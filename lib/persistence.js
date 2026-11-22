import { supabase } from "./supabaseClient";
import { HOME_ROUTE } from "./state";

export const hasSupabase = () => !!supabase;

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// catálogo global de exercícios (pra busca no construtor de treino)
export async function fetchExercises() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("exercises").select("name,muscle,video_id").order("muscle").order("name");
  if (error) return [];
  return data || [];
}

// ---------- helpers ----------
const j = (x) => JSON.stringify(x ?? null);
const clone = (x) => JSON.parse(JSON.stringify(x));

// diff de mapa keyed-por-data { [date]: entry } → { upserts:[date], deletes:[date] }
function diffDateMap(cur = {}, prev = {}) {
  const upserts = [];
  const deletes = [];
  for (const date of Object.keys(cur)) if (j(cur[date]) !== j(prev[date])) upserts.push(date);
  for (const date of Object.keys(prev)) if (!(date in cur)) deletes.push(date);
  return { upserts, deletes };
}

// diff de array keyed-por-id → { upserts:[item], deletes:[id] }
function diffById(cur = [], prev = []) {
  const prevById = new Map(prev.map((x) => [x.id, x]));
  const curIds = new Set(cur.map((x) => x.id));
  const upserts = [];
  const deletes = [];
  for (const it of cur) {
    const p = prevById.get(it.id);
    if (!p || j(it) !== j(p)) upserts.push(it);
  }
  for (const it of prev) if (!curIds.has(it.id)) deletes.push(it.id);
  return { upserts, deletes };
}

function throwIf(...results) {
  for (const r of results) if (r && r.error) throw r.error;
}

// Tabela inexistente: 42P01 vem do Postgres, PGRST205 do PostgREST ("not in schema cache").
const isMissingTable = (e) => e?.code === "42P01" || e?.code === "PGRST205";

// ============================================================
// LOAD — remonta o shape de state em memória a partir das tabelas.
// Retorna { state } ou null (sem profile). Propaga erro (crítico
// p/ o guard anti-clobber: nunca salvar por cima após carga falha).
// ============================================================
export async function loadUserState(uid) {
  if (!supabase || !uid) return null;

  const { data: p, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  if (!p) return null; // sem perfil ainda → tratado como novo (escreve tudo no 1º sync)

  const [sleepR, focusR, exR, habitsR, checksR, gymR, routineR, txR, weightR, canvasR, waterR] = await Promise.all([
    supabase.from("sleep_logs").select("*").eq("user_id", uid),
    supabase.from("focus_days").select("*").eq("user_id", uid),
    supabase.from("exercise_logs").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    supabase.from("habits").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
    supabase.from("habit_checks").select("*").eq("user_id", uid),
    supabase.from("gym_sets").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
    supabase.from("routine_checks").select("*").eq("user_id", uid),
    supabase.from("transactions").select("*").eq("user_id", uid).order("date", { ascending: false }),
    supabase.from("weight_logs").select("*").eq("user_id", uid),
    supabase.from("canvas_pages").select("*").eq("user_id", uid).order("pos", { ascending: true }),
    supabase.from("water_logs").select("*").eq("user_id", uid),
  ]);
  throwIf(sleepR, focusR, exR, habitsR, checksR, gymR, routineR, txR, weightR, canvasR);
  // água NÃO entra no throwIf quando a tabela não existe: banco que ainda não rodou
  // supabase/patch-agua.sql não pode acender o guard anti-clobber e derrubar o app
  // inteiro. Qualquer OUTRO erro de leitura da água continua derrubando, como o resto.
  if (waterR.error && !isMissingTable(waterR.error)) throw waterR.error;
  const water = {};
  for (const r of waterR.data || []) water[r.date] = { goal: r.goal, entries: Array.isArray(r.entries) ? r.entries : [] };
  const sleep = {};
  for (const r of sleepR.data) {
    sleep[r.date] = {
      bedtime: r.bedtime,
      wake: r.wake,
      durationMin: r.duration_min,
      quality: r.quality,
      note: r.note || "",
      lateReason: r.late_reason || "",
    };
  }

  const focusHistory = {};
  for (const r of focusR.data) focusHistory[r.date] = { sessions: r.sessions, minutes: r.minutes };

  const exerciseLogs = exR.data.map((r) => ({
    id: r.id,
    date: r.date,
    type: r.type,
    division: r.division || "",
    durationMin: r.duration_min,
    intensity: r.intensity,
    note: r.note || "",
  }));

  const checksByHabit = {};
  for (const c of checksR.data) (checksByHabit[c.habit_id] ||= []).push(c.date);
  // Ordem: `pos` (escolha do usuário), `created_at` como desempate. A ordenação é
  // feita AQUI e não no `.order("pos")` da query de propósito: base que ainda não
  // recebeu a coluna devolveria erro, e erro de leitura acende o guard anti-clobber
  // — o app inteiro para por causa de uma coluna que só serve pra ordenar. Sem a
  // coluna, `pos` vem undefined em tudo e a ordem cai na de criação, como sempre foi.
  // O sort do JS é estável, então o `.order("created_at")` acima é o desempate.
  const habitRows = [...habitsR.data].sort((a, b) => (Number.isFinite(a.pos) ? a.pos : 0) - (Number.isFinite(b.pos) ? b.pos : 0));
  const habits = habitRows.map((h, i) => ({
    id: h.id,
    name: h.name,
    icon: h.icon || null,
    kind: h.kind || "build",
    priority: h.priority || 2,
    milestones: h.milestones || {},
    direction: h.direction || null,
    weeklyTarget: h.weekly_target || null,
    penaltyDate: h.penalty_date || null,
    why: h.why || "",
    detail: h.detail || "",
    weekdays: Array.isArray(h.weekdays) ? h.weekdays : [], // [] = todos os dias
    steps: Array.isArray(h.steps) ? h.steps : [], // microatividades: [{ id, text }]
    stepChecks: h.step_checks && typeof h.step_checks === "object" ? h.step_checks : {}, // { data: [stepId] }
    minimum: h.minimum || "", // mínimo executável (texto)
    minDays: Array.isArray(h.min_days) ? h.min_days : [], // dias marcados só no mínimo
    pos: Number.isFinite(h.pos) ? h.pos : i, // ordem escolhida pelo usuário
    createdAt: h.created_at, // ISO verbatim — converter p/ data local só no uso
    doneDates: checksByHabit[h.id] || [],
  }));

  const gymSets = gymR.data.map((r) => ({
    id: r.id,
    date: r.date,
    exercise: r.exercise,
    weight: r.weight || 0,
    reps: r.reps,
    failure: !!r.failure,
  }));

  const routineChecks = {};
  for (const r of routineR.data) (routineChecks[r.date] ||= {})[r.item_id] = 0;

  const transactions = txR.data.map((r) => ({
    id: r.id,
    date: r.date,
    type: r.type,
    amount: Number(r.amount) || 0,
    category: r.category || "",
    note: r.note || "",
  }));

  const weights = {};
  for (const r of weightR.data) weights[r.date] = Number(r.kg) || 0;

  const canvasPages = canvasR.data.map((r, i) => ({
    id: r.id,
    name: r.name || `Página ${i + 1}`,
    pos: Number.isFinite(r.pos) ? r.pos : i,
    elements: Array.isArray(r.elements) ? r.elements : [],
  }));

  const t = p.tasks || {};
  const state = {
    settings: p.settings || {},
    stats: p.stats || {}, // `xp` legado no jsonb é descartado em normalizeStats
    tasks: Array.isArray(t.tasks) ? t.tasks : [],
    tasksDate: t.tasksDate || null,
    tasksBonusDate: t.tasksBonusDate || null,
    habits,
    sleep,
    water,
    exerciseLogs,
    focusHistory,
    dietPlan: Array.isArray(p.diet_plan) ? p.diet_plan : [],
    foods: Array.isArray(p.foods) ? p.foods : [], // despensa: catálogo de alimentos reusáveis

    workoutPlan: Array.isArray(p.workout_plan) ? p.workout_plan : [],
    workoutHistory: Array.isArray(p.workout_history) ? p.workout_history : [],
    restDays: p.rest_days && typeof p.rest_days === "object" ? p.rest_days : {},
    journal: p.journal && typeof p.journal === "object" ? p.journal : {},
    gymSets,
    routine: p.routine && typeof p.routine === "object" ? p.routine : {},
    routineChecks,
    transactions,
    books: Array.isArray(p.books) ? p.books : [],
    calendar: p.calendar && typeof p.calendar === "object" ? p.calendar : {},
    agendaRules: Array.isArray(p.agenda_rules) ? p.agenda_rules : [],
    body: p.body && typeof p.body === "object" ? p.body : {},
    weights,
    mapa: p.mapa && typeof p.mapa === "object" ? p.mapa : null,
    wallet: p.wallet && typeof p.wallet === "object" ? p.wallet : { fixed: [], goals: [] },
    canvasPages,
    board: p.board && Array.isArray(p.board.columns) && p.board.columns.length
      ? p.board
      : { columns: [{ id: "c1", name: "A fazer", cards: [] }, { id: "c2", name: "Em progresso", cards: [] }, { id: "c3", name: "Concluído", cards: [] }] },
  };
  return { state, username: p.username || "" };
}

// Troca o nick. Retorna { ok } ou { ok:false, reason: "taken" | "invalid" | "error" }.
export const NICK_RE = /^[A-Za-z0-9_.-]{3,20}$/;
export async function updateUsername(uid, username) {
  if (!supabase || !uid) return { ok: false, reason: "error" };
  if (!NICK_RE.test(username)) return { ok: false, reason: "invalid" };
  const { error } = await supabase.from("profiles").update({ username }).eq("id", uid);
  if (error) return { ok: false, reason: error.code === "23505" ? "taken" : "error" };
  return { ok: true };
}

// ============================================================
// SYNC — escreve só o que mudou entre `prev` (último salvo) e `cur`.
// Lança em qualquer erro (chamador mantém baseline p/ retry).
// ============================================================
export async function syncUserState(uid, cur, prev) {
  if (!supabase || !uid) return;
  prev = prev || {};

  // ---- profiles (config/planos/tasks/agregados) ----
  const patch = {};
  if (j(cur.settings) !== j(prev.settings)) patch.settings = cur.settings;
  if (j(cur.stats) !== j(prev.stats)) patch.stats = cur.stats;
  if (j(cur.dietPlan) !== j(prev.dietPlan)) patch.diet_plan = cur.dietPlan;
  if (j(cur.foods) !== j(prev.foods)) patch.foods = cur.foods;
  if (j(cur.workoutPlan) !== j(prev.workoutPlan)) patch.workout_plan = cur.workoutPlan;
  if (j(cur.workoutHistory) !== j(prev.workoutHistory)) patch.workout_history = cur.workoutHistory;
  if (j(cur.restDays) !== j(prev.restDays)) patch.rest_days = cur.restDays;
  const tasksNow = { tasks: cur.tasks, tasksDate: cur.tasksDate, tasksBonusDate: cur.tasksBonusDate };
  const tasksPrev = { tasks: prev.tasks, tasksDate: prev.tasksDate, tasksBonusDate: prev.tasksBonusDate };
  if (j(tasksNow) !== j(tasksPrev)) patch.tasks = tasksNow;
  if (j(cur.routine) !== j(prev.routine)) patch.routine = cur.routine;
  if (j(cur.journal) !== j(prev.journal)) patch.journal = cur.journal;
  if (j(cur.wallet) !== j(prev.wallet)) patch.wallet = cur.wallet;
  if (j(cur.board) !== j(prev.board)) patch.board = cur.board;
  if (j(cur.books) !== j(prev.books)) patch.books = cur.books;
  if (j(cur.calendar) !== j(prev.calendar)) patch.calendar = cur.calendar;
  if (j(cur.agendaRules) !== j(prev.agendaRules)) patch.agenda_rules = cur.agendaRules;
  if (j(cur.body) !== j(prev.body)) patch.body = cur.body;
  if (j(cur.mapa) !== j(prev.mapa)) patch.mapa = cur.mapa;
  if ((cur.stats?.bestStreak || 0) !== (prev.stats?.bestStreak || 0)) patch.best_streak = cur.stats?.bestStreak || 0;

  const batch = [];
  if (Object.keys(patch).length) {
    patch.id = uid;
    patch.updated_at = new Date().toISOString();
    batch.push(supabase.from("profiles").upsert(patch, { onConflict: "id" }));
  }

  // ---- sleep_logs ----
  {
    const { upserts, deletes } = diffDateMap(cur.sleep, prev.sleep);
    if (upserts.length) {
      const rows = upserts.map((date) => {
        const e = cur.sleep[date];
        return { user_id: uid, date, bedtime: e.bedtime, wake: e.wake, duration_min: e.durationMin, quality: e.quality, note: e.note || null, late_reason: e.lateReason || null, updated_at: new Date().toISOString() };
      });
      batch.push(supabase.from("sleep_logs").upsert(rows, { onConflict: "user_id,date" }));
    }
    if (deletes.length) batch.push(supabase.from("sleep_logs").delete().eq("user_id", uid).in("date", deletes));
  }

  // ---- water_logs (um registro por dia) ----
  // Fora do batch: tabela ausente (patch-agua.sql não aplicado) é ignorada em vez de
  // derrubar o save do resto. Erro de outro tipo lança normalmente.
  {
    const { upserts, deletes } = diffDateMap(cur.water, prev.water);
    const ops = [];
    if (upserts.length) {
      const rows = upserts.map((date) => ({ user_id: uid, date, goal: cur.water[date].goal, entries: cur.water[date].entries, updated_at: new Date().toISOString() }));
      ops.push(supabase.from("water_logs").upsert(rows, { onConflict: "user_id,date" }));
    }
    if (deletes.length) ops.push(supabase.from("water_logs").delete().eq("user_id", uid).in("date", deletes));
    for (const r of await Promise.all(ops)) if (r.error && !isMissingTable(r.error)) throw r.error;
  }

  // ---- weight_logs (pesagens por data) ----
  {
    const { upserts, deletes } = diffDateMap(cur.weights, prev.weights);
    if (upserts.length) {
      const rows = upserts.map((date) => ({ user_id: uid, date, kg: cur.weights[date] }));
      batch.push(supabase.from("weight_logs").upsert(rows, { onConflict: "user_id,date" }));
    }
    if (deletes.length) batch.push(supabase.from("weight_logs").delete().eq("user_id", uid).in("date", deletes));
  }

  // ---- focus_days ----
  {
    const { upserts, deletes } = diffDateMap(cur.focusHistory, prev.focusHistory);
    if (upserts.length) {
      const rows = upserts.map((date) => ({ user_id: uid, date, sessions: cur.focusHistory[date].sessions, minutes: cur.focusHistory[date].minutes }));
      batch.push(supabase.from("focus_days").upsert(rows, { onConflict: "user_id,date" }));
    }
    if (deletes.length) batch.push(supabase.from("focus_days").delete().eq("user_id", uid).in("date", deletes));
  }

  // ---- exercise_logs ----
  {
    const { upserts, deletes } = diffById(cur.exerciseLogs, prev.exerciseLogs);
    if (upserts.length) {
      const rows = upserts.map((e) => ({ id: e.id, user_id: uid, date: e.date, type: e.type, division: e.division || null, duration_min: e.durationMin, intensity: e.intensity, note: e.note || null }));
      batch.push(supabase.from("exercise_logs").upsert(rows, { onConflict: "id" }));
    }
    if (deletes.length) batch.push(supabase.from("exercise_logs").delete().eq("user_id", uid).in("id", deletes));
  }

  // ---- routine_checks (diff por date+item_id) ----
  {
    const flat = (m = {}) => {
      const out = [];
      for (const [date, items] of Object.entries(m || {}))
        for (const itemId of Object.keys(items || {})) out.push({ date, item_id: String(itemId) });
      return out;
    };
    const curC = flat(cur.routineChecks);
    const prevC = flat(prev.routineChecks);
    const key = (c) => `${c.date}|${c.item_id}`;
    const prevK = new Set(prevC.map(key));
    const curK = new Set(curC.map(key));
    const adds = curC.filter((c) => !prevK.has(key(c)));
    const dels = prevC.filter((c) => !curK.has(key(c)));
    if (adds.length) {
      batch.push(supabase.from("routine_checks").upsert(adds.map((c) => ({ user_id: uid, ...c })), { onConflict: "user_id,date,item_id" }));
    }
    if (dels.length) {
      const byDate = {};
      for (const c of dels) (byDate[c.date] ||= []).push(c.item_id);
      for (const [date, ids] of Object.entries(byDate)) {
        batch.push(supabase.from("routine_checks").delete().eq("user_id", uid).eq("date", date).in("item_id", ids));
      }
    }
  }

  // ---- gym_sets ----
  {
    const { upserts, deletes } = diffById(cur.gymSets, prev.gymSets);
    if (upserts.length) {
      const rows = upserts.map((s) => ({ id: s.id, user_id: uid, date: s.date, exercise: s.exercise, weight: s.weight || 0, reps: s.reps ?? null, failure: !!s.failure }));
      batch.push(supabase.from("gym_sets").upsert(rows, { onConflict: "id" }));
    }
    if (deletes.length) batch.push(supabase.from("gym_sets").delete().eq("user_id", uid).in("id", deletes));
  }

  // ---- canvas_pages (prancheta das missões) ----
  // Uma linha por página: rabiscar numa página não reescreve as outras. Sem isso
  // cada traço mandaria a prancheta inteira pro banco.
  {
    const { upserts, deletes } = diffById(cur.canvasPages, prev.canvasPages);
    if (upserts.length) {
      const rows = upserts.map((pg, i) => ({
        id: pg.id,
        user_id: uid,
        name: pg.name || `Página ${i + 1}`,
        pos: Number.isFinite(pg.pos) ? pg.pos : i,
        elements: Array.isArray(pg.elements) ? pg.elements : [],
        updated_at: new Date().toISOString(),
      }));
      batch.push(supabase.from("canvas_pages").upsert(rows, { onConflict: "id" }));
    }
    if (deletes.length) batch.push(supabase.from("canvas_pages").delete().eq("user_id", uid).in("id", deletes));
  }

  // ---- transactions ----
  {
    const { upserts, deletes } = diffById(cur.transactions, prev.transactions);
    if (upserts.length) {
      const rows = upserts.map((tx) => ({ id: tx.id, user_id: uid, date: tx.date, type: tx.type, amount: tx.amount || 0, category: tx.category || null, note: tx.note || null }));
      batch.push(supabase.from("transactions").upsert(rows, { onConflict: "id" }));
    }
    if (deletes.length) batch.push(supabase.from("transactions").delete().eq("user_id", uid).in("id", deletes));
  }

  throwIf(...(await Promise.all(batch)));

  // ---- habits + habit_checks (ordem importa por FK) ----
  // projeção completa: campo fora daqui NUNCA sincroniza. milestones/penaltyDate são
  // legado da gamificação — passam intactos pra não apagar dado de ninguém.
  const projHabit = (h, i) => ({
    id: h.id,
    name: h.name,
    icon: h.icon || null,
    kind: h.kind || "build",
    priority: h.priority || 2,
    milestones: h.milestones || {},
    direction: h.direction || null,
    weeklyTarget: h.weeklyTarget || null,
    penaltyDate: h.penaltyDate || null,
    why: h.why || "",
    detail: h.detail || "",
    weekdays: Array.isArray(h.weekdays) ? h.weekdays : [],
    steps: Array.isArray(h.steps) ? h.steps : [],
    stepChecks: h.stepChecks && typeof h.stepChecks === "object" ? h.stepChecks : {},
    minimum: h.minimum || "",
    minDays: Array.isArray(h.minDays) ? h.minDays : [],
    pos: Number.isFinite(h.pos) ? h.pos : i, // hábito legado sem pos: cai na posição do array
    createdAt: h.createdAt || null,
  });
  const hd = diffById((cur.habits || []).map(projHabit), (prev.habits || []).map(projHabit));
  if (hd.upserts.length) {
    const rows = hd.upserts.map((h) => ({
      id: h.id,
      user_id: uid,
      name: h.name,
      icon: h.icon,
      kind: h.kind,
      priority: h.priority,
      milestones: h.milestones,
      direction: h.direction,
      weekly_target: h.weeklyTarget,
      penalty_date: h.penaltyDate,
      why: h.why || null,
      detail: h.detail || null,
      weekdays: h.weekdays,
      steps: h.steps,
      step_checks: h.stepChecks,
      minimum: h.minimum || null,
      min_days: h.minDays,
      pos: h.pos,
      ...(h.createdAt ? { created_at: h.createdAt } : {}), // sem createdAt → default now() do banco
    }));
    throwIf(await supabase.from("habits").upsert(rows, { onConflict: "id" }));
  }

  // checks: diff por (habit_id, date) — só insert/delete, então key-set basta.
  const checkRows = (arr = []) => {
    const out = [];
    for (const h of arr) for (const d of h.doneDates || []) out.push({ habit_id: h.id, date: d });
    return out;
  };
  const curChecks = checkRows(cur.habits);
  const prevChecks = checkRows(prev.habits);
  const key = (c) => `${c.habit_id}|${c.date}`;
  const prevKeys = new Set(prevChecks.map(key));
  const curKeys = new Set(curChecks.map(key));
  const addChecks = curChecks.filter((c) => !prevKeys.has(key(c)));
  const delChecks = prevChecks.filter((c) => !curKeys.has(key(c)));

  if (addChecks.length) {
    const rows = addChecks.map((c) => ({ user_id: uid, habit_id: c.habit_id, date: c.date }));
    throwIf(await supabase.from("habit_checks").upsert(rows, { onConflict: "habit_id,date" }));
  }
  if (delChecks.length) {
    // agrupa por habit_id p/ deletar em lote por datas
    const byHabit = {};
    for (const c of delChecks) (byHabit[c.habit_id] ||= []).push(c.date);
    for (const [hid, dates] of Object.entries(byHabit)) {
      throwIf(await supabase.from("habit_checks").delete().eq("user_id", uid).eq("habit_id", hid).in("date", dates));
    }
  }
  if (hd.deletes.length) {
    // cascade remove os checks dos hábitos deletados
    throwIf(await supabase.from("habits").delete().eq("user_id", uid).in("id", hd.deletes));
  }
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

// ============================================================
// PUSH — assinatura do aparelho + lembretes materializados
// ============================================================

// Guarda (ou remove) a subscription deste aparelho. Chave é o endpoint: o mesmo
// usuário em dois aparelhos gera duas linhas, e as duas devem receber.
export async function savePushSubscription(uid, sub) {
  if (!supabase || !uid || !sub?.endpoint) return;
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      user_id: uid,
      p256dh: sub.keys?.p256dh || "",
      auth: sub.keys?.auth || "",
      ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

export async function deletePushSubscription(endpoint) {
  if (!supabase || !endpoint) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

// Regrava a fila de lembretes futuros. Apaga só o que ainda NÃO foi enviado:
// linha já enviada é histórico, e reescrevê-la faria o aviso chegar duas vezes.
export async function syncAgendaReminders(uid, reminders) {
  if (!supabase || !uid) return;
  const nowIso = new Date().toISOString();
  const { error: delErr } = await supabase
    .from("agenda_reminders")
    .delete()
    .eq("user_id", uid)
    .is("sent_at", null)
    .gte("fire_at", nowIso);
  if (delErr) throw delErr;
  if (!reminders.length) return;
  const rows = reminders.map((r) => ({
    user_id: uid,
    key: r.key,
    fire_at: r.fireAt.toISOString(),
    title: r.title.slice(0, 120),
    body: r.body.slice(0, 200),
    url: r.url || HOME_ROUTE,
  }));
  const { error } = await supabase.from("agenda_reminders").upsert(rows, { onConflict: "user_id,key" });
  if (error) throw error;
}
