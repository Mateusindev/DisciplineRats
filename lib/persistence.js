import { supabase } from "./supabaseClient";

export const hasSupabase = () => !!supabase;

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
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

  const [sleepR, moodR, focusR, exR, habitsR, checksR, gymR, routineR] = await Promise.all([
    supabase.from("sleep_logs").select("*").eq("user_id", uid),
    supabase.from("mood_logs").select("*").eq("user_id", uid),
    supabase.from("focus_days").select("*").eq("user_id", uid),
    supabase.from("exercise_logs").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    supabase.from("habits").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
    supabase.from("habit_checks").select("*").eq("user_id", uid),
    supabase.from("gym_sets").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
    supabase.from("routine_checks").select("*").eq("user_id", uid),
  ]);
  throwIf(sleepR, moodR, focusR, exR, habitsR, checksR, gymR, routineR);

  const sleep = {};
  for (const r of sleepR.data) {
    const xp = r.xp || 0; // >0 prêmio, <0 penalidade; entradas legadas têm 0 + xp_awarded
    sleep[r.date] = {
      bedtime: r.bedtime,
      wake: r.wake,
      durationMin: r.duration_min,
      quality: r.quality,
      note: r.note || "",
      awardedXp: xp > 0 ? xp : 0,
      penaltyXp: xp < 0 ? -xp : 0,
      xpAwarded: r.xp_awarded, // fallback p/ estorno de entradas legadas sem valor exato
    };
  }

  const mood = {};
  for (const r of moodR.data) mood[r.date] = { mood: r.mood, note: r.note || "" };

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
    xp: r.xp || 0,
  }));

  const checksByHabit = {};
  const checkXpByHabit = {};
  for (const c of checksR.data) {
    (checksByHabit[c.habit_id] ||= []).push(c.date);
    if (c.xp) (checkXpByHabit[c.habit_id] ||= {})[c.date] = c.xp;
  }
  const habits = habitsR.data.map((h) => ({
    id: h.id,
    name: h.name,
    icon: h.icon || null,
    kind: h.kind || "build",
    priority: h.priority || 2,
    milestones: h.milestones || {},
    direction: h.direction || null,
    weeklyTarget: h.weekly_target || null,
    penaltyDate: h.penalty_date || null,
    createdAt: h.created_at, // ISO verbatim — converter p/ data local só no uso
    doneDates: checksByHabit[h.id] || [],
    checkXp: checkXpByHabit[h.id] || {},
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
  for (const r of routineR.data) (routineChecks[r.date] ||= {})[r.item_id] = r.xp || 0;

  const t = p.tasks || {};
  const state = {
    settings: p.settings || {},
    stats: p.stats || {},
    tasks: Array.isArray(t.tasks) ? t.tasks : [],
    tasksDate: t.tasksDate || null,
    tasksBonusDate: t.tasksBonusDate || null,
    habits,
    sleep,
    mood,
    exerciseLogs,
    focusHistory,
    dietPlan: Array.isArray(p.diet_plan) ? p.diet_plan : [],
    workoutPlan: Array.isArray(p.workout_plan) ? p.workout_plan : [],
    pantry: Array.isArray(p.pantry) ? p.pantry : [],
    gymSets,
    routine: p.routine && typeof p.routine === "object" ? p.routine : {},
    routineChecks,
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
  if (j(cur.workoutPlan) !== j(prev.workoutPlan)) patch.workout_plan = cur.workoutPlan;
  const tasksNow = { tasks: cur.tasks, tasksDate: cur.tasksDate, tasksBonusDate: cur.tasksBonusDate };
  const tasksPrev = { tasks: prev.tasks, tasksDate: prev.tasksDate, tasksBonusDate: prev.tasksBonusDate };
  if (j(tasksNow) !== j(tasksPrev)) patch.tasks = tasksNow;
  if (j(cur.routine) !== j(prev.routine)) patch.routine = cur.routine;
  if (j(cur.pantry) !== j(prev.pantry)) patch.pantry = cur.pantry;
  if ((cur.stats?.xp || 0) !== (prev.stats?.xp || 0)) patch.xp = cur.stats?.xp || 0;
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
        const xp = (e.awardedXp || 0) - (e.penaltyXp || 0);
        return { user_id: uid, date, bedtime: e.bedtime, wake: e.wake, duration_min: e.durationMin, quality: e.quality, note: e.note || null, xp_awarded: xp > 0 || !!e.xpAwarded, xp, updated_at: new Date().toISOString() };
      });
      batch.push(supabase.from("sleep_logs").upsert(rows, { onConflict: "user_id,date" }));
    }
    if (deletes.length) batch.push(supabase.from("sleep_logs").delete().eq("user_id", uid).in("date", deletes));
  }

  // ---- mood_logs ----
  {
    const { upserts, deletes } = diffDateMap(cur.mood, prev.mood);
    if (upserts.length) {
      const rows = upserts.map((date) => ({ user_id: uid, date, mood: cur.mood[date].mood, note: cur.mood[date].note || null }));
      batch.push(supabase.from("mood_logs").upsert(rows, { onConflict: "user_id,date" }));
    }
    if (deletes.length) batch.push(supabase.from("mood_logs").delete().eq("user_id", uid).in("date", deletes));
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
      const rows = upserts.map((e) => ({ id: e.id, user_id: uid, date: e.date, type: e.type, division: e.division || null, duration_min: e.durationMin, intensity: e.intensity, note: e.note || null, xp: e.xp || 0 }));
      batch.push(supabase.from("exercise_logs").upsert(rows, { onConflict: "id" }));
    }
    if (deletes.length) batch.push(supabase.from("exercise_logs").delete().eq("user_id", uid).in("id", deletes));
  }

  // ---- routine_checks (diff por date+item_id; xp imutável após criação) ----
  {
    const flat = (m = {}) => {
      const out = [];
      for (const [date, items] of Object.entries(m || {}))
        for (const [itemId, xp] of Object.entries(items || {})) out.push({ date, item_id: String(itemId), xp: xp || 0 });
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

  throwIf(...(await Promise.all(batch)));

  // ---- habits + habit_checks (ordem importa por FK) ----
  // projeção completa: campo fora daqui NUNCA sincroniza (milestones ausente = re-award farm)
  const projHabit = (h) => ({
    id: h.id,
    name: h.name,
    icon: h.icon || null,
    kind: h.kind || "build",
    priority: h.priority || 2,
    milestones: h.milestones || {},
    direction: h.direction || null,
    weeklyTarget: h.weeklyTarget || null,
    penaltyDate: h.penaltyDate || null,
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
      ...(h.createdAt ? { created_at: h.createdAt } : {}), // sem createdAt → default now() do banco
    }));
    throwIf(await supabase.from("habits").upsert(rows, { onConflict: "id" }));
  }

  // checks: diff por (habit_id, date). xp é imutável após criação (só insert/delete), então key-set basta.
  const checkRows = (arr = []) => {
    const out = [];
    for (const h of arr) for (const d of h.doneDates || []) out.push({ habit_id: h.id, date: d, xp: h.checkXp?.[d] || 0 });
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
    const rows = addChecks.map((c) => ({ user_id: uid, habit_id: c.habit_id, date: c.date, xp: c.xp }));
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

// ============================================================
// GRUPOS
// ============================================================

// Meus grupos + meu snapshot de entrada. Retorna [{ id, name, inviteCode, owner, xpAtJoin, joinedAt }]
export async function fetchMyGroups(uid) {
  if (!supabase || !uid) return [];
  const [gRes, mRes] = await Promise.all([
    supabase.from("groups").select("id, name, owner, invite_code, created_at"),
    supabase.from("group_members").select("group_id, xp_at_join, joined_at").eq("user_id", uid),
  ]);
  if (gRes.error || mRes.error) throw gRes.error || mRes.error;
  const mine = new Map(mRes.data.map((m) => [m.group_id, m]));
  return gRes.data
    .filter((g) => mine.has(g.id))
    .map((g) => ({
      id: g.id,
      name: g.name,
      owner: g.owner,
      inviteCode: g.invite_code,
      xpAtJoin: mine.get(g.id).xp_at_join,
      joinedAt: mine.get(g.id).joined_at,
    }));
}

export async function createGroup(name) {
  if (!supabase) return { ok: false };
  const { data, error } = await supabase.rpc("create_group", { group_name: name });
  if (error) return { ok: false, message: error.message };
  const g = Array.isArray(data) ? data[0] : data;
  return { ok: true, group: g };
}

export async function joinGroup(code) {
  if (!supabase) return { ok: false };
  const { data, error } = await supabase.rpc("join_group", { code });
  if (error) return { ok: false, message: error.message };
  const g = Array.isArray(data) ? data[0] : data;
  return { ok: true, group: g };
}

export async function leaveGroup(gid, uid) {
  if (!supabase) return false;
  const { error } = await supabase.from("group_members").delete().eq("group_id", gid).eq("user_id", uid);
  return !error;
}

export async function deleteGroup(gid) {
  if (!supabase) return false;
  const { error } = await supabase.from("groups").delete().eq("id", gid);
  return !error;
}

// [{ username, xp, joined_at, is_owner }] — xp já relativo à entrada
export async function fetchGroupRanking(gid) {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("group_ranking", { gid });
  return error ? [] : data || [];
}

export async function fetchLeaderboard() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("leaderboard").select("username, xp");
  return error ? [] : data || [];
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}
