"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppProvider, useApp } from "./AppContext";
import { MI, Caps, Stepper } from "@/components/ui";
import { TABS, XP, gamify, fmtK, focusXp, sleepXp, SLEEP_GOAL_MIN, SLEEP_GOAL_MAX } from "@/lib/state";
import { hasSupabase } from "@/lib/persistence";

function Chrome({ children }) {
  const { loaded, state, showSettings, setShowSettings, saveError, updateSetting, resetAllData, handleLogout } = useApp();
  const pathname = usePathname();

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-outline">
        <p className="font-label-caps text-label-caps">CARREGANDO PAINEL...</p>
      </div>
    );
  }

  const g = gamify(state.stats);

  return (
    <div className="min-h-screen bg-background">
      {/* Side nav (desktop) */}
      <aside className="hidden md:flex flex-col bg-surface-container border-r border-outline-variant w-64 fixed left-0 top-0 bottom-0 pt-6 pb-6 z-40">
        <div className="px-6 mb-6 flex items-center justify-between">
          <div className="font-headline-md text-headline-md font-black text-primary tracking-tighter flex items-center gap-2 leading-none">
            <MI name="fitness_center" className="text-primary-container" /> DISCIPLINE<br />RATS
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/perfil"
              aria-label="Perfil"
              className={`p-1 transition active:opacity-80 ${pathname === "/perfil" ? "text-primary-container" : "text-primary"}`}
            >
              <MI name="account_circle" fill={pathname === "/perfil"} />
            </Link>
            <button
              aria-label="Configurações"
              onClick={() => setShowSettings((v) => !v)}
              className={`transition p-1 ${showSettings ? "text-primary-container" : "text-primary"} active:opacity-80`}
            >
              <MI name="settings" fill={showSettings} />
            </button>
          </div>
        </div>
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold">
              {g.level}
            </div>
            <div>
              <div className="font-headline-md text-headline-md text-primary leading-tight">{g.tier}</div>
              <Caps className="text-[10px] text-outline-variant">MODO DISCIPLINE RATS</Caps>
            </div>
          </div>
          <div className="w-full bg-surface-variant h-1.5 rounded-full mt-4">
            <div className="bg-primary-container h-full rounded-full" style={{ width: `${g.pct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] font-label-caps text-outline mt-1">
            <span>NÍVEL {g.level}</span>
            <span>{fmtK(g.xp)} XP</span>
          </div>
        </div>

        <nav className="flex-1">
          {TABS.map((t) => {
            const active = pathname === t.path;
            return (
              <Link
                key={t.id}
                href={t.path}
                className={`w-[calc(100%-1rem)] mx-2 my-1 px-4 py-3 flex items-center gap-3 font-label-caps text-label-caps rounded-lg active:scale-95 duration-150 transition ${
                  active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
                }`}
              >
                <MI name={t.icon} fill={active} /> {t.label.toUpperCase()}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 mt-auto space-y-2">
          {hasSupabase() && (
            <button
              onClick={handleLogout}
              className="w-full py-2 flex items-center justify-center gap-2 text-outline hover:text-error font-label-caps text-[10px] transition"
            >
              <MI name="logout" className="text-sm" /> SAIR
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="md:pl-64 pt-8 pb-32 md:pb-12 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-container-padding py-8">
          {showSettings && (
            <div className="glass-card p-6 rounded-xl mb-gutter flex flex-col gap-3">
              <h3 className="font-headline-md text-headline-md text-primary">CONFIGURAÇÕES</h3>
              <Stepper label="Foco (min)" value={state.settings.focusMin} onDec={() => updateSetting("focusMin", -5, 5, 90)} onInc={() => updateSetting("focusMin", 5, 5, 90)} />
              <Stepper label="Pausa (min)" value={state.settings.breakMin} onDec={() => updateSetting("breakMin", -1, 1, 30)} onInc={() => updateSetting("breakMin", 1, 1, 30)} />
              <Stepper label="Meta de sono (min)" value={state.settings.sleepGoalMin} onDec={() => updateSetting("sleepGoalMin", -15, SLEEP_GOAL_MIN, SLEEP_GOAL_MAX)} onInc={() => updateSetting("sleepGoalMin", 15, SLEEP_GOAL_MIN, SLEEP_GOAL_MAX)} />
              <Stepper label="Meta de treinos/semana" value={state.settings.exerciseWeeklyGoal} onDec={() => updateSetting("exerciseWeeklyGoal", -1, 1, 14)} onInc={() => updateSetting("exerciseWeeklyGoal", 1, 1, 14)} />
              <Stepper label="Meta de kcal/dia" value={state.settings.dietKcalGoal} onDec={() => updateSetting("dietKcalGoal", -50, 1000, 5000)} onInc={() => updateSetting("dietKcalGoal", 50, 1000, 5000)} />
              <Stepper label="Meta de proteína (g)" value={state.settings.dietProteinGoal} onDec={() => updateSetting("dietProteinGoal", -5, 20, 400)} onInc={() => updateSetting("dietProteinGoal", 5, 20, 400)} />
              <Stepper label="Meta de carboidrato (g)" value={state.settings.dietCarbGoal} onDec={() => updateSetting("dietCarbGoal", -5, 20, 600)} onInc={() => updateSetting("dietCarbGoal", 5, 20, 600)} />
              <Stepper label="Meta de gordura (g)" value={state.settings.dietFatGoal} onDec={() => updateSetting("dietFatGoal", -5, 10, 250)} onInc={() => updateSetting("dietFatGoal", 5, 10, 250)} />
              <p className="text-[11px] text-outline">
                XP: foco +{focusXp(state.settings.focusMin)} · metas do dia +{XP.tasksAllDone} · sono na meta +{sleepXp(state.settings.sleepGoalMin)} · treino +{XP.exercise}. Foco e sono escalam com a duração/meta. Streak dá +5%/dia (máx +50%).
              </p>
              <button onClick={resetAllData} className="self-start mt-1 px-3 py-1.5 rounded font-label-caps text-[10px] text-error border border-error/60 hover:bg-error/10 transition">
                REINICIAR TODOS OS DADOS
              </button>
              {saveError && <p className="text-[12px] text-error">Não foi possível salvar agora. Progresso pode não persistir.</p>}
            </div>
          )}

          {children}
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-4 md:hidden bg-surface-container-highest/80 backdrop-blur-xl shadow-2xl border-t border-outline-variant/10">
        {TABS.map((t) => {
          const active = pathname === t.path;
          return (
            <Link
              key={t.id}
              href={t.path}
              className={`flex flex-col items-center justify-center transition ${active ? "text-primary scale-110 font-bold" : "text-on-surface-variant"}`}
            >
              <MI name={t.icon} fill={active} />
              <Caps className="text-[10px] mt-1">{t.label}</Caps>
            </Link>
          );
        })}
        <Link
          href="/perfil"
          className={`flex flex-col items-center justify-center transition ${pathname === "/perfil" ? "text-primary scale-110 font-bold" : "text-on-surface-variant"}`}
        >
          <MI name="account_circle" fill={pathname === "/perfil"} />
          <Caps className="text-[10px] mt-1">Perfil</Caps>
        </Link>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={`flex flex-col items-center justify-center transition ${showSettings ? "text-primary scale-110 font-bold" : "text-on-surface-variant"}`}
        >
          <MI name="settings" fill={showSettings} />
          <Caps className="text-[10px] mt-1">Config</Caps>
        </button>
      </nav>

    </div>
  );
}

export default function AppLayout({ children }) {
  return (
    <AppProvider>
      <Chrome>{children}</Chrome>
    </AppProvider>
  );
}
