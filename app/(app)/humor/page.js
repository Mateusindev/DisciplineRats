"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps } from "@/components/ui";
import { getDateStr, last7Dates, MOOD_OPTIONS } from "@/lib/state";
import { LineChart } from "@/components/charts";

const GLOW = { boxShadow: "0 0 15px rgba(255, 193, 7, 0.2)" };
const MOOD_ICON = {
  1: "sentiment_very_dissatisfied",
  2: "sentiment_dissatisfied",
  3: "sentiment_neutral",
  4: "sentiment_satisfied",
  5: "sentiment_very_satisfied",
};

function moodStreak(moodMap) {
  let streak = 0;
  let off = moodMap[getDateStr(0)] ? 0 : -1;
  while (moodMap[getDateStr(off)]) {
    streak++;
    off--;
  }
  return streak;
}

export default function HumorPage() {
  const { state, setState, toast } = useApp();
  const today = getDateStr(0);
  const existing = state.mood[today];
  const [mood, setMood] = useState(existing?.mood || null);
  const [note, setNote] = useState(existing?.note || "");

  const days = last7Dates();
  const withData = days.filter((d) => state.mood[d]);
  const avg = withData.length ? withData.reduce((s, d) => s + state.mood[d].mood, 0) / withData.length : null;
  const streak = moodStreak(state.mood);
  const goalPct = Math.round((withData.length / 7) * 100);

  const selected = mood ? MOOD_OPTIONS.find((o) => o.value === mood) : null;
  const bigIcon = mood ? MOOD_ICON[mood] : "sentiment_neutral";
  const iconColor = mood === 5 ? "text-primary-container" : mood === 1 ? "text-error" : "text-primary";

  function save() {
    if (!mood) return;
    setState((prev) => ({ ...prev, mood: { ...prev.mood, [today]: { mood, note: note.slice(0, 140) } } }));
    toast("Humor registrado", { sub: selected ? selected.label.toUpperCase() : "", icon: MOOD_ICON[mood] });
  }

  return (
    <div className="space-y-8">
      {/* Header + stat tiles */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-card-gap">
        <div className="md:col-span-8 space-y-2">
          <h2 className="font-headline-lg text-headline-lg text-primary uppercase">Equilíbrio Emocional</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
            Registre seu estado de espírito para manter a sequência e acompanhar sua constância mental.
          </p>
        </div>
        <div className="md:col-span-4 flex justify-start md:justify-end items-start gap-4">
          <div className="glass-card p-4 rounded-xl flex flex-col items-center min-w-[100px]">
            <Caps className="text-primary-container">SEQUÊNCIA</Caps>
            <span className="font-headline-lg text-headline-lg">{streak} {streak === 1 ? "DIA" : "DIAS"}</span>
          </div>
          <div className="glass-card p-4 rounded-xl flex flex-col items-center min-w-[100px] border-primary-container/30">
            <Caps className="text-primary-container">MÉDIA</Caps>
            <span className="font-headline-lg text-headline-lg text-primary-container">{avg ? avg.toFixed(1) : "—"}</span>
          </div>
        </div>
      </section>

      {/* Bento */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-card-gap">
        {/* Left: avatar + selection */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-card-gap">
          <div className="glass-card p-8 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group min-h-[360px]">
            <div
              className="relative z-10 w-48 h-48 rounded-full bg-surface-container flex items-center justify-center border-4 border-primary/20 transition-all duration-500 group-hover:scale-105"
              style={mood ? { borderColor: mood === 5 ? "#fabd00" : mood === 1 ? "#ffb4ab" : "rgba(255,193,7,0.2)" } : undefined}
            >
              <MI name={bigIcon} className={`text-[120px] ${iconColor} transition-all duration-300`} />
            </div>
            <div className="z-10 mt-8 text-center space-y-2">
              <h3 className="font-headline-md text-headline-md tracking-widest text-primary">
                {selected ? selected.label.toUpperCase() : "SELECIONE SEU ESTADO"}
              </h3>
              <Caps className="opacity-50">CALIBRAÇÃO ATUAL</Caps>
            </div>
          </div>

          {/* Selection grid */}
          <div className="grid grid-cols-5 gap-3">
            {MOOD_OPTIONS.map((opt) => {
              const active = mood === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setMood(opt.value)}
                  aria-label={opt.label}
                  className={`glass-card p-4 rounded-xl flex flex-col items-center gap-2 transition-all active:scale-95 border ${
                    active ? "bg-primary/20 border-primary/50" : "border-white/10 hover:bg-primary/20"
                  }`}
                >
                  <MI name={MOOD_ICON[opt.value]} className={`text-3xl ${active ? "text-primary" : "text-on-surface-variant"}`} />
                  <Caps className={`text-[9px] text-center ${active ? "text-primary" : ""}`}>{opt.label.toUpperCase()}</Caps>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: goal + note + save */}
        <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-card-gap">
          <div className="glass-card p-6 rounded-xl space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <Caps className="text-on-surface-variant">META SEMANAL</Caps>
                <h4 className="font-headline-md text-headline-md">7 DIAS REGISTRADOS</h4>
              </div>
              <Caps className="text-primary">{goalPct}%</Caps>
            </div>
            <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-primary-container rounded-full" style={{ width: `${goalPct}%`, ...GLOW }} />
            </div>
            <p className="text-sm opacity-60 italic">"Disciplina é a ponte entre metas e conquistas."</p>
          </div>

          <div className="glass-card p-6 rounded-xl flex flex-col gap-3 flex-grow">
            <Caps className="text-on-surface-variant border-b border-white/10 pb-2">ANOTAÇÃO DO DIA</Caps>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Alguma anotação sobre o dia? (opcional)"
              maxLength={140}
              rows={4}
              className="flex-grow bg-surface-container-lowest border border-white/5 rounded-lg px-3 py-2 text-body-md outline-none focus:border-primary/50 transition-colors resize-none"
            />
          </div>

          <button
            onClick={save}
            disabled={!mood}
            style={mood ? GLOW : undefined}
            className={`w-full font-headline-md text-headline-md py-4 rounded-xl active:scale-95 transition-transform ${
              mood ? "bg-primary-container text-on-primary-fixed" : "bg-surface-variant text-outline cursor-not-allowed"
            }`}
          >
            CONFIRMAR REGISTRO
          </button>
        </div>
      </div>

      {/* Mood history */}
      <section className="glass-card p-8 rounded-xl">
        <div className="flex justify-between items-center mb-8">
          <h3 className="font-headline-md text-headline-md">HISTÓRICO DE HUMOR</h3>
          <div className="flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full text-[10px] font-label-caps border border-white/5">
            <span className="w-2 h-2 rounded-full bg-primary-container" /> ESCALA 1–5
          </div>
        </div>
        {withData.length > 0 ? (
          <LineChart
            days={days}
            values={days.map((d) => state.mood[d]?.mood ?? null)}
            today={today}
            yMin={0}
            yMax={5.4}
            format={(v) => MOOD_OPTIONS.find((o) => o.value === v)?.emoji || v}
            ariaLabel="Humor nos últimos 7 dias (escala 1 a 5)"
          />
        ) : (
          <p className="text-[13px] text-outline text-center py-10">Sem registros ainda — confirme seu humor de hoje pra começar o gráfico.</p>
        )}
      </section>
    </div>
  );
}
