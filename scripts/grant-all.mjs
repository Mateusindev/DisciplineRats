// Gera o SQL que libera TUDO que é pago pra uma conta — dono do app, conta de
// teste, cortesia, o que for.
//
//   bun scripts/grant-all.mjs seu@email.com > supabase/liberar-tudo.sql
//
// Por que gerar em vez de escrever o .sql à mão: a lista sai do catálogo de
// verdade (PET_PAID_SPECIES + PET_PAID_ITEMS), então item novo nunca fica de fora
// por esquecimento. Rode de novo depois de acrescentar item pago.
//
// POR QUE ISSO É SQL E NÃO UM BOTÃO NO APP: `pet_entitlements` não tem policy de
// escrita — nem pro dono da linha. É o que impede uma linha no console do navegador
// de liberar item pago. Um "modo dono" no cliente reabriria exatamente esse buraco,
// pra qualquer usuário, não só pra você. O SQL editor do Supabase usa a service key
// e passa por cima do RLS, que é o caminho previsto.

import { PET_PAID_ITEMS, PET_PAID_SPECIES, PET_ITEM_PRICE } from "../lib/state.js";

const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("uso: bun scripts/grant-all.mjs seu@email.com");
  process.exit(1);
}

const pagos = [...PET_PAID_SPECIES, ...PET_PAID_ITEMS];
const linhas = pagos.map((i) => `    ('${i.id}')`).join(",\n");
const esc = email.replace(/'/g, "''");

console.log(`-- ============================================================
-- LIBERA TUDO pra ${esc}
--
-- Gerado por scripts/grant-all.mjs a partir do catálogo. ${pagos.length} itens pagos
-- (${PET_PAID_SPECIES.length} espécie(s) + ${PET_PAID_ITEMS.length} acessórios), valor de catálogo
-- R$ ${(pagos.length * PET_ITEM_PRICE).toFixed(2).replace(".", ",")}.
--
-- Cole no SQL editor do Supabase e rode. Idempotente: rodar duas vezes não
-- duplica nada. Depois recarregue o app — os entitlements são lidos na carga.
--
-- payment_id fica como 'cortesia' de propósito: o registro continua honesto,
-- e dá pra separar liberação manual de compra de verdade depois.
-- ============================================================

insert into public.pet_entitlements (user_id, item_id, payment_id, amount)
select u.id, x.item_id, 'cortesia', 0
from auth.users u
cross join (values
${linhas}
) as x(item_id)
where u.email = '${esc}'
on conflict (user_id, item_id) do nothing;

-- confere: espere ${pagos.length}
select count(*) as liberados
from public.pet_entitlements e
join auth.users u on u.id = e.user_id
where u.email = '${esc}';`);
