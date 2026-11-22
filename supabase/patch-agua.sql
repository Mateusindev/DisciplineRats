-- ============================================================
-- PATCH — Water Tracker (/agua).
--
-- `schema.sql` continua sendo a fonte da verdade e contém tudo isto. Este arquivo
-- existe pra aplicar só a tabela nova num banco que já está no ar, sem disparar os
-- ~40 `alter table` do schema completo. Idempotente.
--
-- Sem esta tabela o app continua funcionando: a água só não persiste entre sessões
-- (lib/persistence.js ignora o erro de tabela inexistente).
-- ============================================================

create table if not exists public.water_logs (
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  goal       integer not null default 2000,
  entries    jsonb   not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.water_logs enable row level security;

drop policy if exists "own rows select" on public.water_logs;
create policy "own rows select" on public.water_logs for select using (auth.uid() = user_id);
drop policy if exists "own rows insert" on public.water_logs;
create policy "own rows insert" on public.water_logs for insert with check (auth.uid() = user_id);
drop policy if exists "own rows update" on public.water_logs;
create policy "own rows update" on public.water_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows delete" on public.water_logs;
create policy "own rows delete" on public.water_logs for delete using (auth.uid() = user_id);
