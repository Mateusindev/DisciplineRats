-- ============================================================
-- LIBERA TUDO pra mateusbessacontato@gmail.com
--
-- Gerado por scripts/grant-all.mjs a partir do catálogo. 27 itens pagos
-- (1 espécie(s) + 26 acessórios), valor de catálogo
-- R$ 26,73.
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
where u.email = 'mateusbessacontato@gmail.com'
on conflict (user_id, item_id) do nothing;

-- confere: espere 27
select count(*) as liberados
from public.pet_entitlements e
join auth.users u on u.id = e.user_id
where u.email = 'mateusbessacontato@gmail.com';
