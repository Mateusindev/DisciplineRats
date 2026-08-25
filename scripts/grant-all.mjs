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
-- ISTO AQUI é o que libera. O script que gerou este arquivo não fala com banco
-- nenhum — ele só escreve o texto. Cole o bloco inteiro no SQL editor do Supabase
-- (menu lateral > SQL Editor > New query) e rode.
--
-- Gerado por scripts/grant-all.mjs a partir do catálogo: ${pagos.length} itens pagos
-- (${PET_PAID_SPECIES.length} espécie(s) + ${PET_PAID_ITEMS.length} acessórios), R$ ${(pagos.length * PET_ITEM_PRICE).toFixed(2).replace(".", ",")} de catálogo.
-- Idempotente: rodar duas vezes não duplica nada.
--
-- payment_id fica 'cortesia' de propósito: o registro segue honesto, e dá pra
-- separar liberação manual de compra de verdade depois.
-- ============================================================

-- 1) ACHAR A CONTA. Espere UMA linha. Zero linhas aqui é a falha silenciosa que
--    mais acontece: o e-mail do login não é o que você digitou. A comparação é
--    case-insensitive de propósito, mas não adivinha e-mail diferente.
select id, email, created_at from auth.users where lower(email) = lower('${esc}');

-- Se a de cima veio vazia, rode esta pra ver os e-mails que existem de verdade:
-- select id, email from auth.users order by created_at;

-- 2) LIBERAR
insert into public.pet_entitlements (user_id, item_id, payment_id, amount)
select u.id, x.item_id, 'cortesia', 0
from auth.users u
cross join (values
${linhas}
) as x(item_id)
where lower(u.email) = lower('${esc}')
on conflict (user_id, item_id) do nothing;

-- 3) CONFERIR. Espere ${pagos.length}.
select count(*) as liberados
from public.pet_entitlements e
join auth.users u on u.id = e.user_id
where lower(u.email) = lower('${esc}');

-- Deu ${pagos.length} e o app ainda mostra cadeado? Saia e entre de novo (ou F5): os
-- entitlements são lidos uma vez, na carga.`);
