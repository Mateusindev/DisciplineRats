"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSession, loadUserState, syncUserState, updateUsername, signOut, hasSupabase, savePushSubscription, deletePushSubscription, syncAgendaReminders } from "@/lib/persistence";
import {
  defaultState,
  mergeWithDefaults,
  getDateStr,
  formatTime,
  playChime,
  playAlarm,
  computeActivityStreak,
  agendaReminders,
  waterEntries,
  waterTotal,
  waterGoal,
  WATER_DAY_START_H,
  WATER_DAY_END_H,
  HOME_ROUTE,
  TABS,
} from "@/lib/state";
import { applyMode } from "@/lib/themes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { registerServiceWorker, ensureNotifyPermission, notify } from "@/lib/notify";
import { MI, Loader } from "@/components/ui";

const clone = (x) => JSON.parse(JSON.stringify(x));

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
          className="toast-in rounded-lg border border-outline-variant bg-popover px-4 py-3 flex items-center gap-3 shadow-lg"
        >
          <MI
            name={t.icon || (t.type === "error" ? "error" : "check_circle")}
            fill
            className={`text-[20px] ${t.type === "error" ? "text-error" : "text-primary-container"}`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-on-surface leading-tight">{t.title}</p>
            {t.sub && <p className="mt-0.5 text-xs text-on-surface-variant">{t.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Radix AlertDialog: empilha certo por cima de um Dialog shadcn já aberto (o
// overlay feito à mão ficava atrás do foco preso do Dialog). Esc/clique fora
// cancelam; o foco abre no botão de confirmar, então Enter confirma como antes.
function ConfirmDialog() {
  const { confirmState, resolveConfirm } = useApp();
  const actionRef = useRef(null);
  const { title, body, confirmLabel = "Confirmar", danger = true } = confirmState || {};
  return (
    <AlertDialog open={!!confirmState} onOpenChange={(o) => !o && resolveConfirm(false)}>
      <AlertDialogContent
        className="max-w-sm sm:max-w-sm bg-popover border-outline-variant"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          actionRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">{title}</AlertDialogTitle>
          {body ? <AlertDialogDescription>{body}</AlertDialogDescription> : <AlertDialogDescription className="sr-only">{title}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            ref={actionRef}
            onClick={() => resolveConfirm(true)}
            className={danger ? "bg-error text-on-error hover:bg-error/90" : undefined}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Foco desativado (fora de TABS): o cronômetro não pode sobreviver nem como widget
// nem como sessão restaurada — um snapshot salvo antes de desativar mostraria o
// botão de start de uma seção que não existe mais na navegação.
const FOCO_ON = TABS.some((t) => t.id === "foco");

function TimerWidget() {
  const { timer } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  if (!FOCO_ON || !timer || !timer.active || pathname === "/foco") return null;
  const { phase, secondsLeft, isRunning, pending, phaseTotal, toggleTimer } = timer;
  const label = pending ? (phase === "focus" ? "SESSÃO PRONTA" : "PAUSA PRONTA") : phase === "focus" ? "FOCO" : "PAUSA";
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
        aria-label={isRunning ? "Pausar" : pending ? `Iniciar ${phase === "focus" ? "sessão" : "pausa"}` : "Retomar"}
        className={`w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center active:scale-95 transition shrink-0 ${
          pending ? "animate-pulse" : ""
        }`}
      >
        <MI name={isRunning ? "pause" : "play_arrow"} fill className="text-lg" />
      </button>
    </div>
  );
}

export function AppProvider({ children }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [state, setState] = useState(defaultState());
  const [saveError, setSaveError] = useState(false);
  const [myName, setMyName] = useState("");
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null); // { title, body, confirmLabel, danger, resolve }
  const lastSavedRef = useRef(null); // baseline p/ diff-sync

  const toast = useCallback((title, opts = {}) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, title, sub: opts.sub, icon: opts.icon, type: opts.type || "success" }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 3000);
  }, []);

  // confirm(opts) → Promise<boolean>. Resolve true/false ao clicar/cancelar.
  const confirm = useCallback(
    (opts = {}) => new Promise((resolve) => setConfirmState({ ...opts, resolve })),
    []
  );
  const resolveConfirm = useCallback((val) => {
    setConfirmState((c) => {
      if (c) c.resolve(val);
      return null;
    });
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

  // service worker: habilita notificação de sistema (mobile exige SW)
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // ---- lembrete de agenda com o app ABERTO ----
  // Isto cobre só o app em primeiro plano: navegador congela a página em segundo
  // plano (no iOS, mata). Lembrete com o app fechado é o push do servidor —
  // supabase/functions/agenda-reminders. Os dois usam a mesma lista de lembretes,
  // e a chave por ocorrência evita aviso repetido quando os dois chegam.
  const notifiedRef = useRef(new Set());
  useEffect(() => {
    if (!loaded || !state.settings?.notifyAgenda) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    // o que já foi avisado sobrevive ao reload (senão reabrir o app re-notifica)
    const K = "dr_notified_v1";
    if (!notifiedRef.current.size) {
      try {
        const raw = JSON.parse(localStorage.getItem(K) || "[]");
        if (Array.isArray(raw)) notifiedRef.current = new Set(raw);
      } catch (e) {}
    }

    const tick = () => {
      const lead = stateRef.current.settings?.notifyLeadMin ?? 15;
      const now = Date.now();
      for (const r of agendaReminders(stateRef.current, { leadMin: lead, horizonDays: 2, from: new Date(now - 60 * 60_000) })) {
        // janela: já passou da hora de avisar, e o evento ainda não começou há
        // mais de 5 min (aviso de evento velho é ruído, não lembrete)
        const due = r.fireAt.getTime() <= now && r.eventAt.getTime() > now - 5 * 60_000;
        if (!due || notifiedRef.current.has(r.key)) continue;
        notifiedRef.current.add(r.key);
        notify(r.title, r.body, { tag: `agenda-${r.key}`, url: r.url });
      }
      try {
        // guarda só as chaves recentes: a lista não pode crescer pra sempre
        localStorage.setItem(K, JSON.stringify([...notifiedRef.current].slice(-200)));
      } catch (e) {}
    };

    tick();
    const id = setInterval(tick, 30_000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, state.settings?.notifyAgenda, state.settings?.notifyLeadMin, state.calendar, state.agendaRules, state.workoutPlan]);

  // Fila de lembretes no servidor: é dela que a função de push se alimenta. O
  // cliente materializa porque a lógica de recorrência vive aqui — reimplementá-la
  // no servidor criaria duas verdades que envelhecem separadas.
  useEffect(() => {
    if (!loaded || !userIdRef.current || !hasSupabase()) return;
    const id = setTimeout(() => {
      const s = stateRef.current;
      const list = s.settings?.notifyAgenda ? agendaReminders(s, { leadMin: s.settings?.notifyLeadMin ?? 15 }) : [];
      syncAgendaReminders(userIdRef.current, list).catch(() => {}); // silencioso: lembrete não pode derrubar a tela
    }, 1500);
    return () => clearTimeout(id);
  }, [loaded, state.settings?.notifyAgenda, state.settings?.notifyLeadMin, state.calendar, state.agendaRules, state.workoutPlan]);

  const savePush = useCallback(async (sub) => {
    if (!userIdRef.current) return;
    try {
      if (sub) await savePushSubscription(userIdRef.current, sub);
      else {
        const cur = await (await import("@/lib/notify")).getPushSubscription();
        if (cur?.endpoint) await deletePushSubscription(cur.endpoint);
      }
    } catch (e) {}
  }, []);

  // ---- lembrete de água ----
  // Global (e não na página /agua) pra avisar em qualquer aba do app aberta. Avisa
  // depois de `waterReminder` minutos sem registro, só dentro da janela 7h–22h e só
  // enquanto a meta do dia não foi batida. Conta a partir do último registro OU do
  // último aviso/abertura — senão reabrir o app à tarde avisaria na hora.
  const waterNudgeRef = useRef(Date.now());
  useEffect(() => {
    if (!loaded || !state.settings?.waterReminder) return;
    waterNudgeRef.current = Date.now();
    const tick = () => {
      const s = stateRef.current;
      const mins = s.settings?.waterReminder;
      if (!mins || typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const today = getDateStr(0);
      const goal = waterGoal(s);
      const total = waterTotal(s, today);
      if (total >= goal) return;
      const h = new Date().getHours();
      if (h < WATER_DAY_START_H || h >= WATER_DAY_END_H) return;
      const last = waterEntries(s, today).at(-1);
      if (Date.now() - Math.max(last?.time || 0, waterNudgeRef.current) < mins * 60_000) return;
      waterNudgeRef.current = Date.now();
      notify("Hora de beber água", `Faltam ${(goal - total).toLocaleString("pt-BR")} ml pra meta de hoje.`, { tag: "agua", url: "/agua" });
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [loaded, state.settings?.waterReminder]);

  // aplica o modo claro/escuro escolhido (classe no <html>)
  useEffect(() => {
    applyMode(state.settings?.mode);
  }, [state.settings?.mode]);

  // mantém a sequência geral em dia com a atividade (deriva de qualquer ação)
  useEffect(() => {
    if (!loaded) return;
    setState((prev) => {
      const st = computeActivityStreak(prev);
      if (st === prev.stats.streak && st <= (prev.stats.bestStreak || 0)) return prev;
      return { ...prev, stats: { ...prev.stats, streak: st, bestStreak: Math.max(prev.stats.bestStreak || 0, st) } };
    });
  }, [loaded, state.habits, state.exerciseLogs, state.gymSets, state.sleep, state.water, state.journal, state.routineChecks, state.focusHistory]);

  // redireciona ao /login em signout
  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

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
        }
        const res = await loadUserState(uid); // lança se a leitura falhar
        setMyName(res?.username || ""); // nick vem do profile, não do email
        const s = mergeWithDefaults(res ? res.state : defaultState());
        // baseline p/ diff: sem perfil ainda → vazio (escreve tudo); senão clone do carregado
        lastSavedRef.current = res ? clone(s) : {};

        const today = getDateStr(0);
        if (s.stats.todayDate !== today) {
          s.stats.todaySessions = 0;
          s.stats.todayMinutes = 0;
          s.stats.todayDate = today;
        }

        // streak geral = dias consecutivos com QUALQUER atividade (derivado)
        s.stats.streak = computeActivityStreak(s, today);
        s.stats.bestStreak = Math.max(s.stats.bestStreak || 0, s.stats.streak);
        setState(s);
        setLoaded(true);
      } catch (e) {
        // NUNCA cai em defaults + salva por cima: bloqueia e mostra erro
        setLoadError(true);
      }
    })();
  }, [router]);

  // save com debounce (diff-sync targeted por domínio)
  useEffect(() => {
    if (!loaded || loadError) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const snapshot = stateRef.current; // versão imutável que vamos sincronizar
      try {
        await syncUserState(userIdRef.current, snapshot, lastSavedRef.current);
        lastSavedRef.current = snapshot; // baseline avança só no sucesso
        setSaveError(false);
      } catch (e) {
        setSaveError(true); // mantém baseline → próxima mudança tenta de novo
      }
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [state, loaded, loadError]);

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
      // registra no histórico diário (retrospecto de foco)
      const focusHistory = { ...(prev.focusHistory || {}) };
      const day = focusHistory[today] || { sessions: 0, minutes: 0 };
      focusHistory[today] = {
        sessions: day.sessions + 1,
        minutes: day.minutes + prev.settings.focusMin,
      };
      return { ...prev, stats, focusHistory };
    });
  }, []);

  // ===== Timer Pomodoro global (persiste entre páginas) =====
  const [phase, setPhase] = useState("focus");
  const [secondsLeft, setSecondsLeft] = useState(defaultState().settings.focusMin * 60);
  const [isRunning, setIsRunning] = useState(false);
  // fase anterior terminou e a próxima está carregada, mas parada esperando o
  // start manual. Encadear sozinho já causou sessão contando com a pessoa longe.
  const [pending, setPending] = useState(false);
  const endRef = useRef(null); // timestamp-alvo do fim da fase (ms)
  const endingRef = useRef(false); // guard de reentrância no fim da fase
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const timerInit = useRef(false);

  // restaura o cronômetro salvo (ou sincroniza com as settings, se não houver)
  useEffect(() => {
    if (!loaded || timerInit.current) return;
    timerInit.current = true;
    const s = stateRef.current.settings;
    let snap = null;
    try {
      if (FOCO_ON) {
        const v = localStorage.getItem(TIMER_KEY);
        snap = v ? JSON.parse(v) : null;
      } else localStorage.removeItem(TIMER_KEY);
    } catch (e) {}
    if (snap && snap.phase) {
      const phase = snap.phase === "focus" ? "focus" : "break"; // migra "longBreak" salvo → "break"
      setPhase(phase);
      setPending(!!snap.pending);
      if (snap.isRunning && snap.endTarget) {
        const rem = Math.round((snap.endTarget - Date.now()) / 1000);
        if (rem > 0) {
          setSecondsLeft(rem);
          setIsRunning(true);
          return;
        }
        // expirou enquanto a aba estava fechada — volta a fase ao início, parado
        const dur = phase === "focus" ? s.focusMin : s.breakMin;
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
        ? { phase, isRunning: true, endTarget: Date.now() + secondsLeft * 1000 }
        : { phase, isRunning: false, secondsLeft, pending };
      localStorage.setItem(TIMER_KEY, JSON.stringify(snap));
    } catch (e) {}
  }, [loaded, phase, isRunning, secondsLeft, pending]);

  const handlePhaseEnd = useCallback(() => {
    if (endingRef.current) return; // guard: interval tick + visibilitychange podem disparar juntos
    endingRef.current = true;
    const s = stateRef.current.settings;
    const hidden = typeof document !== "undefined" && document.visibilityState !== "visible";
    if (phaseRef.current === "focus") {
      playAlarm(); // fim do pomodoro: alarme forte
      if (hidden) notify("Pomodoro concluído! 🍅", `Pausa de ${s.breakMin} min pronta, é só dar start.`);
      completeFocusSession();
      setPhase("break");
      setSecondsLeft(s.breakMin * 60);
    } else {
      playChime(); // fim da pausa: chime suave
      if (hidden) notify("Pausa acabou", `Quando voltar, dê start na sessão de ${s.focusMin} min.`);
      setPhase("focus");
      setSecondsLeft(s.focusMin * 60);
    }
    // a próxima fase NÃO começa sozinha: fica carregada esperando o start.
    // Encadear automático fazia o cronômetro rodar sem ninguém na frente.
    setIsRunning(false);
    setPending(true);
  }, [completeFocusSession]);

  useEffect(() => {
    if (!isRunning) {
      endRef.current = null;
      return;
    }
    // ancora no relógio real: imune a throttling de timer em background
    endRef.current = Date.now() + secondsLeft * 1000;
    endingRef.current = false; // nova fase iniciou → libera o guard
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

  const toggleTimer = useCallback(() => {
    setIsRunning((r) => !r);
    setPending(false); // o start manual aconteceu
    ensureNotifyPermission(); // gesto do usuário: momento certo de pedir permissão (idempotente)
  }, []);
  const resetPhase = useCallback(() => {
    setIsRunning(false);
    setPending(false);
    const s = stateRef.current.settings;
    const p = phaseRef.current;
    const dur = p === "focus" ? s.focusMin : s.breakMin;
    setSecondsLeft(dur * 60);
  }, []);
  // pular só é permitido em pausas (não pula foco)
  const skipPhase = useCallback(() => {
    if (phaseRef.current === "focus") return;
    setIsRunning(false);
    handlePhaseEnd();
  }, [handlePhaseEnd]);

  const phaseTotal = (phase === "focus" ? state.settings.focusMin : state.settings.breakMin) * 60;
  const timer = {
    phase,
    secondsLeft,
    isRunning,
    pending,
    phaseTotal,
    // `pending` mantém o widget na tela: a fase nova está cheia e parada, e sem
    // isso o cronômetro sumiria justo na hora de avisar que ele espera o start
    active: isRunning || pending || secondsLeft < phaseTotal,
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
  function setSetting(key, value) {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
  }

  const updateNickname = useCallback(
    async (nick) => {
      const res = await updateUsername(userIdRef.current, nick.trim());
      if (res.ok) {
        setMyName(nick.trim());
        toast("Nick atualizado", { sub: nick.trim(), icon: "badge" });
      } else {
        const msg =
          res.reason === "taken" ? "Nick já em uso" : res.reason === "invalid" ? "3–20 caracteres: letras, números, _ . -" : "Falha ao salvar nick";
        toast(msg, { type: "error" });
      }
      return res.ok;
    },
    [toast]
  );

  async function resetAllData() {
    const ok = await confirm({
      title: "Reiniciar todos os dados?",
      body: "Apaga hábitos, sono, diário, leitura, quadro e o resto. Não dá pra desfazer.",
      confirmLabel: "Apagar tudo",
    });
    if (!ok) return;
    setState(defaultState());
    router.push(HOME_ROUTE);
  }

  const value = {
    loaded,
    state,
    setState,
    userId: userIdRef.current,
    saveError,
    myName,
    completeFocusSession,
    updateNickname,
    updateSetting,
    setSetting,
    resetAllData,
    handleLogout,
    toast,
    toasts,
    confirm,
    confirmState,
    resolveConfirm,
    timer,
    savePush,
  };

  return (
    <AppCtx.Provider value={value}>
      {loadError ? <LoadErrorScreen /> : loaded ? children : <Loader />}
      <Toaster />
      <ConfirmDialog />
      {loaded && !loadError && <TimerWidget />}
    </AppCtx.Provider>
  );
}

function LoadErrorScreen() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <MI name="cloud_off" className="text-error text-[40px]" />
      <div>
        <h1 className="text-lg font-semibold text-on-surface">Falha ao carregar seus dados</h1>
        <p className="text-sm text-on-surface-variant mt-1 max-w-sm">
          Não foi possível ler seu perfil. Para não sobrescrever nada, o app não salvou nada. Verifique a conexão e recarregue.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="h-9 px-4 rounded-md bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 active:scale-[.98] transition"
      >
        Recarregar
      </button>
    </div>
  );
}
