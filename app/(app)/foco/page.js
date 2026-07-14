"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, StatTile, inputCls } from "@/components/ui";
import { XP, award, focusXp, sleepXp, gamify, fmtK, formatTime, getDateStr, youtubeId, DEFAULT_LOFI_URL } from "@/lib/state";

export default function FocoPage() {
  const { state, setState, board, myName, timer, toast } = useApp();

  // timer é global (vive no AppContext) — persiste entre páginas
  const { phase, secondsLeft, isRunning, cyclePos, toggleTimer, resetPhase, skipPhase } = timer;
  const [newTask, setNewTask] = useState("");

  // player lofi
  const lofiUrl = state.settings.lofiUrl || DEFAULT_LOFI_URL;
  const lofiId = youtubeId(lofiUrl);
  const [lofiInput, setLofiInput] = useState(lofiUrl);
  function playLofi(url) {
    const target = (url ?? lofiInput).trim();
    if (!youtubeId(target)) {
      toast("URL do YouTube inválida", { type: "error" });
      return;
    }
    setLofiInput(target);
    setState((prev) => ({ ...prev, settings: { ...prev.settings, lofiUrl: target } }));
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
        {/* Coluna principal: timer + player lofi (mesma largura) */}
        <div className="lg:col-span-8 space-y-gutter">
          {/* Timer */}
          <div className="glass-card p-8 md:p-12 rounded-xl flex flex-col items-center justify-center relative min-h-[420px] md:min-h-[500px]">
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
                onClick={toggleTimer}
                className="px-8 md:px-10 py-4 bg-primary-container text-on-primary-container font-label-caps text-headline-md rounded-full font-black flex items-center gap-3 hover:scale-105 active:scale-95 transition-transform"
              >
                <MI name={isRunning ? "pause" : "play_arrow"} fill />
                {isRunning ? "PAUSAR" : "INICIAR"}
              </button>
              <button onClick={resetPhase} aria-label="Reiniciar" className="w-16 h-16 glass-card rounded-full flex items-center justify-center text-primary hover:bg-primary-container/10 active:scale-95 transition">
                <MI name="refresh" />
              </button>
              {phase !== "focus" && (
                <button onClick={skipPhase} aria-label="Pular pausa" className="w-16 h-16 glass-card rounded-full flex items-center justify-center text-primary hover:bg-primary-container/10 active:scale-95 transition">
                  <MI name="skip_next" />
                </button>
              )}
            </div>
            <p className="text-outline text-[12px] mt-6">
              {state.stats.todaySessions} sessão(ões) hoje · {state.stats.todayMinutes} min
            </p>
          </div>
          </div>

          {/* Missões de hoje — abaixo do timer */}
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
                    <div className="text-[10px] text-outline">RECOMPENSA: +{XP.tasksAllDone} XP (todas feitas)</div>
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
              Foco +{focusXp(state.settings.focusMin)} · metas do dia +{XP.tasksAllDone} · sono na meta +{sleepXp(state.settings.sleepGoalMin)} · treino +{XP.exercise}. Foco/sono escalam com duração/meta. Streak multiplica (+5%/dia).
            </p>
          </div>

          {/* Player lofi — sidebar */}
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-headline-md text-headline-md text-primary flex items-center gap-2">
                <MI name="music_note" className="text-primary-container" /> LOFI
              </h3>
              {lofiUrl !== DEFAULT_LOFI_URL && (
                <button
                  onClick={() => playLofi(DEFAULT_LOFI_URL)}
                  className="font-label-caps text-[10px] text-outline hover:text-primary transition"
                >
                  PADRÃO
                </button>
              )}
            </div>
            {lofiId ? (
              <div className="aspect-video w-full rounded-lg overflow-hidden border border-white/10 mb-3">
                <iframe
                  key={lofiId}
                  src={`https://www.youtube-nocookie.com/embed/${lofiId}?rel=0&autoplay=1&loop=1&playlist=${lofiId}`}
                  title="Player lofi"
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <p className="text-[12px] text-error mb-3">URL inválida.</p>
            )}
            <div className="flex gap-2">
              <input
                value={lofiInput}
                onChange={(e) => setLofiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && playLofi()}
                placeholder="URL do YouTube..."
                className={`${inputCls} flex-1 text-[12px] min-w-0`}
              />
              <button
                onClick={() => playLofi()}
                aria-label="Tocar"
                className="px-3 rounded-lg bg-primary-container text-on-primary-container flex items-center active:scale-95 transition shrink-0"
              >
                <MI name="play_arrow" fill />
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
    </>
  );
}
