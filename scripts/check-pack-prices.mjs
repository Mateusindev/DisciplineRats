// Guarda a invariante da duplicação deliberada: PET_PACKS (lib/state.js, usado pra
// PINTAR a tela) e PACKS (supabase/functions/_shared/packs.ts, usado pra COBRAR)
// precisam ter o mesmo preço. A duplicação existe porque a Edge Function roda em Deno
// e não importa o bundle do Next; este script é o que impede ela de envelhecer.
//
// Divergência aqui é dinheiro errado: tela diz R$ 9,90 e a cobrança sai R$ 12,90.
import { readFileSync } from "node:fs";
import { PET_PACKS } from "../lib/state.js";

const ts = readFileSync(new URL("../supabase/functions/_shared/packs.ts", import.meta.url), "utf8");
const server = {};
for (const m of ts.matchAll(/(\w+):\s*\{\s*priceBRL:\s*([\d.]+)/g)) server[m[1]] = Number(m[2]);

let fail = 0;
const ok = (c, msg) => { console.log(`${c ? "ok  " : "FALHA"} ${msg}`); if (!c) fail++; };

ok(Object.keys(server).length > 0, `achou ${Object.keys(server).length} packs no arquivo do servidor`);
ok(Object.keys(server).length === PET_PACKS.length, `mesma quantidade de packs (cliente ${PET_PACKS.length}, servidor ${Object.keys(server).length})`);
for (const p of PET_PACKS) {
  ok(server[p.id] !== undefined, `pack "${p.id}" existe no servidor`);
  ok(server[p.id] === p.priceBRL, `pack "${p.id}": cliente R$ ${p.priceBRL} === servidor R$ ${server[p.id]}`);
}
for (const id of Object.keys(server)) ok(PET_PACKS.some((p) => p.id === id), `pack "${id}" do servidor existe no cliente`);

console.log(fail ? `\n${fail} FALHA(S) — preço da tela e da cobrança divergem` : "\npreços conferem");
process.exit(fail ? 1 : 0);
