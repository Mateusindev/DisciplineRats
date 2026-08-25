// Preço e catálogo vendável, do lado do SERVIDOR.
//
// Existe duplicado (o cliente tem os mesmos ids em `PET_ITEMS`, em lib/state.js)
// porque a função Edge roda em Deno e não importa o bundle do Next. A duplicação é
// deliberada, e o cliente é o lado que NÃO manda: quem cobra é aqui. Se o preço
// viesse do navegador, o preço seria zero na primeira vez que alguém abrisse o
// devtools.
//
// A regra que mantém os dois em dia: scripts/check-item-prices.mjs lê ESTE arquivo
// com regex e compara com PET_ITEMS. Divergiu, `bun run check:pet` quebra.

// Preço único de qualquer coisa vendável, em reais. Espécie custa o mesmo que uma
// bandana de propósito: preço único é o que dispensa o usuário de comparar valores.
export const ITEM_PRICE = 0.99;

// Ids vendáveis. Item que não está aqui não gera cobrança — vale tanto pros grátis
// (que ninguém deveria pagar) quanto pra id inventado no request.
//
// ESPÉCIE ENTRA AQUI. Do ponto de vista da cobrança não há diferença entre virar
// rato e comprar um chapéu: mesma preferência, mesmo webhook, mesma linha em
// `pet_entitlements`. A distinção entre bicho e acessório é só do cliente, que
// precisa dela pra desenhar; o servidor não tem por que saber.
export const PAID_ITEMS = new Set([
  // espécie
  "rato",
  // cabeça
  "cap",
  "tophat",
  "halo",
  "crown",
  "ushanka",
  "helmet",
  // rosto
  "shades",
  "eyepatch",
  "monocle",
  "starshades",
  // pescoço
  "bandana",
  "bowtie",
  "scarf",
  "plaid",
  "spikes",
  // brinquedo
  "fish",
  "mouse",
  "pillow",
  "cocoa",
  "rocket",
  // cenário
  "window",
  "shelf",
  "night",
  "snow",
  "space",
  "stage",
]);

// Tolerância de centavo na conferência do valor pago. Existe porque o gateway
// devolve float, e comparar float por igualdade é perder dinheiro de graça.
export const CENT = 0.01;
