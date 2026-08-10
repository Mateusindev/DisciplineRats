"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, StatTile, textareaCls } from "@/components/ui";
import { XP, award, getDateStr, shiftDate, weekdayShort, journalHasContent, journalStreak, JOURNAL_LEGACY_FIELDS } from "@/lib/state";

// blocos de texto livre, na ordem em que aparecem no formulário.
// `dump` guarda o relato do dia — era o antigo "despejo de emoções".
const SIMPLE_FIELDS = [
  { key: "gratitude", label: "GRATIDÃO", icon: "favorite", hint: "Pelo que você é grato hoje? Três coisas bastam.", ph: "Sou grato por...", rows: 3 },
  { key: "memory", label: "MEMÓRIA DO DIA", icon: "photo_camera", hint: "O momento deste dia que vale guardar. É o que você vai reler daqui a um ano.", ph: "Quero lembrar de...", rows: 3 },
  { key: "dump", label: "COMO FOI O DIA", icon: "edit_note", hint: "Conte seu dia brevemente — o que aconteceu, como você estava. Sem tamanho mínimo.", ph: "Hoje...", rows: 6 },
];

// controle do dia: 1 situação positiva + 1 negativa, e como VOCÊ contribuiu pra cada
const CONTROL_FIELDS = [
  { key: "posSituation", label: "SITUAÇÃO POSITIVA", ph: "Algo bom que aconteceu hoje..." },
  { key: "posContribution", label: "COMO EU CONTRIBUÍ", ph: "O que eu fiz pra isso acontecer..." },
  { key: "negSituation", label: "SITUAÇÃO NEGATIVA", ph: "Algo ruim que aconteceu hoje..." },
  { key: "negContribution", label: "COMO EU CONTRIBUÍ", ph: "Minha parcela nisso — o que eu poderia ter feito diferente..." },
];

const ALL_KEYS = [...SIMPLE_FIELDS.map((f) => f.key), ...CONTROL_FIELDS.map((f) => f.key)];
const LIMITS = { gratitude: 2000, memory: 2000, dump: 4000, posSituation: 1500, posContribution: 1500, negSituation: 1500, negContribution: 1500 };

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function fmtDate(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}
// "2026-08" → "AGOSTO 2026"
const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const dayNum = (d) => Number(d.slice(8, 10));

// primeiro texto preenchido da entrada, pro preview do card
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
  const alreadyAwarded = !!entry.xpAwarded;
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
      const clean = { xpAwarded: cur.xpAwarded || false };
      // campos que o formulário não escreve mais continuam guardados como estavam
      for (const k of JOURNAL_LEGACY_FIELDS) if ((cur[k] || "").trim()) clean[k] = cur[k];
      // campo vazio some da entrada em vez de virar string vazia
      for (const k of ALL_KEYS) {
        const v = (draft[k] || "").trim().slice(0, LIMITS[k] || 2000);
        if (v) clean[k] = v;
      }
      let stats = prev.stats;
      // XP só pelo dia de hoje (edição retroativa não rende XP — evita farm)
      if (isToday && !cur.xpAwarded && journalHasContent(clean)) {
        clean.xpAwarded = true;
        stats = { ...stats, xp: (stats.xp || 0) + award(XP.journal, stats.streak) };
      }
      return { ...prev, journal: { ...(prev.journal || {}), [selDate]: clean }, stats };
    });
    toast("Diário salvo", {
      sub: isToday ? (alreadyAwarded ? "Registro atualizado" : `+${XP.journal} XP · reflexão do dia`) : "Registro retroativo salvo",
      icon: "book",
    });
  }

  // função (não componente) — inlina o JSX pra não remontar o textarea a cada tecla
  const ta = (f) => <textarea value={draft[f.key]} onChange={setField(f.key)} placeholder={f.ph} rows={f.rows || 3} className={textareaCls} />;

  return (
    <div className="space-y-8">
      <PageHeader title="DIÁRIO" subtitle="Gratidão, memória do dia, relato e controle. Escrever rende XP — 1× por dia." />

      {/* stats */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-card-gap">
        <StatTile label="SEQUÊNCIA" value={`${streak} ${streak === 1 ? "DIA" : "DIAS"}`}>
          <MI name="local_fire_department" fill className="flame-active text-2xl" />
        </StatTile>
        <StatTile label="DIAS ESCRITOS" value={totalDays}>
          <MI name="book" className="text-primary-container" />
        </StatTile>
        <StatTile label="HOJE" value={alreadyAwarded ? "FEITO" : `+${XP.journal} XP`}>
          <MI name={alreadyAwarded ? "check_circle" : "stars"} fill className="text-primary-container" />
        </StatTile>
      </section>

      {/* entrada de hoje */}
      <section className="glass-card p-6 md:p-8 rounded-xl space-y-6">
        {/* navegador de datas */}
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => goDay(-1)} aria-label="Dia anterior" className="w-10 h-10 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-primary flex items-center justify-center active:scale-95 transition shrink-0">
            <MI name="chevron_left" />
          </button>
          <div className="flex flex-col items-center min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-headline-md text-headline-md text-primary">{isToday ? "HOJE" : "DIÁRIO"}</h3>
              {!isToday && (
                <button onClick={() => setSelDate(today)} className="font-label-caps text-[10px] text-primary hover:underline">VOLTAR PRA HOJE</button>
              )}
            </div>
            <button
              onClick={() => dateRef.current?.showPicker?.() ?? dateRef.current?.focus()}
              className="flex items-center gap-1 text-outline hover:text-on-surface-variant transition"
              aria-label="Escolher data"
            >
              <Caps className="capitalize">{fmtDate(selDate)}</Caps>
              <MI name="calendar_month" className="text-sm" />
            </button>
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
          <button onClick={() => goDay(1)} disabled={isToday} aria-label="Próximo dia" className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition ${isToday ? "bg-surface-variant/40 text-outline cursor-not-allowed" : "bg-surface-container-high text-on-surface-variant hover:text-primary active:scale-95"}`}>
            <MI name="chevron_right" />
          </button>
        </div>
        {!isToday && (
          <Caps className="text-outline text-[10px] flex items-center gap-1"><MI name="history_edu" className="text-sm" /> REGISTRO RETROATIVO — NÃO RENDE XP</Caps>
        )}

        {/* gratidão · memória · relato do dia */}
        {SIMPLE_FIELDS.map((f) => (
          <div key={f.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <MI name={f.icon} className="text-primary-container text-lg" />
              <Caps className="text-on-surface">{f.label}</Caps>
            </div>
            <p className="text-[11px] text-outline">{f.hint}</p>
            {ta(f)}
          </div>
        ))}

        {/* controle do dia — bloco estruturado, por último: é o que exige mais cabeça */}
        <div className="space-y-4 rounded-xl border border-primary-container/20 bg-surface-container-high/40 p-4">
          <div className="flex items-center gap-2">
            <MI name="balance" className="text-primary-container text-lg" />
            <Caps className="text-on-surface">CONTROLE DO DIA</Caps>
          </div>
          <p className="text-[11px] text-outline">
            Pense em uma situação positiva e uma negativa do dia. Em cada uma, reflita como <span className="text-on-surface-variant">você</span> contribuiu pra ela acontecer. Assumir a responsabilidade é assumir o controle da sua vida.
          </p>

          <div className="space-y-3">
            <Caps className="text-primary text-[10px] flex items-center gap-1"><MI name="trending_up" className="text-sm" /> POSITIVO</Caps>
            {CONTROL_FIELDS.slice(0, 2).map((f) => (
              <div key={f.key} className="space-y-1">
                <Caps className="text-outline text-[10px]">{f.label}</Caps>
                {ta({ ...f, rows: 2 })}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Caps className="text-error text-[10px] flex items-center gap-1"><MI name="trending_down" className="text-sm" /> NEGATIVO</Caps>
            {CONTROL_FIELDS.slice(2, 4).map((f) => (
              <div key={f.key} className="space-y-1">
                <Caps className="text-outline text-[10px]">{f.label}</Caps>
                {ta({ ...f, rows: 2 })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Caps className="text-outline text-[10px]">
            {!isToday
              ? "REGISTRO RETROATIVO — NÃO RENDE XP"
              : alreadyAwarded
                ? "XP DO DIA JÁ CREDITADO — EDIÇÕES NÃO DÃO XP EXTRA"
                : draftHasContent
                  ? `SALVAR RENDE +${XP.journal} XP`
                  : "PREENCHA AO MENOS UM CAMPO"}
          </Caps>
          <button
            onClick={save}
            disabled={!draftHasContent}
            className={`px-6 py-3 rounded-xl font-label-caps text-label-caps flex items-center gap-2 active:scale-95 transition ${
              draftHasContent ? "bg-primary-container text-on-primary-container" : "bg-surface-variant text-outline cursor-not-allowed"
            }`}
          >
            <MI name="save" /> SALVAR
          </button>
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
// HISTÓRICO — navegação por mês + grade de dias + painel de leitura
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
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="font-headline-md text-headline-md text-primary">ENTRADAS ANTERIORES</h3>
        <Caps className="text-outline text-[10px]">{entries.length} {entries.length === 1 ? "DIA ESCRITO" : "DIAS ESCRITOS"}</Caps>
      </div>

      {/* navegador de mês: idx 0 = mês mais recente, então "anterior" anda pra frente no array */}
      <div className="glass-card rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <button
          onClick={() => goMonth(1)}
          disabled={idx >= months.length - 1}
          aria-label="Mês anterior"
          className={`w-9 h-9 rounded-full grid place-items-center transition ${idx >= months.length - 1 ? "text-outline/40 cursor-not-allowed" : "bg-surface-container text-on-surface-variant hover:text-primary active:scale-95"}`}
        >
          <MI name="chevron_left" />
        </button>
        <div className="text-center min-w-0">
          <span className="font-headline-md text-headline-md text-on-surface uppercase">{monthLabel(ym)}</span>
          <Caps className="block text-outline text-[10px]">{days.length} {days.length === 1 ? "ENTRADA" : "ENTRADAS"}</Caps>
        </div>
        <button
          onClick={() => goMonth(-1)}
          disabled={idx <= 0}
          aria-label="Próximo mês"
          className={`w-9 h-9 rounded-full grid place-items-center transition ${idx <= 0 ? "text-outline/40 cursor-not-allowed" : "bg-surface-container text-on-surface-variant hover:text-primary active:scale-95"}`}
        >
          <MI name="chevron_right" />
        </button>
      </div>

      {/* grade de dias do mês */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-card-gap">
        {days.map(([d, e]) => {
          const active = open === d;
          return (
            <button
              key={d}
              onClick={() => setOpen(active ? null : d)}
              aria-expanded={active}
              className={`glass-card rounded-xl p-4 text-left flex gap-4 transition hover:border-primary-container/40 ${
                active ? "border-primary-container/60 bg-surface-container-high/50" : ""
              }`}
            >
              <div className="flex flex-col items-center justify-start shrink-0 w-11">
                <span className={`font-headline-lg text-headline-lg leading-none ${active ? "text-primary" : "text-on-surface"}`}>{dayNum(d)}</span>
                <Caps className="text-outline text-[10px] mt-1 uppercase">{weekdayShort(d)}</Caps>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-body-md text-on-surface-variant line-clamp-3">{preview(e)}</p>
                <div className="flex items-center gap-1.5 text-outline">
                  {marks(e).map((m) => (
                    <span key={m.icon} title={m.label} className="flex">
                      <MI name={m.icon} className="text-sm" />
                    </span>
                  ))}
                  <MI name={active ? "expand_less" : "expand_more"} className="text-sm ml-auto" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* painel de leitura do dia aberto */}
      {openEntry && (
        <article className="glass-card rounded-xl p-6 md:p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-headline-md text-headline-md text-primary capitalize">{fmtDate(open)}</h4>
              <Caps className="text-outline text-[10px]">{open.split("-").reverse().join("/")}</Caps>
            </div>
            <button onClick={() => setOpen(null)} aria-label="Fechar" className="w-9 h-9 rounded-full bg-surface-container text-on-surface-variant hover:text-primary grid place-items-center active:scale-95 transition shrink-0">
              <MI name="close" />
            </button>
          </div>

          <PastField e={openEntry} k="gratitude" label="GRATIDÃO" icon="favorite" />
          <PastField e={openEntry} k="memory" label="MEMÓRIA DO DIA" icon="photo_camera" />
          <PastField e={openEntry} k="dump" label="COMO FOI O DIA" icon="edit_note" />

          {(openEntry.posSituation || openEntry.posContribution || openEntry.negSituation || openEntry.negContribution) && (
            <div className="rounded-xl border border-primary-container/20 bg-surface-container-high/40 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <MI name="balance" className="text-primary-container text-lg" />
                <Caps className="text-on-surface">CONTROLE DO DIA</Caps>
              </div>
              {(openEntry.posSituation || openEntry.posContribution) && (
                <div className="space-y-1">
                  <Caps className="text-primary text-[10px] flex items-center gap-1"><MI name="trending_up" className="text-sm" /> POSITIVO</Caps>
                  <PastLine label="Situação" v={openEntry.posSituation} />
                  <PastLine label="Minha contribuição" v={openEntry.posContribution} />
                </div>
              )}
              {(openEntry.negSituation || openEntry.negContribution) && (
                <div className="space-y-1">
                  <Caps className="text-error text-[10px] flex items-center gap-1"><MI name="trending_down" className="text-sm" /> NEGATIVO</Caps>
                  <PastLine label="Situação" v={openEntry.negSituation} />
                  <PastLine label="Minha contribuição" v={openEntry.negContribution} />
                </div>
              )}
            </div>
          )}

          {/* campos de versões antigas do formulário — só aparecem se o dia tiver */}
          <PastField e={openEntry} k="intention" label="INTENÇÃO PRA AMANHÃ (ANTIGO)" icon="wb_twilight" />
          <PastField e={openEntry} k="win" label="CONTROLE DO DIA (ANTIGO)" icon="history_edu" />

          <button
            onClick={() => onEdit(open)}
            className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-primary font-label-caps text-[10px] flex items-center gap-1.5 active:scale-95 transition"
          >
            <MI name="edit" className="text-sm" /> EDITAR ESTE DIA
          </button>
        </article>
      )}
    </section>
  );
}

function PastField({ e, k, label, icon }) {
  if (!(e[k] || "").trim()) return null;
  return (
    <div className="space-y-1.5">
      <Caps className="text-outline text-[10px] flex items-center gap-1.5">
        {icon && <MI name={icon} className="text-sm" />}
        {label}
      </Caps>
      <p className="text-body-md text-on-surface whitespace-pre-wrap">{e[k]}</p>
    </div>
  );
}

function PastLine({ label, v }) {
  if (!(v || "").trim()) return null;
  return (
    <p className="text-body-md text-on-surface-variant whitespace-pre-wrap">
      <span className="text-outline text-[11px]">{label}: </span>
      {v}
    </p>
  );
}
