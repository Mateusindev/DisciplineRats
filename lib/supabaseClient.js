import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// null se env não configurado (app ainda roda em localStorage)
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
