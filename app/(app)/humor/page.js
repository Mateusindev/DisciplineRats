"use client";

import { useApp } from "../AppContext";
import { MI, Caps } from "@/components/ui";
import {
  getDateStr,
  last7Dates,
  MOOD_OPTIONS,
  MOOD_PERIODS,
  MOOD_TAGS,
  currentPeriodKey,
  moodDayAvg,
  moodHasContent,
  moodPeriodAverages,
} from "@/lib/state";
import { LineChart } from "@/components/charts";

const GLOW = { boxShadow: "0 0 15px var(--brand-glow)" };
const MOOD_ICON = {
  1: "sentiment_very_dissatisfied",
  2: "sentiment_dissatisfied",
  3: "sentiment_neutral",
  4: "sentiment_satisfied",
  5: "sentiment_very_satisfied",
};
const moodColor = (m) => (m >= 5 ? "text-primary-container" : m <= 1 ? "text-error" : "text-primary");

function moodStreak(moodMap) {
  let streak = 0;
  let off = moodHasContent(moodMap[getDateStr(0)]) ? 0 : -1;
  while (moodHasContent(moodMap[getDateStr(off)])) {
    streak++;
    off--;
  }
  return streak;
}

// lê o período `key` da entrada do dia, tolerando o formato legado (mood numérico → cai na Tarde)
function readPeriod(dayEntry, key) {
  if (!dayEntry) return null;
  if (typeof dayEntry.mood === "number") return key === "afternoon" ? { mood: dayEntry.mood, note: dayEntry.note || "", tags: [] } : null;
  return dayEntry[key] || null;
}

export default function HumorPage() {
  const { state, setState } = useApp();
  const today = getDateStr(0);
  const nowPeriod = currentPeriodKey();
  const dayEntry = state.mood[today];

  const days = last7Dates();
  const dayAvgs = days.map((d) => moodDayAvg(state.mood[d]));
  const withData = dayAvgs.filter((v) => v !== null);
  const avg = withData.length ? withData.reduce((s, v) => s + v, 0) / withData.length : null;
  const streak = moodStreak(state.mood);
  const registeredDays = days.filter((d) => moodHasContent(state.mood[d])).length;
  const goalPct = Math.round((registeredDays / 7) * 100);
  const periodAvgs = moodPeriodAverages(state.mood);

  // grava um período de hoje, migrando entrada legada p/ shape-por-período
  function updatePeriod(key, patch) {
    setState((prev) => {
      let day = prev.mood[today];
      if (day && typeof day.mood === "number") day = { afternoon: { mood: day.mood, note: day.note || "", tags: [] } };
      day = { ...(day || {}) };
      const cur = day[key] || {};
      const next = { mood: cur.mood, note: cur.note || "", tags: cur.tags || [], ...patch };
      if (typeof next.mood !== "number") delete day[key];
      else day[key] = next;
      return { ...prev, mood: { ...prev.mood, [today]: day } };
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
  const setNote = (key, txt) => updatePeriod(key, { note: txt.slice(0, 140) });

  return (
    <div className="space-y-8">
      {/* Header + stat tiles */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-card-gap">
        <div className="md:col-span-8 space-y-2">
          <h2 className="font-headline-lg text-headline-lg text-primary uppercase">Equilíbrio Emocional</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
            Registre o humor em cada período do dia. Assim dá pra ver o padrão — tarde pesada, treino à noite, humor que vira.
          </p>
        </div>
        <div className="md:col-span-4 flex justify-start md:justify-end items-start gap-4">
          <div className="glass-card p-4 rounded-xl flex flex-col items-center min-w-[100px]">
            <Caps className="text-primary-container">SEQUÊNCIA</Caps>
            <span className="font-headline-lg text-headline-lg">{streak} {streak === 1 ? "DIA" : "DIAS"}</span>
          </div>
          <div className="glass-card p-4 rounded-xl flex flex-col items-center min-w-[100px] border-primary-container/30">
            <Caps className="text-primary-container">MÉDIA 7D</Caps>
            <span className="font-headline-lg text-headline-lg text-primary-container">{avg ? avg.toFixed(1) : "—"}</span>
          </div>
        </div>
      </section>

      {/* Registro por período */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-card-gap">
        {MOOD_PERIODS.map((p) => {
          const cur = readPeriod(dayEntry, p.key);
          const isNow = p.key === nowPeriod;
          return (
            <div
              key={p.key}
              className={`glass-card p-5 rounded-xl flex flex-col gap-4 border ${isNow ? "border-primary/50" : "border-white/10"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MI name={p.icon} className={`text-xl ${isNow ? "text-primary" : "text-on-surface-variant"}`} />
                  <h3 className="font-headline-md text-headline-md">{p.label}</h3>
                  {isNow && <Caps className="text-[8px] text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">AGORA</Caps>}
                </div>
                {cur && <MI name={MOOD_ICON[cur.mood]} className={`text-2xl ${moodColor(cur.mood)}`} />}
              </div>

              {/* picker 1-5 */}
              <div className="grid grid-cols-5 gap-1.5">
                {MOOD_OPTIONS.map((opt) => {
                  const active = cur?.mood === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setMood(p.key, opt.value)}
                      aria-label={opt.label}
                      title={opt.label}
                      className={`aspect-square rounded-lg flex items-center justify-center transition active:scale-90 border ${
                        active ? "bg-primary/20 border-primary/50" : "border-white/10 hover:bg-primary/10"
                      }`}
                    >
                      <MI name={MOOD_ICON[opt.value]} className={`text-xl ${active ? moodColor(opt.value) : "text-on-surface-variant"}`} />
                    </button>
                  );
                })}
              </div>

              {/* tags */}
              <div className="flex flex-wrap gap-1.5">
                {MOOD_TAGS.map((t) => {
                  const on = (cur?.tags || []).includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTag(p.key, t.id)}
                      disabled={!cur}
                      className={`px-2 py-1 rounded-full text-[10px] font-label-caps flex items-center gap-1 border transition ${
                        on
                          ? "bg-primary-container/25 text-primary-container border-primary-container/40"
                          : "border-white/10 text-outline hover:border-white/25 disabled:opacity-40 disabled:hover:border-white/10"
                      }`}
                    >
                      <MI name={t.icon} className="text-xs" /> {t.label}
                    </button>
                  );
                })}
              </div>

              {/* nota */}
              <textarea
                value={cur?.note || ""}
                onChange={(e) => setNote(p.key, e.target.value)}
                disabled={!cur}
                placeholder={cur ? "Nota (opcional)" : "Escolha um humor pra anotar"}
                maxLength={140}
                rows={2}
                className="bg-surface-container-lowest border border-white/5 rounded-lg px-3 py-2 text-body-md outline-none focus:border-primary/50 transition-colors resize-none disabled:opacity-40"
              />
            </div>
          );
        })}
      </section>

      {/* Média por período */}
      <section className="glass-card p-6 rounded-xl">
        <h3 className="font-headline-md text-headline-md mb-5">MÉDIA POR PERÍODO</h3>
        <div className="grid grid-cols-3 gap-4">
          {MOOD_PERIODS.map((p) => {
            const a = periodAvgs[p.key];
            const pct = a.avg ? ((a.avg - 1) / 4) * 100 : 0;
            return (
              <div key={p.key} className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5 text-on-surface-variant">
                  <MI name={p.icon} className="text-base" />
                  <Caps className="text-[10px]">{p.label}</Caps>
                </div>
                <span className={`font-headline-md text-headline-md ${a.avg ? moodColor(Math.round(a.avg)) : "text-outline"}`}>
                  {a.avg ? a.avg.toFixed(1) : "—"}
                </span>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-primary-container rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <Caps className="text-[9px] text-outline">{a.n} {a.n === 1 ? "REGISTRO" : "REGISTROS"}</Caps>
              </div>
            );
          })}
        </div>
      </section>

      {/* Histórico (média do dia) */}
      <section className="glass-card p-8 rounded-xl">
        <div className="flex justify-between items-center mb-8">
          <h3 className="font-headline-md text-headline-md">HISTÓRICO (MÉDIA DO DIA)</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full text-[10px] font-label-caps border border-white/5">
              <span className="w-2 h-2 rounded-full bg-primary-container" /> ESCALA 1–5
            </div>
            <Caps className="text-primary text-[10px]">{goalPct}% DA SEMANA</Caps>
          </div>
        </div>
        {withData.length > 0 ? (
          <LineChart
            days={days}
            values={dayAvgs}
            today={today}
            yMin={0}
            yMax={5.4}
            format={(v) => MOOD_OPTIONS.find((o) => o.value === Math.round(v))?.emoji || (v ? v.toFixed(1) : v)}
            ariaLabel="Média de humor por dia nos últimos 7 dias (escala 1 a 5)"
          />
        ) : (
          <p className="text-[13px] text-outline text-center py-10">Sem registros ainda — marque seu humor de algum período pra começar o gráfico.</p>
        )}
      </section>
    </div>
  );
}
