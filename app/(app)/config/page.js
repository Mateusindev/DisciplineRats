"use client";

import { useApp } from "../AppContext";
import { MI, Caps, Stepper, PageHeader } from "@/components/ui";
import { XP, focusXp, sleepXp, SLEEP_GOAL_MIN, SLEEP_GOAL_MAX } from "@/lib/state";
import { MODES, DEFAULT_MODE } from "@/lib/themes";
import { hasSupabase } from "@/lib/persistence";

export default function ConfigPage() {
  const { state, saveError, updateSetting, setSetting, resetAllData, handleLogout } = useApp();

  return (
    <>
      <PageHeader title="Configurações" subtitle="Ajuste metas, tema e preferências." />

      <div className="glass-card p-6 rounded-xl flex flex-col gap-3 max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <span className="font-body-md text-on-surface-variant">Tema</span>
          <div className="flex gap-1.5 bg-surface-container-highest p-1 rounded-lg">
            {MODES.map((m) => {
              const active = (state.settings.mode || DEFAULT_MODE) === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSetting("mode", m.id)}
                  aria-label={m.label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-label-caps text-[11px] transition ${active ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/50"}`}
                >
                  <MI name={m.icon} className="text-[16px]" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <Stepper label="Foco (min)" value={state.settings.focusMin} onDec={() => updateSetting("focusMin", -5, 5, 90)} onInc={() => updateSetting("focusMin", 5, 5, 90)} />
        <Stepper label="Pausa (min)" value={state.settings.breakMin} onDec={() => updateSetting("breakMin", -1, 1, 30)} onInc={() => updateSetting("breakMin", 1, 1, 30)} />
        <Stepper label="Meta de sono (min)" value={state.settings.sleepGoalMin} onDec={() => updateSetting("sleepGoalMin", -15, SLEEP_GOAL_MIN, SLEEP_GOAL_MAX)} onInc={() => updateSetting("sleepGoalMin", 15, SLEEP_GOAL_MIN, SLEEP_GOAL_MAX)} />
        <div className="flex items-center justify-between gap-3">
          <span className="font-body-md text-on-surface-variant">Deitar até (horário saudável)</span>
          <input
            type="time"
            value={state.settings.sleepLimit || "23:30"}
            onChange={(e) => e.target.value && setSetting("sleepLimit", e.target.value)}
            aria-label="Horário limite pra dormir"
            className="bg-surface-container-highest px-3 py-1.5 rounded-lg border border-white/10 focus:border-primary/50 outline-none text-on-surface font-headline-md text-headline-md"
          />
        </div>
        <Stepper label="Meta de treinos/semana" value={state.settings.exerciseWeeklyGoal} onDec={() => updateSetting("exerciseWeeklyGoal", -1, 1, 14)} onInc={() => updateSetting("exerciseWeeklyGoal", 1, 1, 14)} />
        <Stepper label="Meta de kcal/dia" value={state.settings.dietKcalGoal} onDec={() => updateSetting("dietKcalGoal", -50, 1000, 5000)} onInc={() => updateSetting("dietKcalGoal", 50, 1000, 5000)} />
        <Stepper label="Meta de proteína (g)" value={state.settings.dietProteinGoal} onDec={() => updateSetting("dietProteinGoal", -5, 20, 400)} onInc={() => updateSetting("dietProteinGoal", 5, 20, 400)} />
        <Stepper label="Meta de carboidrato (g)" value={state.settings.dietCarbGoal} onDec={() => updateSetting("dietCarbGoal", -5, 20, 600)} onInc={() => updateSetting("dietCarbGoal", 5, 20, 600)} />
        <Stepper label="Meta de gordura (g)" value={state.settings.dietFatGoal} onDec={() => updateSetting("dietFatGoal", -5, 10, 250)} onInc={() => updateSetting("dietFatGoal", 5, 10, 250)} />
        <p className="text-[11px] text-outline">
          XP: foco +{focusXp(state.settings.focusMin)} · metas do dia +{XP.tasksAllDone} · sono na meta +{sleepXp(state.settings.sleepGoalMin)} · treino +{XP.exercise}. Foco e sono escalam com a duração/meta. Streak dá +5%/dia (máx +50%). Comportamento não cumprido tira metade do XP que daria (foco isento; inegociável da rotina tira −{XP.routineCriticalPenalty}).
        </p>
        <button onClick={resetAllData} className="self-start mt-1 px-3 py-1.5 rounded font-label-caps text-[10px] text-error border border-error/60 hover:bg-error/10 transition">
          REINICIAR TODOS OS DADOS
        </button>
        {saveError && <p className="text-[12px] text-error">Não foi possível salvar agora. Progresso pode não persistir.</p>}
        {hasSupabase() && (
          <button
            onClick={handleLogout}
            className="self-start mt-2 flex items-center gap-2 text-outline hover:text-error font-label-caps text-[10px] transition"
          >
            <MI name="logout" className="text-sm" /> SAIR DA CONTA
          </button>
        )}
      </div>
    </>
  );
}
