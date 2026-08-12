// Dispara os lembretes de agenda que já venceram. É o que faz a notificação
// chegar com o app FECHADO — sem isto, só chega com o app aberto.
//
// Ela NÃO calcula recorrência: o cliente materializa os próximos 30 dias em
// `agenda_reminders` (lib/state.js → agendaReminders). Aqui só perguntamos "o que
// venceu e ainda não foi enviado?". Reimplementar regra semanal e treino derivado
// do plano aqui criaria duas verdades que envelhecem separadas.
//
// Rode de minuto em minuto (pg_cron). Ver o README ao lado.

import { createClient } from "jsr:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

// Um lembrete velho não vira notificação: avisar de um compromisso de ontem é
// ruído, e é o que aconteceria se a função ficasse um tempo fora do ar.
const MAX_LATE_MIN = 30;

Deno.serve(async (req) => {
  // só aceita chamada autenticada (o cron manda o service role no header)
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.includes(SB_KEY)) return new Response("unauthorized", { status: 401 });

  const db = createClient(SB_URL, SB_KEY);
  const now = new Date();
  const floor = new Date(now.getTime() - MAX_LATE_MIN * 60_000);

  const { data: due, error } = await db
    .from("agenda_reminders")
    .select("user_id,key,title,body,url,fire_at")
    .is("sent_at", null)
    .lte("fire_at", now.toISOString())
    .gte("fire_at", floor.toISOString())
    .limit(500);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!due?.length) return Response.json({ sent: 0 });

  // marca os atrasados demais como enviados sem enviar: eles não devem tocar,
  // mas também não podem ficar pra sempre na fila de "pendentes"
  await db
    .from("agenda_reminders")
    .update({ sent_at: now.toISOString() })
    .is("sent_at", null)
    .lt("fire_at", floor.toISOString());

  const server = await webpush.ApplicationServer.new({
    contactInformation: VAPID_SUBJECT,
    vapidKeys: await webpush.importVapidKeys(
      { publicKey: JSON.parse(VAPID_PUBLIC), privateKey: JSON.parse(VAPID_PRIVATE) },
      { extractable: false },
    ),
  });

  // subscriptions de todos os usuários envolvidos, de uma vez
  const userIds = [...new Set(due.map((r) => r.user_id))];
  const { data: subs } = await db.from("push_subscriptions").select("endpoint,user_id,p256dh,auth").in("user_id", userIds);
  const byUser = new Map<string, typeof subs>();
  for (const s of subs ?? []) {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }

  let sent = 0;
  const dead: string[] = [];
  const done: { user_id: string; key: string }[] = [];

  for (const r of due) {
    const list = byUser.get(r.user_id) ?? [];
    // sem aparelho assinado não há o que enviar — marca como resolvido, senão a
    // linha fica pendente pra sempre e volta em toda execução
    if (!list.length) {
      done.push({ user_id: r.user_id, key: r.key });
      continue;
    }
    const payload = JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: `agenda-${r.key}` });
    for (const s of list) {
      try {
        const sub = server.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } });
        await sub.pushTextMessage(payload, {});
        sent++;
      } catch (e) {
        // 404/410 = aparelho desinstalou ou a subscription expirou: limpa
        const msg = String(e);
        if (msg.includes("404") || msg.includes("410") || msg.includes("Gone")) dead.push(s.endpoint);
      }
    }
    done.push({ user_id: r.user_id, key: r.key });
  }

  if (dead.length) await db.from("push_subscriptions").delete().in("endpoint", dead);
  // marca um a um pela PK composta: upsert em massa reescreveria title/body
  for (const d of done) {
    await db.from("agenda_reminders").update({ sent_at: now.toISOString() }).eq("user_id", d.user_id).eq("key", d.key);
  }

  return Response.json({ sent, cleaned: dead.length, processed: done.length });
});
