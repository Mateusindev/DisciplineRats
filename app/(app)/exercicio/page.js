"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, StarRating } from "@/components/ui";
import { XP, award, getDateStr, weekdayShort, last7Dates, EXERCISE_TYPES } from "@/lib/state";

const GLOW = { boxShadow: "0 0 15px rgba(255, 193, 7, 0.15)" };

export default function ExercicioPage() {
  const { state, setState, toast } = useApp();
  const [type, setType] = useState(EXERCISE_TYPES[0]);
  const [duration, setDuration] = useState(60);
  const [intensity, setIntensity] = useState(3);
  const [note, setNote] = useState("");

  const today = getDateStr(0);
  const days = last7Dates();
  const daysSet = new Set(days);
  const weekLogs = state.exerciseLogs.filter((l) => daysSet.has(l.date));
  const goal = state.settings.exerciseWeeklyGoal;

  // volume per weekday (total minutes)
  const volByDate = {};
  for (const l of weekLogs) volByDate[l.date] = (volByDate[l.date] || 0) + l.durationMin;
  const weekVolume = weekLogs.reduce((s, l) => s + l.durationMin, 0);
  const maxDayVol = Math.max(1, ...days.map((d) => volByDate[d] || 0));

  // week vs prev-week comparison
  const prevDays = Array.from({ length: 7 }, (_, i) => getDateStr(-(13 - i)));
  const prevSet = new Set(prevDays);
  const prevVolume = state.exerciseLogs.filter((l) => prevSet.has(l.date)).reduce((s, l) => s + l.durationMin, 0);
  const volDelta = prevVolume ? Math.round(((weekVolume - prevVolume) / prevVolume) * 100) : null;

  // current intensity gauge = avg intensity of week (0-5) -> %
  const avgIntensity = weekLogs.length ? weekLogs.reduce((s, l) => s + l.intensity, 0) / weekLogs.length : 0;
  const intensityPct = Math.round((avgIntensity / 5) * 100);

  // 30-day frequency bars (minutes per day)
  const days30 = Array.from({ length: 30 }, (_, i) => getDateStr(-(29 - i)));
  const freqByDate = {};
  for (const l of state.exerciseLogs) if (freqByDate[l.date] !== undefined || days30.includes(l.date)) freqByDate[l.date] = (freqByDate[l.date] || 0) + l.durationMin;
  const maxFreq = Math.max(60, ...days30.map((d) => freqByDate[d] || 0));

  function logWorkout() {
    setState((prev) => ({
      ...prev,
      exerciseLogs: [{ id: Date.now(), date: today, type, durationMin: duration, intensity, note: note.slice(0, 200) }, ...prev.exerciseLogs].slice(0, 200),
      stats: { ...prev.stats, xp: (prev.stats.xp || 0) + award(XP.exercise, prev.stats.streak) },
    }));
    setNote("");
    toast("Treino registrado", { sub: `${type.toUpperCase()} · ${duration} MIN · +${XP.exercise} XP`, icon: "fitness_center" });
  }
  function removeLog(id) {
    setState((prev) => ({ ...prev, exerciseLogs: prev.exerciseLogs.filter((l) => l.id !== id) }));
  }
  function updateGoal(delta) {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, exerciseWeeklyGoal: Math.min(14, Math.max(1, prev.settings.exerciseWeeklyGoal + delta)) },
    }));
  }

  return (
    <div className="grid grid-cols-12 gap-gutter">
      {/* Header + intensity metric */}
      <div className="col-span-12 lg:col-span-8">
        <h1 className="font-headline-lg text-headline-lg text-primary uppercase mb-2">Cockpit de Treino</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          Registre sua disciplina. Cada métrica é um passo rumo à performance de elite. Bata a meta semanal.
        </p>
      </div>
      <div className="col-span-12 lg:col-span-4 flex justify-start lg:justify-end items-start">
        <div className="lg:text-right">
          <Caps className="text-primary uppercase">Intensidade média</Caps>
          <p className="font-display-timer text-display-timer leading-none text-primary">{intensityPct}%</p>
        </div>
      </div>

      {/* Form card */}
      <section className="col-span-12 lg:col-span-7 glass-card p-8 rounded-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <MI name="assignment" className="text-[120px]" />
        </div>
        <h2 className="font-headline-md text-headline-md text-primary mb-6 flex items-center gap-2">
          <MI name="edit_note" /> PARÂMETROS DA SESSÃO
        </h2>

        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Caps className="text-on-surface-variant">TIPO DE TREINO</Caps>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-on-surface font-body-md py-3 outline-none transition-colors"
              >
                {EXERCISE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Caps className="text-on-surface-variant">DURAÇÃO (MIN)</Caps>
              <input
                type="number"
                min={5}
                max={300}
                value={duration}
                onChange={(e) => setDuration(Math.max(5, Math.min(300, Number(e.target.value) || 0)))}
                placeholder="60"
                className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-on-surface font-body-md py-3 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Caps className="text-on-surface-variant">FOCO / MODALIDADE</Caps>
            <div className="flex flex-wrap gap-3">
              {EXERCISE_TYPES.map((t) => {
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-4 py-2 rounded-full font-label-caps text-label-caps transition-all border ${
                      active ? "border-primary bg-primary/10 text-primary" : "border-outline-variant hover:bg-primary/10 hover:border-primary"
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Caps className="text-on-surface-variant">INTENSIDADE</Caps>
            <StarRating value={intensity} onChange={setIntensity} />
          </div>

          <div className="space-y-2">
            <Caps className="text-on-surface-variant">NOTAS DE INTENSIDADE</Caps>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Exercícios, cargas, como se sentiu..."
              maxLength={200}
              rows={3}
              className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-on-surface font-body-md py-3 outline-none transition-colors resize-none"
            />
          </div>

          <button
            onClick={logWorkout}
            style={GLOW}
            className="w-full py-4 bg-primary text-on-primary font-headline-md text-headline-md uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-primary-container active:scale-[0.99] transition-colors rounded-lg"
          >
            REGISTRAR SESSÃO
            <MI name="chevron_right" />
          </button>
        </div>
      </section>

      {/* Right column: heatmap + goal */}
      <div className="col-span-12 lg:col-span-5 flex flex-col gap-gutter">
        {/* Weekly volume heatmap */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex justify-between items-center mb-6">
            <Caps className="text-primary">VOLUME SEMANAL</Caps>
            <MI name="grid_view" className="text-on-surface-variant" />
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => {
              const vol = volByDate[d] || 0;
              const isToday = d === today;
              const ratio = vol / maxDayVol; // 0..1
              const bg = vol === 0 ? "bg-surface-container-highest" : "bg-primary";
              const opacity = vol === 0 ? 1 : 0.2 + ratio * 0.7;
              return (
                <div key={d} className="space-y-2">
                  <div
                    className={`h-12 w-full rounded-sm ${bg} ${isToday && vol ? "border border-primary/50 shadow-inner" : ""}`}
                    style={{ opacity }}
                    title={`${vol} min`}
                  />
                  <div className={`text-center text-[10px] font-label-caps ${isToday ? "text-primary" : "text-on-surface-variant"}`}>
                    {weekdayShort(d)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
            <Caps className="text-[10px] text-on-surface-variant">VOLUME TOTAL: {weekVolume} MIN</Caps>
            {volDelta !== null && (
              <Caps className={`text-[10px] ${volDelta >= 0 ? "text-primary" : "text-error"}`}>
                {volDelta >= 0 ? "+" : ""}{volDelta}% VS SEMANA PASSADA
              </Caps>
            )}
          </div>
        </div>

        {/* Weekly goal */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <Caps className="text-primary">META SEMANAL</Caps>
            <div className="flex items-center gap-2">
              <button onClick={() => updateGoal(-1)} aria-label="Diminuir meta" className="w-7 h-7 rounded-full bg-surface-variant text-on-surface flex items-center justify-center hover:brightness-125 active:scale-95 transition">−</button>
              <span className="font-label-caps w-8 text-center text-primary">{goal}x</span>
              <button onClick={() => updateGoal(1)} aria-label="Aumentar meta" className="w-7 h-7 rounded-full bg-surface-variant text-on-surface flex items-center justify-center hover:brightness-125 active:scale-95 transition">+</button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {Array.from({ length: goal }).map((_, i) => (
              <MI key={i} name="fitness_center" fill={i < weekLogs.length} className={`text-2xl ${i < weekLogs.length ? "text-primary" : "text-surface-variant"}`} />
            ))}
            {weekLogs.length > goal && <Caps className="text-outline ml-1">+{weekLogs.length - goal}</Caps>}
          </div>
          <p className="text-[12px] text-on-surface-variant mt-3">{weekLogs.length} de {goal} treinos essa semana</p>
        </div>
      </div>

      {/* Frequency bar chart (30d) */}
      <section className="col-span-12 glass-card p-6 rounded-xl overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">FREQUÊNCIA DE TREINO (30D)</h3>
            <Caps className="text-on-surface-variant">CONSISTÊNCIA ACIMA DE INTENSIDADE</Caps>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-full" />
              <span className="text-[10px] font-label-caps">TREINO</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-surface-container-highest rounded-full" />
              <span className="text-[10px] font-label-caps">DESCANSO</span>
            </div>
          </div>
        </div>
        <div className="flex items-end justify-between h-32 gap-[3px] md:gap-2">
          {days30.map((d) => {
            const vol = freqByDate[d] || 0;
            const isToday = d === today;
            const hpct = vol === 0 ? 6 : Math.max(12, Math.round((vol / maxFreq) * 100));
            return (
              <div
                key={d}
                title={`${weekdayShort(d)} ${d} · ${vol} min`}
                style={{ height: `${hpct}%`, ...(isToday && vol ? GLOW : {}) }}
                className={`w-full rounded-t-sm transition-colors ${vol === 0 ? "bg-surface-container-highest" : "bg-primary hover:bg-primary-container"}`}
              />
            );
          })}
        </div>
      </section>

      {/* Recent workouts feed */}
      <div className="col-span-12 lg:col-span-4 glass-card p-4 rounded-xl border-primary/20 bg-primary/5">
        <div className="flex items-center gap-3 text-primary mb-3">
          <MI name="sensors" />
          <Caps>TREINOS DA SEMANA</Caps>
        </div>
        {weekLogs.length === 0 ? (
          <p className="text-[12px] text-on-surface-variant">Nenhum treino registrado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-56 overflow-y-auto ff-scroll">
            {weekLogs.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 rounded-lg px-3 py-2 bg-surface-container-high border border-white/5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md text-on-surface truncate">{l.type} · {l.durationMin} min</p>
                    <Caps className="text-outline text-[10px]">{weekdayShort(l.date)}, {l.date}</Caps>
                  </div>
                  <StarRating value={l.intensity} onChange={() => {}} size="text-sm" />
                  <button onClick={() => removeLog(l.id)} aria-label="Remover" className="text-outline hover:text-error transition">
                    <MI name="close" className="text-lg" />
                  </button>
                </div>
                {l.note && <p className="text-[12px] text-on-surface-variant">{l.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quote */}
      <div className="col-span-12 lg:col-span-8 glass-card p-6 rounded-xl flex items-center justify-center bg-surface-container">
        <blockquote className="text-center">
          <p className="font-headline-md text-headline-md italic text-primary/80">
            "Disciplina é a ponte entre metas e conquistas."
          </p>
          <cite className="font-label-caps text-label-caps text-on-surface-variant mt-2 block">— PROTOCOLO DISCIPLINE RATS</cite>
        </blockquote>
      </div>
    </div>
  );
}
