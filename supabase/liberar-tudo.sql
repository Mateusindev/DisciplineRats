-- ============================================================
-- LIBERA TUDO pra mateusbessacontato@gmail.com
--
-- ISTO AQUI é o que libera. O script que gerou este arquivo não fala com banco
-- nenhum — ele só escreve o texto. Cole o bloco inteiro no SQL editor do Supabase
-- (menu lateral > SQL Editor > New query) e rode.
--
-- Gerado por scripts/grant-all.mjs a partir do catálogo: 27 itens pagos
-- (1 espécie(s) + 26 acessórios), R$ 26,73 de catálogo.
-- Idempotente: rodar duas vezes não duplica nada.
--
-- payment_id fica 'cortesia' de propósito: o registro segue honesto, e dá pra
-- separar liberação manual de compra de verdade depois.
-- ============================================================

-- 1) ACHAR A CONTA. Espere UMA linha. Zero linhas aqui é a falha silenciosa que
--    mais acontece: o e-mail do login não é o que você digitou. A comparação é
--    case-insensitive de propósito, mas não adivinha e-mail diferente.
select id, email, created_at from auth.users where lower(email) = lower('mateusbessacontato@gmail.com');

-- Se a de cima veio vazia, rode esta pra ver os e-mails que existem de verdade:
-- select id, email from auth.users order by created_at;

-- 2) LIBERAR
insert into public.pet_entitlements (user_id, item_id, payment_id, amount)
select u.id, x.item_id, 'cortesia', 0
from auth.users u
cross join (values
    ('rato'),
    ('cap'),
    ('tophat'),
    ('halo'),
    ('crown'),
    ('ushanka'),
    ('helmet'),
    ('shades'),
    ('eyepatch'),
    ('monocle'),
    ('starshades'),
    ('bandana'),
    ('bowtie'),
    ('scarf'),
    ('plaid'),
    ('spikes'),
    ('fish'),
    ('mouse'),
    ('pillow'),
    ('cocoa'),
    ('rocket'),
    ('window'),
    ('shelf'),
    ('night'),
    ('snow'),
    ('space'),
    ('stage')
) as x(item_id)
where lower(u.email) = lower('mateusbessacontato@gmail.com')
on conflict (user_id, item_id) do nothing;

-- 3) CONFERIR. Espere 27.
select count(*) as liberados
from public.pet_entitlements e
join auth.users u on u.id = e.user_id
where lower(u.email) = lower('mateusbessacontato@gmail.com');

-- Deu 27 e o app ainda mostra cadeado? Saia e entre de novo (ou F5): os
-- entitlements são lidos uma vez, na carga.
