// Guarda a invariante da duplicação deliberada: o catálogo do CLIENTE (PET_ITEMS em
// lib/state.js, usado pra PINTAR a tela) e o do SERVIDOR
// (supabase/functions/_shared/items.ts, usado pra COBRAR) precisam concordar em preço
// e em quais ids são vendáveis.
//
// A duplicação existe porque a Edge Function roda em Deno e não importa o bundle do
// Next. Este script é o que impede ela de envelhecer — e divergência aqui é dinheiro
// errado ou item que não abre cobrança.
import { readFileSync } from "node:fs";
import { PET_ITEMS, PET_PAID_ITEMS, PET_ITEM_PRICE } from "../lib/state.js";

const ts = readFileSync(new URL("../supabase/functions/_shared/items.ts", import.meta.url), "utf8");

const priceMatch = ts.match(/ITEM_PRICE\s*=\s*([\d.]+)/);
const setBlock = ts.match(/PAID_ITEMS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
const serverIds = new Set([...(setBlock?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]));

let fail = 0;
const ok = (c, msg) => { console.log(`${c ? "ok  " : "FALHA"} ${msg}`); if (!c) fail++; };

ok(!!priceMatch, "achou ITEM_PRICE no arquivo do servidor");
ok(Number(priceMatch?.[1]) === PET_ITEM_PRICE, `preço igual nos dois lados (cliente ${PET_ITEM_PRICE}, servidor ${priceMatch?.[1]})`);
ok(serverIds.size === PET_PAID_ITEMS.length, `mesma quantidade de itens pagos (cliente ${PET_PAID_ITEMS.length}, servidor ${serverIds.size})`);
for (const it of PET_PAID_ITEMS) ok(serverIds.has(it.id), `item pago "${it.id}" está na lista do servidor`);
for (const id of serverIds) ok(PET_PAID_ITEMS.some((i) => i.id === id), `id "${id}" do servidor existe e é pago no cliente`);
// o grátis NÃO pode estar vendável: cobrar por algo que a pessoa já tem é o pior bug possível aqui
for (const it of PET_ITEMS.filter((i) => i.source === "free")) ok(!serverIds.has(it.id), `item grátis "${it.id}" NÃO é vendável no servidor`);

console.log(fail ? `\n${fail} FALHA(S) — catálogo da tela e da cobrança divergem` : "\ncatálogos conferem");
process.exit(fail ? 1 : 0);
