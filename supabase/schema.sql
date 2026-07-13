-- ============================================================
-- Foco de Ferro — schema Supabase
-- Rode no SQL Editor do painel Supabase (uma vez).
-- ============================================================

-- Perfil por usuário: guarda XP + o blob de estado do app (jsonb).
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text,
  xp           integer not null default 0,
  best_streak  integer not null default 0,
  state        jsonb   not null default '{}'::jsonb,  -- settings, stats, tasks, habits, sleep, exerciseLogs, mood
  updated_at   timestamptz not null default now()
);

-- Row Level Security: cada um só mexe no próprio perfil.
alter table public.profiles enable row level security;

drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Cria o perfil automaticamente quando o usuário se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Leaderboard público: expõe SÓ username + xp (a view roda como owner, ignora RLS).
create or replace view public.leaderboard as
  select username, xp
  from public.profiles
  order by xp desc
  limit 100;

grant select on public.leaderboard to anon, authenticated;
