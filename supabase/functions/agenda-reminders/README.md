# Lembrete de agenda com o app fechado

Sem esta função, a notificação só chega **com o app aberto**. Ela é o que entrega
push no Android e no iPhone com o app fora da tela.

Como as peças se encaixam:

```
cliente (lib/state.js: agendaReminders)
  → materializa os próximos 30 dias em agenda_reminders
      → pg_cron chama esta função de minuto em minuto
          → ela envia push pros aparelhos em push_subscriptions
              → public/sw.js recebe o evento "push" e mostra a notificação
```

A recorrência (regra semanal, treino do plano) é calculada **só no cliente**, de
propósito: a lógica já vive em `lib/state.js`, e reimplementá-la aqui criaria duas
verdades que envelhecem separadas.

## 1. Tabelas

Rode `supabase/schema.sql` no SQL editor (já contém `push_subscriptions` e
`agenda_reminders`, ambas com RLS por usuário).

## 2. Chaves VAPID

O par identifica o seu servidor pro serviço de push do navegador. Gere uma vez:

```bash
deno run -A https://raw.githubusercontent.com/negrel/webpush/master/cmd/generate-vapid-keys.ts > vapid.json
```

O arquivo tem `publicKey` e `privateKey` em JWK. A pública também precisa ir pro
cliente em **base64url**, no formato que `applicationServerKey` aceita — o script
imprime esse valor; se não, converta o `x`+`y` do JWK com:

```bash
deno eval 'const k=JSON.parse(Deno.readTextFileSync("vapid.json")).publicKey;
const b=(s)=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
const raw=new Uint8Array([4,...b(k.x),...b(k.y)]);
console.log(btoa(String.fromCharCode(...raw)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""));'
```

## 3. Segredo do cron

Quem pode disparar a função. É um segredo só pra isto, **não** a chave do projeto:
o Supabase migrou de `service_role` JWT pra `sb_secret_*`, e comparar com a chave
do projeto quebra conforme a versão. Gere um:

```bash
bun -e 'console.log(crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"").slice(0,8))'
```

Salve como secret `CRON_SECRET`. A chave **anônima** não serve pra autorizar: ela
vive no bundle do site, então qualquer um poderia disparar suas notificações.

## 4. Variáveis

No `.env.local` do Next (a pública, que vai pro navegador):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<a base64url do passo 2>
```

Nos secrets da função (privadas, nunca no cliente):

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="$(jq -c .publicKey vapid.json)" \
  VAPID_PRIVATE_KEY="$(jq -c .privateKey vapid.json)" \
  VAPID_SUBJECT="mailto:voce@seudominio.com"
```

## 5. Deploy — com "Verify JWT" DESLIGADO

A função é chamada por **cron**, não por usuário logado. Com a verificação de JWT
ligada, o gateway exige um JWT no `Authorization` e recusa **antes** de chegar no
código, com `UNAUTHORIZED_INVALID_JWT_FORMAT` — e o formato novo de chave do
Supabase (`sb_publishable_*` / `sb_secret_*`) não é JWT, então nem a chave certa
passaria.

Desligar não deixa a função aberta: ela exige o `x-cron-secret`, que é o que de
fato autoriza. Sem ele, responde 401.

- **Painel**: Edge Functions → `agenda-reminders` → configurações da função →
  desligue a verificação de JWT.
- **CLI**: já está em `supabase/config.toml` (`verify_jwt = false`), então basta

```bash
supabase functions deploy agenda-reminders
```

## 6. Cron de um minuto

Antes, teste a função sozinha — assim você separa "função quebrada" de "cron não
dispara". Sem `Authorization`: com verify_jwt desligado, quem autoriza é o
`x-cron-secret`.

```bash
curl -i -X POST 'https://<PROJECT_REF>.functions.supabase.co/agenda-reminders' \
  -H 'x-cron-secret: <CRON_SECRET>'
```

Esperado: `200 {"sent":0}` — zero porque nada venceu ainda. Um `401` responde em
JSON dizendo o que faltou (sem vazar segredo).

Depois, no SQL editor (troque `<PROJECT_REF>` e `<CRON_SECRET>`):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'agenda-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/agenda-reminders',
    headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb
  );
  $$
);
```

Conferir se está agendado e se as execuções passam:

```sql
select jobname, schedule, active from cron.job;

-- últimas execuções do job (status 'succeeded' = o POST saiu)
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'agenda-reminders')
order by start_time desc limit 5;

-- o que a função respondeu de fato
select status_code, content, created from net._http_response order by created desc limit 5;
```

`status_code` 200 com `{"sent":0}` é o esperado enquanto nada venceu.
`{"code":"UNAUTHORIZED_INVALID_JWT_FORMAT"}` = o "Verify JWT" da função continua
ligado, ou sobrou um header `Authorization` na chamada. Remover o job:

```sql
select cron.unschedule('agenda-reminders');
```

## Limites que vale saber

- **Horizonte de 30 dias.** O cliente materializa até 30 dias à frente, e refaz
  isso quando você abre o app ou muda a agenda. Se ficar mais de 30 dias sem abrir,
  os lembretes param — o servidor não sabe calcular recorrência sozinho.
- **Atraso máximo de 30 min.** Lembrete que venceu há mais tempo é marcado como
  resolvido sem tocar: avisar de compromisso de ontem é ruído.
- **Evento de dia inteiro não avisa.** Sem hora não existe "15 minutos antes", e
  escolher a meia-noite seria inventar um horário que você não pediu.
- **iOS**: só em PWA instalado pela tela de início (iOS 16.4+). Em aba do Safari o
  `PushManager` não existe — a UI detecta e explica em vez de oferecer um botão
  que não funciona.
