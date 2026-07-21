"use client";

import Link from "next/link";
import { useApp } from "../AppContext";
import { MI, Caps, StatTile } from "@/components/ui";
import { gamify, fmtK, getDateStr, toggleHabitState, habitPriority, computeHabitStreak } from "@/lib/state";

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const count = (div) => (div.items || []).length;

// ---- Layout 5: painel (métrica grande + chips de exercícios) ----
function WoDashboard({ workouts }) {
  return (
    <div className="space-y-3">
      {workouts.map(({ mod, div }) => (
        <div key={div.id} className="glass-card rounded-xl p-5 flex flex-col sm:flex-row gap-5">
          <div className="sm:w-32 shrink-0 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1">
            <div className="text-metric-mobile font-metric-mobile text-primary-container leading-none">{count(div)}</div>
            <div>
              <div className="font-headline-md text-[16px] text-primary leading-tight">{div.name}</div>
              <Caps className="text-outline text-[9px]">{mod}</Caps>
            </div>
          </div>
          <div className="flex-1 border-t sm:border-t-0 sm:border-l border-white/5 sm:pl-5 pt-3 sm:pt-0">
            {count(div) > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {div.items.map((it) => (
                  <span key={it.id} className="px-2.5 py-1 rounded-full bg-surface-container-high text-[12px] text-on-surface-variant" title={it.detail || ""}>
                    {it.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-outline">Sem exercícios cadastrados</p>
            )}
            <Link href="/exercicio" className="inline-block mt-3 font-label-caps text-[10px] text-primary-container">REGISTRAR →</Link>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { state, setState, myName } = useApp();
  const g = gamify(state.stats);
  const today = getDateStr(0);
  const todayIdx = (new Date().getDay() + 6) % 7; // 0=Seg … 6=Dom (casa com weekStartOf)
  const FULL_DATE = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  // treino do dia: todas as divisões (com modalidade) agendadas pra hoje
  const todayWorkouts = [];
  for (const m of state.workoutPlan || []) {
    for (const d of m.divisions || []) {
      if ((d.weekdays || []).includes(todayIdx)) todayWorkouts.push({ mod: m.name, div: d });
    }
  }

  // hábitos marcáveis (build + weekly; quit tem fluxo próprio)
  const habits = (state.habits || []).filter((h) => (h.kind || "build") !== "quit");

  function toggle(id) {
    setState((prev) => toggleHabitState(prev, id, today));
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="font-headline-lg text-headline-lg text-primary uppercase">
          {greeting()}{myName ? `, ${myName}` : ""}
        </h2>
        <p className="text-on-surface-variant text-body-md capitalize">{FULL_DATE}</p>
      </div>

      {/* resumo */}
      <section className="grid grid-cols-3 gap-card-gap mb-6">
        <StatTile label="SEQUÊNCIA" value={state.stats.streak}>
          <MI name="local_fire_department" fill className="flame-active text-2xl" />
        </StatTile>
        <StatTile label="NÍVEL" value={g.level}>
          <span className="text-on-surface-variant font-label-caps text-[10px]">{g.tier}</span>
        </StatTile>
        <StatTile label="XP TOTAL" value={fmtK(g.xp)}>
          <MI name="military_tech" className="text-primary-container" />
        </StatTile>
      </section>

      <div className="glass-card p-6 rounded-xl mb-12">
        <div className="w-full bg-surface-variant h-1.5 rounded-full">
          <div className="bg-primary-container h-full rounded-full transition-all" style={{ width: `${g.pct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] font-label-caps text-outline mt-1.5">
          <span>NÍVEL {g.level}</span>
          <span>FALTAM {fmtK(g.toNext)} XP</span>
        </div>
      </div>

      {/* treino do dia */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-headline-md text-headline-md text-primary uppercase flex items-center gap-2">
            <MI name="fitness_center" className="text-primary-container" /> Treino de hoje
          </h3>
          <Link href="/exercicio" className="font-label-caps text-[10px] text-outline hover:text-primary transition">
            VER TUDO
          </Link>
        </div>

        {todayWorkouts.length === 0 ? (
          <div className="glass-card p-8 rounded-xl text-center">
            <MI name="self_improvement" className="text-4xl text-outline mb-2" />
            <p className="font-headline-md text-headline-md text-on-surface-variant">Descanso hoje</p>
            <p className="text-[12px] text-outline mt-1">
              Nenhum treino agendado pra hoje. Defina os dias em <Link href="/exercicio" className="text-primary underline">Meus Treinos</Link>.
            </p>
          </div>
        ) : (
          <WoDashboard workouts={todayWorkouts} />
        )}
      </section>

      {/* hábitos */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-md text-headline-md text-primary uppercase flex items-center gap-2">
            <MI name="check_circle" className="text-primary-container" /> Hábitos de hoje
          </h3>
          <Link href="/habitos" className="font-label-caps text-[10px] text-outline hover:text-primary transition">
            VER TUDO
          </Link>
        </div>

        {habits.length === 0 ? (
          <div className="glass-card p-8 rounded-xl text-center">
            <p className="text-[12px] text-outline">
              Nenhum hábito ainda. Crie o primeiro em <Link href="/habitos" className="text-primary underline">Hábitos</Link>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {habits.map((h) => {
              const done = (h.doneDates || []).includes(today);
              const streak = computeHabitStreak(h.doneDates);
              const noXp = (h.kind || "build") === "weekly" && h.direction === "max";
              return (
                <button
                  key={h.id}
                  onClick={() => toggle(h.id)}
                  aria-pressed={done}
                  className={`glass-card p-4 rounded-xl text-left transition active:scale-[0.98] ${
                    done ? "border-primary-container/50 bg-primary-container/10" : "hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <MI name={h.icon || "check_circle"} className={done ? "text-primary-container" : "text-outline"} />
                    <MI
                      name={done ? "check_circle" : "radio_button_unchecked"}
                      fill={done}
                      className={done ? "text-primary-container" : "text-outline"}
                    />
                  </div>
                  <div className="font-body-md text-[14px] text-on-surface leading-tight mb-1 line-clamp-2">{h.name}</div>
                  <div className="flex items-center gap-1 text-outline-variant font-label-caps text-[9px]">
                    <MI name="local_fire_department" className={`text-xs ${streak > 0 ? "text-primary-container" : ""}`} />
                    {streak}D
                    {!noXp && <span className="ml-auto">+{habitPriority(h).xp} XP</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
