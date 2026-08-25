-- ============================================================
-- PATCH — XP passa a ser do servidor.
--
-- Fecha a falha em que o cliente mandava o valor final do XP: `profiles.xp` e a
-- cópia em `profiles.stats->'xp'` eram colunas comuns de uma tabela com policy de
-- update pro próprio dono, então bastava alterar o payload do upsert (ou digitar uma
-- linha no console) pra escrever qualquer número. Foi por `stats` que passou o
-- 99999999999: `xp` é integer e nem comportaria esse valor, jsonb comporta.
--
-- `schema.sql` é a fonte da verdade e já contém tudo isto. Este arquivo existe pelo
-- mesmo motivo do patch-mascote: o schema completo dispara dezenas de `alter table`,
-- cada um pedindo AccessExclusiveLock, e rodar aquilo com o app no ar fabrica
-- deadlock. Aqui são poucos comandos.
--
-- ANTES DE RODAR: FECHE O APP e as outras abas do SQL editor.
-- Idempotente: rodar de novo não faz nada na segunda vez.
--
-- DEPOIS de rodar, faça o deploy do app (lib/persistence.js passa a mandar delta em
-- vez de valor absoluto). Na ordem inversa o app antigo continua tentando gravar xp
-- e o trigger simplesmente ignora — ninguém ganha XP até o deploy sair.
-- ============================================================

set lock_timeout = '8s';
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

-- Teto do dia. Conta feita sobre as fontes de XP QUE EXISTEM HOJE — o Foco está
-- desativado (comentado em TABS + DISABLED_ROUTES, e o TimerWidget só aparece com
-- timer ativo, que só começa em /foco), então as sessões não entram. Dieta, Leitura,
-- Missões e Agenda não pagam XP. Sobram hábitos, rotina, sono, treino e diário.
--
-- Perfil pesado, tudo no talo (multiplicador de streak 1.5 e prioridade alta):
--   12 hábitos de prioridade alta ...... 450
--   rotina de 12 itens + bônus de fechar  112
--   2 treinos .......................... 120
--   sono na meta de 9h .................  90
--   diário ............................. .22
--   ------------------------------------ ~794
--   + marco de 90 dias limpos de um vício (+750, uma vez por hábito na vida)
--   ------------------------------------ ~1544
--
-- Daí 1600: cobre o dia mais gordo que as regras permitem e não sobra pra trapaça.
-- É `create or replace`, então dá pra mexer só no SQL editor, sem redeploy do app —
-- mas mexa também em XP_DAILY_CAP (lib/state.js), que é o que a UI usa pra avisar.
--
-- REATIVAR O FOCO PEDE SUBIR ESTE TETO: 8 sessões de 25min valem ~600, e sem isso o
-- usuário que voltar a usar o timer bate no teto no meio da tarde. Ver a checklist
-- de reativação em TABS (lib/state.js).
create or replace function public.xp_daily_cap() returns integer
  language sql immutable as $$ select 1600 $$;
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

-- ============================================================
-- LIMPEZA — corrigir a conta que já foi inflada.
--
-- O trigger acima congela o XP no valor que ESTÁ no banco. Se esse valor já é
-- trapaça, ele congela a trapaça. Corrija à mão, nesta ordem.
--
-- 1) Veja quem está fora da curva (seguro, só lê). `piso` é o XP reconstruído a
--    partir da atividade registrada — é um PISO, não o valor exato: ignora
--    multiplicador de streak, marcos, diário e penalidades.
--
--      select id, username, xp, public.xp_evidence_floor(id) as piso
--        from public.profiles
--       order by xp desc
--       limit 20;
--
-- 2) Confirme na origem: quem inflou tem XP alto e atividade quase nula.
--
--      select day, sum(applied) from public.xp_events
--       where user_id = '<uuid>' group by day order by day desc limit 30;
--      -- (vazio p/ trapaça antiga: o ledger só começa a existir agora)
--
-- 3) Corrija. DESTRUTIVO e sem volta — descomente e rode com o uuid certo:
--
--      update public.profiles p
--         set xp = public.xp_evidence_floor(p.id)
--       where p.id = '<uuid>';
--
--    Vale pro seu amigo. Rodando pelo SQL editor você é `postgres`, não
--    `authenticated`, então o trigger deixa passar — é a única porta que sobrou.
--
-- 4) Ranking de grupo usa `xp − xp_at_join`. Se ele entrou num grupo com o XP
--    inflado, o snapshot também está inflado e o ranking dele fica negativo (o
--    `greatest(0, …)` do group_ranking segura). Pra zerar dentro do grupo:
--
--      update public.group_members set xp_at_join = (select xp from public.profiles where id = user_id)
--       where user_id = '<uuid>';
-- ============================================================
