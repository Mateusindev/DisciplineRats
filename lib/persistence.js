import { supabase } from "./supabaseClient";

export const STORAGE_KEY = "ferro-focus-state";
export const hasSupabase = () => !!supabase;

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function readLocal() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}

// Retorna o blob de estado salvo, ou null se vazio.
export async function loadState(userId) {
  if (supabase && userId) {
    const { data, error } = await supabase.from("profiles").select("state").eq("id", userId).single();
    if (error) return null;
    return data?.state && Object.keys(data.state).length ? data.state : null;
  }
  return readLocal();
}

export async function saveState(userId, state) {
  if (supabase && userId) {
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      state,
      xp: state?.stats?.xp || 0,
      best_streak: state?.stats?.bestStreak || 0,
      updated_at: new Date().toISOString(),
    });
    return !error;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export async function fetchLeaderboard() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("leaderboard").select("username, xp");
  return error ? [] : data || [];
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}
