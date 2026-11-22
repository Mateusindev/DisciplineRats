"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useApp } from "../AppContext";
import { MI, PageHeader, textareaCls } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { getDateStr, shiftDate, weekdayShort, journalHasContent, journalStreak, JOURNAL_LEGACY_FIELDS } from "@/lib/state";

// blocos de texto livre, na ordem em que aparecem no formulário.
// `dump` guarda o relato do dia — era o antigo "despejo de emoções".
const SIMPLE_FIELDS = [
  { key: "gratitude", label: "Gratidão", hint: "Pelo que você é grato hoje? Três coisas bastam.", ph: "Sou grato por...", rows: 3 },
  { key: "memory", label: "Memória do dia", hint: "O momento deste dia que vale guardar. É o que você vai reler daqui a um ano.", ph: "Quero lembrar de...", rows: 3 },
  { key: "dump", label: "Como foi o dia", hint: "Conte seu dia brevemente — o que aconteceu, como você estava. Sem tamanho mínimo.", ph: "Hoje...", rows: 6 },
];

// controle do dia: 1 situação positiva + 1 negativa, e como VOCÊ contribuiu pra cada
const CONTROL_FIELDS = [
  { key: "posSituation", label: "Situação positiva", ph: "Algo bom que aconteceu hoje..." },
  { key: "posContribution", label: "Como eu contribuí", ph: "O que eu fiz pra isso acontecer..." },
  { key: "negSituation", label: "Situação negativa", ph: "Algo ruim que aconteceu hoje..." },
  { key: "negContribution", label: "Como eu contribuí", ph: "Minha parcela nisso — o que eu poderia ter feito diferente..." },
];

const ALL_KEYS = [...SIMPLE_FIELDS.map((f) => f.key), ...CONTROL_FIELDS.map((f) => f.key)];
const LIMITS = { gratitude: 2000, memory: 2000, dump: 4000, posSituation: 1500, posContribution: 1500, negSituation: 1500, negContribution: 1500 };

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function fmtDate(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}
// versão curta pro seletor de data do editor: "seg., 26 de out."
function fmtDateShort(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}
// "2026-08" → "agosto 2026" (a maiúscula vem do CSS)
const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const dayNum = (d) => Number(d.slice(8, 10));

// primeiro texto preenchido da entrada, pro preview da linha
function preview(e) {
  for (const k of ["dump", "memory", "gratitude", "posSituation", "negSituation", "intention", "win"]) {
    const v = (e[k] || "").trim();
    if (v) return v;
  }
  return "";
}
// selos do que foi preenchido naquele dia
function marks(e) {
  const has = (k) => (e[k] || "").trim().length > 0;
  return [
    has("gratitude") && { icon: "favorite", label: "Gratidão" },
    has("memory") && { icon: "photo_camera", label: "Memória do dia" },
    has("dump") && { icon: "edit_note", label: "Relato do dia" },
    (has("posSituation") || has("posContribution") || has("negSituation") || has("negContribution")) && { icon: "balance", label: "Controle do dia" },
  ].filter(Boolean);
}

// textarea de escrita: a classe padrão do app, com entrelinha de leitura
const writeCls = `${textareaCls} block leading-relaxed`;

export default function DiarioPage() {
  const { state, setState, toast } = useApp();
  const today = getDateStr(0);
  const [selDate, setSelDate] = useState(today);
  const dateRef = useRef(null);
  const isToday = selDate === today;
  const entry = state.journal?.[selDate] || {};

  const [draft, setDraft] = useState(() => Object.fromEntries(ALL_KEYS.map((k) => [k, entry[k] || ""])));
  // ao trocar o dia selecionado, carrega a entrada daquele dia no editor
  useEffect(() => {
    const e = state.journal?.[selDate] || {};
    setDraft(Object.fromEntries(ALL_KEYS.map((k) => [k, e[k] || ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selDate]);
  const setField = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  const draftHasContent = journalHasContent(draft);
  const alreadySaved = journalHasContent(entry);
  const todayDone = journalHasContent(state.journal?.[today]);
  const streak = journalStreak(state.journal);
  const totalDays = Object.values(state.journal || {}).filter(journalHasContent).length;

  const goDay = (delta) => {
    const next = shiftDate(selDate, delta);
    if (next > today) return; // não navega pro futuro
    setSelDate(next);
  };

  function save() {
    if (!draftHasContent) {
      toast("Escreva algo primeiro", { type: "error" });
      return;
    }
    setState((prev) => {
      const cur = prev.journal?.[selDate] || {};
      const clean = {};
      // campos que o formulário não escreve mais continuam guardados como estavam
      for (const k of JOURNAL_LEGACY_FIELDS) if ((cur[k] || "").trim()) clean[k] = cur[k];
      // campo vazio some da entrada em vez de virar string vazia
      for (const k of ALL_KEYS) {
        const v = (draft[k] || "").trim().slice(0, LIMITS[k] || 2000);
        if (v) clean[k] = v;
      }
      return { ...prev, journal: { ...(prev.journal || {}), [selDate]: clean } };
    });
    toast("Diário salvo", {
      sub: isToday ? (alreadySaved ? "Registro atualizado" : "Reflexão do dia") : "Registro retroativo salvo",
      icon: "book",
    });
  }

  // função (não componente) — inlina o JSX pra não remontar o textarea a cada tecla
  const ta = (f) => (
    <textarea id={`diario-${f.key}`} value={draft[f.key]} onChange={setField(f.key)} placeholder={f.ph} rows={f.rows || 3} className={writeCls} />
  );

  // linha de status do rodapé do editor — só texto, sem destaque
  const status = !draftHasContent
    ? "Preencha ao menos um campo"
    : !isToday
      ? "Registro retroativo"
      : alreadySaved
        ? "Já salvo hoje — salvar de novo atualiza"
        : "Pronto pra salvar";

  return (
    <div className="space-y-6">
      <PageHeader title="Diário" subtitle="Gratidão, memória do dia, relato e controle." />

      {/* stats — um card só, dividido em três colunas */}
      <section className="grid grid-cols-3 divide-x divide-outline-variant rounded-xl border border-outline-variant bg-surface-container">
        <div className="px-4 py-3 sm:px-5 sm:py-4 min-w-0">
          <div className="text-xs text-outline">Sequência</div>
          <div className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight tabular-nums">
            <span className={streak > 0 ? "text-primary-container" : "text-on-surface"}>{streak}</span>
            <span className="ml-1 text-sm font-normal text-on-surface-variant">{streak === 1 ? "dia" : "dias"}</span>
          </div>
        </div>
        <div className="px-4 py-3 sm:px-5 sm:py-4 min-w-0">
          <div className="text-xs text-outline">Dias escritos</div>
          <div className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight tabular-nums text-on-surface">{totalDays}</div>
        </div>
        <div className="px-4 py-3 sm:px-5 sm:py-4 min-w-0">
          <div className="text-xs text-outline">Hoje</div>
          <div className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight tabular-nums text-on-surface truncate">
            {todayDone ? "Feito" : "Pendente"}
          </div>
        </div>
      </section>

      {/* editor da entrada do dia selecionado */}
      <section className="rounded-xl border border-outline-variant bg-surface-container">
        {/* cabeçalho: título à esquerda, navegador de datas compacto à direita */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-outline-variant px-5 py-4 md:px-6">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-on-surface">{isToday ? "Entrada de hoje" : "Entrada retroativa"}</h2>
            <p className="mt-0.5 text-xs text-outline">{isToday ? "Escreva com calma — salve quando terminar." : "Dias passados também podem ser editados."}</p>
          </div>
          <div className="flex items-center gap-1">
            {!isToday && (
              <Button variant="ghost" size="sm" onClick={() => setSelDate(today)} className="text-on-surface-variant">
                Voltar pra hoje
              </Button>
            )}
            <div className="flex items-center rounded-md border border-outline-variant">
              <Button variant="ghost" size="icon-sm" onClick={() => goDay(-1)} aria-label="Dia anterior" className="rounded-r-none text-on-surface-variant">
                <MI name="chevron_left" className="text-[20px]" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dateRef.current?.showPicker?.() ?? dateRef.current?.focus()}
                aria-label="Escolher data"
                className="rounded-none border-x border-outline-variant px-3 font-normal text-on-surface tabular-nums"
              >
                <span className="inline-block first-letter:uppercase">{fmtDateShort(selDate)}</span>
                <MI name="calendar_month" className="text-[16px] text-outline" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => goDay(1)} disabled={isToday} aria-label="Próximo dia" className="rounded-l-none text-on-surface-variant">
                <MI name="chevron_right" className="text-[20px]" />
              </Button>
            </div>
            <input
              ref={dateRef}
              type="date"
              value={selDate}
              max={today}
              onChange={(e) => e.target.value && e.target.value <= today && setSelDate(e.target.value)}
              aria-hidden="true"
              tabIndex={-1}
              className="w-0 h-0 opacity-0 pointer-events-none absolute"
            />
          </div>
        </div>

        <div className="space-y-6 px-5 py-6 md:px-6">
          {/* gratidão · memória · relato do dia */}
          {SIMPLE_FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <div>
                <label htmlFor={`diario-${f.key}`} className="text-sm font-medium text-on-surface">{f.label}</label>
                <p className="mt-0.5 text-xs text-on-surface-variant">{f.hint}</p>
              </div>
              {ta(f)}
            </div>
          ))}

          {/* controle do dia — bloco estruturado, por último: é o que exige mais cabeça */}
          <div className="space-y-4 border-t border-outline-variant pt-6">
            <div>
              <h3 className="text-sm font-semibold text-on-surface">Controle do dia</h3>
              <p className="mt-0.5 text-xs text-on-surface-variant leading-relaxed">
                Pense em uma situação positiva e uma negativa do dia. Em cada uma, reflita como <span className="text-on-surface">você</span> contribuiu pra ela acontecer. Assumir a responsabilidade é assumir o controle da sua vida.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-on-surface">
                  <MI name="trending_up" className="text-[18px] text-outline" /> Positivo
                </div>
                {CONTROL_FIELDS.slice(0, 2).map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <label htmlFor={`diario-${f.key}`} className="text-xs text-on-surface-variant">{f.label}</label>
                    {ta({ ...f, rows: 2 })}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-on-surface">
                  <MI name="trending_down" className="text-[18px] text-outline" /> Negativo
                </div>
                {CONTROL_FIELDS.slice(2, 4).map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <label htmlFor={`diario-${f.key}`} className="text-xs text-on-surface-variant">{f.label}</label>
                    {ta({ ...f, rows: 2 })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* rodapé: status em texto discreto + a única ação primária */}
        <div className="flex items-center justify-between gap-4 border-t border-outline-variant px-5 py-4 md:px-6">
          <p className="text-xs text-outline">{status}</p>
          <Button onClick={save} disabled={!draftHasContent} className="shrink-0">
            <MI name="save" className="text-[18px]" /> Salvar
          </Button>
        </div>
      </section>

      <Historico
        journal={state.journal}
        today={today}
        onEdit={(d) => {
          setSelDate(d);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}

// ============================================================
// HISTÓRICO — navegação por mês + lista de dias com leitura inline
// Só entram meses que TÊM entrada: as setas pulam vazio direto, senão
// navegar num diário começado há pouco vira uma sequência de telas vazias.
// ============================================================
function Historico({ journal, today, onEdit }) {
  const entries = useMemo(
    () =>
      Object.entries(journal || {})
        .filter(([d, e]) => d !== today && journalHasContent(e))
        .sort((a, b) => (a[0] < b[0] ? 1 : -1)),
    [journal, today]
  );

  // meses com entrada, do mais recente pro mais antigo
  const months = useMemo(() => [...new Set(entries.map(([d]) => d.slice(0, 7)))], [entries]);
  const [monthIdx, setMonthIdx] = useState(0);
  const [open, setOpen] = useState(null);
  // apagar/adicionar entradas pode encolher a lista de meses embaixo do índice atual
  const idx = Math.min(monthIdx, Math.max(0, months.length - 1));
  const ym = months[idx];
  const days = useMemo(() => entries.filter(([d]) => d.slice(0, 7) === ym), [entries, ym]);
  const openEntry = open && journal?.[open] ? journal[open] : null;

  if (!entries.length) return null;

  const goMonth = (delta) => {
    const next = idx + delta;
    if (next < 0 || next >= months.length) return;
    setMonthIdx(next);
    setOpen(null);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-on-surface">Entradas anteriores</h2>
          <p className="text-xs text-outline">
            {entries.length} {entries.length === 1 ? "dia escrito" : "dias escritos"} · {days.length} {days.length === 1 ? "entrada" : "entradas"} no mês
          </p>
        </div>
        {/* navegador de mês: idx 0 = mês mais recente, então "anterior" anda pra frente no array */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={() => goMonth(1)} disabled={idx >= months.length - 1} aria-label="Mês anterior" className="text-on-surface-variant">
            <MI name="chevron_left" className="text-[20px]" />
          </Button>
          <span className="min-w-28 text-center text-sm font-medium text-on-surface tabular-nums inline-block first-letter:uppercase">{monthLabel(ym)}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => goMonth(-1)} disabled={idx <= 0} aria-label="Próximo mês" className="text-on-surface-variant">
            <MI name="chevron_right" className="text-[20px]" />
          </Button>
        </div>
      </div>

      {/* lista de dias do mês — o dia aberto se expande ali mesmo */}
      <ul className="divide-y divide-outline-variant overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
        {days.map(([d, e]) => {
          const active = open === d;
          return (
            <li key={d}>
              <button
                onClick={() => setOpen(active ? null : d)}
                aria-expanded={active}
                className={`flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-variant/60 md:px-5 ${active ? "bg-surface-variant/60" : ""}`}
              >
                <span className="w-14 shrink-0 text-sm text-outline tabular-nums">
                  {dayNum(d)} {weekdayShort(d)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{preview(e)}</span>
                <span className="hidden items-center gap-1.5 text-outline sm:flex">
                  {marks(e).map((m) => (
                    <span key={m.icon} title={m.label} className="flex">
                      <MI name={m.icon} className="text-[16px]" />
                    </span>
                  ))}
                </span>
                <MI name="expand_more" className={`text-[18px] text-outline transition-transform ${active ? "rotate-180" : ""}`} />
              </button>

              {/* painel de leitura do dia aberto */}
              {active && openEntry && (
                <article className="space-y-5 border-t border-outline-variant px-4 pb-5 pt-4 md:px-5 md:pl-[5.5rem]">
                  <p className="text-xs text-outline">
                    <span className="inline-block first-letter:uppercase">{fmtDate(open)}</span> · {open.split("-").reverse().join("/")}
                  </p>

                  <PastField e={openEntry} k="gratitude" label="Gratidão" />
                  <PastField e={openEntry} k="memory" label="Memória do dia" />
                  <PastField e={openEntry} k="dump" label="Como foi o dia" />

                  {(openEntry.posSituation || openEntry.posContribution || openEntry.negSituation || openEntry.negContribution) && (
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-on-surface-variant">Controle do dia</div>
                      {(openEntry.posSituation || openEntry.posContribution) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-outline"><MI name="trending_up" className="text-[16px]" /> Positivo</div>
                          <PastLine label="Situação" v={openEntry.posSituation} />
                          <PastLine label="Minha contribuição" v={openEntry.posContribution} />
                        </div>
                      )}
                      {(openEntry.negSituation || openEntry.negContribution) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-outline"><MI name="trending_down" className="text-[16px]" /> Negativo</div>
                          <PastLine label="Situação" v={openEntry.negSituation} />
                          <PastLine label="Minha contribuição" v={openEntry.negContribution} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* campos de versões antigas do formulário — só aparecem se o dia tiver */}
                  <PastField e={openEntry} k="intention" label="Intenção pra amanhã (antigo)" />
                  <PastField e={openEntry} k="win" label="Controle do dia (antigo)" />

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(open)}>
                      <MI name="edit" className="text-[16px]" /> Editar este dia
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setOpen(null)} className="text-on-surface-variant">
                      Fechar
                    </Button>
                  </div>
                </article>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PastField({ e, k, label }) {
  if (!(e[k] || "").trim()) return null;
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-on-surface-variant">{label}</div>
      <p className="text-sm leading-relaxed text-on-surface whitespace-pre-wrap">{e[k]}</p>
    </div>
  );
}

function PastLine({ label, v }) {
  if (!(v || "").trim()) return null;
  return (
    <p className="text-sm leading-relaxed text-on-surface whitespace-pre-wrap">
      <span className="text-on-surface-variant">{label}: </span>
      {v}
    </p>
  );
}
