// Constantes + helpers puros de estado/gamificação (sem JSX).

export const TIPS = [
  "Tenha clareza do ponto A ao ponto B: onde você está hoje e onde quer chegar.",
  "Monte um plano de ação intencional. Transforme metas em hábitos diários.",
  "Torne o planejamento inegociável. Visualize seus objetivos todos os dias.",
  "Esteja em um ambiente que te motive, ensine e inspire a melhorar.",
  "Esteja disposta a superar as tentativas de autossabotagem da sua mente.",
];

export const EXERCISE_TYPES = ["Musculação", "Cardio", "Caminhada", "Alongamento", "Outro"];

export const MOOD_OPTIONS = [
  { value: 1, emoji: "😞", label: "Muito baixo" },
  { value: 2, emoji: "🙁", label: "Baixo" },
  { value: 3, emoji: "😐", label: "Neutro" },
  { value: 4, emoji: "🙂", label: "Bom" },
  { value: 5, emoji: "😄", label: "Ótimo" },
];

export const TABS = [
  { id: "foco", label: "Foco", icon: "timer", path: "/foco" },
  { id: "habitos", label: "Hábitos", icon: "check_circle", path: "/habitos" },
  { id: "sono", label: "Sono", icon: "bedtime", path: "/sono" },
  { id: "exercicio", label: "Exercício", icon: "fitness_center", path: "/exercicio" },
  { id: "humor", label: "Humor", icon: "psychology", path: "/humor" },
  { id: "analise", label: "Análise", icon: "insights", path: "/analise" },
];

export const TIERS = ["INICIANTE", "APRENDIZ DE FERRO", "FORJADOR", "VETERANO DE AÇO", "MESTRE DE TITÂNIO"];
export const HABIT_ICONS = ["water_drop", "menu_book", "self_improvement", "directions_run", "bolt", "dark_mode"];

/* ---------- helpers ---------- */
export function pad(n) {
  return String(n).padStart(2, "0");
}
export function getDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function weekdayShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}
export function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad(m)}:${pad(s)}`;
}
export function minutesToHm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m ? pad(m) : ""}`;
}
export function last7Dates() {
  return Array.from({ length: 7 }, (_, i) => getDateStr(-(6 - i)));
}
export function lastNDates(n) {
  return Array.from({ length: n }, (_, i) => getDateStr(-(n - 1 - i)));
}
export function fmtK(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : String(n);
}

/* ---------- gamification rules ---------- */
export const XP = { focus: 50, tasksAllDone: 10, sleepGoal: 50, exercise: 40 };

// baselines de referência p/ XP proporcional
export const BASE_FOCUS_MIN = 25;
export const BASE_SLEEP_MIN = 450;
// limites da meta de sono: 6h a 9h
export const SLEEP_GOAL_MIN = 360;
export const SLEEP_GOAL_MAX = 540;

// XP da sessão de foco escala com a duração (mais tempo = mais XP; menos = menos)
export function focusXp(focusMin) {
  return Math.max(1, Math.round(XP.focus * ((focusMin || BASE_FOCUS_MIN) / BASE_FOCUS_MIN)));
}
// XP do sono escala com a meta (meta maior = mais XP)
export function sleepXp(goalMin) {
  return Math.max(1, Math.round(XP.sleepGoal * ((goalMin || BASE_SLEEP_MIN) / BASE_SLEEP_MIN)));
}

// +5% por dia de streak, teto +50%
export function streakMult(streak) {
  return 1 + Math.min(0.05 * (streak || 0), 0.5);
}
export function award(base, streak) {
  return Math.round(base * streakMult(streak));
}
export function tierFor(level) {
  if (level <= 2) return TIERS[0];
  if (level <= 5) return TIERS[1];
  if (level <= 9) return TIERS[2];
  if (level <= 14) return TIERS[3];
  return TIERS[4];
}
// escalonada suave: nível N→N+1 custa 500 + 250*(N-1)
export function gamify(stats) {
  const xp = stats.xp || 0;
  let level = 1;
  let need = 500;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level++;
    need += 250;
  }
  const intoLevel = xp - acc;
  return { xp, level, intoLevel, toNext: need, pct: Math.round((intoLevel / need) * 100), tier: tierFor(level) };
}

// Insígnias derivadas do estado (nada persistido — recalculado sempre).
export function computeBadges(state) {
  const s = state.stats || {};
  const g = gamify(s);
  const goal = state.settings?.sleepGoalMin || 450;
  const sleepGoalNights = Object.values(state.sleep || {}).filter((n) => (n?.durationMin || 0) >= goal).length;
  const exSessions = (state.exerciseLogs || []).length;
  const moodDays = Object.keys(state.mood || {}).length;
  const habitBest = (state.habits || []).reduce((m, h) => Math.max(m, computeHabitStreak(h.doneDates)), 0);
  const totalSessions = s.totalSessions || 0;

  const defs = [
    { id: "first_focus", name: "Primeiro Foco", icon: "footprint", desc: "Conclua 1 sessão de foco", cur: totalSessions, target: 1 },
    { id: "focus_10", name: "Aquecendo", icon: "mode_heat", desc: "10 sessões de foco", cur: totalSessions, target: 10 },
    { id: "focus_50", name: "Foco de Aço", icon: "bolt", desc: "50 sessões de foco", cur: totalSessions, target: 50 },
    { id: "focus_100", name: "Centurião", icon: "military_tech", desc: "100 sessões de foco", cur: totalSessions, target: 100 },
    { id: "focus_500", name: "Lendário", icon: "workspace_premium", desc: "500 sessões de foco", cur: totalSessions, target: 500 },
    { id: "streak_3", name: "Constância", icon: "whatshot", desc: "Sequência de 3 dias", cur: s.bestStreak || 0, target: 3 },
    { id: "streak_7", name: "Semana Firme", icon: "local_fire_department", desc: "Sequência de 7 dias", cur: s.bestStreak || 0, target: 7 },
    { id: "streak_30", name: "Inabalável", icon: "mode_heat", desc: "Sequência de 30 dias", cur: s.bestStreak || 0, target: 30 },
    { id: "level_5", name: "Aprendiz", icon: "stars", desc: "Alcance o nível 5", cur: g.level, target: 5 },
    { id: "level_10", name: "Veterano", icon: "star", desc: "Alcance o nível 10", cur: g.level, target: 10 },
    { id: "level_15", name: "Mestre", icon: "diamond", desc: "Alcance o nível 15", cur: g.level, target: 15 },
    { id: "sleep_7", name: "Bem Dormido", icon: "bedtime", desc: "7 noites na meta de sono", cur: sleepGoalNights, target: 7 },
    { id: "sleep_30", name: "Sono de Ouro", icon: "nights_stay", desc: "30 noites na meta de sono", cur: sleepGoalNights, target: 30 },
    { id: "ex_10", name: "Suado", icon: "fitness_center", desc: "10 treinos registrados", cur: exSessions, target: 10 },
    { id: "ex_50", name: "Máquina", icon: "exercise", desc: "50 treinos registrados", cur: exSessions, target: 50 },
    { id: "mood_7", name: "Autoconsciente", icon: "psychology", desc: "7 dias de humor registrados", cur: moodDays, target: 7 },
    { id: "mood_30", name: "Equilibrado", icon: "self_improvement", desc: "30 dias de humor registrados", cur: moodDays, target: 30 },
    { id: "habit_7", name: "Disciplina Diária", icon: "check_circle", desc: "Um hábito por 7 dias seguidos", cur: habitBest, target: 7 },
  ];
  return defs.map((d) => ({ ...d, earned: d.cur >= d.target, pct: Math.min(100, Math.round((d.cur / d.target) * 100)) }));
}

export function computeHabitStreak(doneDates) {
  const set = new Set(doneDates || []);
  let streak = 0;
  let offset = set.has(getDateStr(0)) ? 0 : -1;
  while (set.has(getDateStr(offset))) {
    streak++;
    offset--;
  }
  return streak;
}

export function defaultState() {
  return {
    settings: { focusMin: 25, breakMin: 5, longBreakMin: 15, cycleLength: 4, exerciseWeeklyGoal: 3, sleepGoalMin: 450 },
    stats: {
      xp: 0,
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
    tasksBonusDate: null,
    habits: [],
    sleep: {},
    exerciseLogs: [],
    mood: {},
    focusHistory: {}, // { [date]: { sessions, minutes } } — retrospecto de foco
  };
}

export function mergeWithDefaults(parsed) {
  const d = defaultState();
  parsed = parsed || {};
  const settings = { ...d.settings, ...(parsed.settings || {}) };
  settings.sleepGoalMin = Math.min(SLEEP_GOAL_MAX, Math.max(SLEEP_GOAL_MIN, settings.sleepGoalMin || BASE_SLEEP_MIN));
  return {
    settings,
    stats: { ...d.stats, ...(parsed.stats || {}) },
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    tasksDate: parsed.tasksDate || d.tasksDate,
    tasksBonusDate: parsed.tasksBonusDate || null,
    habits: Array.isArray(parsed.habits) ? parsed.habits : [],
    sleep: parsed.sleep && typeof parsed.sleep === "object" ? parsed.sleep : {},
    exerciseLogs: Array.isArray(parsed.exerciseLogs) ? parsed.exerciseLogs : [],
    mood: parsed.mood && typeof parsed.mood === "object" ? parsed.mood : {},
    focusHistory: parsed.focusHistory && typeof parsed.focusHistory === "object" ? parsed.focusHistory : {},
  };
}

export function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((freq, i) => {
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
  } catch (e) {}
}
