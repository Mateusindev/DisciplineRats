// Preço dos packs, do lado do SERVIDOR.
//
// Existe duplicado (o cliente tem o mesmo em `PET_PACKS`, em lib/state.js) porque a
// função Edge roda em Deno e não importa o bundle do Next. A duplicação é
// deliberada, e o cliente é o lado que NÃO manda: quem cobra é aqui. Se o preço
// viesse do navegador, o preço seria zero na primeira vez que alguém abrisse o
// devtools.
//
// A regra que mantém os dois em dia: o teste em scripts/check-pack-prices.mjs lê
// ESTE arquivo com regex e compara com PET_PACKS. Divergiu, o teste quebra.
export const PACKS: Record<string, { priceBRL: number; title: string }> = {
  inverno: { priceBRL: 9.9, title: "Pack Inverno — Discipline Rats" },
  espaco: { priceBRL: 12.9, title: "Pack Espaço — Discipline Rats" },
  rock: { priceBRL: 9.9, title: "Pack Rockstar — Discipline Rats" },
};

// Tolerância de centavo na conferência do valor pago. Existe porque o gateway
// devolve float, e comparar float por igualdade é como perder dinheiro de graça.
export const CENT = 0.01;
