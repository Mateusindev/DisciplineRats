"use client";

// Registro de humor de hoje — vive na página de Humor, junto do diagnóstico que ele
// alimenta. O /sono mantém apenas a MoodStrip (leitura dos mesmos 7 dias do gráfico de
// sono), porque ali o valor é a correlação, não o registro.
//
// Compacto de propósito: uma linha por período, escala inline. Etiqueta e nota só aparecem
// se você abrir. O período atual já vem aberto, então o caso comum é um clique.

import { useState } from "react";
import { MI, Caps } from "@/components/ui";
import { getDateStr, currentPeriodKey, moodDayAvg, MOOD_OPTIONS, MOOD_PERIODS, MOOD_TAGS } from "@/lib/state";

// tolera a entrada legada (mood numérico solto no dia → conta como Tarde)
function readPeriod(dayEntry, key) {
  if (!dayEntry) return null;
  if (typeof dayEntry.mood === "number") {
    return key === "afternoon" ? { mood: dayEntry.mood, note: dayEntry.note || "", tags: [] } : null;
  }
  return dayEntry[key] || null;
}

const FACE = { 1: "sentiment_very_dissatisfied", 2: "sentiment_dissatisfied", 3: "sentiment_neutral", 4: "sentiment_satisfied", 5: "sentiment_very_satisfied" };
const faceTone = (m) => (m <= 2 ? "text-error" : m >= 4 ? "text-primary-container" : "text-primary");

// Faixa de 7 dias alinhada ao gráfico de sono — é aqui que a correlação aparece.
export function MoodStrip({ mood, days }) {
  const avgs = days.map((d) => moodDayAvg(mood?.[d]));
  if (!avgs.some((v) => v !== null)) return null;
  return (
    <div className="mt-4 pt-4 border-t border-white/5">
      <Caps className="text-[10px] text-outline uppercase mb-2 block">HUMOR NOS MESMOS DIAS</Caps>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const v = avgs[i];
          return (
            <div key={d} className="flex flex-col items-center gap-0.5">
              {v === null ? (
                <span className="w-5 h-5 grid place-items-center text-outline-variant text-[13px]">·</span>
              ) : (
                <MI name={FACE[Math.round(v)]} fill className={`text-[19px] ${faceTone(v)}`} />
              )}
              <span className="text-[9px] text-outline tabular-nums">{d.slice(8, 10)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MoodPanel({ state, setState }) {
  const today = getDateStr(0);
  const now = currentPeriodKey();
  const [open, setOpen] = useState(now); // período com etiquetas/nota abertas
  const dayEntry = state.mood?.[today];

  // grava um período de hoje, migrando entrada legada pro shape por período
  function updatePeriod(key, patch) {
    setState((prev) => {
      let day = prev.mood?.[today];
      if (day && typeof day.mood === "number") day = { afternoon: { mood: day.mood, note: day.note || "", tags: [] } };
      day = { ...(day || {}) };
      const cur = day[key] || {};
      const next = { mood: cur.mood, note: cur.note || "", tags: cur.tags || [], ...patch };
      if (typeof next.mood !== "number") delete day[key];
      else day[key] = next;
      return { ...prev, mood: { ...(prev.mood || {}), [today]: day } };
    });
  }

  const setMood = (key, val) => {
    const cur = readPeriod(dayEntry, key);
    updatePeriod(key, { mood: cur?.mood === val ? undefined : val }); // clicar de novo limpa
  };
  const toggleTag = (key, tagId) => {
    const cur = readPeriod(dayEntry, key);
    const tags = cur?.tags || [];
    updatePeriod(key, { tags: tags.includes(tagId) ? tags.filter((t) => t !== tagId) : [...tags, tagId] });
  };

  return (
    <div className="md:col-span-12 glass-card p-6 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <MI name="psychology" className="text-primary-container" /> HUMOR DE HOJE
        </h3>
        <Caps className="text-[10px] text-outline">SEM XP</Caps>
      </div>
      <p className="text-[12px] text-on-surface-variant mb-4">
        Três momentos do dia. É o que revela se a noite mal dormida cobrou o preço na tarde seguinte.
      </p>

      <div className="space-y-2">
        {MOOD_PERIODS.map((p) => {
          const cur = readPeriod(dayEntry, p.key);
          const isNow = p.key === now;
          const isOpen = open === p.key;
          const tags = cur?.tags || [];
          return (
            <div key={p.key} className={`rounded-lg border transition ${isNow ? "border-primary-container/40 bg-primary-container/[0.05]" : "border-white/5"}`}>
              <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                <span className="flex items-center gap-1.5 w-[104px] shrink-0">
                  <MI name={p.icon} className={`text-base ${isNow ? "text-primary-container" : "text-outline"}`} />
                  <Caps className={`text-[10px] ${isNow ? "text-primary" : "text-on-surface-variant"}`}>{p.label}</Caps>
                </span>

                <div className="flex gap-1">
                  {MOOD_OPTIONS.map((o) => {
                    const on = cur?.mood === o.value;
                    return (
                      <button
                        key={o.value}
                        onClick={() => setMood(p.key, o.value)}
                        aria-label={`${p.label}: ${o.label}`}
                        aria-pressed={on}
                        title={o.label}
                        className={`w-9 h-9 rounded-lg grid place-items-center transition active:scale-90 ${
                          on ? "bg-surface-variant" : "hover:bg-surface-variant/50"
                        }`}
                      >
                        <MI name={FACE[o.value]} fill={on} className={`text-[21px] ${on ? faceTone(o.value) : "text-outline-variant"}`} />
                      </button>
                    );
                  })}
                </div>

                <span className="flex-1" />

                {typeof cur?.mood === "number" && (
                  <button
                    onClick={() => setOpen(isOpen ? null : p.key)}
                    className="flex items-center gap-1 text-[11px] text-outline hover:text-primary transition shrink-0"
                  >
                    {tags.length > 0 ? `${tags.length} etiqueta(s)` : "detalhar"}
                    <MI name="expand_more" className={`text-[14px] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>

              {isOpen && typeof cur?.mood === "number" && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {MOOD_TAGS.map((t) => {
                      const on = tags.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleTag(p.key, t.id)}
                          className={`px-2 py-1 rounded-full text-[10px] font-label-caps flex items-center gap-1 border transition ${
                            on ? "border-primary text-primary bg-primary/10" : "border-white/10 text-outline hover:border-white/25"
                          }`}
                        >
                          <MI name={t.icon} className="text-[12px]" /> {t.label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    value={cur?.note || ""}
                    onChange={(e) => updatePeriod(p.key, { note: e.target.value.slice(0, 140) })}
                    placeholder="Nota rápida (opcional)"
                    maxLength={140}
                    className="w-full bg-surface-container-high border border-white/5 rounded-lg px-3 py-2 text-[12px] text-on-surface placeholder:text-outline outline-none focus:border-primary-container/50 transition"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-outline mt-3">
        Sem etiqueta o número não explica nada — é ela que revela que dia de trabalho puxa pra baixo ou que treino levanta. Clicar na carinha de novo limpa o
        registro.
      </p>
    </div>
  );
}
