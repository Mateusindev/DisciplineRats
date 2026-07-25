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

// ===== Humor por período do dia =====
// entrada do dia: { morning?, afternoon?, evening? } com { mood:1-5, note?, tags?:[] }
// legado (registro único): { mood:number, note } — helpers abaixo toleram as duas formas.
export const MOOD_PERIODS = [
  { key: "morning", label: "Manhã", icon: "wb_twilight" },
  { key: "afternoon", label: "Tarde", icon: "clear_day" },
  { key: "evening", label: "Noite", icon: "bedtime" },
];
const MOOD_PERIOD_KEYS = MOOD_PERIODS.map((p) => p.key);

// tags de atividade/contexto por registro (lista fixa por ora)
export const MOOD_TAGS = [
  { id: "treino", label: "Treino", icon: "fitness_center" },
  { id: "jiu", label: "Jiu-jitsu", icon: "sports_martial_arts" },
  { id: "trabalho", label: "Trabalho", icon: "work" },
  { id: "estudo", label: "Estudo", icon: "school" },
  { id: "social", label: "Social", icon: "groups" },
  { id: "descanso", label: "Descanso", icon: "self_improvement" },
  { id: "sono_ruim", label: "Sono ruim", icon: "bedtime_off" },
  { id: "ansiedade", label: "Ansiedade", icon: "sentiment_stressed" },
];

// ===== Agenda / Calendário (sem XP) =====
// state.calendar = { [date "YYYY-MM-DD"]: [ evento ] }
// evento = { id, title, cat, allDay:bool, start:"HH:MM"|null, end:"HH:MM"|null, note:string }
export const CALENDAR_CATS = [
  { id: "trabalho", label: "Trabalho", color: "#7c9cff" },
  { id: "pessoal", label: "Pessoal", color: "#b48cff" },
  { id: "saude", label: "Saúde", color: "#ff8a8a" },
  { id: "treino", label: "Treino", color: "#7ee0a1" },
  { id: "estudo", label: "Estudo", color: "#6bd6e0" },
  { id: "social", label: "Social", color: "#ffcf6b" },
  { id: "outro", label: "Outro", color: "#b0b6be" },
];
export const calCat = (id) => CALENDAR_CATS.find((c) => c.id === id) || CALENDAR_CATS[CALENDAR_CATS.length - 1];

// ordena eventos de um dia: dia-inteiro primeiro, depois por horário de início
export function sortEvents(events) {
  return [...(events || [])].sort((a, b) => {
    if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
    return (a.start || "").localeCompare(b.start || "");
  });
}
// rótulo de horário do evento
export function eventTimeLabel(e) {
  if (e.allDay) return "Dia inteiro";
  if (e.start && e.end) return `${e.start}–${e.end}`;
  return e.start || "";
}

// período atual pela hora local (manhã <12, tarde 12–18, noite ≥18)
export function currentPeriodKey() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

// períodos preenchidos de uma entrada. Legado numérico → um item { key:null }.
export function moodPeriods(entry) {
  if (!entry) return [];
  if (typeof entry.mood === "number") return [{ key: null, mood: entry.mood, note: entry.note || "", tags: [] }];
  const out = [];
  for (const k of MOOD_PERIOD_KEYS) {
    const p = entry[k];
    if (p && typeof p.mood === "number") out.push({ key: k, mood: p.mood, note: p.note || "", tags: p.tags || [] });
  }
  return out;
}

// média dos períodos presentes (ou o numérico legado); null se vazio.
export function moodDayAvg(entry) {
  const ps = moodPeriods(entry);
  if (!ps.length) return null;
  return ps.reduce((s, p) => s + p.mood, 0) / ps.length;
}

export function moodHasContent(entry) {
  return moodPeriods(entry).length > 0;
}

// humor médio por tag ao longo de todo o histórico → { [tagId]: { avg, n } }
export function moodTagAverages(moodMap) {
  const acc = {};
  for (const date of Object.keys(moodMap || {})) {
    for (const p of moodPeriods(moodMap[date])) {
      for (const t of p.tags || []) {
        const a = (acc[t] ||= { sum: 0, n: 0 });
        a.sum += p.mood;
        a.n++;
      }
    }
  }
  const out = {};
  for (const [t, a] of Object.entries(acc)) out[t] = { avg: a.sum / a.n, n: a.n };
  return out;
}

// humor médio por período do dia ao longo do histórico → { morning:{avg,n}, ... }
export function moodPeriodAverages(moodMap) {
  const acc = {};
  for (const date of Object.keys(moodMap || {})) {
    for (const p of moodPeriods(moodMap[date])) {
      if (!p.key) continue; // legado sem período definido não entra na média por período
      const a = (acc[p.key] ||= { sum: 0, n: 0 });
      a.sum += p.mood;
      a.n++;
    }
  }
  const out = {};
  for (const p of MOOD_PERIODS) out[p.key] = acc[p.key] ? { avg: acc[p.key].sum / acc[p.key].n, n: acc[p.key].n } : { avg: null, n: 0 };
  return out;
}

export const TABS = [
  { id: "home", label: "Home", icon: "home", path: "/home" },
  { id: "missoes", label: "Missões", icon: "flag", path: "/missoes" },
  // desativados por enquanto — reativar removendo o comentário:
  // { id: "foco", label: "Foco", icon: "timer", path: "/foco" },
  // { id: "rotina", label: "Rotina", icon: "checklist", path: "/rotina" },
  { id: "habitos", label: "Hábitos", icon: "check_circle", path: "/habitos" },
  { id: "sono", label: "Sono", icon: "bedtime", path: "/sono" },
  { id: "exercicio", label: "Exercício", icon: "fitness_center", path: "/exercicio" },
  { id: "dieta", label: "Dieta", icon: "restaurant", path: "/dieta" },
  { id: "calendario", label: "Agenda", icon: "calendar_month", path: "/calendario" },
  { id: "humor", label: "Humor", icon: "psychology", path: "/humor" },
  { id: "diario", label: "Diário", icon: "book", path: "/diario" },
  // { id: "carteira", label: "Carteira", icon: "account_balance_wallet", path: "/carteira" },
  { id: "leitura", label: "Leitura", icon: "menu_book", path: "/leitura" },
  // { id: "grupos", label: "Grupos", icon: "groups", path: "/grupos" },
  { id: "analise", label: "Análise", icon: "insights", path: "/analise" },
];


export const TIERS = ["INICIANTE", "APRENDIZ DE FERRO", "FORJADOR", "VETERANO DE AÇO", "MESTRE DE TITÂNIO"];
export const DEFAULT_LOFI_URL = "https://youtu.be/KfRkr0h-L2g";

// extrai o ID de vídeo de várias formas de URL do YouTube (ou ID cru)
export function youtubeId(url) {
  if (!url) return null;
  const raw = String(url).trim();
  try {
    const u = new URL(raw);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => p === "embed" || p === "live" || p === "shorts");
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
    return null;
  } catch (e) {
    return /^[\w-]{11}$/.test(raw) ? raw : null;
  }
}
export const HABIT_ICONS = [
  "water_drop", "menu_book", "self_improvement", "directions_run", "bolt", "dark_mode",
  "fitness_center", "bedtime", "restaurant", "psychology", "savings", "brush",
  "code", "music_note", "sunny", "eco", "smoking_rooms", "no_drinks",
  "phone_disabled", "cleaning_services", "pets", "favorite", "school", "timer",
];

/* ---------- helpers ---------- */
export function pad(n) {
  return String(n).padStart(2, "0");
}
export function getDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function dietTotals(entries) {
  return (entries || []).reduce(
    (t, e) => ({
      kcal: t.kcal + (e.kcal || 0),
      protein: t.protein + (e.protein || 0),
      carbs: t.carbs + (e.carbs || 0),
      fat: t.fat + (e.fat || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
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

// ---- finanças ----
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function fmtMoney(n) {
  return BRL.format(Number(n) || 0);
}
export const monthKey = (dateStr) => (dateStr || getDateStr(0)).slice(0, 7); // "YYYY-MM"
export const EXPENSE_CATS = ["Alimentação", "Transporte", "Moradia", "Contas", "Lazer", "Saúde", "Educação", "Compras", "Outros"];
export const INCOME_CATS = ["Salário", "Freelas", "Investimento", "Presente", "Outros"];

/* ---------- gamification rules ---------- */
export const XP = {
  focus: 50,
  tasksAllDone: 10,
  tasksMiss: 5, // metade do bônus: dia fechado com missão pendente
  sleepGoal: 50,
  sleepMiss: 25, // metade: noite abaixo da meta
  exercise: 40,
  exerciseMiss: 20, // metade: por treino faltante na meta semanal
  journal: 15, // escrever no diário (1×/dia, sem penalidade — reflexão não se pune)
};

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
// penalidade por noite abaixo da meta — flat (sem multiplicador de streak)
export function sleepMissXp(goalMin) {
  return Math.max(1, Math.round(XP.sleepMiss * ((goalMin || BASE_SLEEP_MIN) / BASE_SLEEP_MIN)));
}

// ---- qualidade do horário de dormir ----
export const SLEEP_LIMIT_DEFAULT = "23:30";
export const SLEEP_LATE_ZERO = 90; // min após o limite em que o prêmio zera (além disso, negativo)

const hhmmToMin = (t) => {
  const [h, m] = String(t || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
// noite: horários antes do meio-dia contam como madrugada (dia seguinte) p/ comparar com o limite noturno
const toEvening = (min) => (min < 12 * 60 ? min + 24 * 60 : min);

// Quão tarde a pessoa deitou, em minutos após o limite (negativo = deitou no horário/antes).
export function bedtimeLateness(bedtime, limit = SLEEP_LIMIT_DEFAULT) {
  return toEvening(hhmmToMin(bedtime)) - toEvening(hhmmToMin(limit));
}

// Fator do horário (deitar): 1 no horário; cai linearmente; passa a negativo após SLEEP_LATE_ZERO. Clamp [-1,1].
export function bedtimeFactor(bedtime, limit = SLEEP_LIMIT_DEFAULT) {
  const late = bedtimeLateness(bedtime, limit);
  if (late <= 0) return 1;
  return Math.max(-1, Math.min(1, 1 - late / SLEEP_LATE_ZERO));
}

// XP líquido (assinado) da noite, combinando DURAÇÃO e HORÁRIO de dormir.
// Meta batida: prêmio cheio só deitando cedo; tarde derruba e pode virar negativo (streak amplia só o positivo).
// Meta não batida: −metade, agravada se também deitou tarde (até 2×).
export function computeSleepXp({ durationMin, bedtime, goalMin, limit = SLEEP_LIMIT_DEFAULT, streak = 0 }) {
  const bf = bedtimeFactor(bedtime, limit);
  if (durationMin >= goalMin) {
    const raw = sleepXp(goalMin) * bf;
    return raw >= 0 ? Math.round(raw * streakMult(streak)) : Math.round(raw); // negativo é flat
  }
  const late = bedtimeLateness(bedtime, limit);
  const lateMult = Math.max(1, Math.min(2, 1 + Math.max(0, late) / SLEEP_LATE_ZERO));
  return -Math.round(sleepMissXp(goalMin) * lateMult);
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
  const sleep = state.sleep || {};
  const sleepGoalNights = Object.values(sleep).filter((n) => (n?.durationMin || 0) >= goal).length;
  const totalNights = Object.keys(sleep).length;
  const exSessions = (state.exerciseLogs || []).length;
  const gymSetsCount = (state.gymSets || []).length;
  const moodMap = state.mood || {};
  const moodDays = Object.keys(moodMap).filter((k) => moodHasContent(moodMap[k])).length;
  const positiveHabits = (state.habits || []).filter(
    (h) => (h.kind || "build") !== "quit" && !((h.kind || "build") === "weekly" && h.direction === "max")
  );
  const habitBest = positiveHabits.reduce((m, h) => Math.max(m, computeHabitStreak(h.doneDates)), 0);
  const habitChecks = positiveHabits.reduce((sum, h) => sum + (h.doneDates || []).length, 0);
  const habitsCreated = (state.habits || []).length;
  const journal = state.journal || {};
  const journalCount = Object.keys(journal).filter((k) => journalHasContent(journal[k])).length;
  const totalSessions = s.totalSessions || 0;
  const focusHours = Math.floor((s.totalMinutes || 0) / 60);
  const xp = g.xp;
  const bestStreak = s.bestStreak || 0;

  // dias ativos + guerreiro de fim de semana (sáb+dom ativos na mesma semana)
  const actSet = activeDaySet(state);
  const activeDays = actSet.size;
  let weekendWarrior = false;
  for (const d of actSet) {
    if (new Date(d + "T00:00:00").getDay() === 6 && actSet.has(shiftDate(d, 1))) {
      weekendWarrior = true;
      break;
    }
  }

  const defs = [
    // ---- Foco ----
    { id: "first_focus", group: "Foco", name: "Primeiro Foco", icon: "footprint", desc: "Conclua 1 sessão de foco", cur: totalSessions, target: 1 },
    { id: "focus_10", group: "Foco", name: "Aquecendo", icon: "mode_heat", desc: "10 sessões de foco", cur: totalSessions, target: 10 },
    { id: "focus_50", group: "Foco", name: "Foco de Aço", icon: "bolt", desc: "50 sessões de foco", cur: totalSessions, target: 50 },
    { id: "focus_100", group: "Foco", name: "Centurião", icon: "military_tech", desc: "100 sessões de foco", cur: totalSessions, target: 100 },
    { id: "focus_250", group: "Foco", name: "Imparável", icon: "rocket_launch", desc: "250 sessões de foco", cur: totalSessions, target: 250 },
    { id: "focus_500", group: "Foco", name: "Lendário", icon: "workspace_premium", desc: "500 sessões de foco", cur: totalSessions, target: 500 },
    { id: "focus_1000", group: "Foco", name: "Divindade do Foco", icon: "auto_awesome", desc: "1000 sessões de foco", cur: totalSessions, target: 1000 },
    { id: "hours_10", group: "Foco", name: "10 Horas", icon: "hourglass_top", desc: "10h totais de foco", cur: focusHours, target: 10 },
    { id: "hours_50", group: "Foco", name: "Maratonista", icon: "timelapse", desc: "50h totais de foco", cur: focusHours, target: 50 },
    { id: "hours_100", group: "Foco", name: "100 Horas", icon: "history_toggle_off", desc: "100h totais de foco", cur: focusHours, target: 100 },

    // ---- Sequência ----
    { id: "streak_3", group: "Sequência", name: "Constância", icon: "whatshot", desc: "Sequência de 3 dias", cur: bestStreak, target: 3 },
    { id: "streak_7", group: "Sequência", name: "Semana Firme", icon: "local_fire_department", desc: "Sequência de 7 dias", cur: bestStreak, target: 7 },
    { id: "streak_14", group: "Sequência", name: "Duas Semanas", icon: "mode_heat", desc: "Sequência de 14 dias", cur: bestStreak, target: 14 },
    { id: "streak_30", group: "Sequência", name: "Inabalável", icon: "local_fire_department", desc: "Sequência de 30 dias", cur: bestStreak, target: 30 },
    { id: "streak_60", group: "Sequência", name: "Ferro Puro", icon: "bolt", desc: "Sequência de 60 dias", cur: bestStreak, target: 60 },
    { id: "streak_100", group: "Sequência", name: "Chama Eterna", icon: "auto_awesome", desc: "Sequência de 100 dias", cur: bestStreak, target: 100 },
    { id: "streak_365", group: "Sequência", name: "Um Ano Inteiro", icon: "emoji_events", desc: "Sequência de 365 dias", cur: bestStreak, target: 365 },

    // ---- Nível ----
    { id: "level_5", group: "Nível", name: "Aprendiz", icon: "stars", desc: "Alcance o nível 5", cur: g.level, target: 5 },
    { id: "level_10", group: "Nível", name: "Veterano", icon: "star", desc: "Alcance o nível 10", cur: g.level, target: 10 },
    { id: "level_15", group: "Nível", name: "Mestre", icon: "diamond", desc: "Alcance o nível 15", cur: g.level, target: 15 },
    { id: "level_25", group: "Nível", name: "Grão-Mestre", icon: "shield", desc: "Alcance o nível 25", cur: g.level, target: 25 },
    { id: "level_40", group: "Nível", name: "Elite", icon: "military_tech", desc: "Alcance o nível 40", cur: g.level, target: 40 },
    { id: "level_50", group: "Nível", name: "Ascensão", icon: "workspace_premium", desc: "Alcance o nível 50", cur: g.level, target: 50 },

    // ---- XP ----
    { id: "xp_1k", group: "XP", name: "Mil Pontos", icon: "toll", desc: "Acumule 1.000 XP", cur: xp, target: 1000 },
    { id: "xp_5k", group: "XP", name: "Coletor", icon: "savings", desc: "Acumule 5.000 XP", cur: xp, target: 5000 },
    { id: "xp_10k", group: "XP", name: "Fortuna", icon: "paid", desc: "Acumule 10.000 XP", cur: xp, target: 10000 },
    { id: "xp_25k", group: "XP", name: "Magnata", icon: "diamond", desc: "Acumule 25.000 XP", cur: xp, target: 25000 },
    { id: "xp_50k", group: "XP", name: "Tesouro Vivo", icon: "workspace_premium", desc: "Acumule 50.000 XP", cur: xp, target: 50000 },

    // ---- Sono ----
    { id: "sleep_7", group: "Sono", name: "Bem Dormido", icon: "bedtime", desc: "7 noites na meta de sono", cur: sleepGoalNights, target: 7 },
    { id: "sleep_30", group: "Sono", name: "Sono de Ouro", icon: "nights_stay", desc: "30 noites na meta de sono", cur: sleepGoalNights, target: 30 },
    { id: "sleep_100", group: "Sono", name: "Descanso Sagrado", icon: "dark_mode", desc: "100 noites na meta de sono", cur: sleepGoalNights, target: 100 },
    { id: "nights_10", group: "Sono", name: "Registro Noturno", icon: "nightlight", desc: "Registre 10 noites de sono", cur: totalNights, target: 10 },
    { id: "nights_50", group: "Sono", name: "Diário do Sono", icon: "bedtime", desc: "Registre 50 noites de sono", cur: totalNights, target: 50 },

    // ---- Treino ----
    { id: "ex_10", group: "Treino", name: "Suado", icon: "fitness_center", desc: "10 treinos registrados", cur: exSessions, target: 10 },
    { id: "ex_50", group: "Treino", name: "Máquina", icon: "exercise", desc: "50 treinos registrados", cur: exSessions, target: 50 },
    { id: "ex_100", group: "Treino", name: "Atleta", icon: "sports_martial_arts", desc: "100 treinos registrados", cur: exSessions, target: 100 },
    { id: "ex_250", group: "Treino", name: "Ferro Forjado", icon: "sports_gymnastics", desc: "250 treinos registrados", cur: exSessions, target: 250 },
    { id: "sets_50", group: "Treino", name: "Série Iniciante", icon: "repeat", desc: "50 séries registradas", cur: gymSetsCount, target: 50 },
    { id: "sets_200", group: "Treino", name: "Volume Bruto", icon: "stacked_bar_chart", desc: "200 séries registradas", cur: gymSetsCount, target: 200 },
    { id: "sets_500", group: "Treino", name: "Rei do Volume", icon: "emoji_events", desc: "500 séries registradas", cur: gymSetsCount, target: 500 },

    // ---- Hábitos ----
    { id: "habit_created", group: "Hábitos", name: "Começar é Tudo", icon: "add_task", desc: "Crie seu 1º hábito", cur: habitsCreated, target: 1 },
    { id: "habit_7", group: "Hábitos", name: "Disciplina Diária", icon: "check_circle", desc: "Um hábito por 7 dias seguidos", cur: habitBest, target: 7 },
    { id: "habit_30", group: "Hábitos", name: "Segunda Natureza", icon: "verified", desc: "Um hábito por 30 dias seguidos", cur: habitBest, target: 30 },
    { id: "habit_100", group: "Hábitos", name: "Piloto Automático", icon: "psychology_alt", desc: "Um hábito por 100 dias seguidos", cur: habitBest, target: 100 },
    { id: "checks_50", group: "Hábitos", name: "50 Marcações", icon: "done_all", desc: "50 marcações de hábito", cur: habitChecks, target: 50 },
    { id: "checks_250", group: "Hábitos", name: "Consistente", icon: "task_alt", desc: "250 marcações de hábito", cur: habitChecks, target: 250 },
    { id: "checks_1000", group: "Hábitos", name: "Milésima Vitória", icon: "workspace_premium", desc: "1000 marcações de hábito", cur: habitChecks, target: 1000 },

    // ---- Diário ----
    { id: "journal_1", group: "Diário", name: "Querido Diário", icon: "edit_note", desc: "Escreva 1 entrada no diário", cur: journalCount, target: 1 },
    { id: "journal_7", group: "Diário", name: "Reflexivo", icon: "menu_book", desc: "7 entradas no diário", cur: journalCount, target: 7 },
    { id: "journal_30", group: "Diário", name: "Escritor", icon: "book", desc: "30 entradas no diário", cur: journalCount, target: 30 },
    { id: "journal_100", group: "Diário", name: "Cronista", icon: "auto_stories", desc: "100 entradas no diário", cur: journalCount, target: 100 },

    // ---- Humor ----
    { id: "mood_7", group: "Humor", name: "Autoconsciente", icon: "psychology", desc: "7 dias de humor registrados", cur: moodDays, target: 7 },
    { id: "mood_30", group: "Humor", name: "Equilibrado", icon: "self_improvement", desc: "30 dias de humor registrados", cur: moodDays, target: 30 },
    { id: "mood_100", group: "Humor", name: "Mente Clara", icon: "spa", desc: "100 dias de humor registrados", cur: moodDays, target: 100 },

    // ---- Dedicação ----
    { id: "active_10", group: "Dedicação", name: "Presente", icon: "calendar_today", desc: "10 dias ativos no app", cur: activeDays, target: 10 },
    { id: "active_50", group: "Dedicação", name: "Comprometido", icon: "event_available", desc: "50 dias ativos no app", cur: activeDays, target: 50 },
    { id: "active_100", group: "Dedicação", name: "Devoto", icon: "calendar_month", desc: "100 dias ativos no app", cur: activeDays, target: 100 },
    { id: "active_365", group: "Dedicação", name: "Ano de Disciplina", icon: "emoji_events", desc: "365 dias ativos no app", cur: activeDays, target: 365 },
    { id: "weekend_warrior", group: "Dedicação", name: "Guerreiro de Fim de Semana", icon: "weekend", desc: "Ativo num sábado e domingo", cur: weekendWarrior ? 1 : 0, target: 1 },
  ];
  return defs.map((d) => ({ ...d, earned: d.cur >= d.target, pct: Math.min(100, Math.round((d.cur / d.target) * 100)) }));
}

// ===== Hábitos: prioridade + vícios (quit) =====
export const HABIT_PRIORITIES = [
  { v: 1, label: "BAIXA", xp: 10, mult: 0.75 },
  { v: 2, label: "NORMAL", xp: 15, mult: 1 },
  { v: 3, label: "ALTA", xp: 25, mult: 1.5 },
];
export const habitPriority = (h) => HABIT_PRIORITIES.find((p) => p.v === (h.priority || 2)) || HABIT_PRIORITIES[1];

// dias da semana (0=Seg … 6=Dom, casa com weekStartOf); índice de hoje: (getDay()+6)%7
export const DOW_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Marca/desmarca hábito como concluído em `today`. Reducer puro reusável
// (habitos e home chamam o MESMO): award/estorno de XP idêntico, quit não-toggle,
// weekly-max marca sem XP. Retorna o próximo state.
export function toggleHabitState(prev, id, today) {
  const h = prev.habits.find((x) => x.id === id);
  if (!h || (h.kind || "build") === "quit") return prev;
  const noXp = (h.kind || "build") === "weekly" && h.direction === "max";
  const doneDates = h.doneDates || [];
  const has = doneDates.includes(today);
  let stats = prev.stats;
  let patch;
  if (has) {
    const refund = h.checkXp?.[today] || 0;
    const { [today]: _drop, ...restXp } = h.checkXp || {};
    patch = { doneDates: doneDates.filter((d) => d !== today), checkXp: restXp };
    if (refund) stats = { ...stats, xp: Math.max(0, (stats.xp || 0) - refund) };
  } else if (noXp) {
    patch = { doneDates: [...doneDates, today] };
  } else {
    const gain = award(habitPriority(h).xp, stats.streak);
    patch = { doneDates: [...doneDates, today], checkXp: { ...(h.checkXp || {}), [today]: gain } };
    stats = { ...stats, xp: (stats.xp || 0) + gain };
  }
  return { ...prev, stats, habits: prev.habits.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
}

// Marcos de dias limpos p/ vícios (XP base — escala com prioridade)
export const QUIT_MILESTONES = [
  { days: 3, xp: 15 },
  { days: 7, xp: 35 },
  { days: 14, xp: 70 },
  { days: 30, xp: 150 },
  { days: 60, xp: 300 },
  { days: 90, xp: 500 },
];

// "YYYY-MM-DD" local a partir de ISO completo (truncar em UTC dá off-by-one em UTC-3)
export function localDateStr(iso) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// b - a em dias (strings "YYYY-MM-DD")
export function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

// última recaída até hoje (quit usa doneDates como datas de recaída)
export function lastRelapse(doneDates) {
  const today = getDateStr(0);
  let last = null;
  for (const d of doneDates || []) if (d <= today && (!last || d > last)) last = d;
  return last;
}

// início do período limpo atual: última recaída, senão criação
export function quitPeriodStart(h) {
  return lastRelapse(h.doneDates) || localDateStr(h.createdAt);
}

export function cleanDays(h) {
  return Math.max(0, daysBetween(quitPeriodStart(h), getDateStr(0)));
}

export function bestCleanRun(h) {
  const today = getDateStr(0);
  const relapses = [...new Set((h.doneDates || []).filter((d) => d <= today))].sort();
  let best = 0;
  let prev = localDateStr(h.createdAt);
  for (const r of relapses) {
    best = Math.max(best, daysBetween(prev, r));
    prev = r;
  }
  return Math.max(best, Math.max(0, daysBetween(prev, today)));
}

// recaídas no intervalo [from, to] inclusivo
export function relapsesInWindow(doneDates, from, to) {
  return (doneDates || []).filter((d) => d >= from && d <= to).length;
}

// ===== meta semanal (kind "weekly"): pelo menos/no máximo N dias por semana =====
export const WEEKLY_BONUS = { min: 25, max: 30 }; // XP base por semana fechada dentro da meta

// segunda-feira da semana da data
export function weekStartOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const dow = (d.getDay() + 6) % 7; // seg = 0
  return shiftDate(dateStr, -dow);
}

// dias marcados na semana corrente (segunda → hoje)
export function weekCount(h, today = getDateStr(0)) {
  const wk = weekStartOf(today);
  return (h.doneDates || []).filter((d) => d >= wk && d <= today).length;
}

// Semanas FECHADAS dentro da meta e ainda não premiadas. Idempotente via milestones["wk:<segunda>"].
// Começa na 1ª semana cheia após a criação (semana parcial da criação é injusta p/ "min").
// Semana fora da meta não é marcada — re-avaliar é barato e doneDates passados não mudam.
export function computeDueWeeklyBonus(h) {
  if ((h.kind || "build") !== "weekly") return null;
  const target = h.weeklyTarget || 3;
  const dir = h.direction || "min";
  const today = getDateStr(0);
  const curWeek = weekStartOf(today);
  const created = localDateStr(h.createdAt);
  let wk = weekStartOf(created);
  if (wk < created) wk = shiftDate(wk, 7);
  const got = h.milestones || {};
  const dates = h.doneDates || [];
  const keys = [];
  let guard = 0;
  while (wk < curWeek && guard++ < 520) {
    const key = `wk:${wk}`;
    if (!got[key]) {
      const wkEnd = shiftDate(wk, 6);
      const count = dates.filter((d) => d >= wk && d <= wkEnd).length;
      const ok = dir === "min" ? count >= target : count <= target;
      if (ok) keys.push(key);
    }
    wk = shiftDate(wk, 7);
  }
  if (!keys.length) return null;
  const per = Math.round(WEEKLY_BONUS[dir] * habitPriority(h).mult);
  return { keys, xp: per * keys.length };
}

// Marcos vencidos e ainda não premiados no período limpo atual.
// milestones = { [periodStart]: [3,7,...] } — chave antiga persiste (anti re-award após undo).
export function computeDueMilestones(h) {
  if ((h.kind || "build") !== "quit") return null;
  const key = quitPeriodStart(h);
  const clean = cleanDays(h);
  const got = (h.milestones && h.milestones[key]) || [];
  const due = QUIT_MILESTONES.filter((m) => m.days <= clean && !got.includes(m.days));
  if (!due.length) return null;
  const mult = habitPriority(h).mult;
  return { key, newDays: due.map((m) => m.days), xp: due.reduce((s, m) => s + Math.round(m.xp * mult), 0) };
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

// ---- sequência geral (streak) ----
// "dia ativo" = fez QUALQUER coisa registrável no app naquele dia.
// Conjunto de datas "YYYY-MM-DD" com atividade, de todas as áreas.
export function activeDaySet(state) {
  const s = new Set();
  const addKeys = (o) => o && Object.keys(o).forEach((k) => s.add(k));
  addKeys(state.focusHistory);
  addKeys(state.sleep);
  const md = state.mood || {};
  Object.keys(md).forEach((k) => moodHasContent(md[k]) && s.add(k));
  addKeys(state.routineChecks);
  const j = state.journal || {};
  Object.keys(j).forEach((k) => journalHasContent(j[k]) && s.add(k));
  (state.exerciseLogs || []).forEach((l) => l?.date && s.add(l.date));
  (state.gymSets || []).forEach((g) => g?.date && s.add(g.date));
  (state.habits || []).forEach((h) => {
    if ((h.kind || "build") !== "quit") (h.doneDates || []).forEach((d) => s.add(d));
  });
  return s;
}

// sequência = dias consecutivos com atividade terminando hoje (ou ontem, pra
// não zerar antes do dia acabar). Derivada — imune a ordem e auto-corrige.
export function computeActivityStreak(state, today = getDateStr(0)) {
  const set = activeDaySet(state);
  if (!set.size) return 0;
  let cursor = set.has(today) ? today : shiftDate(today, -1);
  if (!set.has(cursor)) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

// ---- diário ----
// campos de texto da entrada (win = legado do controle antigo, mantido p/ histórico)
export const JOURNAL_FIELDS = ["gratitude", "posSituation", "posContribution", "negSituation", "negContribution", "dump", "intention", "win"];
// entrada tem conteúdo se qualquer campo de texto foi preenchido
export function journalHasContent(e) {
  if (!e) return false;
  return JOURNAL_FIELDS.some((k) => (e[k] || "").trim().length > 0);
}
// sequência de dias com entrada preenchida (a partir de hoje/ontem pra trás)
export function journalStreak(journal) {
  const j = journal || {};
  let streak = 0;
  let offset = journalHasContent(j[getDateStr(0)]) ? 0 : -1;
  while (journalHasContent(j[getDateStr(offset)])) {
    streak++;
    offset--;
  }
  return streak;
}

export function defaultState() {
  return {
    settings: {
      focusMin: 25,
      breakMin: 5,
      exerciseWeeklyGoal: 3,
      sleepGoalMin: 450,
      sleepLimit: "23:30", // deitar até esse horário = no horário; mais tarde derruba o XP
      mode: "light", // dark | light; ver lib/themes.js
      dietKcalGoal: 2000,
      dietProteinGoal: 150,
      dietCarbGoal: 200,
      dietFatGoal: 65,
      lofiUrl: DEFAULT_LOFI_URL,
      walletBudget: 0, // teto de gastos/mês (R$); 0 = sem orçamento
      walletCats: [], // categorias custom criadas pelo usuário
      bookCats: [], // categorias/gêneros custom de livros
    },
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
    // plano de dieta fixo: blocos de refeição dinâmicos, cada um com seus itens
    dietPlan: [
      { id: 1, name: "Café da manhã", items: [] },
      { id: 2, name: "Almoço", items: [] },
      { id: 3, name: "Jantar", items: [] },
    ],
    // treinos por modalidade: modalidade → divisões → exercícios { id, name, detail }
    workoutPlan: [
      {
        id: 1,
        name: "Academia",
        divisions: [
          { id: 11, name: "Treino A", items: [], weekdays: [] },
          { id: 12, name: "Treino B", items: [], weekdays: [] },
        ],
      },
    ],
    // séries de academia: { id, date, exercise, weight, reps|null, failure }
    gymSets: [],
    // diário: { [date]: { gratitude, posSituation, posContribution, negSituation, negContribution, dump, intention, xpAwarded } }
    journal: {},
    // despensa: itens { id, name, qty, status: "ok"|"low"|"out" }
    pantry: [],
    // rotina fixa diária: items { id, name, time? } + bonusDate (dia completo já premiado)
    routine: { items: [], bonusDate: null },
    // checks da rotina: { [date]: { [itemId]: xpConcedido } }
    routineChecks: {},
    // quadro estilo Trello: colunas { id, name, cards:[{id,text,priority}] }
    board: {
      columns: [
        { id: "c1", name: "A fazer", cards: [] },
        { id: "c2", name: "Em progresso", cards: [] },
        { id: "c3", name: "Concluído", cards: [] },
      ],
    },
    // estante: livros { id, title, author, total, page, status, rating, review, cover, startedAt, finishedAt }
    books: [],
    // agenda: { [date]: [{ id, title, cat, allDay, start, end, note }] } — sem XP
    calendar: {},
    // finanças: transações { id, date, type:"income"|"expense", amount, category, note }
    transactions: [],
    // carteira jsonb: despesas fixas + metas de economia
    wallet: { fixed: [], goals: [] }, // fixed:{id,name,amount,category,day} goals:{id,name,target,saved}
  };
}

export const isGymModality = (m) => /academia/i.test(m?.name || "");

// Academia é fixa: garante a modalidade no plano (usuários antigos podem ter deletado).
export function ensureAcademia(workoutPlan) {
  const plan = Array.isArray(workoutPlan) ? workoutPlan : [];
  if (plan.some(isGymModality)) return plan;
  return [
    {
      id: 1,
      name: "Academia",
      divisions: [
        { id: 11, name: "Treino A", items: [], weekdays: [] },
        { id: 12, name: "Treino B", items: [], weekdays: [] },
      ],
    },
    ...plan,
  ];
}

// Progressão por exercício: [{ date, max, volume }] ordenado por data.
// max = maior carga do dia; volume = Σ peso×reps (série "só falha" conta reps=1).
export function gymProgress(gymSets, exercise) {
  const byDate = {};
  for (const s of gymSets || []) {
    if (s.exercise !== exercise) continue;
    const d = (byDate[s.date] ||= { date: s.date, max: 0, volume: 0 });
    d.max = Math.max(d.max, s.weight || 0);
    d.volume += (s.weight || 0) * (s.reps || 1);
  }
  return Object.values(byDate).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// exercícios distintos já registrados (mais recente primeiro)
export function gymExercises(gymSets) {
  const seen = new Map(); // nome → data mais recente
  for (const s of gymSets || []) {
    if (!seen.has(s.exercise) || s.date > seen.get(s.exercise)) seen.set(s.exercise, s.date);
  }
  return [...seen.entries()].sort((a, b) => (a[1] > b[1] ? -1 : 1)).map(([name]) => name);
}

// PR (recorde pessoal) de um exercício: maior carga já registrada; desempate por mais reps.
// Retorna { weight, reps, date } ou null. Ignora séries sem carga (peso 0).
export function gymPR(gymSets, exercise) {
  let best = null;
  for (const s of gymSets || []) {
    if (s.exercise !== exercise) continue;
    const w = s.weight || 0;
    if (w <= 0) continue;
    const reps = s.reps || 0;
    if (!best || w > best.weight || (w === best.weight && reps > (best.reps || 0))) {
      best = { weight: w, reps: s.reps ?? null, date: s.date };
    }
  }
  return best;
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
    dietPlan: Array.isArray(parsed.dietPlan) ? parsed.dietPlan : d.dietPlan,
    workoutPlan: ensureAcademia(Array.isArray(parsed.workoutPlan) ? parsed.workoutPlan : d.workoutPlan),
    gymSets: Array.isArray(parsed.gymSets) ? parsed.gymSets : [],
    journal: parsed.journal && typeof parsed.journal === "object" ? parsed.journal : {},
    pantry: Array.isArray(parsed.pantry) ? parsed.pantry : [],
    routine: {
      items: Array.isArray(parsed.routine?.items) ? parsed.routine.items : [],
      bonusDate: parsed.routine?.bonusDate || null,
      penaltyDate: parsed.routine?.penaltyDate || null,
    },
    routineChecks: parsed.routineChecks && typeof parsed.routineChecks === "object" ? parsed.routineChecks : {},
    board: parsed.board && Array.isArray(parsed.board.columns) && parsed.board.columns.length ? { columns: parsed.board.columns } : d.board,
    books: Array.isArray(parsed.books) ? parsed.books : [],
    calendar: parsed.calendar && typeof parsed.calendar === "object" ? parsed.calendar : {},
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    wallet: {
      fixed: Array.isArray(parsed.wallet?.fixed) ? parsed.wallet.fixed : [],
      goals: Array.isArray(parsed.wallet?.goals) ? parsed.wallet.goals : [],
    },
  };
}

// Penalidade de exercício: por treino faltante na meta SEMANAL, avaliada em semanas fechadas.
// Idempotente via marker (segunda da última semana avaliada). Primeiro uso só inicializa (sem retro).
// Cap 4 semanas. penalty = déficit × exerciseMiss por semana.
export function computeExercisePenalty(exerciseLogs, weeklyGoal, marker, today = getDateStr(0)) {
  const goal = weeklyGoal || 0;
  const curWeek = weekStartOf(today);
  const lastClosed = shiftDate(curWeek, -7); // segunda da semana fechada mais recente
  if (goal <= 0) return null;
  // primeiro uso: sem marker → inicializa no fim da semana fechada, não cobra retroativo
  if (!marker) return { xp: 0, weeks: [], lastWeek: lastClosed };
  let wk = shiftDate(marker, 7);
  const floor = shiftDate(curWeek, -28); // cap 4 semanas
  if (wk < floor) wk = floor;
  if (wk > lastClosed) return null;
  const dates = (exerciseLogs || []).map((l) => l.date);
  let xp = 0;
  const weeks = [];
  let guard = 0;
  while (wk <= lastClosed && guard++ < 8) {
    const wkEnd = shiftDate(wk, 6);
    const sessions = dates.filter((d) => d >= wk && d <= wkEnd).length;
    const deficit = Math.max(0, goal - sessions);
    if (deficit > 0) {
      xp += deficit * XP.exerciseMiss;
      weeks.push({ week: wk, deficit });
    }
    wk = shiftDate(wk, 7);
  }
  return { xp, weeks, lastWeek: lastClosed };
}

// Penalidade de hábito diário (build): dia fechado sem check custa metade do valor por prioridade.
// Idempotente via h.penaltyDate. Cap 7 dias. Não cobra antes da criação. Só kind "build".
export function habitDailyPenaltyXp(h) {
  return Math.max(1, Math.round(habitPriority(h).xp / 2));
}
export function computeHabitDailyPenalty(h, today = getDateStr(0)) {
  if ((h.kind || "build") !== "build") return null;
  const yesterday = shiftDate(today, -1);
  const start = h.penaltyDate ? shiftDate(h.penaltyDate, 1) : yesterday;
  if (start > yesterday) return null;
  const floor = shiftDate(today, -7);
  const createdDay = localDateStr(h.createdAt);
  let d = start < floor ? floor : start;
  const done = new Set(h.doneDates || []);
  let count = 0;
  let guard = 0;
  while (d <= yesterday && guard++ < 8) {
    if (d >= createdDay && !done.has(d)) count++;
    d = shiftDate(d, 1);
  }
  return { count, xp: count * habitDailyPenaltyXp(h), lastEvaluated: yesterday };
}

export function playAlarm() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === "suspended") ctx.resume(); // autoplay policy: retoma se suspenso
    const beep = (freq, start, dur = 0.18, vol = 0.22) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.exponentialRampToValueAtTime(vol, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };
    const t0 = ctx.currentTime + 0.05;
    for (let burst = 0; burst < 3; burst++) {
      const b = t0 + burst * 0.85;
      beep(880, b);
      beep(880, b + 0.22);
      beep(1175, b + 0.44);
    }
    setTimeout(() => ctx.close(), 3200);
  } catch (e) {}
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
