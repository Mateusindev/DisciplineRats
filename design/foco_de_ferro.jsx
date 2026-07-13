import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Flame,
  Trophy,
  Plus,
  X,
  CheckCircle2,
  Circle,
  Settings2,
  Dumbbell,
  ChevronLeft,
  ChevronRight,
  Timer,
  ListChecks,
  Moon,
  Smile,
  Star,
} from "lucide-react";

const COLORS = {
  bg: "#14161A",
  panel: "#1B1E24",
  panelAlt: "#22262E",
  gold: "#C9A34E",
  goldDim: "#8A7238",
  rust: "#B33951",
  text: "#F1EFE9",
  textMuted: "#8F929B",
  border: "#2B2F38",
};

const STORAGE_KEY = "ferro-focus-state";

const TIPS = [
  "Tenha clareza do ponto A ao ponto B: onde você está hoje e onde quer chegar.",
  "Monte um plano de ação intencional. Transforme metas em hábitos diários.",
  "Torne o planejamento inegociável. Visualize seus objetivos todos os dias.",
  "Esteja em um ambiente que te motive, ensine e inspire a melhorar.",
  "Esteja disposta a superar as tentativas de autossabotagem da sua mente.",
];

const EXERCISE_TYPES = ["Musculação", "Cardio", "Caminhada", "Alongamento", "Outro"];
const MOOD_OPTIONS = [
  { value: 1, emoji: "😞", label: "Muito baixo" },
  { value: 2, emoji: "🙁", label: "Baixo" },
  { value: 3, emoji: "😐", label: "Neutro" },
  { value: 4, emoji: "🙂", label: "Bom" },
  { value: 5, emoji: "😄", label: "Ótimo" },
];

const TABS = [
  { id: "foco", label: "Foco", icon: Timer },
  { id: "habitos", label: "Hábitos", icon: ListChecks },
  { id: "sono", label: "Sono", icon: Moon },
  { id: "exercicio", label: "Exercício", icon: Dumbbell },
  { id: "humor", label: "Humor", icon: Smile },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function getDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function weekdayShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

function minutesToHm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m ? pad(m) : ""}`;
}

function last7Dates() {
  return Array.from({ length: 7 }, (_, i) => getDateStr(-(6 - i)));
}

function defaultState() {
  return {
    settings: {
      focusMin: 25,
      breakMin: 5,
      longBreakMin: 15,
      cycleLength: 4,
      exerciseWeeklyGoal: 3,
    },
    stats: {
      totalSessions: 0,
      totalMinutes: 0,
      todaySessions: 0,
      todayMinutes: 0,
      todayDate: getDateStr(0),
      streak: 0,
      bestStreak: 0,
      lastCompletedDate: null,
    },
    tasks: [],
    tasksDate: getDateStr(0),
    habits: [],
    sleep: {},
    exerciseLogs: [],
    mood: {},
  };
}

function mergeWithDefaults(parsed) {
  const d = defaultState();
  return {
    settings: { ...d.settings, ...(parsed.settings || {}) },
    stats: { ...d.stats, ...(parsed.stats || {}) },
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    tasksDate: parsed.tasksDate || d.tasksDate,
    habits: Array.isArray(parsed.habits) ? parsed.habits : [],
    sleep: parsed.sleep && typeof parsed.sleep === "object" ? parsed.sleep : {},
    exerciseLogs: Array.isArray(parsed.exerciseLogs) ? parsed.exerciseLogs : [],
    mood: parsed.mood && typeof parsed.mood === "object" ? parsed.mood : {},
  };
}

function computeHabitStreak(doneDates) {
  const set = new Set(doneDates || []);
  let streak = 0;
  let offset = set.has(getDateStr(0)) ? 0 : -1;
  while (set.has(getDateStr(offset))) {
    streak++;
    offset--;
  }
  return streak;
}

function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const notes = [660, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.14;
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.start(start);
      osc.stop(start + 0.34);
    });
    setTimeout(() => ctx.close(), 700);
  } catch (e) {
    // audio not available, fail silently
  }
}

/* ---------- shared small components ---------- */

function StarRating({ value, onChange, count = 5, size = 18 }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }).map((_, i) => {
        const v = i + 1;
        const filled = v <= value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-label={`Nota ${v} de ${count}`}
            className="ff-btn"
          >
            <Star
              size={size}
              color={filled ? COLORS.gold : COLORS.textMuted}
              fill={filled ? COLORS.gold : "none"}
              strokeWidth={1.6}
            />
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ label, value, onDec, onInc, suffix = "" }) {
  return (
    <div className="flex items-center justify-between">
      {label && (
        <span className="text-sm" style={{ color: COLORS.text }}>
          {label}
        </span>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={onDec}
          aria-label={`Diminuir ${label || ""}`}
          className="ff-btn w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: COLORS.panelAlt, color: COLORS.text }}
        >
          −
        </button>
        <span className="ff-mono text-sm w-10 text-center" style={{ color: COLORS.text }}>
          {value}{suffix}
        </span>
        <button
          onClick={onInc}
          aria-label={`Aumentar ${label || ""}`}
          className="ff-btn w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: COLORS.panelAlt, color: COLORS.text }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Card({ children }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}` }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="ff-display text-sm" style={{ color: COLORS.text }}>
      {children}
    </h2>
  );
}

/* ---------- Foco tab ---------- */

function FocoTab({ state, setState, onCompleteFocus }) {
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
      onCompleteFocus();
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
    setState((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { id: Date.now(), text, done: false }],
    }));
    setNewTask("");
  }

  function toggleTask(id) {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  }

  function removeTask(id) {
    setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));
  }

  const phaseLabel = phase === "focus" ? "FOCO" : phase === "break" ? "PAUSA" : "PAUSA LONGA";
  const phaseColor = phase === "focus" ? COLORS.gold : COLORS.rust;
  const totalPlates = Math.min(state.stats.todaySessions, 10);
  const extraPlates = Math.max(0, state.stats.todaySessions - 10);

  return (
    <div className="flex flex-col gap-6">
      <div
        className="rounded-2xl p-6 flex flex-col items-center gap-4"
        style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}` }}
      >
        <span className="ff-display text-xs tracking-widest" style={{ color: phaseColor }}>
          {phaseLabel} &middot; SÉRIE {cyclePos + 1} DE {state.settings.cycleLength}
        </span>

        <div className="ff-mono" style={{ fontSize: 64, color: COLORS.text, lineHeight: 1, fontWeight: 700 }}>
          {formatTime(secondsLeft)}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={resetPhase}
            aria-label="Reiniciar série"
            className="ff-btn p-3 rounded-full transition"
            style={{ background: COLORS.panelAlt, color: COLORS.textMuted }}
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={() => setIsRunning((r) => !r)}
            aria-label={isRunning ? "Pausar" : "Iniciar"}
            className="ff-btn p-4 rounded-full transition"
            style={{ background: phaseColor, color: COLORS.bg }}
          >
            {isRunning ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <button
            onClick={skipPhase}
            aria-label="Pular série"
            className="ff-btn p-3 rounded-full transition"
            style={{ background: COLORS.panelAlt, color: COLORS.textMuted }}
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1 mt-1" aria-label={`${state.stats.todaySessions} sessões concluídas hoje`}>
          <div style={{ width: 18, height: 4, background: COLORS.border, borderRadius: 2 }} />
          {Array.from({ length: totalPlates }).map((_, i) => (
            <div key={i} className="ff-plate-in" style={{ width: 12, height: 26, borderRadius: 2, background: i % 2 === 0 ? COLORS.gold : COLORS.goldDim }} />
          ))}
          <div style={{ width: 30, height: 8, background: COLORS.border, borderRadius: 2 }} />
          {Array.from({ length: totalPlates }).map((_, i) => (
            <div key={`r-${i}`} className="ff-plate-in" style={{ width: 12, height: 26, borderRadius: 2, background: i % 2 === 0 ? COLORS.gold : COLORS.goldDim }} />
          ))}
          <div style={{ width: 18, height: 4, background: COLORS.border, borderRadius: 2 }} />
          {extraPlates > 0 && (
            <span className="ff-mono text-xs ml-2" style={{ color: COLORS.textMuted }}>+{extraPlates}</span>
          )}
        </div>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          {state.stats.todaySessions} sessão(ões) de foco hoje &middot; {state.stats.todayMinutes} min
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2">
            <Flame size={18} color={COLORS.rust} />
            <span className="text-xs" style={{ color: COLORS.textMuted }}>sequência atual</span>
          </div>
          <span className="ff-mono text-2xl" style={{ color: COLORS.text }}>{state.stats.streak}</span>
          <span className="text-xs" style={{ color: COLORS.textMuted }}>{state.stats.streak === 1 ? "dia" : "dias"}</span>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <Trophy size={18} color={COLORS.gold} />
            <span className="text-xs" style={{ color: COLORS.textMuted }}>melhor sequência</span>
          </div>
          <span className="ff-mono text-2xl" style={{ color: COLORS.text }}>{state.stats.bestStreak}</span>
          <span className="text-xs" style={{ color: COLORS.textMuted }}>{state.stats.bestStreak === 1 ? "dia" : "dias"}</span>
        </Card>
      </div>

      <Card>
        <SectionTitle>METAS DE ESTUDO DE HOJE</SectionTitle>
        <div className="flex gap-2">
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Adicionar uma meta de estudo..."
            className="ff-input flex-1 rounded-md px-3 py-2 text-sm"
            style={{ background: COLORS.panelAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          />
          <button onClick={addTask} aria-label="Adicionar meta" className="ff-btn px-3 rounded-md transition" style={{ background: COLORS.gold, color: COLORS.bg }}>
            <Plus size={18} />
          </button>
        </div>
        {state.tasks.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Nenhuma meta ainda. Defina de 1 a 3 metas claras para hoje.</p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-52 overflow-y-auto ff-scroll">
            {state.tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <button onClick={() => toggleTask(t.id)} aria-label={t.done ? "Marcar como pendente" : "Marcar como concluída"} className="ff-btn">
                  {t.done ? <CheckCircle2 size={18} color={COLORS.gold} /> : <Circle size={18} color={COLORS.textMuted} />}
                </button>
                <span className="text-sm flex-1" style={{ color: t.done ? COLORS.textMuted : COLORS.text, textDecoration: t.done ? "line-through" : "none" }}>
                  {t.text}
                </span>
                <button onClick={() => removeTask(t.id)} aria-label="Remover meta" className="ff-btn" style={{ color: COLORS.textMuted }}>
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------- Hábitos tab ---------- */

function HabitosTab({ state, setState }) {
  const [newHabit, setNewHabit] = useState("");
  const today = getDateStr(0);

  function addHabit() {
    const name = newHabit.trim();
    if (!name) return;
    setState((prev) => ({
      ...prev,
      habits: [...prev.habits, { id: Date.now(), name, doneDates: [] }],
    }));
    setNewHabit("");
  }

  function toggleHabitToday(id) {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => {
        if (h.id !== id) return h;
        const has = h.doneDates.includes(today);
        return { ...h, doneDates: has ? h.doneDates.filter((d) => d !== today) : [...h.doneDates, today] };
      }),
    }));
  }

  function removeHabit(id) {
    setState((prev) => ({ ...prev, habits: prev.habits.filter((h) => h.id !== id) }));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle>HÁBITOS RECORRENTES</SectionTitle>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          Coisas que você quer repetir todo dia. Marque quando concluir e acompanhe sua sequência.
        </p>
        <div className="flex gap-2">
          <input
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHabit()}
            placeholder="Ex: beber 2L de água, meditar, ler 10 páginas..."
            className="ff-input flex-1 rounded-md px-3 py-2 text-sm"
            style={{ background: COLORS.panelAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          />
          <button onClick={addHabit} aria-label="Adicionar hábito" className="ff-btn px-3 rounded-md transition" style={{ background: COLORS.gold, color: COLORS.bg }}>
            <Plus size={18} />
          </button>
        </div>

        {state.habits.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Nenhum hábito cadastrado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.habits.map((h) => {
              const doneToday = h.doneDates.includes(today);
              const streak = computeHabitStreak(h.doneDates);
              return (
                <li
                  key={h.id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: COLORS.panelAlt }}
                >
                  <button
                    onClick={() => toggleHabitToday(h.id)}
                    aria-label={doneToday ? "Desmarcar hoje" : "Marcar como feito hoje"}
                    className="ff-btn"
                  >
                    {doneToday ? <CheckCircle2 size={20} color={COLORS.gold} /> : <Circle size={20} color={COLORS.textMuted} />}
                  </button>
                  <span className="text-sm flex-1" style={{ color: COLORS.text }}>{h.name}</span>
                  <div className="flex items-center gap-1" style={{ color: streak > 0 ? COLORS.rust : COLORS.textMuted }}>
                    <Flame size={14} />
                    <span className="ff-mono text-xs">{streak}</span>
                  </div>
                  <button onClick={() => removeHabit(h.id)} aria-label="Remover hábito" className="ff-btn" style={{ color: COLORS.textMuted }}>
                    <X size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------- Sono tab ---------- */

function SonoTab({ state, setState }) {
  const today = getDateStr(0);
  const existing = state.sleep[today];
  const [bedtime, setBedtime] = useState(existing?.bedtime || "23:00");
  const [wake, setWake] = useState(existing?.wake || "07:00");
  const [quality, setQuality] = useState(existing?.quality || 3);

  function computeDuration(bt, wk) {
    const [bh, bm] = bt.split(":").map(Number);
    const [wh, wm] = wk.split(":").map(Number);
    let diff = wh * 60 + wm - (bh * 60 + bm);
    if (diff <= 0) diff += 24 * 60;
    return diff;
  }

  const durationMin = computeDuration(bedtime, wake);

  function save() {
    setState((prev) => ({
      ...prev,
      sleep: { ...prev.sleep, [today]: { bedtime, wake, durationMin, quality } },
    }));
  }

  const days = last7Dates();
  const withData = days.filter((d) => state.sleep[d]);
  const avgMin = withData.length
    ? Math.round(withData.reduce((sum, d) => sum + state.sleep[d].durationMin, 0) / withData.length)
    : null;
  const maxBar = 10 * 60;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle>SONO DE HOJE</SectionTitle>
        <div className="flex gap-4">
          <label className="flex-1 flex flex-col gap-1">
            <span className="text-xs" style={{ color: COLORS.textMuted }}>Dormiu às</span>
            <input
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              className="ff-input rounded-md px-3 py-2 text-sm ff-mono"
              style={{ background: COLORS.panelAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
            />
          </label>
          <label className="flex-1 flex flex-col gap-1">
            <span className="text-xs" style={{ color: COLORS.textMuted }}>Acordou às</span>
            <input
              type="time"
              value={wake}
              onChange={(e) => setWake(e.target.value)}
              className="ff-input rounded-md px-3 py-2 text-sm ff-mono"
              style={{ background: COLORS.panelAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
            />
          </label>
        </div>
        <p className="text-sm" style={{ color: COLORS.text }}>
          Duração estimada: <span className="ff-mono">{minutesToHm(durationMin)}</span>
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: COLORS.text }}>Qualidade</span>
          <StarRating value={quality} onChange={setQuality} />
        </div>
        <button
          onClick={save}
          className="ff-btn self-start px-4 py-2 rounded-md text-sm transition"
          style={{ background: COLORS.gold, color: COLORS.bg }}
        >
          Salvar sono de hoje
        </button>
      </Card>

      <Card>
        <SectionTitle>ÚLTIMOS 7 DIAS</SectionTitle>
        <div className="flex items-end justify-between gap-2" style={{ height: 100 }}>
          {days.map((d) => {
            const entry = state.sleep[d];
            const h = entry ? Math.max(6, (entry.durationMin / maxBar) * 90) : 0;
            return (
              <div key={d} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div
                  style={{
                    width: "70%",
                    height: h,
                    borderRadius: 3,
                    background: entry ? COLORS.gold : COLORS.border,
                  }}
                  aria-label={entry ? `${minutesToHm(entry.durationMin)} em ${d}` : `sem dados em ${d}`}
                />
                <span className="text-xs" style={{ color: COLORS.textMuted }}>{weekdayShort(d)}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          {avgMin ? `Média: ${minutesToHm(avgMin)} por noite` : "Ainda sem dados suficientes para uma média."}
        </p>
      </Card>
    </div>
  );
}

/* ---------- Exercício tab ---------- */

function ExercicioTab({ state, setState }) {
  const [type, setType] = useState(EXERCISE_TYPES[0]);
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState(3);

  const today = getDateStr(0);
  const days = last7Dates();
  const daysSet = new Set(days);
  const weekLogs = state.exerciseLogs.filter((l) => daysSet.has(l.date));
  const goal = state.settings.exerciseWeeklyGoal;

  function logWorkout() {
    setState((prev) => ({
      ...prev,
      exerciseLogs: [
        { id: Date.now(), date: today, type, durationMin: duration, intensity },
        ...prev.exerciseLogs,
      ].slice(0, 200),
    }));
  }

  function removeLog(id) {
    setState((prev) => ({ ...prev, exerciseLogs: prev.exerciseLogs.filter((l) => l.id !== id) }));
  }

  function updateGoal(delta) {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        exerciseWeeklyGoal: Math.min(14, Math.max(1, prev.settings.exerciseWeeklyGoal + delta)),
      },
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle>REGISTRAR TREINO</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {EXERCISE_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="ff-btn px-3 py-1.5 rounded-full text-xs transition"
              style={{
                background: type === t ? COLORS.gold : COLORS.panelAlt,
                color: type === t ? COLORS.bg : COLORS.textMuted,
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <Stepper label="Duração (min)" value={duration} onDec={() => setDuration((v) => Math.max(5, v - 5))} onInc={() => setDuration((v) => Math.min(180, v + 5))} />
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: COLORS.text }}>Intensidade</span>
          <StarRating value={intensity} onChange={setIntensity} />
        </div>
        <button
          onClick={logWorkout}
          className="ff-btn self-start px-4 py-2 rounded-md text-sm transition"
          style={{ background: COLORS.gold, color: COLORS.bg }}
        >
          Registrar treino
        </button>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle>META SEMANAL</SectionTitle>
          <Stepper value={goal} onDec={() => updateGoal(-1)} onInc={() => updateGoal(1)} suffix="x" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {Array.from({ length: goal }).map((_, i) => (
            <Dumbbell key={i} size={22} color={i < weekLogs.length ? COLORS.gold : COLORS.border} />
          ))}
          {weekLogs.length > goal && (
            <span className="ff-mono text-xs ml-1" style={{ color: COLORS.textMuted }}>+{weekLogs.length - goal}</span>
          )}
        </div>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          {weekLogs.length} de {goal} treinos essa semana
        </p>
      </Card>

      <Card>
        <SectionTitle>TREINOS DA SEMANA</SectionTitle>
        {weekLogs.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Nenhum treino registrado essa semana ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto ff-scroll">
            {weekLogs.map((l) => (
              <li key={l.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.panelAlt }}>
                <div className="flex-1">
                  <p className="text-sm" style={{ color: COLORS.text }}>{l.type} &middot; {l.durationMin} min</p>
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>{weekdayShort(l.date)}, {l.date}</p>
                </div>
                <StarRating value={l.intensity} onChange={() => {}} size={13} />
                <button onClick={() => removeLog(l.id)} aria-label="Remover treino" className="ff-btn" style={{ color: COLORS.textMuted }}>
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------- Humor tab ---------- */

function HumorTab({ state, setState }) {
  const today = getDateStr(0);
  const existing = state.mood[today];
  const [mood, setMood] = useState(existing?.mood || null);
  const [note, setNote] = useState(existing?.note || "");

  function save() {
    if (!mood) return;
    setState((prev) => ({
      ...prev,
      mood: { ...prev.mood, [today]: { mood, note: note.slice(0, 140) } },
    }));
  }

  const days = last7Dates();
  const withData = days.filter((d) => state.mood[d]);
  const avg = withData.length
    ? (withData.reduce((sum, d) => sum + state.mood[d].mood, 0) / withData.length).toFixed(1)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle>COMO VOCÊ ESTÁ HOJE?</SectionTitle>
        <div className="flex justify-between">
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMood(opt.value)}
              aria-label={opt.label}
              className="ff-btn flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition"
              style={{ background: mood === opt.value ? COLORS.panelAlt : "transparent" }}
            >
              <span style={{ fontSize: 26, opacity: mood === opt.value ? 1 : 0.55 }}>{opt.emoji}</span>
              <span className="text-xs" style={{ color: mood === opt.value ? COLORS.gold : COLORS.textMuted }}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Alguma anotação sobre o dia? (opcional)"
          maxLength={140}
          rows={2}
          className="ff-input rounded-md px-3 py-2 text-sm resize-none"
          style={{ background: COLORS.panelAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
        />
        <button
          onClick={save}
          disabled={!mood}
          className="ff-btn self-start px-4 py-2 rounded-md text-sm transition"
          style={{ background: mood ? COLORS.gold : COLORS.border, color: mood ? COLORS.bg : COLORS.textMuted }}
        >
          Salvar humor de hoje
        </button>
      </Card>

      <Card>
        <SectionTitle>ÚLTIMOS 7 DIAS</SectionTitle>
        <div className="flex justify-between">
          {days.map((d) => {
            const entry = state.mood[d];
            const opt = entry ? MOOD_OPTIONS.find((o) => o.value === entry.mood) : null;
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <span style={{ fontSize: 20, opacity: opt ? 1 : 0.25 }}>{opt ? opt.emoji : "·"}</span>
                <span className="text-xs" style={{ color: COLORS.textMuted }}>{weekdayShort(d)}</span>
              </div>
            );
          })}
        </div>
        {avg && (
          <p className="text-xs" style={{ color: COLORS.textMuted }}>Média da semana: {avg} de 5</p>
        )}
      </Card>
    </div>
  );
}

/* ---------- App shell ---------- */

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState(defaultState());
  const [activeTab, setActiveTab] = useState("foco");
  const [showSettings, setShowSettings] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const saveTimer = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY, false);
        const parsed = result && result.value ? JSON.parse(result.value) : defaultState();
        let s = mergeWithDefaults(parsed);

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
        if (
          s.stats.lastCompletedDate &&
          s.stats.lastCompletedDate !== today &&
          s.stats.lastCompletedDate !== yesterday
        ) {
          s.stats.streak = 0;
        }

        setState(s);
      } catch (e) {
        setState(defaultState());
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const result = await window.storage.set(STORAGE_KEY, JSON.stringify(stateRef.current), false);
        setSaveError(!result);
      } catch (e) {
        setSaveError(true);
      }
    }, 500);
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
        // already counted today
      } else if (stats.lastCompletedDate === yesterday) {
        stats.streak += 1;
      } else {
        stats.streak = 1;
      }
      stats.lastCompletedDate = today;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);

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
    setActiveTab("foco");
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center w-full" style={{ minHeight: 400, background: COLORS.bg, color: COLORS.textMuted }}>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14 }}>Carregando painel...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center" style={{ background: COLORS.bg, fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .ff-display { font-family: 'Oswald', sans-serif; letter-spacing: 0.02em; }
        .ff-mono { font-family: 'JetBrains Mono', monospace; }
        .ff-scroll::-webkit-scrollbar { width: 6px; }
        .ff-scroll::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 4px; }
        .ff-btn:focus-visible, .ff-input:focus-visible, .ff-tile:focus-visible { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
        @media (prefers-reduced-motion: no-preference) {
          .ff-plate-in { animation: ffPlateIn 0.35s ease-out; }
        }
        @keyframes ffPlateIn {
          from { transform: scale(0.4) translateY(6px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="w-full max-w-xl px-4 py-6 sm:py-8 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell size={22} color={COLORS.gold} strokeWidth={2.2} />
            <div>
              <h1 className="ff-display text-xl sm:text-2xl" style={{ color: COLORS.text, lineHeight: 1 }}>
                FOCO DE FERRO
              </h1>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>seu painel diário de disciplina</p>
            </div>
          </div>
          <button
            aria-label="Configurações"
            onClick={() => setShowSettings((v) => !v)}
            className="ff-btn p-2 rounded-full transition"
            style={{ background: showSettings ? COLORS.panelAlt : "transparent", color: COLORS.textMuted }}
          >
            <Settings2 size={20} />
          </button>
        </div>

        {showSettings && (
          <Card>
            <SectionTitle>CONFIGURAÇÕES</SectionTitle>
            <Stepper label="Foco (min)" value={state.settings.focusMin} onDec={() => updateSetting("focusMin", -5, 5, 90)} onInc={() => updateSetting("focusMin", 5, 5, 90)} />
            <Stepper label="Pausa curta (min)" value={state.settings.breakMin} onDec={() => updateSetting("breakMin", -1, 1, 30)} onInc={() => updateSetting("breakMin", 1, 1, 30)} />
            <Stepper label="Pausa longa (min)" value={state.settings.longBreakMin} onDec={() => updateSetting("longBreakMin", -5, 5, 60)} onInc={() => updateSetting("longBreakMin", 5, 5, 60)} />
            <Stepper label="Sessões até pausa longa" value={state.settings.cycleLength} onDec={() => updateSetting("cycleLength", -1, 2, 8)} onInc={() => updateSetting("cycleLength", 1, 2, 8)} />
            <button
              onClick={resetAllData}
              className="ff-btn text-xs self-start mt-1 px-3 py-1.5 rounded-md transition"
              style={{ color: COLORS.rust, border: `1px solid ${COLORS.rust}` }}
            >
              Reiniciar todos os dados
            </button>
            {saveError && (
              <p className="text-xs" style={{ color: COLORS.rust }}>Não foi possível salvar agora. Seu progresso pode não persistir.</p>
            )}
          </Card>
        )}

        <div className="flex gap-1 overflow-x-auto ff-scroll pb-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="ff-btn flex items-center gap-1.5 px-3 py-2 rounded-full text-xs shrink-0 transition"
                style={{
                  background: active ? COLORS.gold : COLORS.panelAlt,
                  color: active ? COLORS.bg : COLORS.textMuted,
                  fontFamily: "Oswald, sans-serif",
                  letterSpacing: "0.03em",
                }}
              >
                <Icon size={14} />
                {t.label.toUpperCase()}
              </button>
            );
          })}
        </div>

        {activeTab === "foco" && <FocoTab state={state} setState={setState} onCompleteFocus={completeFocusSession} />}
        {activeTab === "habitos" && <HabitosTab state={state} setState={setState} />}
        {activeTab === "sono" && <SonoTab state={state} setState={setState} />}
        {activeTab === "exercicio" && <ExercicioTab state={state} setState={setState} />}
        {activeTab === "humor" && <HumorTab state={state} setState={setState} />}

        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}` }}
        >
          <p className="text-sm flex-1" style={{ color: COLORS.text }}>
            {TIPS[state.stats.totalSessions % TIPS.length]}
          </p>
        </div>

        <div className="flex justify-between text-xs" style={{ color: COLORS.textMuted }}>
          <span>{state.stats.totalSessions} sessões de foco no total</span>
          <span>{Math.round(state.stats.totalMinutes / 60)}h focadas no total</span>
        </div>
      </div>
    </div>
  );
}
