// Gera app/favicon.ico com o triângulo da Vercel.
// Rode: bun run scripts/gen-favicon.mjs
//
// O .ico é montado à mão porque o sharp só exporta PNG — e ICO desde o Vista
// aceita PNG embutido, então é só o cabeçalho + os blocos. Três tamanhos: 16 e 32
// pra aba, 48 pro atalho de desktop.
//
// Isto NÃO mexe em public/icon.svg: aquele é o ícone do PWA (tela de início) e o
// das notificações. Trocar os dois de uma vez apagaria a identidade do app
// instalado no celular, que é outra coisa que o favicon da aba.

import sharp from "sharp";
import { writeFileSync } from "node:fs";

// Path oficial do triângulo da Vercel, verbatim — o viewBox dele é 1155x1000 e o
// desenho encosta nas quatro bordas.
const VERCEL_PATH = "m577.3 0 577.4 1000H0z";

// Favicon precisa de duas coisas que o SVG solto não tem:
//   · fundo sólido — triângulo branco em cima de transparente sumiria na aba do
//     tema claro, e preto vazado sumiria no escuro;
//   · folga e canvas quadrado — encostando na borda o desenho fica apertado, e
//     1155x1000 esticaria pra caber num ícone quadrado.
// Daí o translate/scale: o path não é tocado, só posicionado.
const S = 0.78; // escala (folga de ~11% de cada lado)
const TX = (1155 - 1155 * S) / 2;
const TY = (1155 - 1000 * S) / 2;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1155 1155">
  <rect width="1155" height="1155" fill="#000000"/>
  <g transform="translate(${TX} ${TY}) scale(${S})">
    <path d="${VERCEL_PATH}" fill="#ffffff"/>
  </g>
</svg>`;

const SIZES = [16, 32, 48];
const pngs = await Promise.all(SIZES.map((s) => sharp(Buffer.from(SVG)).resize(s, s).png().toBuffer()));

// ICONDIR: reservado(2) + tipo 1 = ícone(2) + quantidade(2)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(SIZES.length, 4);

// cada ICONDIRENTRY tem 16 bytes; os dados vêm depois de todas as entradas
let offset = 6 + SIZES.length * 16;
const entries = SIZES.map((size, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size === 256 ? 0 : size, 0); // 0 significa 256 no formato
  e.writeUInt8(size === 256 ? 0 : size, 1);
  e.writeUInt8(0, 2); // paleta: 0 = sem paleta indexada
  e.writeUInt8(0, 3); // reservado
  e.writeUInt16LE(1, 4); // planos de cor
  e.writeUInt16LE(32, 6); // bits por pixel
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});

writeFileSync("app/favicon.ico", Buffer.concat([header, ...entries, ...pngs]));
console.log(`✓ app/favicon.ico — ${SIZES.join("/")}px, ${(offset / 1024).toFixed(1)} kB`);
