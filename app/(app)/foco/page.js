"use client";

// Foco: cronômetro pomodoro + as missões do quadro. Nada mais.
// O timer vive no AppContext (sobrevive à navegação); esta página só o pilota.
// As missões vêm de state.board — o MESMO quadro de /missoes, não uma lista paralela.

import Link from "next/link";
import { useApp } from "../AppContext";
import { MI, Caps, StatTile, Stepper } from "@/components/ui";
import { focusXp, formatTime, getDateStr, pendingCards, toggleBoardCardState } from "@/lib/state";

const PRI = {
  1: { label: "BAIXA", dot: "bg-outline" },
  2: { label: "MÉDIA", dot: "bg-primary-container" },
  3: { label: "ALTA", dot: "bg-error" },
};
const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default function FocoPage() {
  const { state, setState, timer, updateSetting } = useApp();
  const { phase, secondsLeft, isRunning, pending, toggleTimer, resetPhase, skipPhase } = timer;

  const today = getDateStr(0);
  const cards = pendingCards(state);
  const toggleCard = (colId, cardId) => setState((prev) => toggleBoardCardState(prev, colId, cardId));

  const phaseLabel = phase === "focus" ? "FASE DE FOCO PROFUNDO" : "PAUSA";
  const phaseTotal = (phase === "focus" ? state.settings.focusMin : state.settings.breakMin) * 60;
  const R = 90;
  const CIRC = 2 * Math.PI * R;
  const offset = phaseTotal > 0 ? CIRC * (secondsLeft / phaseTotal) : CIRC;
  const focusHours = Math.round(state.stats.totalMinutes / 60);

  return (
    <>
      <section className="grid grid-cols-3 gap-card-gap mb-8">
        <StatTile label="SESSÕES HOJE" value={state.stats.todaySessions}>
          <MI name="timer" className="text-primary-container" />
        </StatTile>
        <StatTile label="MINUTOS HOJE" value={state.stats.todayMinutes}>
          <MI name="schedule" className="text-on-surface-variant" />
        </StatTile>
        <StatTile label="TEMPO TOTAL" value={`${focusHours}h`}>
          <MI name="history" className="text-on-surface-variant" />
        </StatTile>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        {/* ---------- timer ---------- */}
        <div className="lg:col-span-8">
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
                  {pending && (
                    <Caps className="text-primary text-[10px] tracking-widest mt-1 block">
                      {phase === "focus" ? "TOQUE INICIAR PRA COMEÇAR" : "TOQUE INICIAR PRA DESCANSAR"}
                    </Caps>
                  )}
                </div>
              </div>

              <div className="flex gap-4 mt-10 items-center">
                <button
                  onClick={toggleTimer}
                  className={`px-8 md:px-10 py-4 bg-primary-container text-on-primary-container font-label-caps text-headline-md rounded-full font-black flex items-center gap-3 hover:scale-105 active:scale-95 transition-transform ${
                    pending ? "animate-pulse" : ""
                  }`}
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

              <p className="text-outline text-[12px] mt-6">Sessão concluída rende +{focusXp(state.settings.focusMin)} XP</p>
            </div>
          </div>
        </div>

        {/* ---------- missões do quadro + duração ---------- */}
        <div className="lg:col-span-4 space-y-gutter">
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline-md text-headline-md text-primary uppercase flex items-center gap-2">
                <MI name="flag" className="text-primary-container" /> Missões
              </h3>
              <Link href="/missoes" className="font-label-caps text-[10px] text-outline hover:text-primary transition">
                QUADRO
              </Link>
            </div>

            {cards.length === 0 ? (
              <div className="text-center py-8">
                <MI name="task_alt" className="text-outline text-3xl" />
                <p className="text-[13px] text-outline mt-2">Nada pendente no quadro.</p>
                <Link href="/missoes" className="mt-3 inline-block px-4 py-2 rounded-lg border border-primary/40 text-primary font-label-caps text-[11px]">
                  CRIAR MISSÃO
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto ff-scroll pr-1">
                  {cards.map((k) => {
                    const overdue = k.due && k.due < today;
                    const p = PRI[k.priority] || PRI[2];
                    return (
                      <div key={k.id} className="flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-surface-variant/30 transition">
                        <button
                          onClick={() => toggleCard(k.colId, k.id)}
                          aria-label={`Concluir ${k.text}`}
                          className="shrink-0 mt-0.5 text-outline hover:text-primary-container transition"
                        >
                          <MI name="radio_button_unchecked" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-on-surface leading-snug">{k.text}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                              <Caps className="text-outline text-[9px]">{k.colName}</Caps>
                            </span>
                            {k.due && (
                              <Caps className={`text-[9px] flex items-center gap-0.5 ${overdue ? "text-error" : "text-outline"}`}>
                                <MI name="event" className="text-[12px]" /> {ddmm(k.due)}
                              </Caps>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-outline mt-3 pt-3 border-t border-white/5">
                  Marcar aqui move o card no quadro, igual em Missões. Sem XP — card é livre de criar e de concluir.
                </p>
              </>
            )}
          </div>

          <div className="glass-card p-6 rounded-xl">
            <Caps className="text-outline text-[10px] mb-3 block">DURAÇÃO</Caps>
            <div className="flex flex-col gap-3">
              <Stepper label="Foco (min)" value={state.settings.focusMin} onDec={() => updateSetting("focusMin", -5, 5, 90)} onInc={() => updateSetting("focusMin", 5, 5, 90)} />
              <Stepper label="Pausa (min)" value={state.settings.breakMin} onDec={() => updateSetting("breakMin", -1, 1, 30)} onInc={() => updateSetting("breakMin", 1, 1, 30)} />
            </div>
            <p className="text-[11px] text-outline mt-3">O XP da sessão escala com a duração: 50 XP a cada 25 min.</p>
          </div>
        </div>
      </div>
    </>
  );
}
