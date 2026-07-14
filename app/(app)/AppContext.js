"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSession, loadState, saveState, fetchLeaderboard, signOut, readLocal, hasSupabase } from "@/lib/persistence";
import { defaultState, mergeWithDefaults, getDateStr, XP, award, formatTime, playChime } from "@/lib/state";
import { MI } from "@/components/ui";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const TIMER_KEY = "ferro-focus-timer"; // snapshot do cronômetro (persiste no reload)

function Toaster() {
  const { toasts } = useApp();
  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 pointer-events-none sm:w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in glass-card rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl border-l-4 ${
            t.type === "error" ? "border-l-error" : "border-l-primary-container"
          }`}
        >
          <MI
            name={t.icon || (t.type === "error" ? "error" : "check_circle")}
            fill
            className={t.type === "error" ? "text-error" : "text-primary-container"}
          />
          <div className="flex-1 min-w-0">
            <p className="font-body-md text-body-md text-on-surface leading-tight">{t.title}</p>
            {t.sub && <p className="font-label-caps text-[10px] text-on-surface-variant">{t.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimerWidget() {
  const { timer } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  if (!timer || !timer.active || pathname === "/foco") return null;
  const { phase, secondsLeft, isRunning, phaseTotal, toggleTimer } = timer;
  const label = phase === "focus" ? "FOCO" : phase === "break" ? "PAUSA" : "PAUSA LONGA";
  const R = 18;
  const CIRC = 2 * Math.PI * R;
  const offset = phaseTotal > 0 ? CIRC * (secondsLeft / phaseTotal) : CIRC;
  return (
    <div className="fixed bottom-4 right-4 z-[90] glass-card rounded-2xl pl-3 pr-2 py-2 flex items-center gap-3 shadow-2xl border border-primary-container/30">
      <button
        onClick={() => router.push("/foco")}
        aria-label="Abrir foco"
        className="relative w-12 h-12 flex items-center justify-center shrink-0"
      >
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={R} fill="transparent" stroke="currentColor" strokeWidth="3" className="text-surface-variant" />
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-primary-container"
            style={{ strokeDasharray: CIRC, strokeDashoffset: offset, transition: "stroke-dashoffset 0.25s linear" }}
          />
        </svg>
        <MI name={phase === "focus" ? "psychology" : "self_improvement"} className="text-primary-container text-lg" />
      </button>
      <div className="min-w-0">
        <div className="font-display-timer text-headline-md text-primary leading-none tabular-nums">{formatTime(secondsLeft)}</div>
        <div className="font-label-caps text-[9px] text-outline tracking-widest">{label}</div>
      </div>
      <button
        onClick={toggleTimer}
        aria-label={isRunning ? "Pausar" : "Retomar"}
        className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center active:scale-95 transition shrink-0"
      >
        <MI name={isRunning ? "pause" : "play_arrow"} fill className="text-lg" />
      </button>
    </div>
  );
}

export function AppProvider({ children }) {
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState(defaultState());
  const [showSettings, setShowSettings] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [myName, setMyName] = useState("");
  const [board, setBoard] = useState([]);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((title, opts = {}) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, title, sub: opts.sub, icon: opts.icon, type: opts.type || "success" }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 3000);
  }, []);

  const router = useRouter();
  const saveTimer = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const userIdRef = useRef(null);

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  // redireciona ao /login em signout
  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  // leaderboard real
  useEffect(() => {
    if (!loaded || !hasSupabase()) return;
    fetchLeaderboard().then(setBoard);
  }, [loaded, state.stats.xp]);

  // carga inicial
  useEffect(() => {
    (async () => {
      try {
        let uid = null;
        if (hasSupabase()) {
          const session = await getSession();
          if (!session) {
            router.replace("/login");
            return;
          }
          uid = session.user.id;
          userIdRef.current = uid;
          setMyName((session.user.email || "").split("@")[0]);
        }
        let raw = await loadState(uid);
        if (!raw && uid) raw = readLocal(); // migra localStorage p/ nuvem no 1º save
        let s = mergeWithDefaults(raw || defaultState());

        const today = getDateStr(0);
        const yesterday = getDateStr(-1);
        if (s.stats.todayDate !== today) {
          s.stats.todaySessions = 0;
          s.stats.todayMinutes = 0;
          s.stats.todayDate = today;
        }
        if (s.tasksDate !== today) {
          s.tasks = [];
          s.tasksDate = today;
        }
        if (s.stats.lastCompletedDate && s.stats.lastCompletedDate !== today && s.stats.lastCompletedDate !== yesterday) {
          s.stats.streak = 0;
        }
        setState(s);
      } catch (e) {
        setState(defaultState());
      } finally {
        setLoaded(true);
      }
    })();
  }, [router]);

  // save com debounce
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const ok = await saveState(userIdRef.current, stateRef.current);
        setSaveError(!ok);
      } catch (e) {
        setSaveError(true);
      }
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [state, loaded]);

  const completeFocusSession = useCallback((seriesCompleted = false) => {
    setState((prev) => {
      const today = getDateStr(0);
      const yesterday = getDateStr(-1);
      const stats = { ...prev.stats };
      if (stats.todayDate !== today) {
        stats.todaySessions = 0;
        stats.todayMinutes = 0;
        stats.todayDate = today;
      }
      stats.todaySessions += 1;
      stats.todayMinutes += prev.settings.focusMin;
      stats.totalSessions += 1;
      stats.totalMinutes += prev.settings.focusMin;
      if (stats.lastCompletedDate === today) {
        // já contado
      } else if (stats.lastCompletedDate === yesterday) {
        stats.streak += 1;
      } else {
        stats.streak = 1;
      }
      stats.lastCompletedDate = today;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      stats.xp = (stats.xp || 0) + award(XP.focus, stats.streak);
      // registra no histórico diário (retrospecto de foco)
      const focusHistory = { ...(prev.focusHistory || {}) };
      const day = focusHistory[today] || { sessions: 0, minutes: 0, series: 0 };
      focusHistory[today] = {
        sessions: day.sessions + 1,
        minutes: day.minutes + prev.settings.focusMin,
        series: (day.series || 0) + (seriesCompleted ? 1 : 0),
      };
      return { ...prev, stats, focusHistory };
    });
  }, []);

  // ===== Timer Pomodoro global (persiste entre páginas) =====
  const [phase, setPhase] = useState("focus");
  const [secondsLeft, setSecondsLeft] = useState(defaultState().settings.focusMin * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [cyclePos, setCyclePos] = useState(0);
  const endRef = useRef(null); // timestamp-alvo do fim da fase (ms)
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const cycleRef = useRef(cyclePos);
  cycleRef.current = cyclePos;
  const timerInit = useRef(false);

  // restaura o cronômetro salvo (ou sincroniza com as settings, se não houver)
  useEffect(() => {
    if (!loaded || timerInit.current) return;
    timerInit.current = true;
    const s = stateRef.current.settings;
    let snap = null;
    try {
      const v = localStorage.getItem(TIMER_KEY);
      snap = v ? JSON.parse(v) : null;
    } catch (e) {}
    if (snap && snap.phase) {
      setPhase(snap.phase);
      setCyclePos(snap.cyclePos || 0);
      if (snap.isRunning && snap.endTarget) {
        const rem = Math.round((snap.endTarget - Date.now()) / 1000);
        if (rem > 0) {
          setSecondsLeft(rem);
          setIsRunning(true);
          return;
        }
        // expirou enquanto a aba estava fechada — volta a fase ao início, parado
        const dur = snap.phase === "focus" ? s.focusMin : snap.phase === "break" ? s.breakMin : s.longBreakMin;
        setSecondsLeft(dur * 60);
        return;
      }
      if (typeof snap.secondsLeft === "number") {
        setSecondsLeft(snap.secondsLeft);
        return;
      }
    }
    setSecondsLeft(s.focusMin * 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // salva o cronômetro a cada mudança (reload mantém o progresso)
  useEffect(() => {
    if (!loaded || !timerInit.current) return;
    try {
      const snap = isRunning
        ? { phase, cyclePos, isRunning: true, endTarget: Date.now() + secondsLeft * 1000 }
        : { phase, cyclePos, isRunning: false, secondsLeft };
      localStorage.setItem(TIMER_KEY, JSON.stringify(snap));
    } catch (e) {}
  }, [loaded, phase, cyclePos, isRunning, secondsLeft]);

  const handlePhaseEnd = useCallback(() => {
    playChime();
    const s = stateRef.current.settings;
    if (phaseRef.current === "focus") {
      const nextPos = cycleRef.current + 1;
      const seriesCompleted = nextPos >= s.cycleLength;
      completeFocusSession(seriesCompleted);
      if (seriesCompleted) {
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
  }, [completeFocusSession]);

  useEffect(() => {
    if (!isRunning) {
      endRef.current = null;
      return;
    }
    // ancora no relógio real: imune a throttling de timer em background
    endRef.current = Date.now() + secondsLeft * 1000;
    const tick = () => {
      const rem = Math.round((endRef.current - Date.now()) / 1000);
      if (rem > 0) {
        setSecondsLeft(rem);
        return;
      }
      clearInterval(id);
      setSecondsLeft(0);
      handlePhaseEnd();
    };
    const id = setInterval(tick, 250);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, phase]);

  const toggleTimer = useCallback(() => setIsRunning((r) => !r), []);
  const resetPhase = useCallback(() => {
    setIsRunning(false);
    const s = stateRef.current.settings;
    const p = phaseRef.current;
    const dur = p === "focus" ? s.focusMin : p === "break" ? s.breakMin : s.longBreakMin;
    setSecondsLeft(dur * 60);
  }, []);
  // pular só é permitido em pausas (não pula foco)
  const skipPhase = useCallback(() => {
    if (phaseRef.current === "focus") return;
    setIsRunning(false);
    handlePhaseEnd();
  }, [handlePhaseEnd]);

  const phaseTotal =
    (phase === "focus" ? state.settings.focusMin : phase === "break" ? state.settings.breakMin : state.settings.longBreakMin) * 60;
  const timer = {
    phase,
    secondsLeft,
    isRunning,
    cyclePos,
    phaseTotal,
    active: isRunning || secondsLeft < phaseTotal,
    toggleTimer,
    resetPhase,
    skipPhase,
  };

  function updateSetting(key, delta, min, max) {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: Math.min(max, Math.max(min, prev.settings[key] + delta)) },
    }));
  }
  function resetAllData() {
    setState(defaultState());
    setShowSettings(false);
    router.push("/foco");
  }

  const value = {
    loaded,
    state,
    setState,
    showSettings,
    setShowSettings,
    saveError,
    myName,
    board,
    completeFocusSession,
    updateSetting,
    resetAllData,
    handleLogout,
    toast,
    toasts,
    timer,
  };

  return (
    <AppCtx.Provider value={value}>
      {children}
      <Toaster />
      <TimerWidget />
    </AppCtx.Provider>
  );
}
