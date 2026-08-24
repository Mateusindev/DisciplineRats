-- ============================================================
-- PATCH — só o que o mascote e a lojinha precisam.
--
-- `schema.sql` continua sendo a fonte da verdade e contém tudo isto. Este arquivo
-- existe por um motivo operacional: o schema completo dispara ~40 `alter table`, e
-- cada um pede AccessExclusiveLock — que conflita até com um SELECT. Rodar aquilo com
-- o app no ar disputa lock com quem está lendo e o Postgres mata um dos dois com
-- `40P01: deadlock detected`.
--
-- Aqui são 8 comandos em vez de 40, então a transação é curta e a chance de disputa
-- despenca. Mesmo assim: FECHE O APP antes, e feche as outras abas do SQL editor.
--
-- Idempotente. Rodar duas vezes não faz nada na segunda.
-- ============================================================

set lock_timeout = '8s';

-- ---------- hábitos: ordem escolhida + mínimo executável ----------
alter table public.habits add column if not exists pos integer not null default 0;
alter table public.habits add column if not exists minimum text;
alter table public.habits add column if not exists min_days jsonb not null default '[]'::jsonb;
create index if not exists habits_user_pos on public.habits (user_id, pos);

-- ---------- mascote: nome, pelagem, acessórios vestidos ----------
alter table public.profiles add column if not exists pet jsonb not null default '{}'::jsonb;

-- ---------- lojinha: a única parte do banco que o cliente NÃO escreve ----------
-- `pet_entitlements` só tem policy de SELECT. Sem insert/update/delete, ninguém
-- escreve pela API pública — nem o dono. Quem grava é a Edge Function `mp-webhook`,
-- com a service key, que passa por cima do RLS. É isso que impede uma linha no console
-- do navegador de liberar item pago.
create table if not exists public.pet_entitlements (
  user_id    uuid not null references auth.users (id) on delete cascade,
  item_id    text not null,
  payment_id text,
  amount     numeric(10,2),
  granted_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- Quem instalou na versão que vendia PACKS tem a coluna com o nome antigo. Tenta
-- renomear e engole o erro em vez de consultar o catálogo: ler information_schema toma
-- lock em várias relações do catálogo dentro da mesma transação que já tem
-- AccessExclusiveLock nesta tabela — é assim que se fabrica deadlock.
do $$
begin
  alter table public.pet_entitlements rename column pack_id to item_id;
exception
  when undefined_column then null;   -- nunca teve pack_id: instalação nova
  when duplicate_column then null;   -- item_id já existe: já foi renomeado
end $$;

alter table public.pet_entitlements enable row level security;
drop policy if exists "own entitlements select" on public.pet_entitlements;
create policy "own entitlements select" on public.pet_entitlements for select using (auth.uid() = user_id);

-- Log de pagamento. `payment_id` como PK dá a idempotência de graça: o webhook do
-- Mercado Pago reenvia, e reenviar um insert com a mesma PK não concede duas vezes.
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
-- nenhuma policy de propósito: nem leitura pelo cliente. É registro financeiro.

-- ---------- conferir o que ficou ----------
-- Espere 5 linhas na primeira e 2 na segunda.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (   (table_name = 'habits'   and column_name in ('pos', 'minimum', 'min_days'))
       or (table_name = 'profiles' and column_name = 'pet')
       or (table_name = 'pet_entitlements' and column_name = 'item_id'))
order by table_name, column_name;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('pet_entitlements', 'pet_payments');
