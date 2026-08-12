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

## 3. Variáveis

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

## 4. Deploy

```bash
supabase functions deploy agenda-reminders
```

## 5. Cron de um minuto

No SQL editor (troque `<PROJECT_REF>` e `<SERVICE_ROLE_KEY>`):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'agenda-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/agenda-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb
  );
  $$
);
```

Conferir e remover:

```sql
select * from cron.job;
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
