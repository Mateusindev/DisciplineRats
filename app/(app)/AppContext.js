"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSession, loadState, saveState, fetchLeaderboard, signOut, readLocal, hasSupabase } from "@/lib/persistence";
import { defaultState, mergeWithDefaults, getDateStr, XP, award } from "@/lib/state";
import { MI } from "@/components/ui";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

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

  const completeFocusSession = useCallback(() => {
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
      return { ...prev, stats };
    });
  }, []);

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
  };

  return (
    <AppCtx.Provider value={value}>
      {children}
      <Toaster />
    </AppCtx.Provider>
  );
}
