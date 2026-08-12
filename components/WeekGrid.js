"use client";

// GRADE SEMANAL — sete colunas de dia, horas no eixo Y, evento posicionado no
// horário real. É a visão que responde "quando eu tenho espaço?", que a grade do
// mês não responde: lá o dia é um quadradinho e a hora não existe.
//
// Três coisas que a referência não precisava resolver e aqui precisam:
//   1. evento de DIA INTEIRO não tem onde morar numa régua de horas → faixa
//      própria acima da grade, senão ele sumiria da semana;
//   2. evento fora da janela padrão (madrugada, depois das 23h) → a janela se
//      estica pra caber tudo, porque agenda que esconde compromisso é pior que
//      agenda feia;
//   3. eventos que se sobrepõem → dividem a largura em colunas, senão um cobre o
//      outro e você marca duas coisas no mesmo horário sem ver.

import { useEffect, useRef, useState } from "react";
import { format, addDays, startOfWeek, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MI, Caps } from "@/components/ui";
import { calCat, eventTimeLabel } from "@/lib/state";

const ds = (d) => format(d, "yyyy-MM-dd");
const HOUR_H = 56; // altura de uma hora, em px
const DEFAULT_FROM = 6; // janela padrão: 06:00
const DEFAULT_TO = 23; // ... até 23:00 (a linha das 23h fecha a grade)
const CHIP_H = 19; // altura de um chip de rotina
const CHIP_GAP = 2;

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};

// início/fim do evento em minutos. Sem fim, assume 1h — bloco de altura zero não
// seria clicável. Fim antes do início (virou o dia) para à meia-noite.
function span(ev) {
  const s = toMin(ev.start);
  if (s === null) return null;
  let e = toMin(ev.end);
  if (e === null || e <= s) e = Math.min(s + 60, 24 * 60);
  return { s, e };
}

// Onde cada chip de rotina cabe. Rotina é um instante, não um intervalo: dois
// itens com dez minutos de diferença ocupariam o mesmo lugar na régua, e um
// esconderia o outro. O de baixo é empurrado até caber.
//
// Ele também desvia dos EVENTOS, que ficam com a largura cheia da coluna — o
// compromisso é o conteúdo principal e não deve ser espremido pela rotina. Sem
// desviar, um evento cobriria o chip e tiraria o clique dele.
//
// O deslocamento não engana porque cada chip mostra a hora escrita.
function stackRoutine(items, topOf, blocks = []) {
  let lastBottom = -Infinity;
  return [...items]
    .sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")))
    .map((r) => {
      let top = Math.max(topOf(toMin(r.start)) + 1, lastBottom);
      // desce até sair de cima de qualquer evento (guard: nº de blocos + 1)
      for (let guard = 0; guard <= blocks.length; guard++) {
        const hit = blocks.find((b) => top < b.bottom && top + CHIP_H > b.top);
        if (!hit) break;
        top = hit.bottom + CHIP_GAP;
      }
      lastBottom = top + CHIP_H + CHIP_GAP;
      return { r, top };
    });
}

// Reparte eventos que se sobrepõem em colunas lado a lado. Agrupa em blocos
// conectados (um evento longo pode ligar dois que não se tocam) e dentro do bloco
// aloca a primeira coluna livre.
function layout(events) {
  const timed = events.map((ev) => ({ ev, ...span(ev) })).filter((x) => x.s !== null).sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const cols = []; // cols[i] = fim do último evento naquela coluna
    for (const item of cluster) {
      let c = cols.findIndex((end) => end <= item.s);
      if (c === -1) {
        c = cols.length;
        cols.push(item.e);
      } else {
        cols[c] = item.e;
      }
      item.col = c;
    }
    for (const item of cluster) out.push({ ...item, cols: cols.length });
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of timed) {
    if (cluster.length && item.s >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.e);
  }
  flush();
  return out;
}

// Item de rotina: bloco fantasma, tracejado e apagado, marcável no clique. Sai
// visualmente da frente dos compromissos de propósito — rotina é ritmo, e ela
// não entra na contagem de eventos por isso mesmo.
function RoutineChip({ r, date, today, onToggle, style, className = "" }) {
  const future = date > today;
  return (
    <button
      onClick={() => onToggle(date, r.itemId)}
      aria-pressed={r.done}
      disabled={future}
      title={`${future ? "Rotina não se marca no futuro" : r.done ? "Desmarcar" : "Marcar"} ${r.title}${r.start ? ` (${r.start})` : ""}${
        r.habitId ? " · vinculado a um hábito" : ""
      }`}
      style={style}
      className={`flex items-center gap-1 px-1 rounded border border-dashed text-[10px] leading-tight transition ${
        r.done
          ? "border-primary-container/40 bg-primary-container/10 text-primary line-through"
          : "border-outline/30 bg-surface-container/80 text-on-surface-variant hover:border-primary-container/50 hover:bg-primary/[0.06]"
      } ${future ? "opacity-40 cursor-not-allowed" : ""} ${className}`}
    >
      <MI name={r.done ? "check_circle" : "radio_button_unchecked"} className="text-[11px] shrink-0" />
      {/* a hora vai escrita: o chip pode ter sido empurrado pra baixo pra não
          cobrir o vizinho, e sem ela a posição viraria uma informação errada */}
      {r.start && <span className="tabular-nums text-outline shrink-0">{r.start}</span>}
      <span className="truncate">{r.title}</span>
      {r.habitId && <MI name="link" className="text-[10px] shrink-0 opacity-70" />}
    </button>
  );
}

export default function WeekGrid({ anchor, setAnchor, eventsOn, routineOn, routineStats, onToggleRoutine, onAdd, onEdit }) {
  const scrollRef = useRef(null);
  const [now, setNow] = useState(() => new Date());

  // relógio da linha de agora: de minuto em minuto. Sem isso a linha congela na
  // hora em que a página abriu e passa a mentir sobre o presente.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 }); // semana começa na segunda, igual ao resto do app
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = days.map((d) => eventsOn(d));
  // Rotina entra na grade, no horário dela — não na contagem de eventos. Ela é
  // ritmo, não compromisso: por isso é um bloco fantasma (tracejado, apagado) e
  // marcável no clique, em vez de abrir o editor de evento.
  const routineByDay = days.map((d) => routineOn(d));

  // janela de horas: começa na padrão e se estica pra caber o que existir
  let from = DEFAULT_FROM;
  let to = DEFAULT_TO;
  for (const list of [...byDay, ...routineByDay]) {
    for (const ev of list) {
      if (ev.allDay) continue;
      const sp = span(ev);
      if (!sp) continue;
      from = Math.min(from, Math.floor(sp.s / 60));
      to = Math.max(to, Math.ceil(sp.e / 60));
    }
  }
  to = Math.min(to, 24);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const gridH = hours.length * HOUR_H;
  const topOf = (min) => ((min - from * 60) / 60) * HOUR_H;

  // rola até o começo da janela útil na primeira pintura (senão abre às 00:00
  // quando algum evento de madrugada esticou a régua)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = Math.max(0, (DEFAULT_FROM - from) * HOUR_H - 8);
  }, [from]);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowInWindow = nowMin >= from * 60 && nowMin <= to * 60;
  const nowCol = days.findIndex((d) => isSameDay(d, now));

  const label =
    format(weekStart, "d", { locale: ptBR }) +
    (format(weekStart, "LLL", { locale: ptBR }) === format(days[6], "LLL", { locale: ptBR })
      ? ` a ${format(days[6], "d 'de' LLLL", { locale: ptBR })}`
      : ` de ${format(weekStart, "LLL", { locale: ptBR })} a ${format(days[6], "d 'de' LLLL", { locale: ptBR })}`);

  const allDayRow = byDay.map((evs) => evs.filter((e) => e.allDay));
  const looseRoutine = routineByDay.map((list) => list.filter((r) => !r.start)); // rotina sem hora
  const hasAllDay = allDayRow.some((l) => l.length) || looseRoutine.some((l) => l.length);
  const todayStr = ds(now);

  return (
    <div className="w-full flex flex-col bg-surface-container rounded-2xl border border-outline-variant/20 overflow-hidden">
      {/* ---- cabeçalho: intervalo da semana + navegação ---- */}
      <div className="flex items-center justify-between gap-3 p-3 bg-surface-container-high">
        <div className="min-w-0">
          <Caps className="text-primary text-[9px] block">VISUALIZAÇÃO SEMANAL</Caps>
          <h1 className="font-headline-md text-headline-md text-on-surface leading-none truncate capitalize">{label}</h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setAnchor(addDays(weekStart, -7))}
            aria-label="Semana anterior"
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-variant grid place-items-center text-on-surface transition"
          >
            <MI name="chevron_left" className="text-[20px]" />
          </button>
          <button
            onClick={() => {
              setAnchor(new Date());
              setSelected(new Date());
            }}
            className="px-3 h-8 rounded-full bg-surface-container hover:bg-surface-variant text-on-surface font-label-caps text-[10px] transition"
          >
            HOJE
          </button>
          <button
            onClick={() => setAnchor(addDays(weekStart, 7))}
            aria-label="Próxima semana"
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-variant grid place-items-center text-on-surface transition"
          >
            <MI name="chevron_right" className="text-[20px]" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto ff-scroll">
        <div className="min-w-[700px]">
          {/* ---- faixa dos dias ---- */}
          <div className="grid border-y border-outline-variant/15 bg-surface-container-high" style={{ gridTemplateColumns: "3.5rem repeat(7, 1fr)" }}>
            <div className="flex items-end justify-end p-1">
              <span className="text-[9px] font-label-caps text-outline/60">{format(now, "OOO")}</span>
            </div>
            {days.map((d) => {
              const isNow = isToday(d);
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={ds(d)} className={`py-2 flex flex-col items-center justify-center gap-0.5 ${isNow ? "bg-primary-container/10" : ""}`}>
                  <Caps className={`text-[9px] uppercase ${isNow ? "text-primary" : weekend ? "text-outline/60" : "text-on-surface-variant"}`}>
                    {format(d, "EEE", { locale: ptBR })}
                  </Caps>
                  <span
                    className={`w-6 h-6 grid place-items-center rounded-full text-[13px] tabular-nums ${
                      isNow ? "border border-primary-container text-primary font-bold" : "text-on-surface"
                    }`}
                  >
                    {format(d, "d")}
                  </span>
                  {/* fechamento da rotina do dia. Aqui em cima porque a grade já é
                      a semana inteira — um gráfico separado de 7 dias repetiria o
                      que estas sete colunas mostram. */}
                  {(() => {
                    const rs = routineStats(d);
                    if (!rs.total) return null;
                    return (
                      <span
                        className={`flex items-center gap-0.5 text-[9px] tabular-nums font-label-caps ${rs.complete ? "text-primary" : "text-outline"}`}
                        title={`Rotina: ${rs.done} de ${rs.total}`}
                      >
                        <MI name={rs.complete ? "task_alt" : "checklist"} className="text-[11px]" />
                        {rs.done}/{rs.total}
                      </span>
                    );
                  })()}
                </div>
              );
            })}
          </div>

          {/* ---- dia inteiro: fora da régua de horas, porque não tem hora ---- */}
          {hasAllDay && (
            <div className="grid border-b border-outline-variant/15 bg-surface-container-low" style={{ gridTemplateColumns: "3.5rem repeat(7, 1fr)" }}>
              <div className="flex items-center justify-end pr-1.5 py-1">
                <Caps className="text-outline/60 text-[8px]">DIA</Caps>
              </div>
              {allDayRow.map((evs, i) => (
                <div key={ds(days[i])} className="p-1 space-y-1 min-h-[2rem] border-l border-outline-variant/10">
                  {evs.map((ev) => {
                    const cat = calCat(ev.cat);
                    return (
                      <button
                        key={ev.id}
                        onClick={() => onEdit(ds(days[i]), ev)}
                        title={ev.title}
                        className="w-full text-left px-1.5 py-1 rounded text-[10px] leading-tight truncate hover:brightness-110 transition"
                        style={{ background: `${cat.color}22`, color: cat.color, borderLeft: `2px solid ${cat.color}` }}
                      >
                        {ev.title}
                      </button>
                    );
                  })}
                  {/* rotina sem hora: cabe aqui, junto do que também não tem horário */}
                  {looseRoutine[i].map((r) => (
                    <RoutineChip key={r.id} r={r} date={ds(days[i])} today={todayStr} onToggle={onToggleRoutine} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ---- grade de horas ---- */}
          <div ref={scrollRef} className="overflow-y-auto ff-scroll" style={{ maxHeight: "60vh" }}>
            <div className="grid relative" style={{ gridTemplateColumns: "3.5rem repeat(7, 1fr)", height: gridH }}>
              {/* eixo Y */}
              <div className="relative bg-surface-container">
                {hours.map((h, i) => (
                  <div
                    key={h}
                    // a primeira etiqueta não centraliza na linha, senão metade dela
                    // sai pra fora do topo e a grade fica sem hora de início
                    className={`absolute right-1.5 text-[10px] tabular-nums text-outline ${i === 0 ? "" : "-translate-y-1/2"}`}
                    style={{ top: i * HOUR_H }}
                  >
                    {`${String(h).padStart(2, "0")}:00`}
                  </div>
                ))}
              </div>

              {/* colunas de dia */}
              {days.map((d, di) => {
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                const isNow = isToday(d);
                const placed = layout(byDay[di].filter((e) => !e.allDay));
                const timedRoutine = routineByDay[di].filter((r) => r.start);
                // retângulos dos eventos, pra rotina desviar deles
                const blocks = placed.map(({ s, e }) => ({ top: topOf(s), bottom: topOf(s) + Math.max(((e - s) / 60) * HOUR_H - 2, 18) }));
                return (
                  <div
                    key={ds(d)}
                    className={`relative border-l border-outline-variant/15 ${isNow ? "bg-primary-container/[0.04]" : weekend ? "bg-surface-container/40" : ""}`}
                  >
                    {/* linhas de hora + clique no vazio cria evento naquele horário */}
                    {hours.map((h, i) => (
                      <button
                        key={h}
                        onClick={() => onAdd(d, `${String(h).padStart(2, "0")}:00`)}
                        aria-label={`Novo evento ${format(d, "d/MM")} ${h}:00`}
                        className="absolute left-0 right-0 border-t border-outline-variant/15 hover:bg-primary/[0.06] transition"
                        style={{ top: i * HOUR_H, height: HOUR_H }}
                      />
                    ))}

                    {/* rotina com hora: empilhada pra não se cobrir, e estreita
                        pra não disputar espaço com o compromisso daquele horário */}
                    {stackRoutine(timedRoutine, topOf, blocks).map(({ r, top }) => (
                      <RoutineChip
                        key={r.id}
                        r={r}
                        date={ds(d)}
                        today={todayStr}
                        onToggle={onToggleRoutine}
                        className="absolute z-[5]"
                        style={{ top, left: 2, width: "calc(100% - 4px)", height: CHIP_H }}
                      />
                    ))}

                    {/* eventos */}
                    {placed.map(({ ev, s, e, col, cols }) => {
                      const cat = calCat(ev.cat);
                      const top = topOf(s);
                      const h = Math.max(((e - s) / 60) * HOUR_H - 2, 18);
                      const w = 100 / cols; // largura cheia da coluna, repartida só entre eventos simultâneos
                      const short = h < 34;
                      return (
                        <button
                          key={ev.id}
                          onClick={() => onEdit(ds(d), ev)}
                          title={`${eventTimeLabel(ev)} · ${ev.title}`}
                          className="absolute rounded-md overflow-hidden flex text-left shadow-sm hover:brightness-125 hover:z-20 transition"
                          style={{
                            top,
                            height: h,
                            left: `calc(${col * w}% + 2px)`,
                            width: `calc(${w}% - 4px)`,
                            background: `${cat.color}1f`,
                            zIndex: 10 + col,
                          }}
                        >
                          <span className="w-[3px] shrink-0" style={{ background: cat.color }} />
                          <span className="px-1.5 py-0.5 min-w-0 flex-1 flex flex-col justify-start">
                            <span className="text-[11px] leading-tight font-semibold truncate" style={{ color: cat.color }}>
                              {ev.title}
                            </span>
                            {!short && <span className="text-[9px] leading-tight text-on-surface-variant tabular-nums truncate">{eventTimeLabel(ev)}</span>}
                          </span>
                          {ev.source === "workout" ? (
                            <MI name="fitness_center" className="text-[11px] text-outline shrink-0 mt-0.5 mr-0.5" />
                          ) : ev.ruleId ? (
                            <MI name="repeat" className="text-[11px] text-outline shrink-0 mt-0.5 mr-0.5" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* linha de agora — só quando a semana atual está na tela */}
              {nowInWindow && nowCol >= 0 && (
                <div className="absolute left-14 right-0 pointer-events-none z-30" style={{ top: topOf(nowMin) }}>
                  <div className="relative h-px bg-error">
                    <span className="absolute -left-1 -top-[3px] w-[7px] h-[7px] rounded-full bg-error" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
