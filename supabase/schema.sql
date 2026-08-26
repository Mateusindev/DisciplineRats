-- ============================================================
-- Discipline Rats — schema Supabase (normalizado)
-- Rode no SQL Editor do painel Supabase. É idempotente: rodar de novo é seguro.
-- Logs (sono, foco, treino, hábitos) viram tabelas.
-- Config/planos/tasks ficam como jsonb no profile.
--
-- ANTES DE RODAR: FECHE O APP.
--
-- Todo `alter table` pede AccessExclusiveLock, que conflita até com um SELECT. Com o
-- app aberto (ou outra aba do SQL editor, ou o Table Editor do painel introspectando),
-- este script disputa lock com quem está lendo e o Postgres mata um dos dois com
-- `40P01: deadlock detected`. Não é erro de sintaxe e nada fica aplicado pela metade:
-- o editor roda em transação, então o deadlock desfaz tudo. Feche o app e rode de novo.
--
-- O lock_timeout abaixo troca o deadlock por uma espera curta que falha explicando —
-- errar rápido e claro é melhor do que travar a base enquanto o app está no ar.
-- ============================================================

set lock_timeout = '8s';

-- ---------- PROFILES: config + planos + agregados ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text,
  xp            integer not null default 0,
  best_streak   integer not null default 0,
  settings      jsonb   not null default '{}'::jsonb,
  stats         jsonb   not null default '{}'::jsonb,
  diet_plan     jsonb   not null default '[]'::jsonb,
  workout_plan  jsonb   not null default '[]'::jsonb,
  tasks         jsonb   not null default '{}'::jsonb,  -- { tasks:[], tasksDate, tasksBonusDate }
  routine       jsonb   not null default '{}'::jsonb,  -- rotina fixa: { items:[{id,name,time}], bonusDate }
  pantry        jsonb   not null default '[]'::jsonb,  -- LEGADO, sem uso: lista de compras que nunca foi implementada. A despensa de alimentos é `foods`.
  journal       jsonb   not null default '{}'::jsonb,  -- diário: { date: {gratitude,win,dump,intention,xpAwarded} }
  updated_at    timestamptz not null default now()
);

-- Colunas novas p/ instalações que já tinham a tabela antiga (blob).
alter table public.profiles add column if not exists settings     jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists stats        jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists diet_plan    jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists foods        jsonb not null default '[]'::jsonb;  -- despensa: alimentos reusáveis [{id,name,unit,portionGrams,kcal,protein,carbs,fat}]
alter table public.profiles add column if not exists workout_plan jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists tasks        jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists routine      jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists pantry       jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists journal      jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists wallet       jsonb not null default '{"fixed":[],"goals":[]}'::jsonb;  -- carteira: despesas fixas + metas
alter table public.profiles add column if not exists board        jsonb not null default '{"columns":[]}'::jsonb;  -- quadro Trello das missões
alter table public.profiles add column if not exists books        jsonb not null default '[]'::jsonb;  -- estante de leitura
alter table public.profiles add column if not exists calendar     jsonb not null default '{}'::jsonb;  -- agenda: { [date]: [eventos] }
alter table public.profiles add column if not exists mapa         jsonb not null default '{}'::jsonb;  -- mapa de longo prazo: { lanes, nodes, edges, focusId }
alter table public.profiles add column if not exists workout_history jsonb not null default '[]'::jsonb;  -- fichas de treino arquivadas (snapshot imutável do plano em cada ciclo)
alter table public.profiles add column if not exists rest_days     jsonb not null default '{}'::jsonb;  -- folgas justificadas: { date: {reason,note} } — abatem a meta semanal de treino
alter table public.profiles add column if not exists pet           jsonb not null default '{}'::jsonb;  -- mascote: { name, coat, gear:{slot:itemId} }. Posse de item PAGO não mora aqui — ver pet_entitlements
alter table public.profiles add column if not exists agenda_rules jsonb not null default '[]'::jsonb;  -- agenda: regras de recorrência semanal (ocorrência é calculada, não gravada)
alter table public.profiles add column if not exists body         jsonb not null default '{}'::jsonb;  -- perfil corporal: sexo, nascimento, altura, %gordura, objetivo (idade é derivada)
alter table public.profiles drop column if exists state;           -- blob legado removido

-- ---------- LOGS por data/entrada ----------
create table if not exists public.sleep_logs (
  user_id      uuid not null references auth.users (id) on delete cascade,
  date         date not null,
  bedtime      text,
  wake         text,
  duration_min integer not null default 0,
  quality      smallint,
  note         text,
  late_reason  text,  -- justificativa quando deitou tarde
  xp_awarded   boolean not null default false,
  xp           integer not null default 0,  -- efeito líquido: +prêmio (meta) ou −penalidade (abaixo)
  updated_at   timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.sleep_logs add column if not exists xp integer not null default 0;
alter table public.sleep_logs add column if not exists late_reason text;

-- Humor foi removido do app. A tabela não é mais criada nem lida.
-- Se o seu banco já tem mood_logs e você quer se livrar dos dados, rode à mão:
--   drop table if exists public.mood_logs;

create table if not exists public.focus_days (
  user_id  uuid not null references auth.users (id) on delete cascade,
  date     date not null,
  sessions integer not null default 0,
  minutes  integer not null default 0,
  primary key (user_id, date)
);

-- pesagens: uma por data. Alimenta o gráfico de peso e recalibra o cálculo de gasto.
create table if not exists public.weight_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  date    date not null,
  kg      real not null,
  primary key (user_id, date)
);

-- Migração: versão anterior usava id bigint gerado no client (Date.now()) —
-- colide entre usuários. Detecta e dropa p/ recriar com uuid.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exercise_logs'
      and column_name = 'id' and data_type = 'bigint'
  ) then
    drop table if exists public.habit_checks;
    drop table if exists public.habits;
    drop table if exists public.exercise_logs;
  end if;
end $$;

create table if not exists public.exercise_logs (
  id           uuid primary key default gen_random_uuid(),  -- client manda crypto.randomUUID()
  user_id      uuid not null references auth.users (id) on delete cascade,
  date         date not null,
  type         text,
  division     text,
  duration_min integer not null default 0,
  intensity    smallint,
  note         text,
  xp           integer not null default 0,   -- XP concedido (p/ estorno ao excluir)
  created_at   timestamptz not null default now()
);
create index if not exists exercise_logs_user_date on public.exercise_logs (user_id, date desc);

create table if not exists public.habits (
  id         uuid primary key default gen_random_uuid(),    -- client manda crypto.randomUUID()
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  icon       text,                                          -- Material Symbol escolhido pelo user
  kind       text not null default 'build',                 -- 'build' (diário) | 'weekly' (meta semanal) | 'quit' (largar vício)
  priority   smallint not null default 2,                   -- 1 baixa · 2 normal · 3 alta
  milestones jsonb not null default '{}'::jsonb,            -- quit: { periodo: [3,7,...] } · weekly: { "wk:segunda": true } premiados
  direction  text,                                          -- weekly: 'min' (pelo menos Nx) | 'max' (no máximo Nx)
  weekly_target smallint,                                   -- weekly: N dias por semana (1-7)
  penalty_date date,                                        -- build: último dia fechado já avaliado p/ penalidade
  why        text,                                          -- o porquê do hábito: motivo que o usuário lê antes de marcar
  detail     text,                                          -- anotações livres do usuário sobre o hábito
  steps      jsonb not null default '[]'::jsonb,            -- microatividades: [{ id, text }] — todas feitas = hábito liberado
  step_checks jsonb not null default '{}'::jsonb,           -- { "YYYY-MM-DD": [stepId] }; podado pra ~1 semana no cliente
  created_at timestamptz not null default now()
);
alter table public.habits add column if not exists icon text;
alter table public.habits add column if not exists kind text not null default 'build';
alter table public.habits add column if not exists priority smallint not null default 2;
alter table public.habits add column if not exists milestones jsonb not null default '{}'::jsonb;
alter table public.habits add column if not exists direction text;
alter table public.habits add column if not exists weekly_target smallint;
alter table public.habits add column if not exists penalty_date date;
alter table public.habits add column if not exists detail text;
alter table public.habits add column if not exists why text;
alter table public.habits add column if not exists weekdays jsonb not null default '[]'::jsonb;  -- build: dias da semana agendados (0=Seg..6=Dom); [] = todo dia
alter table public.habits add column if not exists steps jsonb not null default '[]'::jsonb;
alter table public.habits add column if not exists step_checks jsonb not null default '{}'::jsonb;
alter table public.habits add column if not exists pos integer not null default 0;   -- ordem escolhida pelo usuário na lista de hábitos
alter table public.habits add column if not exists minimum text;                     -- mínimo executável: menor versão do hábito que ainda conta
alter table public.habits add column if not exists min_days jsonb not null default '[]'::jsonb;  -- ["YYYY-MM-DD"] dias marcados SÓ no mínimo (subconjunto dos checks)
create index if not exists habits_user on public.habits (user_id);
create index if not exists habits_user_pos on public.habits (user_id, pos);

create table if not exists public.habit_checks (
  user_id  uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  date     date not null,
  xp       integer not null default 0,   -- XP concedido no check (estorno exato no uncheck); quit não usa
  primary key (habit_id, date)
);
alter table public.habit_checks add column if not exists xp integer not null default 0;
create index if not exists habit_checks_user on public.habit_checks (user_id);

-- Checks diários da rotina fixa (item_id aponta pro id no jsonb profiles.routine).
create table if not exists public.routine_checks (
  user_id uuid not null references auth.users (id) on delete cascade,
  date    date not null,
  item_id text not null,
  xp      integer not null default 0,   -- XP concedido no check (estorno exato no uncheck)
  primary key (user_id, date, item_id)
);

-- Séries de academia: peso × reps (ou falha) por exercício, base do gráfico de progressão.
create table if not exists public.gym_sets (
  id         uuid primary key default gen_random_uuid(),   -- client manda crypto.randomUUID()
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  exercise   text not null,
  weight     real not null default 0,     -- kg (aceita 22.5)
  reps       integer,                     -- null quando só "até a falha"
  failure    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists gym_sets_user_ex on public.gym_sets (user_id, exercise, date);

-- Finanças: transações (receita/despesa) por data.
create table if not exists public.transactions (
  id         uuid primary key default gen_random_uuid(),  -- client manda crypto.randomUUID()
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  type       text not null,                -- 'income' | 'expense'
  amount     numeric not null default 0,
  category   text,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date on public.transactions (user_id, date desc);

-- Prancheta das Missões: páginas de desenho livre (formas, pincel, texto).
-- Tabela própria em vez de jsonb no profile porque desenho cresce sem teto: uma
-- linha por página faz o traço novo reescrever SÓ aquela página, e mantém o
-- profile (lido inteiro em todo login) do tamanho que é hoje.
create table if not exists public.canvas_pages (
  id         uuid primary key default gen_random_uuid(),   -- client manda crypto.randomUUID()
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null default 'Página',
  pos        integer not null default 0,                   -- ordem na lista lateral
  elements   jsonb not null default '[]'::jsonb,           -- [{ id, type, ...geometria }] — ordem do array = ordem de empilhamento
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists canvas_pages_user on public.canvas_pages (user_id, pos);

-- ---------- Row Level Security ----------
alter table public.profiles     enable row level security;
alter table public.canvas_pages enable row level security;
alter table public.transactions enable row level security;
alter table public.sleep_logs   enable row level security;
alter table public.focus_days   enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.habits       enable row level security;
alter table public.habit_checks enable row level security;
alter table public.gym_sets     enable row level security;
alter table public.routine_checks enable row level security;
alter table public.weight_logs   enable row level security;

-- profiles: cada um só mexe no próprio.
drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================
-- LOJINHA PAGA DO MASCOTE
--
-- Estas duas tabelas são a única parte do banco que o CLIENTE NÃO ESCREVE. Não é
-- capricho: `profiles` tem policy de update pro próprio dono, então tudo que mora
-- lá (inclusive `pet.owned`) pode ser reescrito pelo console do navegador. Item
-- pago não pode viver num lugar assim.
--
-- `pet_entitlements` tem policy só de SELECT. Sem policy de insert/update/delete,
-- ninguém escreve via API pública — nem o dono. Quem escreve é a Edge Function
-- `mp-webhook`, que usa a service key e por isso passa por cima do RLS.
-- ============================================================
create table if not exists public.pet_entitlements (
  user_id    uuid not null references auth.users (id) on delete cascade,
  item_id    text not null,                                  -- id do item em PET_ITEMS (lib/state.js)
  payment_id text,                                           -- id do pagamento no Mercado Pago
  amount     numeric(10,2),
  granted_at timestamptz not null default now(),
  primary key (user_id, item_id)                             -- comprar duas vezes o mesmo item não duplica
);
-- Renomeia a coluna de quem instalou na versão de PACKS (a loja passou a vender item
-- avulso). Tenta e engole o erro em vez de consultar o catálogo antes: ler
-- information_schema toma lock em várias relações do catálogo dentro da MESMA
-- transação que já tem AccessExclusiveLock nesta tabela, e é assim que se fabrica
-- deadlock. Tentar direto é idempotente pelos dois lados — sem a coluna antiga dá
-- undefined_column, com a nova já criada dá duplicate_column, e os dois são "nada a
-- fazer".
do $$
begin
  alter table public.pet_entitlements rename column pack_id to item_id;
exception
  when undefined_column then null;
  when duplicate_column then null;
end $$;
alter table public.pet_entitlements enable row level security;
drop policy if exists "own entitlements select" on public.pet_entitlements;
create policy "own entitlements select" on public.pet_entitlements for select using (auth.uid() = user_id);
-- de propósito SEM policy de escrita: só a service key (webhook) grava aqui

-- Log de pagamento. `payment_id` como PK é o que dá idempotência de graça: webhook
-- do Mercado Pago repete, e repetir um insert com a mesma PK não concede duas vezes.
create table if not exists public.pet_payments (
  payment_id text primary key,
  user_id    uuid references auth.users (id) on delete set null,
  item_id    text,
  status     text,
  amount     numeric(10,2),
  raw        jsonb,
  created_at timestamptz not null default now()
);
do $$
begin
  alter table public.pet_payments rename column pack_id to item_id;
exception
  when undefined_column then null;
  when duplicate_column then null;
end $$;
alter table public.pet_payments enable row level security;
-- nenhuma policy: nem leitura pelo cliente. É registro financeiro, só backend vê.

-- Policies "próprio user_id" para todas as tabelas de log (select/insert/update/delete).
do $$
declare t text;
begin
  foreach t in array array['sleep_logs','focus_days','exercise_logs','habits','habit_checks','gym_sets','routine_checks','transactions','weight_logs','canvas_pages']
  loop
    execute format('drop policy if exists "own rows select" on public.%I', t);
    execute format('create policy "own rows select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "own rows insert" on public.%I', t);
    execute format('create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "own rows update" on public.%I', t);
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "own rows delete" on public.%I', t);
    execute format('create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------- Nick único ----------
-- Case-insensitive. Se este índice falhar por duplicados pré-existentes,
-- renomeie os duplicados e rode de novo.
create unique index if not exists profiles_username_unique on public.profiles (lower(username));

-- Formato/tamanho: 3–20 chars, letras/números/_/./-  (not valid = não valida linhas antigas)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format
      check (username is null or username ~ '^[A-Za-z0-9_.-]{3,20}$') not valid;
  end if;
end $$;

-- ---------- Novo usuário → cria profile ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base text;
  nick text;
begin
  -- nick inicial = prefixo do email, saneado pro formato permitido
  base := regexp_replace(split_part(new.email, '@', 1), '[^A-Za-z0-9_.-]', '', 'g');
  base := substr(base, 1, 20);
  if char_length(base) < 3 then
    base := 'rat_' || substr(new.id::text, 1, 4);
  end if;
  nick := base;
  -- colisão → sufixo curto derivado do uuid
  if exists (select 1 from public.profiles where lower(username) = lower(nick)) then
    nick := substr(base, 1, 15) || '_' || substr(new.id::text, 1, 4);
  end if;
  insert into public.profiles (id, username) values (new.id, nick);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- GRUPOS — ranking entre amigos.
-- XP no grupo = xp global − xp_at_join (snapshot na entrada),
-- então todo mundo entra no nível 1 com 0 XP dentro do grupo.
-- ============================================================

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 3 and 40),
  owner       uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  xp_at_join integer not null default 0,
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user on public.group_members (user_id);

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

-- security definer: consulta group_members SEM RLS → policies podem usar sem recursão.
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;

-- groups: só membros veem; só o dono renomeia/exclui. Criação/entrada via RPC.
drop policy if exists "groups select" on public.groups;
create policy "groups select" on public.groups for select using (public.is_group_member(id));
drop policy if exists "groups update" on public.groups;
create policy "groups update" on public.groups for update using (auth.uid() = owner) with check (auth.uid() = owner);
drop policy if exists "groups delete" on public.groups;
create policy "groups delete" on public.groups for delete using (auth.uid() = owner);

-- group_members: membros veem a lista; sai por conta própria ou expulso pelo dono.
drop policy if exists "members select" on public.group_members;
create policy "members select" on public.group_members for select using (public.is_group_member(group_id));
drop policy if exists "members delete" on public.group_members;
create policy "members delete" on public.group_members for delete
  using (auth.uid() = user_id or exists (select 1 from public.groups g where g.id = group_id and g.owner = auth.uid()));

-- Cria grupo + já entra como membro (snapshot do xp atual). Atômico.
create or replace function public.create_group(group_name text)
returns table (id uuid, name text, invite_code text)
language plpgsql security definer set search_path = public
as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  insert into public.groups (name, owner) values (trim(group_name), auth.uid()) returning * into g;
  insert into public.group_members (group_id, user_id, xp_at_join)
    values (g.id, auth.uid(), coalesce((select p.xp from public.profiles p where p.id = auth.uid()), 0));
  return query select g.id, g.name, g.invite_code;
end;
$$;

-- Entra num grupo pelo código de convite.
-- Re-entrar (ou usar o código já sendo membro) reseta o snapshot → XP do grupo volta a 0.
create or replace function public.join_group(code text)
returns table (id uuid, name text)
language plpgsql security definer set search_path = public
as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select * into g from public.groups where invite_code = upper(trim(code));
  if not found then raise exception 'convite inválido'; end if;
  insert into public.group_members (group_id, user_id, xp_at_join)
    values (g.id, auth.uid(), coalesce((select p.xp from public.profiles p where p.id = auth.uid()), 0))
    on conflict (group_id, user_id)
    do update set xp_at_join = excluded.xp_at_join, joined_at = now();
  return query select g.id, g.name;
end;
$$;

-- Ranking do grupo: xp relativo desde a entrada. Só membros consultam.
create or replace function public.group_ranking(gid uuid)
returns table (username text, xp integer, joined_at timestamptz, is_owner boolean)
language sql security definer stable set search_path = public
as $$
  select p.username,
         greatest(0, p.xp - m.xp_at_join)::integer as xp,
         m.joined_at,
         (g.owner = m.user_id) as is_owner
  from public.group_members m
  join public.profiles p on p.id = m.user_id
  join public.groups g on g.id = m.group_id
  where m.group_id = gid
    and public.is_group_member(gid)
  order by 2 desc, m.joined_at asc;
$$;

grant execute on function public.create_group(text), public.join_group(text), public.group_ranking(uuid), public.is_group_member(uuid) to authenticated;

-- ---------- Leaderboard público (só username + xp) ----------
create or replace view public.leaderboard as
  select username, xp
  from public.profiles
  order by xp desc
  limit 100;

grant select on public.leaderboard to anon, authenticated;

-- ---------- Catálogo global de exercícios ----------
create table if not exists public.exercises (
  id       serial primary key,
  name     text not null unique,
  muscle   text not null,
  video_id text                       -- id do vídeo YouTube de demonstração (opcional)
);
alter table public.exercises add column if not exists video_id text;
alter table public.exercises enable row level security;
drop policy if exists "exercises readable" on public.exercises;
create policy "exercises readable" on public.exercises for select to authenticated using (true);

-- Catálogo de exercícios: rode supabase/exercises_seed.sql (gerado de videos.json)
-- no SQL editor depois deste arquivo. Todos os itens do seed têm video_id.
-- Não semeamos itens name-only aqui: entradas sem vídeo poluem o picker e o modal
-- de detalhes não mostra demonstração. Se sobrou algum de setups antigos, limpe com:
--   delete from exercises where video_id is null;

-- ---------- Push de notificação (lembrete de agenda com o app fechado) ----------
-- Uma linha por APARELHO: o mesmo usuário no celular e no desktop tem duas
-- subscriptions, e as duas devem receber. `endpoint` é a chave natural — o
-- navegador o troca quando expira, e a linha velha morre no primeiro 410.
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  p256dh     text not null,             -- chave pública do aparelho (criptografia do payload)
  auth       text not null,             -- segredo do aparelho
  ua         text,                      -- só pra você reconhecer o aparelho na lista
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

-- Lembretes já materializados pelo cliente. O servidor não recalcula recorrência:
-- a lógica disso vive em lib/state.js, e duplicá-la aqui criaria duas verdades
-- que envelhecem separadas. O cliente escreve os próximos 30 dias; a função só
-- pergunta "o que já venceu e ainda não foi enviado?".
create table if not exists public.agenda_reminders (
  user_id  uuid not null references auth.users (id) on delete cascade,
  key      text not null,               -- "YYYY-MM-DD:<id do evento ou da regra>"
  fire_at  timestamptz not null,
  title    text not null,
  body     text not null,
  url      text not null default '/calendario',
  sent_at  timestamptz,
  primary key (user_id, key)
);
create index if not exists agenda_reminders_due on public.agenda_reminders (fire_at) where sent_at is null;
alter table public.agenda_reminders enable row level security;

do $$
declare t text;
begin
  foreach t in array array['push_subscriptions','agenda_reminders']
  loop
    execute format('drop policy if exists "own rows select" on public.%I', t);
    execute format('create policy "own rows select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "own rows insert" on public.%I', t);
    execute format('create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "own rows update" on public.%I', t);
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "own rows delete" on public.%I', t);
    execute format('create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ============================================================
-- XP — o contador é DO SERVIDOR.
--
-- Antes disto, `profiles.xp` e `stats->>'xp'` eram colunas comuns de uma tabela com
-- policy de update pro próprio dono. Ou seja: o cliente mandava o valor final. Uma
-- linha no console do navegador — ou um proxy alterando o payload do upsert —
-- escrevia o número que quisesse, e o leaderboard acreditava.
--
-- Regra nova, em duas partes:
--
--   1. NINGUÉM escreve xp pela API pública. O trigger `profiles_guard_xp` descarta o
--      valor que veio do cliente e repõe o que já estava no banco. Ele também
--      reescreve `stats->'xp'` com o valor autoritativo — senão a cópia em jsonb
--      viraria a porta dos fundos (e foi por ela que passou o 99999999999: `xp` é
--      integer e nem comportaria esse número, `stats` é jsonb e comporta qualquer
--      coisa).
--
--   2. O contador só se move por `apply_xp_delta(delta)`, que é `security definer`
--      (por isso passa pelo trigger) e aplica DELTA, nunca valor absoluto — com teto
--      de ganho líquido por dia. O cliente continua fazendo a conta do XP (a regra
--      mora em lib/state.js e não vale duplicar aqui), mas agora ele só consegue
--      pedir "some tanto", e o servidor decide quanto disso cabe.
--
-- O que isto NÃO resolve, de propósito: o app é auto-declarado. Quem quiser trapacear
-- ainda pode dizer que dormiu 8h e marcar hábito que não fez. Isso é inerente e o teto
-- diário é a resposta certa pra isso — limita a trapaça ao que um dia honesto rende,
-- em vez de tentar adivinhar se a atividade foi real.
-- ============================================================

-- Ledger append-only: uma linha por movimento aceito. É o que dá base pro teto
-- diário e o que permite auditar depois "de onde veio esse XP".
create table if not exists public.xp_events (
  id         bigserial primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null default (now() at time zone 'utc')::date,
  delta      integer not null,   -- o que o cliente pediu
  applied    integer not null,   -- o que de fato entrou depois do teto
  created_at timestamptz not null default now()
);
create index if not exists xp_events_user_day on public.xp_events (user_id, day);
alter table public.xp_events enable row level security;
drop policy if exists "own xp events select" on public.xp_events;
create policy "own xp events select" on public.xp_events for select using (auth.uid() = user_id);
-- de propósito SEM policy de escrita: só `apply_xp_delta` (security definer) grava aqui

-- Teto do dia. Conta feita sobre as fontes de XP QUE EXISTEM HOJE. Dieta, Leitura,
-- Missões e Agenda não pagam XP. Pagam foco, hábitos, rotina, sono, treino e diário.
--
-- Perfil pesado, tudo no talo (multiplicador de streak 1.5 e prioridade alta):
--   8 sessões de foco de 25min ......... 600
--   12 hábitos de prioridade alta ...... 450
--   rotina de 12 itens + bônus de fechar  112
--   2 treinos .......................... 120
--   sono na meta de 9h .................  90
--   diário ............................. .22
--   ------------------------------------ ~1394
--   + marco de 90 dias limpos de um vício (+750, uma vez por hábito na vida)
--   ------------------------------------ ~2144
--
-- Daí 2200: cobre o dia mais gordo que as regras permitem e não sobra pra trapaça.
-- É `create or replace`, então dá pra mexer só no SQL editor, sem redeploy do app —
-- mas mexa também em XP_DAILY_CAP (lib/state.js), que é o que a UI usa pra avisar.
--
-- Desativar uma fonte de XP pede BAIXAR este teto de volta: um teto calculado com
-- algo que não existe mais deixa de limitar o que sobrou.
create or replace function public.xp_daily_cap() returns integer
  language sql immutable as $$ select 2200 $$;
create or replace function public.xp_ceiling() returns integer
  language sql immutable as $$ select 2000000000 $$;  -- abaixo do teto do int4

-- ---------- Trigger: cliente não escreve xp ----------
-- security INVOKER de propósito (o default): dentro de um `security definer` o
-- `current_user` viraria o dono da função e a checagem abaixo nunca reprovaria
-- ninguém. Assim ele reflete quem de fato está escrevendo.
create or replace function public.profiles_guard_xp()
returns trigger
language plpgsql set search_path = public
as $$
begin
  -- `current_user` é 'authenticated'/'anon' quando quem escreve é o PostgREST em nome
  -- do usuário. Dentro de `apply_xp_delta` (security definer) é o dono da função, e é
  -- por isso que só ela consegue mover o contador.
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.xp := 0;
    else
      new.xp := old.xp;
    end if;
    new.best_streak := greatest(0, least(100000, coalesce(new.best_streak, 0)));
  end if;

  -- espelho em jsonb sempre reescrito a partir da coluna: uma verdade só
  if new.stats is null or jsonb_typeof(new.stats) <> 'object' then
    new.stats := '{}'::jsonb;
  end if;
  new.stats := jsonb_set(new.stats, '{xp}', to_jsonb(coalesce(new.xp, 0)), true);
  return new;
end;
$$;

drop trigger if exists profiles_guard_xp on public.profiles;
create trigger profiles_guard_xp
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_xp();

-- ---------- A única porta: delta com teto diário ----------
-- Devolve o XP autoritativo depois de aplicar. O cliente adota esse número (ver
-- syncUserState/AppContext) — se o teto cortou, a tela mostra o valor real, não o
-- otimista.
create or replace function public.apply_xp_delta(delta integer)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  uid    uuid    := auth.uid();
  today  date    := (now() at time zone 'utc')::date;
  cap    integer := public.xp_daily_cap();
  step   integer;
  netday integer;
  cur    integer;
  nxt    integer;
begin
  if uid is null then raise exception 'não autenticado'; end if;

  select p.xp into cur from public.profiles p where p.id = uid for update;
  if not found then raise exception 'perfil inexistente'; end if;
  if delta is null or delta = 0 then return cur; end if;

  step := delta;

  -- Teto de GANHO LÍQUIDO no dia. Estorno e penalidade (delta < 0) entram inteiros e
  -- devolvem cota — churn de +/− não rende nada, e quem perdeu XP legitimamente não
  -- fica sem poder ganhar de novo no mesmo dia.
  if step > 0 then
    select coalesce(sum(e.applied), 0) into netday
      from public.xp_events e
     where e.user_id = uid and e.day = today;
    step := least(step, greatest(0, cap - netday));
  end if;

  -- conta em bigint: cur + step estoura int4 antes do least() se vier lixo
  nxt := greatest(0, least(public.xp_ceiling()::bigint, cur::bigint + step))::integer;
  step := nxt - cur;  -- o que de fato entrou

  if step <> 0 then
    update public.profiles set xp = nxt, updated_at = now() where id = uid;
    insert into public.xp_events (user_id, day, delta, applied) values (uid, today, delta, step);
  end if;
  return nxt;
end;
$$;

revoke all on function public.apply_xp_delta(integer) from public;
grant execute on function public.apply_xp_delta(integer) to authenticated;

-- ---------- Limites duros nas colunas ----------
-- `not valid` de propósito: linha já inflada por trapaça não impede o deploy — ela é
-- corrigida à parte (ver supabase/patch-xp.sql).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_xp_range') then
    alter table public.profiles add constraint profiles_xp_range
      check (xp >= 0 and xp <= 2000000000) not valid;
  end if;
end $$;

-- XP gravado nos logs existe só p/ estorno simétrico. Nenhum evento honesto passa de
-- ~800 (marco de 90 dias × multiplicador), então 2000 é folga e mata o log forjado
-- que viraria um estorno gigante ao ser apagado.
do $$
declare
  t text;
  c text;
begin
  foreach t in array array['sleep_logs','exercise_logs','habit_checks','routine_checks']
  loop
    c := t || '_xp_range';
    if not exists (select 1 from pg_constraint where conname = c) then
      execute format('alter table public.%I add constraint %I check (xp between -2000 and 2000) not valid', t, c);
    end if;
  end loop;
end $$;

-- ---------- Diagnóstico: piso de XP com base na atividade registrada ----------
-- NÃO é o XP correto — ignora multiplicador de streak, marcos, diário e penalidades.
-- É um PISO defensável, pra reconstruir uma conta que foi inflada. Ver patch-xp.sql.
create or replace function public.xp_evidence_floor(uid uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select greatest(0, least(public.xp_ceiling(),
      coalesce((select sum(greatest(-2000, least(2000, xp))) from public.habit_checks   where user_id = uid), 0)
    + coalesce((select sum(greatest(-2000, least(2000, xp))) from public.exercise_logs  where user_id = uid), 0)
    + coalesce((select sum(greatest(-2000, least(2000, xp))) from public.sleep_logs     where user_id = uid), 0)
    + coalesce((select sum(greatest(-2000, least(2000, xp))) from public.routine_checks where user_id = uid), 0)
    + coalesce((select sum(least(48, greatest(0, sessions))) * 50 from public.focus_days where user_id = uid), 0)
  ))::integer
$$;
-- sem grant pro cliente: é ferramenta de administração (roda no SQL editor). Exposta
-- ao `authenticated` ela contaria o XP-piso de qualquer conta pra qualquer um.
revoke all on function public.xp_evidence_floor(uuid) from public;
