"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSession, loadUserState, syncUserState, updateUsername, fetchLeaderboard, signOut, hasSupabase, savePushSubscription, deletePushSubscription, syncAgendaReminders, fetchEntitlements } from "@/lib/persistence";
import {
  defaultState,
  mergeWithDefaults,
  getDateStr,
  XP,
  XP_DAILY_CAP,
  award,
  focusXp,
  formatTime,
  playChime,
  playAlarm,
  computeExercisePenalty,
  computeHabitDailyPenalty,
  computeActivityStreak,
  agendaReminders,
  HOME_ROUTE,
  TABS,
} from "@/lib/state";
import { applyMode } from "@/lib/themes";
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

function ConfirmDialog() {
  const { confirmState, resolveConfirm } = useApp();
  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e) => {
      if (e.key === "Escape") resolveConfirm(false);
      if (e.key === "Enter") resolveConfirm(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmState, resolveConfirm]);
  if (!confirmState) return null;
  const { title, body, confirmLabel = "CONFIRMAR", danger = true } = confirmState;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={() => resolveConfirm(false)}>
      {/* sólido, igual aos outros modais: glass-card é 3% de branco e some sobre o scrim */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${danger ? "bg-error/15 text-error" : "bg-primary-container/20 text-primary-container"}`}>
            <MI name={danger ? "warning" : "help"} fill />
          </div>
          <div className="min-w-0">
            <p className="font-headline-md text-headline-md text-on-surface">{title}</p>
            {body && <p className="font-body-md text-body-md text-on-surface-variant mt-1">{body}</p>}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => resolveConfirm(false)} className="px-4 py-2 rounded-lg text-on-surface-variant font-label-caps text-[11px] hover:bg-surface-variant/40 active:scale-95 transition">
            CANCELAR
          </button>
          <button
            onClick={() => resolveConfirm(true)}
            autoFocus
            className={`px-4 py-2 rounded-lg font-label-caps text-[11px] active:scale-95 transition ${danger ? "bg-error text-on-error" : "bg-primary-container text-on-primary-container"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Foco desativado (fora de TABS): o cronômetro não pode sobreviver nem como widget
// nem como sessão restaurada — um snapshot salvo antes de desativar mostraria o
// botão de start e, se rodasse, pagaria XP de foco que o teto diário já não conta.
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
  const [board, setBoard] = useState([]);
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
  const xpCapDayRef = useRef(null); // dia em que já avisamos do teto — 1 aviso, não 1 por save

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
  }, [loaded, state.habits, state.exerciseLogs, state.gymSets, state.sleep, state.journal, state.routineChecks, state.focusHistory]);

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
        }
        const res = await loadUserState(uid); // lança se a leitura falhar
        setMyName(res?.username || ""); // nick vem do profile, não do email
        const s = mergeWithDefaults(res ? res.state : defaultState());
        // baseline p/ diff: sem perfil ainda → vazio (escreve tudo); senão clone do carregado
        lastSavedRef.current = res ? clone(s) : {};

        const today = getDateStr(0);
        const yesterday = getDateStr(-1);
        if (s.stats.todayDate !== today) {
          s.stats.todaySessions = 0;
          s.stats.todayMinutes = 0;
          s.stats.todayDate = today;
        }

        // ===== penalidades de períodos fechados (metade do XP do comportamento não cumprido) =====
        // Centralizado no load: aplica ao abrir o app em qualquer página (não dá p/ fugir).
        const penalties = [];
        let penaltyXp = 0;

        // missões viraram quadro Trello (state.board) — sem penalidade/rollover.
        // rotina: sem penalidade por decisão — errar um dia do esqueleto do dia é um
        // dia, não recaída. O ganho é o XP do item + bônus de fechar (lib/state.js).

        // exercício: treinos faltantes na meta semanal, por semana fechada
        const ep = computeExercisePenalty(s.exerciseLogs, s.settings?.exerciseWeeklyGoal, s.settings?.exercisePenaltyWeek, today, s.restDays);
        if (ep) {
          s.settings = { ...(s.settings || {}), exercisePenaltyWeek: ep.lastWeek };
          if (ep.xp > 0) {
            penaltyXp += ep.xp;
            penalties.push(`treino (−${ep.xp})`);
          }
        }

        // hábitos diários (build): dia fechado sem check → −metade por prioridade
        let habitPenTotal = 0;
        s.habits = (s.habits || []).map((h) => {
          const hp = computeHabitDailyPenalty(h, today);
          if (!hp) return h;
          habitPenTotal += hp.xp;
          return { ...h, penaltyDate: hp.lastEvaluated };
        });
        if (habitPenTotal > 0) {
          penaltyXp += habitPenTotal;
          penalties.push(`hábitos (−${habitPenTotal})`);
        }

        if (penaltyXp > 0) s.stats.xp = Math.max(0, (s.stats.xp || 0) - penaltyXp);

        // streak geral = dias consecutivos com QUALQUER atividade (derivado)
        s.stats.streak = computeActivityStreak(s, today);
        s.stats.bestStreak = Math.max(s.stats.bestStreak || 0, s.stats.streak);
        setState(s);
        setLoaded(true);
        if (penaltyXp > 0) {
          setTimeout(() => toast("XP perdido por pendências", { sub: `${penalties.join(" · ")} = −${penaltyXp} XP`, type: "error", icon: "trending_down", duration: 7000 }), 400);
        }
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
        const res = await syncUserState(userIdRef.current, snapshot, lastSavedRef.current);
        lastSavedRef.current = snapshot; // baseline avança só no sucesso
        // XP é do servidor: ele aplica o delta e devolve o valor real. Se o teto
        // diário cortou, a tela adota o número do banco em vez de seguir otimista —
        // senão o baseline ficaria acima do banco e o próximo delta nasceria errado.
        const serverXp = res?.xp;
        if (Number.isFinite(serverXp) && serverXp !== (snapshot.stats?.xp || 0)) {
          // Teto do dia batido: sem aviso o XP simplesmente para de subir e ninguém
          // entende por quê. Uma vez por dia — o save roda a cada 600ms de atividade.
          const today = getDateStr(0);
          if (serverXp < (snapshot.stats?.xp || 0) && xpCapDayRef.current !== today) {
            xpCapDayRef.current = today;
            toast("Teto diário de XP atingido", {
              sub: `${XP_DAILY_CAP} XP por dia. O que você fizer hoje continua registrado — só não rende mais XP.`,
              type: "error",
              icon: "speed",
              duration: 7000,
            });
          }
          const reconciled = { ...snapshot, stats: { ...snapshot.stats, xp: serverXp } };
          lastSavedRef.current = reconciled;
          setState((prev) => {
            // o que o usuário ganhou DEPOIS do snapshot preserva o delta — vira o
            // próximo pedido, em vez de sumir junto com o corte
            const drift = (prev.stats?.xp || 0) - (snapshot.stats?.xp || 0);
            const next = Math.max(0, serverXp + drift);
            return prev.stats?.xp === next ? prev : { ...prev, stats: { ...prev.stats, xp: next } };
          });
        }
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
      stats.xp = (stats.xp || 0) + award(focusXp(prev.settings.focusMin), stats.streak);
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
      if (hidden) notify("Pomodoro concluído! 🍅", `+${focusXp(s.focusMin)} XP · pausa de ${s.breakMin} min pronta, é só dar start.`);
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

  // Recarrega os itens pagos liberados. Usada no retorno do checkout: o webhook do Mercado Pago
  // pode levar segundos, então a tela pergunta de novo em vez de mandar o usuário
  // recarregar na mão. Não gera escrita: `entitlements` não entra no patch do sync.
  const refreshEntitlements = useCallback(async () => {
    const ents = await fetchEntitlements(userIdRef.current);
    if (!ents) return null;
    setState((prev) => ({ ...prev, entitlements: ents }));
    return ents;
  }, []);
  const updateNickname = useCallback(
    async (nick) => {
      const res = await updateUsername(userIdRef.current, nick.trim());
      if (res.ok) {
        setMyName(nick.trim());
        toast("Nick atualizado", { sub: nick.trim().toUpperCase(), icon: "badge" });
        fetchLeaderboard().then(setBoard); // re-match do "VOCÊ" no ranking
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
      body: "Apaga foco, hábitos, sono, treinos, dieta e XP. Não dá pra desfazer.",
      confirmLabel: "APAGAR TUDO",
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
    board,
    completeFocusSession,
    updateNickname,
    updateSetting,
    setSetting,
    refreshEntitlements,
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
      <MI name="cloud_off" className="text-error text-6xl" />
      <div>
        <p className="font-headline-md text-headline-md text-primary">Falha ao carregar seus dados</p>
        <p className="font-body-md text-on-surface-variant mt-1 max-w-sm">
          Não foi possível ler seu perfil. Para não sobrescrever nada, o app não salvou nada. Verifique a conexão e recarregue.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-full bg-primary-container text-on-primary-container font-label-caps text-label-caps active:scale-95 transition"
      >
        RECARREGAR
      </button>
    </div>
  );
}
