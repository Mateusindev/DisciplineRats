// Gera o par de chaves VAPID do push (rode: bun run scripts/gen-vapid.mjs).
//
// VAPID é só um par ECDSA P-256: o serviço de push do navegador usa a chave
// pública pra confirmar que quem mandou a notificação foi o seu servidor.
//
// Sai em dois formatos porque cada lado quer um:
//   · JWK           → secrets da Edge Function (@negrel/webpush importa assim)
//   · base64url     → NEXT_PUBLIC_VAPID_PUBLIC_KEY, que o navegador passa em
//                     applicationServerKey (formato "raw": 0x04 || x || y)
//
// Grava em vapid.json, que está no .gitignore. A chave PRIVADA nunca vai pro
// cliente nem pro git — quem a tiver pode mandar notificação como se fosse você.

import { writeFileSync, existsSync } from "node:fs";

const OUT = "vapid.json";
if (existsSync(OUT)) {
  console.error(`✗ ${OUT} já existe. Apague antes se quiser gerar outro par.`);
  console.error("  Trocar as chaves invalida as assinaturas dos aparelhos já registrados.");
  process.exit(1);
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);

const pubJwk = await crypto.subtle.exportKey("jwk", publicKey);
const privJwk = await crypto.subtle.exportKey("jwk", privateKey);
const raw = await crypto.subtle.exportKey("raw", publicKey); // 65 bytes: 0x04 || x || y
const appServerKey = b64url(raw);

writeFileSync(OUT, JSON.stringify({ publicKey: pubJwk, privateKey: privJwk, applicationServerKey: appServerKey }, null, 2));

console.log(`✓ ${OUT} criado (fora do git)\n`);
console.log("1) .env.local do Next — chave PÚBLICA, pode ir pro navegador:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${appServerKey}\n`);
console.log("2) Secrets da Edge Function — a privada NUNCA sai daqui:\n");
console.log(`VAPID_PUBLIC_KEY=${JSON.stringify(pubJwk)}`);
console.log(`VAPID_PRIVATE_KEY=${JSON.stringify(privJwk)}`);
console.log(`VAPID_SUBJECT=mailto:seu@email.com`);
