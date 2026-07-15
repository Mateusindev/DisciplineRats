"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, StarRating, inputCls } from "@/components/ui";
import { sleepXp, award, getDateStr, minutesToHm, weekdayShort, last7Dates } from "@/lib/state";
import { LineChart } from "@/components/charts";

function hm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${pad2(m)}m`;
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function sleepStreak(sleep, goal) {
  let streak = 0;
  let off = sleep[getDateStr(0)] ? 0 : -1;
  while (true) {
    const e = sleep[getDateStr(off)];
    if (e && e.durationMin >= goal) {
      streak++;
      off--;
    } else break;
  }
  return streak;
}

export default function SonoPage() {
  const { state, setState, toast } = useApp();
  const today = getDateStr(0);
  const existing = state.sleep[today];
  const [bedtime, setBedtime] = useState(existing?.bedtime || "23:00");
  const [wake, setWake] = useState(existing?.wake || "07:00");
  const [quality, setQuality] = useState(existing?.quality || 3);
  const [note, setNote] = useState(existing?.note || "");

  function computeDuration(bt, wk) {
    const [bh, bm] = bt.split(":").map(Number);
    const [wh, wm] = wk.split(":").map(Number);
    let diff = wh * 60 + wm - (bh * 60 + bm);
    if (diff <= 0) diff += 24 * 60;
    return diff;
  }
  const durationMin = computeDuration(bedtime, wake);
  const goalMin = state.settings.sleepGoalMin || 450;
  const hitsGoal = durationMin >= goalMin;

  function save() {
    setState((prev) => {
      const prevEntry = prev.sleep[today];
      const already = prevEntry?.xpAwarded;
      const entry = { bedtime, wake, durationMin, quality, note: note.slice(0, 200), xpAwarded: already || false };
      let stats = prev.stats;
      if (durationMin >= goalMin && !already) {
        entry.xpAwarded = true;
        stats = { ...stats, xp: (stats.xp || 0) + award(sleepXp(goalMin), stats.streak) };
      }
      return { ...prev, sleep: { ...prev.sleep, [today]: entry }, stats };
    });
    const wasAwarded = existing?.xpAwarded;
    toast("Sono salvo", {
      sub: hitsGoal ? (wasAwarded ? "META BATIDA" : `META BATIDA · +${sleepXp(goalMin)} XP`) : "ABAIXO DA META",
      icon: hitsGoal ? "check_circle" : "bedtime",
    });
  }

  const days = last7Dates();
  const withData = days.filter((d) => state.sleep[d]);
  const avgMin = withData.length ? Math.round(withData.reduce((s, d) => s + state.sleep[d].durationMin, 0) / withData.length) : null;

  // progress ring
  const R = 40;
  const CIRC = 2 * Math.PI * R;
  const fillPct = Math.min(durationMin / goalMin, 1);
  const offset = CIRC * (1 - fillPct);

  const streak = sleepStreak(state.sleep, goalMin);

  return (
    <>
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-headline-lg text-headline-lg text-primary-fixed-dim mb-1">SONO</h1>
        <p className="font-body-md text-on-surface-variant">Registre e acompanhe seu descanso para otimizar sua recuperação neural e muscular.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        {/* Input + progresso */}
        <div className="md:col-span-7 glass-card p-gutter rounded-xl flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
            <MI name="nights_stay" className="text-[120px] text-primary" />
          </div>

          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-1">SONO DE HOJE</h3>
              <div className="flex items-center gap-2 text-primary">
                <MI name="stars" fill className="text-sm" />
                <Caps>+{sleepXp(goalMin)} XP DISPONÍVEIS</Caps>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2 block">
              <Caps className="text-[10px] text-on-surface-variant uppercase tracking-wider">DORMIU ÀS</Caps>
              <input
                type="time"
                value={bedtime}
                onChange={(e) => setBedtime(e.target.value)}
                className="w-full bg-surface-container-highest px-4 py-3 rounded-lg border border-white/5 hover:border-primary/30 focus:border-primary/50 outline-none transition-colors font-headline-md text-headline-md text-on-surface"
              />
            </label>
            <label className="space-y-2 block">
              <Caps className="text-[10px] text-on-surface-variant uppercase tracking-wider">ACORDOU ÀS</Caps>
              <input
                type="time"
                value={wake}
                onChange={(e) => setWake(e.target.value)}
                className="w-full bg-surface-container-highest px-4 py-3 rounded-lg border border-white/5 hover:border-primary/30 focus:border-primary/50 outline-none transition-colors font-headline-md text-headline-md text-on-surface"
              />
            </label>
          </div>

          <div className="flex items-center gap-8 py-2">
            <div className="relative w-24 h-24 shrink-0">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle className="text-white/10" cx="50" cy="50" fill="transparent" r={R} stroke="currentColor" strokeWidth="8" />
                <circle
                  className="text-primary progress-ring__circle"
                  cx="50"
                  cy="50"
                  fill="transparent"
                  r={R}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="8"
                  style={{ strokeDasharray: CIRC, strokeDashoffset: offset }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-headline-md text-headline-md leading-none">{Math.floor(durationMin / 60)}H</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <p className="font-body-md text-on-surface">
                Duração estimada: <span className="text-primary font-bold">{minutesToHm(durationMin)}</span>
              </p>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full w-fit border ${
                  hitsGoal ? "bg-primary-container/10 border-primary/20" : "bg-surface-variant/30 border-white/10"
                }`}
              >
                <MI name={hitsGoal ? "check_circle" : "bedtime"} fill={hitsGoal} className={`text-sm ${hitsGoal ? "text-primary" : "text-outline"}`} />
                <Caps className={`text-[10px] ${hitsGoal ? "text-primary" : "text-outline"}`}>
                  META {minutesToHm(goalMin)} · {hitsGoal ? `BATEU A META (+${sleepXp(goalMin)} XP)` : "ABAIXO DA META"}
                </Caps>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <Caps>QUALIDADE DO DESCANSO</Caps>
            <StarRating value={quality} onChange={setQuality} />
          </div>

          <label className="space-y-2 block">
            <Caps className="text-[10px] text-on-surface-variant uppercase tracking-wider">NOTA (OPCIONAL)</Caps>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Sonhou? Acordou no meio da noite? Cafeína tarde?"
              maxLength={200}
              rows={2}
              className={`${inputCls} resize-none w-full`}
            />
          </label>

          <button
            onClick={save}
            className="w-full bg-primary py-4 rounded-lg text-on-primary font-headline-md text-headline-md tracking-widest hover:bg-primary-fixed hover:scale-[0.99] active:scale-95 transition-all"
          >
            SALVAR REGISTRO
          </button>
        </div>

        {/* Chart */}
        <div className="md:col-span-5 glass-card p-gutter rounded-xl flex flex-col">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-4">ÚLTIMOS 7 DIAS</h3>
          <div className="flex-1 flex items-center">
            {days.some((d) => state.sleep[d]) ? (
              <LineChart
                days={days}
                values={days.map((d) => state.sleep[d]?.durationMin ?? null)}
                today={today}
                yMax={Math.max(600, goalMin + 120)}
                goal={{ value: goalMin, label: `META ${minutesToHm(goalMin)}` }}
                format={minutesToHm}
                ariaLabel="Duração do sono nos últimos 7 dias"
              />
            ) : (
              <p className="text-[13px] text-outline text-center w-full py-10">Sem registros ainda — salve seu sono de hoje pra começar o gráfico.</p>
            )}
          </div>
          <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
            <div className="flex flex-col">
              <Caps className="text-[10px] text-secondary uppercase">MÉDIA SEMANAL</Caps>
              <span className="font-headline-md text-headline-md">{avgMin ? hm(avgMin) : "—"}</span>
            </div>
            <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center border border-white/10">
              <MI name="trending_up" fill className="text-primary" />
            </div>
          </div>
        </div>

        {/* Streak */}
        <div className="md:col-span-4 glass-card p-6 rounded-xl border-l-4 border-l-primary flex gap-4 items-center">
          <div className="w-14 h-14 bg-primary-container/20 rounded-xl flex items-center justify-center shrink-0">
            <MI name="military_tech" fill className="text-primary text-3xl" />
          </div>
          <div>
            <Caps className="text-on-surface">SEQUÊNCIA DE SONO</Caps>
            <p className="font-body-md text-on-surface-variant text-sm">
              {streak > 0 ? `${streak} ${streak === 1 ? "dia" : "dias"} batendo a meta de sono.` : "Bata a meta hoje pra iniciar a sequência."}
            </p>
            <div className="mt-2 text-primary font-bold text-xs">MELHOR RECUPERAÇÃO</div>
          </div>
        </div>

        {/* Tip */}
        <div className="md:col-span-8 glass-card p-6 rounded-xl flex items-center gap-4 bg-gradient-to-r from-surface-container-high to-transparent border-none">
          <div className="w-10 h-10 bg-on-primary-container/10 rounded-full flex items-center justify-center shrink-0">
            <MI name="lightbulb" fill className="text-primary-container" />
          </div>
          <p className="font-body-md italic text-on-surface-variant">
            "O sono é a ponte entre o esforço e o resultado. Recuperação consistente é o que sustenta a disciplina."
          </p>
        </div>
      </div>
    </>
  );
}
