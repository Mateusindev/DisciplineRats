// Cria a cobrança de UM acessório no Mercado Pago (Checkout Pro) e devolve a URL pra
// onde o navegador deve ir. Ela NÃO libera nada — quem libera é o mp-webhook,
// depois que o dinheiro entrou. Separar as duas coisas é o ponto: se liberar
// morasse aqui, bastaria chamar esta função pra ganhar o item.
//
// Duas coisas que o cliente manda e são ignoradas de propósito: preço (vem de
// _shared/items.ts) e identidade (vem do JWT, não do corpo do request).
//
// Ver o README ao lado.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { ITEM_PRICE, PAID_ITEMS } from "../_shared/items.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
const MP_API = "https://api.mercadopago.com";

const cors = {
  "Access-Control-Allow-Origin": SITE_URL || "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!MP_TOKEN) return json({ error: "mp_nao_configurado" }, 500);
  if (!SITE_URL) return json({ error: "site_url_nao_configurada" }, 500);

  // Identidade vem do token, sempre. Aceitar um user_id do corpo seria deixar
  // qualquer um comprar em nome de qualquer um — ou pior, comprar pra si e mandar
  // o entitlement pra outra conta.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "sem_token" }, 401);
  const db = createClient(SB_URL, SB_KEY);
  const { data: auth, error: authErr } = await db.auth.getUser(jwt);
  if (authErr || !auth?.user) return json({ error: "token_invalido" }, 401);
  const user = auth.user;

  let itemId = "";
  try {
    itemId = String(((await req.json()) as { itemId?: string })?.itemId ?? "");
  } catch {
    return json({ error: "corpo_invalido" }, 400);
  }
  // Só id que está na lista do SERVIDOR gera cobrança. Item grátis não está lá, então
  // nem por engano alguém paga por algo que já tinha.
  if (!PAID_ITEMS.has(itemId)) return json({ error: "item_desconhecido" }, 400);

  // Já é dono? Não cria cobrança. Cobrar de novo pelo que a pessoa já tem é o tipo
  // de bug que vira pedido de reembolso.
  const { data: have } = await db
    .from("pet_entitlements")
    .select("item_id")
    .eq("user_id", user.id)
    .eq("item_id", itemId)
    .maybeSingle();
  if (have) return json({ error: "ja_possui", itemId }, 409);

  // `external_reference` é o fio que liga o pagamento à conta. O webhook não recebe
  // sessão nenhuma, então é por aqui que ele descobre pra quem conceder.
  const externalRef = `${user.id}|${itemId}`;
  const pref = {
    items: [
      {
        id: itemId,
        title: `Acessório do mascote — Discipline Rats`,
        description: "Acessório cosmético para o mascote. Não altera XP, nível nem ranking.",
        quantity: 1,
        currency_id: "BRL",
        unit_price: ITEM_PRICE,
      },
    ],
    payer: { email: user.email ?? undefined },
    external_reference: externalRef,
    notification_url: `${SB_URL}/functions/v1/mp-webhook`,
    back_urls: {
      success: `${SITE_URL}/perfil?compra=ok#mascote`,
      pending: `${SITE_URL}/perfil?compra=pendente#mascote`,
      failure: `${SITE_URL}/perfil?compra=falhou#mascote`,
    },
    auto_return: "approved",
    statement_descriptor: "DISCIPLINERATS",
  };

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MP_TOKEN}`,
      "Content-Type": "application/json",
      // idempotência do lado do MP: recarregar a tela e clicar duas vezes não cria
      // duas preferências pro mesmo par usuário+item
      "X-Idempotency-Key": `${user.id}-${itemId}`,
    },
    body: JSON.stringify(pref),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("mp preference falhou", res.status, body);
    return json({ error: "mp_recusou", status: res.status, detalhe: body?.message ?? null }, 502);
  }

  // `sandbox_init_point` só existe com credencial de TESTE. Preferir o init_point e
  // cair no sandbox evita o erro clássico de mandar todo mundo pro sandbox em prod.
  const url = body?.init_point ?? body?.sandbox_init_point;
  if (!url) return json({ error: "mp_sem_url" }, 502);
  return json({ url, itemId, priceBRL: ITEM_PRICE });
});
