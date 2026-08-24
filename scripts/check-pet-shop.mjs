// Regras da lojinha do mascote que NÃO dá pra ver na tela: os dois livros de XP, a
// fronteira de confiança entre item de XP (escrito pelo cliente) e item pago
// (concedido pelo servidor), e a sanidade do catálogo.
//
//   bun scripts/check-pet-shop.mjs
//
// O par deste script é scripts/check-pack-prices.mjs, que garante que o preço da
// tela e o preço da cobrança não divergem.

import {
  normalizePet,
  defaultPet,
  petBalance,
  buyPetItem,
  togglePetGear,
  petOwns,
  mergeWithDefaults,
  gamify,
  xpToReachLevel,
  petGrowth,
  petItemIsPaid,
  PET_ITEMS,
  PET_ALL_ITEMS,
  PET_PAID_ITEMS,
  PET_ITEM_BY_ID,
  PET_SLOTS,
  PET_PACKS,
} from "../lib/state.js";

let fail = 0;
const ok = (c, m) => {
  console.log(`${c ? "ok  " : "FALHA"} ${m}`);
  if (!c) fail++;
};
const st = (xp, pet, ents) => ({ stats: { xp, streak: 0 }, pet: pet || defaultPet(), entitlements: ents || [] });

console.log("=== XP: dois livros ===");
ok(petBalance(st(1000)) === 1000, "saldo = xp quando nada foi gasto");
ok(petBalance(st(1000, { ...defaultPet(), spent: 400 })) === 600, "saldo desconta o gasto");
ok(petBalance(st(100, { ...defaultPet(), spent: 999 })) === 0, "saldo nunca negativo");

{
  const antes = st(1000);
  const depois = buyPetItem(antes, "bell"); // 250 XP, nível 1
  ok(depois.pet.owned.includes("bell") && depois.pet.spent === 250, "compra guarda item e cobra");
  ok(depois.pet.gear.neck === "bell", "compra já veste");
  ok(petBalance(depois) === 750, "saldo cai");
  ok(depois.stats.xp === antes.stats.xp, "XP TOTAL intocado — é o que impede o gato de encolher ao comprar");
  ok(gamify(depois.stats).level === gamify(antes.stats).level, "nível idêntico depois de comprar");
  ok(petGrowth(depois.stats).pct === petGrowth(antes.stats).pct, "barra de crescimento não mexe");
  ok(buyPetItem(depois, "bell") === depois, "não compra duas vezes o mesmo item");
}
ok(buyPetItem(st(100), "bell").pet.owned.length === 0, "sem saldo não compra");
ok(buyPetItem(st(3200), "crown").pet.owned.length === 0, `trava de nível morde (3200 xp = nível ${gamify({ xp: 3200 }).level}, coroa pede 12)`);
ok(buyPetItem(st(1000), "id_que_nao_existe").pet.owned.length === 0, "id inexistente não compra nem explode");
ok(buyPetItem(st(xpToReachLevel(12) + 5000), "crown").pet.owned.includes("crown"), "nível 12 compra a coroa");

console.log("=== XP: equipar ===");
{
  const dono = buyPetItem(st(xpToReachLevel(12) + 5000), "crown");
  const tirado = togglePetGear(dono, "crown");
  ok(!tirado.pet.gear.head, "clicar no vestido tira");
  ok(togglePetGear(tirado, "crown").pet.gear.head === "crown", "clicar de novo veste");
  ok(!togglePetGear(st(1000), "crown").pet.gear.head, "não veste o que não possui");
  let dois = buyPetItem(st(9999), "bell");
  dois = buyPetItem(dois, "bowtie");
  ok(dois.pet.gear.neck === "bowtie", "segundo item do mesmo slot substitui o primeiro");
}

console.log("=== XP: normalizador ===");
{
  const sujo = { name: "x".repeat(50), coat: "inexistente", owned: ["bell", "bell", "fantasma"], gear: { neck: "crown", head: "tophat" }, spent: -5 };
  const limpo = normalizePet(sujo, null, []);
  ok(limpo.name.length === 18, "nome cortado no limite");
  ok(limpo.coat === "laranja", "pelagem inválida cai no padrão");
  ok(limpo.owned.length === 1 && limpo.owned[0] === "bell", "item duplicado e fantasma removidos");
  ok(!limpo.gear.neck, "equipado no slot errado (coroa no pescoço) é desequipado");
  ok(!limpo.gear.head, "equipado sem possuir é desequipado");
  ok(limpo.spent === 0, "spent negativo vira 0");
  ok(JSON.stringify(Object.keys(limpo)) === '["name","coat","owned","gear","spent"]', "ordem de chaves estável (diff-sync)");
  ok(JSON.stringify(normalizePet(limpo, null, [])) === JSON.stringify(limpo), "normalizador idempotente");
}

console.log("=== PAGO: fronteira de confiança ===");
{
  // `pet.owned` é escrito pelo cliente (a policy de profiles deixa o dono escrever a
  // própria linha), então item pago NÃO pode valer por estar ali.
  const forjado = { ...defaultPet(), owned: ["ushanka", "helmet", "guitar", "bell"], gear: { head: "ushanka" } };
  const limpo = normalizePet(forjado, null, []);
  ok(!limpo.owned.includes("ushanka") && !limpo.owned.includes("helmet"), "item pago forjado em owned é EXPURGADO");
  ok(limpo.owned.length === 1 && limpo.owned[0] === "bell", "item de XP forjado sobrevive (mentir pra si mesmo é permitido)");
  ok(!limpo.gear.head, "pago equipado sem entitlement é desequipado");

  const comEnt = normalizePet({ ...defaultPet(), gear: { head: "ushanka" } }, null, ["inverno"]);
  ok(comEnt.gear.head === "ushanka", "com entitlement, o pago fica vestido");
  ok(!comEnt.owned.includes("ushanka"), "e mesmo assim não entra em owned — a posse é o entitlement");
}
ok(petOwns(st(0, null, ["inverno"]), "ushanka"), "petOwns vê pago pelo entitlement");
ok(!petOwns(st(0, null, ["espaco"]), "ushanka"), "entitlement de outro pack não libera");
ok(!petOwns(st(0, null, []), "ushanka"), "sem entitlement, não possui");
ok(petOwns(st(0, { ...defaultPet(), owned: ["bell"] }), "bell"), "petOwns vê item de XP em owned");

{
  const richo = st(999999);
  ok(buyPetItem(richo, "ushanka") === richo, "XP não compra item pago nem com saldo infinito");
  ok(buyPetItem(richo, "helmet") === richo, "idem capacete");
  const semEnt = st(0);
  ok(togglePetGear(semEnt, "ushanka") === semEnt, "não veste pago sem entitlement");
  const vestido = togglePetGear(st(0, null, ["inverno"]), "ushanka");
  ok(vestido.pet.gear.head === "ushanka", "veste pago com entitlement");
  ok(togglePetGear(vestido, "ushanka").pet.gear.head === undefined, "e tira no segundo clique");
}

console.log("=== merge/carga ===");
{
  const m = mergeWithDefaults({ entitlements: ["inverno", "inverno", "pack_falso"] });
  ok(m.entitlements.length === 1 && m.entitlements[0] === "inverno", "merge dedup e descarta pack inexistente");
  ok(Array.isArray(mergeWithDefaults({}).entitlements), "entitlements sempre array");
  const mig = mergeWithDefaults({ settings: { petName: "Mingau", petCoat: "siames" } });
  ok(mig.pet.name === "Mingau" && mig.pet.coat === "siames", "nome/pelagem migram de settings pro pet");
  ok(mig.settings.petName === undefined && mig.settings.petCoat === undefined, "campos antigos saem de settings");
  ok(mergeWithDefaults({ settings: { petName: "Velho" }, pet: { name: "Novo" } }).pet.name === "Novo", "pet existente ganha do settings legado");
}

console.log("=== catálogo ===");
ok(PET_ALL_ITEMS.length === Object.keys(PET_ITEM_BY_ID).length, "nenhum id duplicado no catálogo inteiro");
ok(PET_ALL_ITEMS.length === PET_ITEMS.length + PET_PAID_ITEMS.length, `catálogo unificado: ${PET_ALL_ITEMS.length} itens`);
ok(PET_ALL_ITEMS.every((i) => PET_SLOTS.some((s) => s.id === i.slot)), "todo item tem slot válido");
ok(PET_ITEMS.every((i) => i.price > 0 && i.minLevel >= 1 && i.name && i.desc && i.source === "xp"), "item de XP tem preço, nível, nome, descrição e source");
ok(PET_PAID_ITEMS.every((i) => i.source === "brl" && i.price === 0), "item pago é source brl e não tem preço em XP");
ok(PET_PAID_ITEMS.every((i) => i.pack && PET_PACKS.some((p) => p.id === i.pack)), "todo item pago aponta pra um pack existente");
ok(PET_PAID_ITEMS.every((i) => i.minLevel === 1), "item pago não tem trava de nível (você pagou)");
ok(!PET_PAID_ITEMS.some((i) => ["crown", "wings", "halo"].includes(i.id)), "coroa/asas/auréola seguem exclusivas de XP (dinheiro compra largura, XP compra prestígio)");
for (const sl of PET_SLOTS) ok(PET_ALL_ITEMS.filter((i) => i.slot === sl.id).length >= 3, `slot ${sl.id}: ${PET_ALL_ITEMS.filter((i) => i.slot === sl.id).length} itens`);
for (const p of PET_PACKS) {
  ok(p.items.every((id) => PET_ITEM_BY_ID[id]), `pack ${p.id}: todos os itens existem`);
  ok(p.items.every((id) => petItemIsPaid(id)), `pack ${p.id}: só itens pagos`);
  ok(new Set(p.items.map((id) => PET_ITEM_BY_ID[id].slot)).size === p.items.length, `pack ${p.id}: um item por slot (as peças não se cobrem)`);
  ok(p.priceBRL > 0 && p.name && p.desc, `pack ${p.id}: preço, nome e descrição`);
}

console.log(
  `\n${PET_ITEMS.length} itens de XP (${PET_ITEMS.reduce((a, i) => a + i.price, 0)} XP pra ter todos) · ` +
    `${PET_PACKS.length} packs pagos com ${PET_PAID_ITEMS.length} itens (R$ ${PET_PACKS.reduce((a, p) => a + p.priceBRL, 0).toFixed(2)})`,
);
console.log(fail ? `${fail} FALHA(S)` : "todas as checagens passaram");
process.exit(fail ? 1 : 0);
