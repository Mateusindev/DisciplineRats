"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, StatTile, textareaCls } from "@/components/ui";
import { XP, award, getDateStr, shiftDate, journalHasContent, journalStreak } from "@/lib/state";

// campos simples (textarea única)
const SIMPLE_FIELDS = [
  { key: "gratitude", label: "GRATIDÃO", icon: "favorite", hint: "Pelo que você é grato hoje? Três coisas bastam.", ph: "Sou grato por...", rows: 3 },
  { key: "dump", label: "DESPEJO DE EMOÇÕES", icon: "cyclone", hint: "Sem filtro. O que está pesando, girando na cabeça, incomodando.", ph: "O que está na minha cabeça agora...", rows: 5 },
  { key: "intention", label: "INTENÇÃO PRA AMANHÃ", icon: "wb_twilight", hint: "Uma linha: como você quer que o amanhã seja.", ph: "Amanhã eu quero...", rows: 2 },
];

// controle do dia: 1 situação positiva + 1 negativa, e como VOCÊ contribuiu pra cada
const CONTROL_FIELDS = [
  { key: "posSituation", label: "SITUAÇÃO POSITIVA", ph: "Algo bom que aconteceu hoje..." },
  { key: "posContribution", label: "COMO EU CONTRIBUÍ", ph: "O que eu fiz pra isso acontecer..." },
  { key: "negSituation", label: "SITUAÇÃO NEGATIVA", ph: "Algo ruim que aconteceu hoje..." },
  { key: "negContribution", label: "COMO EU CONTRIBUÍ", ph: "Minha parcela nisso — o que eu poderia ter feito diferente..." },
];

const ALL_KEYS = [...SIMPLE_FIELDS.map((f) => f.key), ...CONTROL_FIELDS.map((f) => f.key)];
const LIMITS = { gratitude: 2000, dump: 4000, intention: 1000, posSituation: 1500, posContribution: 1500, negSituation: 1500, negContribution: 1500 };

function fmtDate(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
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

  const past = Object.entries(state.journal || {})
    .filter(([d, e]) => d !== today && journalHasContent(e))
    .sort((a, b) => (a[0] < b[0] ? 1 : -1));

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
      for (const k of ALL_KEYS) clean[k] = (draft[k] || "").trim().slice(0, LIMITS[k] || 2000);
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
      <PageHeader title="DIÁRIO" subtitle="Gratidão, controle do dia e despejo de emoções. Escrever rende XP — 1× por dia." />

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

        {/* gratidão */}
        {(() => {
          const f = SIMPLE_FIELDS[0];
          return (
            <div key={f.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <MI name={f.icon} className="text-primary-container text-lg" />
                <Caps className="text-on-surface">{f.label}</Caps>
              </div>
              <p className="text-[11px] text-outline">{f.hint}</p>
              {ta(f)}
            </div>
          );
        })()}

        {/* controle do dia — bloco estruturado */}
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

        {/* despejo + intenção */}
        {SIMPLE_FIELDS.slice(1).map((f) => (
          <div key={f.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <MI name={f.icon} className="text-primary-container text-lg" />
              <Caps className="text-on-surface">{f.label}</Caps>
            </div>
            <p className="text-[11px] text-outline">{f.hint}</p>
            {ta(f)}
          </div>
        ))}

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

      {/* histórico */}
      {past.length > 0 && (
        <section className="space-y-4">
          <h3 className="font-headline-md text-headline-md text-primary">ENTRADAS ANTERIORES</h3>
          {past.map(([d, e]) => (
            <details key={d} className="glass-card rounded-xl overflow-hidden group">
              <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-3 hover:bg-surface-variant/20 transition">
                <div className="flex items-center gap-3 min-w-0">
                  <MI name="event_note" className="text-primary-container shrink-0" />
                  <span className="font-headline-md text-headline-md text-on-surface capitalize truncate">{fmtDate(d)}</span>
                </div>
                <MI name="expand_more" className="text-outline transition group-open:rotate-180 shrink-0" />
              </summary>
              <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                <PastField e={e} k="gratitude" label="GRATIDÃO" />
                {(e.posSituation || e.posContribution) && (
                  <div className="space-y-2">
                    <Caps className="text-primary text-[10px]">CONTROLE · POSITIVO</Caps>
                    <PastLine label="Situação" v={e.posSituation} />
                    <PastLine label="Minha contribuição" v={e.posContribution} />
                  </div>
                )}
                {(e.negSituation || e.negContribution) && (
                  <div className="space-y-2">
                    <Caps className="text-error text-[10px]">CONTROLE · NEGATIVO</Caps>
                    <PastLine label="Situação" v={e.negSituation} />
                    <PastLine label="Minha contribuição" v={e.negContribution} />
                  </div>
                )}
                {e.win && <PastField e={e} k="win" label="CONTROLE DO DIA (ANTIGO)" />}
                <PastField e={e} k="dump" label="DESPEJO DE EMOÇÕES" />
                <PastField e={e} k="intention" label="INTENÇÃO PRA AMANHÃ" />
                <button
                  onClick={() => {
                    setSelDate(d);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="mt-2 px-4 py-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-primary font-label-caps text-[10px] flex items-center gap-1.5 active:scale-95 transition"
                >
                  <MI name="edit" className="text-sm" /> EDITAR ESTE DIA
                </button>
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}

function PastField({ e, k, label }) {
  if (!(e[k] || "").trim()) return null;
  return (
    <div className="space-y-1">
      <Caps className="text-outline text-[10px]">{label}</Caps>
      <p className="text-body-md text-on-surface-variant whitespace-pre-wrap">{e[k]}</p>
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
