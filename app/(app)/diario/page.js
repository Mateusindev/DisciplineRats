"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, StatTile, textareaCls } from "@/components/ui";
import { XP, award, getDateStr, journalHasContent, journalStreak } from "@/lib/state";

// campos do diário: chave, rótulo, ícone, placeholder
const FIELDS = [
  { key: "gratitude", label: "GRATIDÃO", icon: "favorite", hint: "Pelo que você é grato hoje? Três coisas bastam.", ph: "Sou grato por..." },
  { key: "win", label: "CONTROLE DO DIA", icon: "military_tech", hint: "O que você fez bem? O que estava sob seu controle e você honrou?", ph: "Hoje eu controlei / venci..." },
  { key: "dump", label: "DESPEJO DE EMOÇÕES", icon: "cyclone", hint: "Sem filtro. O que está pesando, girando na cabeça, incomodando.", ph: "O que está na minha cabeça agora..." },
  { key: "intention", label: "INTENÇÃO PRA AMANHÃ", icon: "wb_twilight", hint: "Uma linha: como você quer que o amanhã seja.", ph: "Amanhã eu quero..." },
];

function fmtDate(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

export default function DiarioPage() {
  const { state, setState, toast } = useApp();
  const today = getDateStr(0);
  const entry = state.journal?.[today] || {};

  const [draft, setDraft] = useState({
    gratitude: entry.gratitude || "",
    win: entry.win || "",
    dump: entry.dump || "",
    intention: entry.intention || "",
  });

  const setField = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  const draftHasContent = journalHasContent(draft);
  const alreadyAwarded = !!entry.xpAwarded;
  const streak = journalStreak(state.journal);
  const totalDays = Object.values(state.journal || {}).filter(journalHasContent).length;

  // entradas passadas (mais recente primeiro, exceto hoje)
  const past = Object.entries(state.journal || {})
    .filter(([d, e]) => d !== today && journalHasContent(e))
    .sort((a, b) => (a[0] < b[0] ? 1 : -1));

  function save() {
    if (!draftHasContent) {
      toast("Escreva algo primeiro", { type: "error" });
      return;
    }
    setState((prev) => {
      const cur = prev.journal?.[today] || {};
      const clean = {
        gratitude: draft.gratitude.trim().slice(0, 2000),
        win: draft.win.trim().slice(0, 2000),
        dump: draft.dump.trim().slice(0, 4000),
        intention: draft.intention.trim().slice(0, 1000),
        xpAwarded: cur.xpAwarded || false,
      };
      let stats = prev.stats;
      if (!cur.xpAwarded && journalHasContent(clean)) {
        clean.xpAwarded = true;
        stats = { ...stats, xp: (stats.xp || 0) + award(XP.journal, stats.streak) };
      }
      return { ...prev, journal: { ...(prev.journal || {}), [today]: clean }, stats };
    });
    toast("Diário salvo", {
      sub: alreadyAwarded ? "Registro atualizado" : `+${XP.journal} XP · reflexão do dia`,
      icon: "book",
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader title="DIÁRIO" subtitle="Seu espaço pra gratidão, controle do dia e despejo de emoções. Escrever rende XP — 1× por dia." />

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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-headline-md text-headline-md text-primary">HOJE</h3>
          <Caps className="text-outline capitalize">{fmtDate(today)}</Caps>
        </div>

        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <MI name={f.icon} className="text-primary-container text-lg" />
              <Caps className="text-on-surface">{f.label}</Caps>
            </div>
            <p className="text-[11px] text-outline">{f.hint}</p>
            <textarea
              value={draft[f.key]}
              onChange={setField(f.key)}
              placeholder={f.ph}
              rows={f.key === "dump" ? 5 : f.key === "intention" ? 2 : 3}
              className={textareaCls}
            />
          </div>
        ))}

        <div className="flex items-center justify-between gap-4">
          <Caps className="text-outline text-[10px]">
            {alreadyAwarded ? "XP DO DIA JÁ CREDITADO — EDIÇÕES NÃO DÃO XP EXTRA" : draftHasContent ? `SALVAR RENDE +${XP.journal} XP` : "PREENCHA AO MENOS UM CAMPO"}
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
                {FIELDS.filter((f) => (e[f.key] || "").trim()).map((f) => (
                  <div key={f.key} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <MI name={f.icon} className="text-primary-container text-sm" />
                      <Caps className="text-outline text-[10px]">{f.label}</Caps>
                    </div>
                    <p className="text-body-md text-on-surface-variant whitespace-pre-wrap">{e[f.key]}</p>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
