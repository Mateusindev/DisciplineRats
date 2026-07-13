"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../AppContext";
import { MI, Caps, StatTile, inputCls } from "@/components/ui";
import {
  XP,
  award,
  gamify,
  fmtK,
  formatTime,
  getDateStr,
  computeHabitStreak,
  playChime,
  HABIT_ICONS,
} from "@/lib/state";

export default function FocoPage() {
  const { state, setState, completeFocusSession, board, myName } = useApp();
  const router = useRouter();

  const [phase, setPhase] = useState("focus");
  const [secondsLeft, setSecondsLeft] = useState(state.settings.focusMin * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [cyclePos, setCyclePos] = useState(0);
  const [newTask, setNewTask] = useState("");

  const settingsRef = useRef(state.settings);
  settingsRef.current = state.settings;

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;
        clearInterval(id);
        handlePhaseEnd();
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, phase]);

  function handlePhaseEnd() {
    playChime();
    const s = settingsRef.current;
    if (phase === "focus") {
      completeFocusSession();
      const nextPos = cyclePos + 1;
      if (nextPos >= s.cycleLength) {
        setCyclePos(0);
        setPhase("longBreak");
        setSecondsLeft(s.longBreakMin * 60);
      } else {
        setCyclePos(nextPos);
        setPhase("break");
        setSecondsLeft(s.breakMin * 60);
      }
    } else {
      setPhase("focus");
      setSecondsLeft(s.focusMin * 60);
    }
    setIsRunning(true);
  }

  function resetPhase() {
    setIsRunning(false);
    const s = state.settings;
    const dur = phase === "focus" ? s.focusMin : phase === "break" ? s.breakMin : s.longBreakMin;
    setSecondsLeft(dur * 60);
  }
  function skipPhase() {
    setIsRunning(false);
    handlePhaseEnd();
    setIsRunning(false);
  }

  function addTask() {
    const text = newTask.trim();
    if (!text) return;
    setState((prev) => ({ ...prev, tasks: [...prev.tasks, { id: Date.now(), text, done: false }] }));
    setNewTask("");
  }
  function toggleTask(id) {
    setState((prev) => {
      const tasks = prev.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      const today = getDateStr(0);
      const allDone = tasks.length > 0 && tasks.every((t) => t.done);
      if (allDone && prev.tasksBonusDate !== today) {
        return {
          ...prev,
          tasks,
          tasksBonusDate: today,
          stats: { ...prev.stats, xp: (prev.stats.xp || 0) + award(XP.tasksAllDone, prev.stats.streak) },
        };
      }
      return { ...prev, tasks };
    });
  }

  const g = gamify(state.stats);
  const phaseLabel = phase === "focus" ? "FASE DE FOCO PROFUNDO" : phase === "break" ? "PAUSA CURTA" : "PAUSA LONGA";
  const phaseTotal = (phase === "focus" ? state.settings.focusMin : phase === "break" ? state.settings.breakMin : state.settings.longBreakMin) * 60;
  const R = 90;
  const CIRC = 2 * Math.PI * R;
  const offset = phaseTotal > 0 ? CIRC * (secondsLeft / phaseTotal) : CIRC;

  const focusHours = Math.round(state.stats.totalMinutes / 60);
  const habits = state.habits.slice(0, 3);

  return (
    <>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-card-gap mb-12">
        <StatTile label="SEQUÊNCIA" value={state.stats.streak}>
          <MI name="local_fire_department" fill className="flame-active text-2xl" />
        </StatTile>
        <StatTile label="NÍVEL" value={g.level}>
          <span className="text-on-surface-variant font-label-caps text-[10px]">{g.tier}</span>
        </StatTile>
        <StatTile label="XP TOTAL" value={fmtK(g.xp)}>
          <MI name="military_tech" className="text-primary-container" />
        </StatTile>
        <StatTile label="TEMPO FOCO" value={`${focusHours}h`}>
          <MI name="history" className="text-on-surface-variant" />
        </StatTile>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        {/* Timer */}
        <div className="lg:col-span-8 glass-card p-8 md:p-12 rounded-xl flex flex-col items-center justify-center relative min-h-[420px] md:min-h-[500px]">
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative w-72 h-72 md:w-80 md:h-80 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full timer-glow" viewBox="0 0 200 200">
                <circle className="text-surface-variant" cx="100" cy="100" fill="transparent" r={R} stroke="currentColor" strokeWidth="6" />
                <circle
                  className="text-primary-container progress-ring__circle"
                  cx="100"
                  cy="100"
                  fill="transparent"
                  r={R}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="8"
                  style={{ strokeDasharray: CIRC, strokeDashoffset: offset }}
                />
              </svg>
              <div className="text-center">
                <div className="font-display-timer text-[72px] md:text-display-timer text-primary leading-none">{formatTime(secondsLeft)}</div>
                <Caps className="text-outline tracking-widest mt-2 uppercase block">{phaseLabel}</Caps>
                <Caps className="text-outline-variant block mt-1">SÉRIE {cyclePos + 1} / {state.settings.cycleLength}</Caps>
              </div>
            </div>

            <div className="flex gap-4 mt-10 items-center">
              <button
                onClick={() => setIsRunning((r) => !r)}
                className="px-8 md:px-10 py-4 bg-primary-container text-on-primary-container font-label-caps text-headline-md rounded-full font-black flex items-center gap-3 hover:scale-105 active:scale-95 transition-transform"
              >
                <MI name={isRunning ? "pause" : "play_arrow"} fill />
                {isRunning ? "PAUSAR" : "INICIAR"}
              </button>
              <button onClick={resetPhase} aria-label="Reiniciar" className="w-16 h-16 glass-card rounded-full flex items-center justify-center text-primary hover:bg-primary-container/10 active:scale-95 transition">
                <MI name="refresh" />
              </button>
              <button onClick={skipPhase} aria-label="Pular" className="w-16 h-16 glass-card rounded-full flex items-center justify-center text-primary hover:bg-primary-container/10 active:scale-95 transition">
                <MI name="skip_next" />
              </button>
            </div>
            <p className="text-outline text-[12px] mt-6">
              {state.stats.todaySessions} sessão(ões) hoje · {state.stats.todayMinutes} min
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-gutter">
          <div className="glass-card p-6 rounded-xl border-primary-container/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline-md text-headline-md text-primary">PRÓXIMA RECOMPENSA</h3>
              <MI name="inventory_2" className="text-primary-container" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-lg bg-surface-variant flex items-center justify-center text-primary-container">
                <MI name="workspace_premium" fill className="text-4xl" />
              </div>
              <div className="flex-1">
                <div className="text-body-md font-bold text-on-surface">Emblema Nível {g.level + 1}</div>
                <div className="w-full bg-surface-variant h-2 rounded-full mt-2">
                  <div className="bg-primary-container h-full rounded-full" style={{ width: `${g.pct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] font-label-caps text-outline mt-1">
                  <span>{g.intoLevel}/{g.toNext} XP</span>
                  <span>{g.pct}%</span>
                </div>
              </div>
            </div>
            <p className="text-[12px] text-on-surface-variant leading-relaxed">
              Foco +{XP.focus} · metas do dia +{XP.tasksAllDone} · sono na meta +{XP.sleepGoal} · treino +{XP.exercise}. Streak multiplica (+5%/dia).
            </p>
          </div>

          {/* Missões = tasks */}
          <div className="glass-card p-6 rounded-xl">
            <h3 className="font-headline-md text-headline-md text-primary mb-4">MISSÕES DE HOJE</h3>
            <div className="space-y-3">
              {state.tasks.length === 0 && <p className="text-[12px] text-outline">Nenhuma meta ainda. Adicione de 1 a 3 metas claras.</p>}
              {state.tasks.map((t) => (
                <div key={t.id} className={`flex items-center gap-3 p-3 bg-surface-container-high rounded-lg border border-white/5 ${t.done ? "" : "opacity-70"}`}>
                  <button onClick={() => toggleTask(t.id)} aria-label="Alternar meta">
                    <MI name={t.done ? "task_alt" : "radio_button_unchecked"} fill={t.done} className={t.done ? "text-primary-container" : "text-outline"} />
                  </button>
                  <div className="flex-1">
                    <div className={`text-[13px] font-bold ${t.done ? "line-through text-outline" : "text-on-surface"}`}>{t.text}</div>
                    <div className="text-[10px] text-outline">RECOMPENSA: +50 XP</div>
                  </div>
                  <Caps className={t.done ? "text-primary-container text-[10px]" : "text-outline text-[10px]"}>{t.done ? "FEITA" : "ATIVA"}</Caps>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="Nova meta..."
                className={`${inputCls} flex-1 text-[13px]`}
              />
              <button onClick={addTask} aria-label="Adicionar meta" className="px-3 rounded-lg bg-primary-container text-on-primary-container flex items-center active:scale-95 transition">
                <MI name="add" />
              </button>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="glass-card p-6 rounded-xl bg-gradient-to-br from-surface-container to-background">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline-md text-headline-md text-primary">TOP DISCÍPULOS</h3>
              <MI name="leaderboard" className="text-outline" />
            </div>
            {board.length === 0 ? (
              <p className="text-[12px] text-outline">Sem ranking ainda. Ganhe XP pra aparecer.</p>
            ) : (
              <div className="space-y-3">
                {board.slice(0, 6).map((row, i) => {
                  const me = row.username === myName;
                  return (
                    <div
                      key={i}
                      className={`flex justify-between items-center text-[13px] ${
                        me ? "bg-primary-container/10 px-2 py-1 rounded border border-primary-container/20" : "text-on-surface/80"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={me ? "text-primary font-bold" : "text-outline"}>{i + 1}.</span> {me ? "VOCÊ" : row.username}
                      </span>
                      <Caps className={me ? "text-primary" : ""}>{fmtK(row.xp)} XP</Caps>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Disciplinas = habits preview */}
      <section className="mt-section-margin">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary uppercase">Disciplinas</h2>
            <p className="text-on-surface-variant text-body-md">Forje seu caráter na repetição diária.</p>
          </div>
          <button onClick={() => router.push("/habitos")} className="text-primary font-label-caps text-label-caps flex items-center gap-2 hover:underline">
            VER TODOS <MI name="arrow_forward" className="text-sm" />
          </button>
        </div>
        {habits.length === 0 ? (
          <div className="glass-card p-8 rounded-xl text-center">
            <p className="text-on-surface-variant">Nenhum hábito ainda. Vá em Hábitos para criar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {habits.map((h, i) => {
              const done = h.doneDates.includes(getDateStr(0));
              const streak = computeHabitStreak(h.doneDates);
              return (
                <div key={h.id} className="glass-card p-8 rounded-xl group hover:border-primary/40 transition-all">
                  <div className="w-12 h-12 rounded bg-primary-container/20 flex items-center justify-center text-primary-container mb-6 group-hover:scale-110 transition-transform">
                    <MI name={HABIT_ICONS[i % HABIT_ICONS.length]} className="text-3xl" />
                  </div>
                  <h4 className="font-headline-md text-headline-md mb-2">{h.name}</h4>
                  <div className="flex items-center justify-between text-outline-variant font-label-caps text-[10px] mb-4">
                    <span className="flex items-center gap-1"><MI name="local_fire_department" className="text-sm" /> {streak} DIAS</span>
                    <span>{done ? "100%" : "0%"}</span>
                  </div>
                  <div className="w-full bg-surface-variant h-1 rounded-full mb-6">
                    <div className="bg-primary-container h-full rounded-full transition-all" style={{ width: done ? "100%" : "0%" }} />
                  </div>
                  <button
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        habits: prev.habits.map((x) =>
                          x.id === h.id
                            ? { ...x, doneDates: done ? x.doneDates.filter((d) => d !== getDateStr(0)) : [...x.doneDates, getDateStr(0)] }
                            : x
                        ),
                      }))
                    }
                    className={`w-full py-2 font-label-caps text-[10px] rounded transition-colors ${
                      done ? "bg-primary-container text-on-primary-container" : "border border-primary text-primary hover:bg-primary/10"
                    }`}
                  >
                    {done ? "CONCLUÍDO HOJE" : "MARCAR AGORA"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
