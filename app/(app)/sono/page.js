"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, StarRating, inputCls } from "@/components/ui";
import MetasEditor from "@/components/MetasEditor";
import MoodPanel, { MoodStrip } from "@/components/MoodPanel";
import { sleepXp, sleepMissXp, computeSleepXp, bedtimeLateness, SLEEP_LIMIT_DEFAULT, SLEEP_GOAL_MIN, SLEEP_GOAL_MAX, award, getDateStr, minutesToHm, weekdayShort, last7Dates } from "@/lib/state";
import { LineChart } from "@/components/charts";

function hm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${pad2(m)}m`;
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
// streak só conta NOITE LIMPA: bateu a meta E deitou no horário (madrugada quebra)
function sleepStreak(sleep, goal, limit) {
  let streak = 0;
  let off = sleep[getDateStr(0)] ? 0 : -1;
  while (true) {
    const e = sleep[getDateStr(off)];
    if (e && e.durationMin >= goal && bedtimeLateness(e.bedtime, limit) <= 0) {
      streak++;
      off--;
    } else break;
  }
  return streak;
}

export default function SonoPage() {
  const { state, setState, toast, setSetting } = useApp();
  const today = getDateStr(0);
  const existing = state.sleep[today];
  const [bedtime, setBedtime] = useState(existing?.bedtime || "23:00");
  const [wake, setWake] = useState(existing?.wake || "07:00");
  const [quality, setQuality] = useState(existing?.quality || 3);
  const [note, setNote] = useState(existing?.note || "");
  const [lateReason, setLateReason] = useState(existing?.lateReason || "");

  function computeDuration(bt, wk) {
    const [bh, bm] = bt.split(":").map(Number);
    const [wh, wm] = wk.split(":").map(Number);
    let diff = wh * 60 + wm - (bh * 60 + bm);
    if (diff <= 0) diff += 24 * 60;
    return diff;
  }
  const durationMin = computeDuration(bedtime, wake);
  const goalMin = state.settings.sleepGoalMin || 450;
  const limit = state.settings.sleepLimit || SLEEP_LIMIT_DEFAULT;
  const hitsGoal = durationMin >= goalMin;
  const lateMin = bedtimeLateness(bedtime, limit); // >0 = deitou tarde
  const onTime = lateMin <= 0;
  const needsReason = lateMin > 0 && !lateReason.trim(); // deitou tarde exige justificativa
  // XP líquido previsto p/ o registro atual (assinado): combina duração + horário
  const previewNet = computeSleepXp({ durationMin, bedtime, goalMin, limit, streak: state.stats.streak });

  function save() {
    if (needsReason) {
      toast("Justifique pra registrar", { sub: "Deitou tarde? Escreva o motivo.", type: "error", icon: "edit_note" });
      return;
    }
    setState((prev) => {
      const prevEntry = prev.sleep[today];
      // net anterior (assinado): prêmio − penalidade; fallback p/ entradas legadas
      const prevNet =
        (prevEntry?.awardedXp || 0) - (prevEntry?.penaltyXp || 0) ||
        (prevEntry?.xpAwarded ? award(sleepXp(goalMin), prev.stats.streak) : 0);
      const net = computeSleepXp({ durationMin, bedtime, goalMin, limit, streak: prev.stats.streak });
      const xp = Math.max(0, (prev.stats.xp || 0) + (net - prevNet)); // aplica só o delta (estorno simétrico)
      const entry = {
        bedtime,
        wake,
        durationMin,
        quality,
        note: note.slice(0, 200),
        lateReason: lateMin > 0 ? lateReason.slice(0, 200) : "",
        awardedXp: net > 0 ? net : 0,
        penaltyXp: net < 0 ? -net : 0,
      };
      return { ...prev, sleep: { ...prev.sleep, [today]: entry }, stats: { ...prev.stats, xp } };
    });
    const sign = previewNet >= 0 ? "+" : "−";
    const reason = !hitsGoal ? "ABAIXO DA META" : onTime ? "META BATIDA · CEDO" : "META BATIDA · DEITOU TARDE";
    toast("Sono salvo", {
      sub: `${reason} · ${sign}${Math.abs(previewNet)} XP`,
      icon: previewNet >= 0 ? "check_circle" : "warning",
      type: previewNet >= 0 ? undefined : "error",
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

  const streak = sleepStreak(state.sleep, goalMin, limit);
  // noites "sujas" no gráfico: deitou tarde (madrugada) — não é 8h limpa
  const lateFlags = days.map((d) => {
    const e = state.sleep[d];
    return e ? bedtimeLateness(e.bedtime, limit) > 0 : false;
  });
  const hasLate = lateFlags.some(Boolean);

  return (
    <>
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-headline-lg text-headline-lg text-primary-fixed-dim mb-1">SONO</h1>
        <p className="font-body-md text-on-surface-variant">Registre e acompanhe seu descanso para otimizar sua recuperação neural e muscular.</p>
      </div>

      {/* Metas de sono */}
      <div className="glass-card p-6 rounded-xl mb-8">
        <Caps className="text-outline text-[10px] block mb-4">METAS DE SONO</Caps>
        <MetasEditor
          fields={[
            { key: "sleepGoalMin", label: "Meta de sono", type: "number", value: state.settings.sleepGoalMin, min: SLEEP_GOAL_MIN, max: SLEEP_GOAL_MAX, step: 15, format: (v) => minutesToHm(v), onChange: (v) => setSetting("sleepGoalMin", v) },
            { key: "sleepLimit", label: "Deitar até", type: "time", value: state.settings.sleepLimit || "23:30", onChange: (v) => setSetting("sleepLimit", v) },
          ]}
        />
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
              <div className="flex items-center gap-2">
                <MI name={previewNet >= 0 ? "stars" : "warning"} fill className={`text-sm ${previewNet >= 0 ? "text-primary" : "text-error"}`} />
                <Caps className={previewNet >= 0 ? "text-primary" : "text-error"}>
                  ESTE REGISTRO: {previewNet >= 0 ? "+" : "−"}{Math.abs(previewNet)} XP
                </Caps>
              </div>
              <Caps className="text-[10px] text-outline mt-1 block">DEITAR ATÉ {limit} RENDE XP CHEIO</Caps>
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
              {/* horário de dormir */}
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full w-fit border ${
                  onTime ? "bg-primary-container/10 border-primary/20" : "bg-error-container/20 border-error/30"
                }`}
              >
                <MI name={onTime ? "bedtime" : "nightlight"} fill className={`text-sm ${onTime ? "text-primary" : "text-error"}`} />
                <Caps className={`text-[10px] ${onTime ? "text-primary" : "text-error"}`}>
                  {onTime ? `DEITOU NO HORÁRIO (ATÉ ${limit})` : `DEITOU ${Math.floor(lateMin / 60)}H${String(lateMin % 60).padStart(2, "0")} APÓS O LIMITE`}
                </Caps>
              </div>
              {/* justificativa obrigatória quando deitou tarde */}
              {lateMin > 0 && (
                <label className="block space-y-1 pt-1">
                  <Caps className="text-[10px] text-error uppercase tracking-wider">Por que deitou tarde? (obrigatório)</Caps>
                  <textarea
                    value={lateReason}
                    onChange={(e) => setLateReason(e.target.value)}
                    placeholder="Ex.: trabalho atrasado, ansiedade, tela até tarde, saída..."
                    maxLength={200}
                    rows={2}
                    className={`${inputCls} resize-none w-full border-error/40 focus:border-error`}
                  />
                </label>
              )}
              {/* duração vs meta */}
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full w-fit border ${
                  hitsGoal ? "bg-primary-container/10 border-primary/20" : "bg-error-container/20 border-error/30"
                }`}
              >
                <MI name={hitsGoal ? "check_circle" : "warning"} fill className={`text-sm ${hitsGoal ? "text-primary" : "text-error"}`} />
                <Caps className={`text-[10px] ${hitsGoal ? "text-primary" : "text-error"}`}>
                  META {minutesToHm(goalMin)} · {hitsGoal ? "BATEU A META" : `ABAIXO DA META (−${sleepMissXp(goalMin)} XP)`}
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
            disabled={needsReason}
            className="w-full bg-primary py-4 rounded-lg text-on-primary font-headline-md text-headline-md tracking-widest hover:bg-primary-fixed hover:scale-[0.99] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            SALVAR REGISTRO
          </button>
          {needsReason && <p className="text-[11px] text-error text-center -mt-2">Justifique por que deitou tarde pra registrar.</p>}
        </div>

        {/* Chart */}
        <div className="md:col-span-5 glass-card p-gutter rounded-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline-md text-headline-md text-on-surface">ÚLTIMOS 7 DIAS</h3>
            {hasLate && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-error-container/20 rounded-full border border-error/20">
                <span className="w-2 h-2 rounded-full bg-error" />
                <Caps className="text-[9px] text-error">DEITOU TARDE</Caps>
              </div>
            )}
          </div>
          <div className="flex-1 flex items-center">
            {days.some((d) => state.sleep[d]) ? (
              <LineChart
                days={days}
                values={days.map((d) => state.sleep[d]?.durationMin ?? null)}
                today={today}
                yMax={Math.max(600, goalMin + 120)}
                goal={{ value: goalMin, label: `META ${minutesToHm(goalMin)}` }}
                format={minutesToHm}
                flags={lateFlags}
                reasons={days.map((d) => state.sleep[d]?.lateReason || "")}
                ariaLabel="Duração do sono nos últimos 7 dias (pontos vermelhos = deitou tarde)"
              />
            ) : (
              <p className="text-[13px] text-outline text-center w-full py-10">Sem registros ainda — salve seu sono de hoje pra começar o gráfico.</p>
            )}
          </div>
          {/* humor nos mesmos 7 dias — a correlação fica visível sem precisar de outra tela */}
          <MoodStrip mood={state.mood} days={days} />

          <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
            <div className="flex flex-col">
              <Caps className="text-[10px] text-secondary uppercase">MÉDIA SEMANAL</Caps>
              <span className="font-headline-md text-headline-md">{avgMin ? hm(avgMin) : "—"}</span>
            </div>
            <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center border border-white/10">
              <MI name="trending_up" fill className="text-primary" />
            </div>
          </div>

          {/* justificativas das noites que deitou tarde */}
          {hasLate && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <Caps className="text-[10px] text-error uppercase mb-2 block">Noites que deitou tarde</Caps>
              <ul className="space-y-1.5">
                {days
                  .filter((d) => state.sleep[d] && bedtimeLateness(state.sleep[d].bedtime, limit) > 0)
                  .map((d) => (
                    <li key={d} className="flex gap-2 text-[12px]">
                      <span className="font-label-caps text-error shrink-0 uppercase">{weekdayShort(d)}</span>
                      <span className={state.sleep[d].lateReason ? "text-on-surface-variant" : "text-outline italic"}>
                        {state.sleep[d].lateReason || "sem justificativa"}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        {/* Streak */}
        <div className="md:col-span-4 glass-card p-6 rounded-xl border-l-4 border-l-primary flex gap-4 items-center">
          <div className="w-14 h-14 bg-primary-container/20 rounded-xl flex items-center justify-center shrink-0">
            <MI name="military_tech" fill className="text-primary text-3xl" />
          </div>
          <div>
            <Caps className="text-on-surface">SEQUÊNCIA DE SONO</Caps>
            <p className="font-body-md text-on-surface-variant text-sm">
              {streak > 0
                ? `${streak} ${streak === 1 ? "noite limpa" : "noites limpas"} (meta + deitar no horário).`
                : "Bata a meta e deite no horário pra iniciar a sequência."}
            </p>
            <div className="mt-2 text-primary font-bold text-xs">MADRUGADA QUEBRA A SEQUÊNCIA</div>
          </div>
        </div>

        <MoodPanel state={state} setState={setState} />

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
