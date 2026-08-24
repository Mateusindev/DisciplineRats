// Regras da lojinha do mascote que NÃO dá pra ver na tela: XP só faz crescer, a
// fronteira de confiança entre item grátis (todos) e item pago (só com entitlement do
// servidor), e a sanidade do catálogo.
//
//   bun scripts/check-pet-shop.mjs
//
// O par deste script é scripts/check-item-prices.mjs, que garante que o catálogo da
// tela e o da cobrança não divergem.

import {
  normalizePet,
  defaultPet,
  togglePetGear,
  petOwns,
  mergeWithDefaults,
  gamify,
  xpToReachLevel,
  petGrowth,
  petStage,
  petItemIsPaid,
  petPriceLabel,
  PET_ITEMS,
  PET_PAID_ITEMS,
  PET_FREE_ITEMS,
  PET_ITEM_BY_ID,
  PET_ITEM_PRICE,
  PET_SLOTS,
  PET_STAGES,
} from "../lib/state.js";

let fail = 0;
const ok = (c, m) => {
  console.log(`${c ? "ok  " : "FALHA"} ${m}`);
  if (!c) fail++;
};
const st = (xp, pet, ents) => ({ stats: { xp, streak: 0 }, pet: pet || defaultPet(), entitlements: ents || [] });

console.log("=== XP faz UMA coisa: crescer ===");
ok(!("owned" in defaultPet()) && !("spent" in defaultPet()), "pet não tem mais lista de comprados nem saldo gasto");
ok(petStage(1).name === "FILHOTE" && petStage(15).name === "LENDÁRIO", "degraus de crescimento seguem no XP");
{
  // nada no app tira XP: os degraus só dependem do total, e o total só sobe
  const antes = petGrowth({ xp: 5000 });
  const depois = petGrowth({ xp: 5000 });
  ok(antes.pct === depois.pct && antes.cur.name === depois.cur.name, "crescimento é função pura do XP total");
  ok(petGrowth({ xp: 999999 }).next === null && petGrowth({ xp: 999999 }).pct === 100, "último degrau não mente");
  ok(gamify({ xp: xpToReachLevel(6) }).level === 6, "xpToReachLevel casa com gamify");
}

console.log("=== fronteira de confiança ===");
ok(PET_FREE_ITEMS.length === PET_SLOTS.length, `um item grátis por categoria (${PET_FREE_ITEMS.length} grátis, ${PET_SLOTS.length} categorias)`);
for (const sl of PET_SLOTS) {
  const free = PET_ITEMS.filter((i) => i.slot === sl.id && i.source === "free");
  ok(free.length === 1, `categoria ${sl.id}: exatamente 1 grátis (${free.map((f) => f.id).join(",") || "nenhum"})`);
}
ok(PET_FREE_ITEMS.every((i) => petOwns(st(0, null, []), i.id)), "grátis é de todos, mesmo com zero XP e zero compras");
ok(PET_PAID_ITEMS.every((i) => !petOwns(st(999999, null, []), i.id)), "pago não é de ninguém sem entitlement, nem com XP infinito");
ok(petOwns(st(0, null, ["crown"]), "crown"), "entitlement do item libera aquele item");
ok(!petOwns(st(0, null, ["crown"]), "tophat"), "entitlement de um item não libera outro");
ok(!petOwns(st(0, null, ["nao_existe"]), "crown"), "entitlement de id inexistente não libera nada");

{
  // o vetor de fraude que existia: escrever no próprio profiles. Agora não há campo.
  const forjado = { ...defaultPet(), owned: ["crown", "helmet"], spent: -999, gear: { head: "crown" } };
  const limpo = normalizePet(forjado, null, []);
  ok(!("owned" in limpo) && !("spent" in limpo), "owned/spent forjados são DESCARTADOS pelo normalizador");
  ok(!limpo.gear.head, "pago equipado sem entitlement é desequipado");
  const comEnt = normalizePet({ ...defaultPet(), gear: { head: "crown" } }, null, ["crown"]);
  ok(comEnt.gear.head === "crown", "com entitlement, o pago fica vestido");
  const gratis = normalizePet({ ...defaultPet(), gear: { head: "beanie" } }, null, []);
  ok(gratis.gear.head === "beanie", "grátis fica vestido sem nada");
}

console.log("=== equipar ===");
{
  const semEnt = st(0);
  ok(togglePetGear(semEnt, "crown") === semEnt, "não veste pago sem entitlement");
  const v = togglePetGear(st(0, null, ["crown"]), "crown");
  ok(v.pet.gear.head === "crown", "veste pago com entitlement");
  ok(togglePetGear(v, "crown").pet.gear.head === undefined, "e tira no segundo clique");
  let dois = togglePetGear(st(0), "bell"); // grátis
  dois = togglePetGear(dois, "bandana"); // pago sem entitlement
  ok(dois.pet.gear.neck === "bell", "item pago sem entitlement não rouba o slot do grátis");
  const trocado = togglePetGear(st(0, dois.pet, ["bandana"]), "bandana");
  ok(trocado.pet.gear.neck === "bandana", "com entitlement, o segundo item do slot substitui o primeiro");
}

console.log("=== merge/carga ===");
{
  const m = mergeWithDefaults({ entitlements: ["crown", "crown", "beanie", "id_falso"] });
  ok(m.entitlements.length === 1 && m.entitlements[0] === "crown", "merge dedup, e descarta grátis e id inexistente da lista de entitlements");
  ok(Array.isArray(mergeWithDefaults({}).entitlements), "entitlements sempre array");
  const mig = mergeWithDefaults({ settings: { petName: "Mingau", petCoat: "siames" } });
  ok(mig.pet.name === "Mingau" && mig.pet.coat === "siames", "nome/pelagem migram de settings pro pet");
  ok(mig.settings.petName === undefined, "campo antigo sai de settings");
  ok(JSON.stringify(Object.keys(mig.pet)) === '["name","coat","gear"]', "ordem de chaves do pet estável (diff-sync)");
  ok(JSON.stringify(normalizePet(mig.pet, null, [])) === JSON.stringify(mig.pet), "normalizador idempotente");
}

console.log("=== catálogo ===");
ok(PET_ITEMS.length === Object.keys(PET_ITEM_BY_ID).length, "nenhum id duplicado");
ok(!PET_SLOTS.some((s) => s.id === "back"), "categoria de costas foi removida");
ok(!PET_ITEMS.some((i) => ["backpack", "cape", "wings", "jetpack", "guitar"].includes(i.id)), "itens de costas foram removidos do catálogo");
ok(PET_ITEMS.every((i) => PET_SLOTS.some((s) => s.id === i.slot)), "todo item tem categoria válida");
ok(PET_ITEMS.every((i) => i.source === "free" || i.source === "brl"), "todo item é grátis ou pago — não há terceiro estado");
ok(PET_ITEMS.every((i) => i.name && i.desc), "todo item tem nome e descrição");
ok(!PET_ITEMS.some((i) => "minLevel" in i || "price" in i), "item não carrega trava de nível nem preço próprio (preço é único)");
ok(PET_PAID_ITEMS.every((i) => petItemIsPaid(i.id)) && PET_FREE_ITEMS.every((i) => !petItemIsPaid(i.id)), "petItemIsPaid concorda com source");
ok(PET_ITEM_PRICE > 0, `preço único: ${petPriceLabel()}`);
ok(petPriceLabel() === "R$ 0,99", "rótulo de preço em pt-BR");
for (const sl of PET_SLOTS) {
  const n = PET_ITEMS.filter((i) => i.slot === sl.id).length;
  ok(n >= 4, `categoria ${sl.id}: ${n} itens`);
}
ok(PET_STAGES.length === 5, "5 degraus de crescimento");

console.log(
  `\n${PET_SLOTS.length} categorias · ${PET_FREE_ITEMS.length} grátis · ${PET_PAID_ITEMS.length} pagos a ${petPriceLabel()} ` +
    `(${petPriceLabel(PET_PAID_ITEMS.length * PET_ITEM_PRICE)} por tudo)`,
);
console.log(fail ? `${fail} FALHA(S)` : "todas as checagens passaram");
process.exit(fail ? 1 : 0);
