// Recebe a notificação do Mercado Pago e é o ÚNICO lugar do sistema que libera um
// acessório pago. Roda com a service key, então passa por cima do RLS — é justamente por
// isso que `pet_entitlements` não tem policy de escrita: ninguém mais chega lá.
//
// Três regras que fazem isso ser seguro, e nenhuma delas é opcional:
//
//   1. VALIDA A ASSINATURA antes de olhar o conteúdo. O endpoint é público; sem o
//      HMAC, liberar item seria um POST que qualquer um monta.
//   2. NÃO CONFIA NO CORPO. A notificação diz "o pagamento X mudou"; o valor, o
//      status e o dono vêm de uma consulta nossa à API do MP, não do que chegou.
//   3. CONFERE O VALOR contra o preço do servidor. Preferência pode ser alterada
//      por fora; pagar R$ 0,01 e receber o item seria o resultado.
//
// Responde 200 mesmo em caso que não concede nada (pagamento pendente, evento de
// outro tipo). O MP reenvia enquanto não vê 200/201, e ficar reenviando pra sempre
// um evento que nunca vai conceder só enche o log. 401 fica reservado pra assinatura
// inválida, que é o caso em que reenviar até faz sentido.
//
// Ver o README ao lado.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { ITEM_PRICE, PAID_ITEMS, CENT } from "../_shared/items.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const MP_SECRET = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";
const MP_API = "https://api.mercadopago.com";

// Comparação em tempo constante. Um `===` em string de HMAC vaza, por tempo, quantos
// bytes iniciais o atacante acertou — e com isso a assinatura é descoberta byte a byte.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmacSha256(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  if (!MP_TOKEN || !MP_SECRET) {
    console.error("mp-webhook sem MP_ACCESS_TOKEN ou MP_WEBHOOK_SECRET");
    return new Response("nao_configurado", { status: 500 });
  }

  const url = new URL(req.url);
  const raw = await req.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }

  // `data.id` chega na query em algumas notificações e no corpo em outras.
  const dataId = String(
    url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? (body?.data as { id?: unknown })?.id ?? "",
  );
  const topic = String(url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body?.type ?? "");

  // ---- 1. assinatura ----
  // Manifesto documentado: `id:<data.id em minúsculas>;request-id:<x-request-id>;ts:<ts>;`
  // O id vai minúsculo AQUI, mas a consulta à API usa o id original.
  const sigHeader = req.headers.get("x-signature") ?? "";
  const reqId = req.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const [k, ...v] = kv.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  if (!parts.ts || !parts.v1 || !dataId) return new Response("assinatura_ausente", { status: 401 });
  const manifest = `id:${dataId.toLowerCase()};request-id:${reqId};ts:${parts.ts};`;
  const expected = await hmacSha256(MP_SECRET, manifest);
  if (!safeEqual(expected, parts.v1)) {
    console.error("assinatura invalida", { topic, dataId, reqId });
    return new Response("assinatura_invalida", { status: 401 });
  }

  // Só pagamento concede. `merchant_order` e afins chegam e são reconhecidos sem
  // efeito — responder 200 encerra o reenvio.
  if (topic && !topic.startsWith("payment")) return Response.json({ ok: true, ignorado: topic });

  // ---- 2. a verdade vem da API, não da notificação ----
  const payRes = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(dataId)}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!payRes.ok) {
    console.error("consulta de pagamento falhou", payRes.status);
    // 500 aqui é de propósito: falha nossa/transitória, reenviar é o certo
    return new Response("consulta_falhou", { status: 500 });
  }
  const pay = await payRes.json();
  const status = String(pay?.status ?? "");
  const amount = Number(pay?.transaction_amount ?? 0);
  const ref = String(pay?.external_reference ?? "");
  const [userId, itemId] = ref.split("|");
  const vendavel = PAID_ITEMS.has(itemId ?? "");

  const db = createClient(SB_URL, SB_KEY);

  // Log primeiro, decisão depois: mesmo pagamento recusado fica registrado. PK em
  // payment_id dá a idempotência — reenvio não vira segunda concessão.
  await db.from("pet_payments").upsert(
    {
      payment_id: String(pay?.id ?? dataId),
      user_id: userId && vendavel ? userId : null,
      item_id: itemId ?? null,
      status,
      amount,
      raw: { status, amount, ref, method: pay?.payment_type_id ?? null, detail: pay?.status_detail ?? null },
    },
    { onConflict: "payment_id" },
  );

  if (!vendavel || !userId) {
    console.error("referencia externa irreconhecivel", ref);
    return Response.json({ ok: true, ignorado: "ref_invalida" });
  }
  // `pending` e `in_process` NÃO concedem. Pix e boleto vivem nesse estado até
  // liquidar, e conceder ali é entregar sem receber — o MP manda outra notificação
  // quando aprovar.
  if (status !== "approved") return Response.json({ ok: true, status, concedido: false });

  // ---- 3. o valor pago tem que bater com o preço do servidor ----
  if (amount + CENT < ITEM_PRICE) {
    console.error("valor abaixo do preco", { ref, amount, esperado: ITEM_PRICE });
    return Response.json({ ok: true, status, concedido: false, motivo: "valor_menor" });
  }

  const { error } = await db.from("pet_entitlements").upsert(
    { user_id: userId, item_id: itemId, payment_id: String(pay?.id ?? dataId), amount },
    { onConflict: "user_id,item_id" },
  );
  if (error) {
    console.error("concessao falhou", error.message);
    return new Response("concessao_falhou", { status: 500 }); // reenviar é o certo
  }
  return Response.json({ ok: true, status, concedido: true, itemId });
});
