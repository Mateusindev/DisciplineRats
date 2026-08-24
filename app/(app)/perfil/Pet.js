"use client";

// ============================================================================
// MASCOTE — um gato que cresce com o XP, se veste na lojinha e mora no perfil.
//
// SVG paramétrico, não sprite. Três razões: (1) não existe asset externo pra
// carregar — o app é auto-contido e a CSP não deixaria; (2) o mesmo desenho serve
// os cinco tamanhos só mudando números, então "crescer" muda PROPORÇÃO (filhote
// tem cabeça grande) e não só escala, que pareceria zoom; (3) acessório é código,
// então o MESMO desenho serve pro gato e pra vitrine da loja — a peça que aparece
// no card é a peça que vai pro bicho, não uma ilustração parecida que envelhece.
//
// A ordem de desenho não é detalhe: costas ANTES do corpo (fica atrás), e
// cabeça/rosto/pescoço DEPOIS da cabeça e DENTRO do grupo dela, pra herdarem o
// `headScale` — assim o chapéu do filhote é grande junto com a cabeça dele, de
// graça. Brinquedo e cenário NÃO moram no gato: são do cercado, senão o novelo
// sairia andando junto quando ele passeia.
//
// Quem pede menos movimento (prefers-reduced-motion) recebe um gato parado: as
// keyframes morrem no CSS e a vagabundagem nem começa aqui.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, inputCls } from "@/components/ui";
import {
  fmtK,
  gamify,
  petGrowth,
  petCoat,
  petBalance,
  buyPetItem,
  togglePetGear,
  defaultPet,
  PET_STAGES,
  PET_COATS,
  PET_SLOTS,
  PET_ITEMS,
  PET_ITEM_BY_ID,
  PET_NAME_LEN,
} from "@/lib/state";

// Cor de tecido, igual à pelagem: hex fixo, não token de tema. Gorro vermelho é
// vermelho nos dois temas — acessório é objeto, não interface.
const T = {
  wool: "#c2543f",
  woolDark: "#a8422f",
  denim: "#46679b",
  denimDark: "#37527c",
  gold: "#e6c04c",
  goldDark: "#b8952f",
  ink: "#2f3540",
  cloth: "#f2f4f8",
  leaf: "#5c8a52",
  leafDark: "#4a7042",
  plum: "#7b4f9d",
  plumDark: "#5e3a79",
  sky: "#8fc3e8",
  skyDark: "#5fa3d0",
  wood: "#8b6b45",
  mouse: "#a9b0bd",
};

// ---------------------------------------------------------------- acessórios
// Cada um em coordenadas LOCAIS do grupo onde entra, então nenhum precisa saber o
// tamanho do gato.

// cabeça e rosto: origem = centro da cabeça, raio 16, olhos em (-6,-1) e (6,-2)
function HeadGear({ id }) {
  switch (id) {
    case "beanie":
      return (
        <g>
          <path d="M-14.5 -7 a14.5 14.5 0 0 1 29 0 z" fill={T.wool} />
          <rect x="-15.5" y="-8.5" width="31" height="5" rx="2.5" fill={T.woolDark} />
          <circle cx="0" cy="-23" r="3.4" fill={T.cloth} />
          <rect x="-1.4" y="-22.5" width="2.8" height="3.5" fill={T.wool} />
        </g>
      );
    case "cap":
      return (
        <g>
          <path d="M-14 -8 a14 14 0 0 1 28 0 z" fill={T.denim} />
          <path d="M-13 -8 h-12 q-2.5 3.5 1 5.4 h12 z" fill={T.denimDark} />
          <circle cx="0" cy="-21.6" r="1.9" fill={T.denimDark} />
        </g>
      );
    case "tophat":
      return (
        <g>
          <rect x="-9" y="-31" width="18" height="19" rx="1.6" fill={T.ink} />
          <rect x="-9" y="-17" width="18" height="4.4" fill={T.wool} />
          <ellipse cx="0" cy="-12" rx="15.5" ry="3.6" fill={T.ink} />
        </g>
      );
    case "halo":
      return <ellipse cx="0" cy="-27" rx="11" ry="3.6" fill="none" stroke={T.gold} strokeWidth="2.6" />;
    case "crown":
      return (
        <g>
          <path d="M-12 -13 l0 -10 l5.5 4.5 l3.5 -8.5 l3.5 8.5 l5.5 -4.5 l0 10 z" fill={T.gold} />
          <rect x="-12" y="-14.4" width="24" height="3.4" rx="1.2" fill={T.goldDark} />
          <circle cx="0" cy="-17" r="1.7" fill={T.wool} />
        </g>
      );
    default:
      return null;
  }
}

function FaceGear({ id }) {
  switch (id) {
    case "glasses":
      return (
        <g fill="none" stroke={T.ink} strokeWidth="1.5">
          <circle cx="-6" cy="-1" r="5" />
          <circle cx="6.5" cy="-1.5" r="5.4" />
          <path d="M-1 -1.2 h2" />
          <path d="M-11 -1.6 l-4 -1.6" />
        </g>
      );
    case "shades":
      return (
        <g>
          <rect x="-11.4" y="-5.2" width="10.4" height="8.4" rx="3" fill={T.ink} />
          <rect x="1.2" y="-6" width="11" height="9" rx="3" fill={T.ink} />
          <path d="M-1.2 -2.4 h2.6" stroke={T.ink} strokeWidth="1.6" />
          <path d="M-11.6 -4 l-3.6 -1.4" stroke={T.ink} strokeWidth="1.4" />
        </g>
      );
    case "eyepatch":
      return (
        <g>
          <path d="M-15.5 -6 l31 2.4" stroke={T.ink} strokeWidth="1.4" />
          <ellipse cx="6.5" cy="-1.8" rx="5.6" ry="5" fill={T.ink} />
        </g>
      );
    case "monocle":
      return (
        <g fill="none" stroke={T.gold} strokeWidth="1.6">
          <circle cx="6.5" cy="-1.8" r="6" />
          <path d="M6.5 4.4 q-2 6 -7 7.6" strokeWidth="1" />
        </g>
      );
    default:
      return null;
  }
}

// pescoço: base da cabeça, onde vive a coleira dos degraus altos
function NeckGear({ id }) {
  switch (id) {
    case "bell":
      return (
        <g>
          <path d="M-13 11 Q-1 19 12 9" stroke={T.wool} strokeWidth="3.6" strokeLinecap="round" fill="none" />
          <circle cx="0" cy="16.6" r="2.8" fill={T.gold} />
          <path d="M-2 16.6 h4" stroke={T.goldDark} strokeWidth="0.9" />
        </g>
      );
    case "bandana":
      return (
        <g>
          <path d="M-13 11 Q-1 19 12 9" stroke={T.wool} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M-9 13.6 Q0 18.6 9 12 L0 27 Z" fill={T.wool} />
          <circle cx="-3" cy="17.5" r="0.9" fill={T.cloth} />
          <circle cx="3" cy="19.5" r="0.9" fill={T.cloth} />
        </g>
      );
    case "bowtie":
      return (
        <g>
          <path d="M-13 11 Q-1 19 12 9" stroke={T.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M-1 15.6 l-8 -4.4 l0 9 z" fill={T.plum} />
          <path d="M1 15.6 l8 -4.6 l0 9 z" fill={T.plum} />
          <circle cx="0" cy="15.8" r="1.9" fill={T.plumDark} />
        </g>
      );
    case "scarf":
      return (
        <g>
          <path d="M-13.5 10 Q-1 20 12.5 8" stroke={T.leaf} strokeWidth="5.4" fill="none" strokeLinecap="round" />
          <path d="M-6 16 q-3 9 -1 16 l6 1 q-1 -9 1 -15 z" fill={T.leaf} />
          <path d="M-6 24 h6" stroke={T.leafDark} strokeWidth="1.2" />
        </g>
      );
    default:
      return null;
  }
}

// costas: coordenadas do CORPO (ellipse cx 56, cy 56+dy). Desenhado ANTES do
// corpo, então nasce do dorso em vez de flutuar na frente dele.
function BackGear({ id, dy = 0 }) {
  switch (id) {
    case "backpack":
      return (
        <g transform={`translate(0,${dy})`}>
          <rect x="40" y="38" width="21" height="18" rx="5" fill={T.denim} />
          <rect x="44" y="41" width="13" height="7" rx="3" fill={T.denimDark} />
          <path d="M61 44 q7 2 8 8" stroke={T.denimDark} strokeWidth="2.4" fill="none" />
        </g>
      );
    case "cape":
      return (
        <g transform={`translate(0,${dy})`}>
          <path d="M70 42 q-30 -2 -44 14 q16 8 34 4 q10 -8 10 -18 z" fill={T.plum} opacity="0.92" />
          <path d="M70 42 q-8 6 -10 14" stroke={T.plumDark} strokeWidth="1.6" fill="none" />
        </g>
      );
    case "wings":
      return (
        <g transform={`translate(0,${dy})`} fill={T.cloth}>
          <path d="M56 42 q-16 -20 -30 -16 q4 16 22 20 z" />
          <path d="M58 42 q-8 -22 4 -26 q8 14 2 26 z" opacity="0.8" />
        </g>
      );
    default:
      return null;
  }
}

// brinquedo: fica no chão do cercado
function Toy({ id }) {
  if (!id) return null;
  return (
    <svg viewBox="0 0 40 32" className="block h-8" aria-hidden="true">
      {id === "yarn" && (
        <g>
          <circle cx="20" cy="20" r="11" fill={T.wool} />
          <g stroke={T.woolDark} strokeWidth="1.2" fill="none">
            <path d="M11 16 q9 6 18 1" />
            <path d="M12 24 q8 -7 17 -3" />
            <path d="M20 9 q-6 10 -1 22" />
          </g>
          <path d="M31 18 q7 -3 6 -9" stroke={T.wool} strokeWidth="1.6" fill="none" />
        </g>
      )}
      {id === "fish" && (
        <g>
          <ellipse cx="21" cy="21" rx="12" ry="7.5" fill={T.sky} />
          <path d="M33 21 l7 -6 l0 12 z" fill={T.skyDark} />
          <circle cx="15" cy="19" r="1.6" fill={T.ink} />
          <path d="M22 14.5 q3 3 0 6" stroke={T.skyDark} strokeWidth="1.2" fill="none" />
        </g>
      )}
      {id === "mouse" && (
        <g>
          <ellipse cx="19" cy="22" rx="11" ry="7" fill={T.mouse} />
          <circle cx="11" cy="17.5" r="3.6" fill="#c2c8d3" />
          <circle cx="8.5" cy="22" r="1.3" fill={T.ink} />
          <path d="M30 22 q8 1 7 -7" stroke={T.mouse} strokeWidth="1.6" fill="none" />
        </g>
      )}
      {id === "pillow" && (
        <g>
          <rect x="5" y="12" width="30" height="17" rx="6" fill={T.plum} />
          <path d="M10 20 q10 4 20 0" stroke={T.plumDark} strokeWidth="1.4" fill="none" />
        </g>
      )}
    </svg>
  );
}

// cenário: fundo do cercado. preserveAspectRatio none porque ele DEVE esticar até
// as bordas — é papel de parede, não figura.
function Scene({ id }) {
  if (!id) return null;
  return (
    <svg viewBox="0 0 120 64" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      {id === "rug" && <ellipse cx="60" cy="60" rx="46" ry="7" fill={T.wool} opacity="0.45" />}
      {id === "window" && (
        <g>
          <rect x="34" y="6" width="52" height="38" rx="3" fill={T.sky} opacity="0.55" />
          <g stroke={T.wood} strokeWidth="2.6" fill="none">
            <rect x="34" y="6" width="52" height="38" rx="3" />
            <path d="M60 6 v38" />
            <path d="M34 25 h52" />
          </g>
          <circle cx="72" cy="16" r="1.8" fill={T.ink} opacity="0.5" />
        </g>
      )}
      {id === "shelf" && (
        <g>
          <rect x="16" y="20" width="88" height="3.4" rx="1.6" fill={T.wood} />
          <rect x="22" y="8" width="5" height="12" fill={T.wool} />
          <rect x="28" y="6" width="5" height="14" fill={T.leaf} />
          <rect x="34" y="9" width="4" height="11" fill={T.denim} />
          <rect x="86" y="7" width="6" height="13" fill={T.plum} />
        </g>
      )}
      {id === "night" && (
        <g>
          <rect x="0" y="0" width="120" height="64" fill="#141d33" opacity="0.72" />
          <circle cx="96" cy="14" r="8" fill="#f0e2a8" opacity="0.9" />
          <circle cx="92" cy="12" r="7" fill="#141d33" opacity="0.72" />
          <g fill="#f4f0d8" opacity="0.85">
            {[
              [16, 12],
              [30, 24],
              [48, 9],
              [62, 20],
              [74, 30],
              [24, 38],
              [104, 34],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" />
            ))}
          </g>
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------- o gato

function Cat({ stage, coat, act, gear }) {
  const c = coat;
  const low = act === "sit" || act === "sleep"; // sentado: corpo desce, patas dobram
  const walking = act === "walk";
  const happy = act === "happy";
  const sleeping = act === "sleep";
  const tip = c.points ? c.dark : c.fur; // siamês: extremidades escuras
  const dy = low ? 5 : 0;
  // a coleira automática dos degraus altos sai de cena quando há acessório de
  // pescoço: dois colares no mesmo pescoço é bug, não estilo
  const stageCollar = stage.collar && !gear.neck;

  return (
    <svg viewBox="0 0 120 92" style={{ height: stage.size }} className="block overflow-visible" aria-hidden="true">
      {/* sombra no chão: encolhe junto com o corpo quando ele senta */}
      <ellipse cx="58" cy="84" rx={low ? 25 : 28} ry="3.6" fill="var(--color-outline)" opacity="0.28" />

      {/* rabo — o <g> de fora carrega o translate (atributo), o de dentro a
          animação (CSS). Juntos no mesmo <g>, o CSS apagaria o translate. */}
      <g transform={`translate(31,${57 + dy})`}>
        <g className={`pet-tail ${walking || happy ? "pet-tail-fast" : ""}`}>
          <path d="M0 0 C-15 -3 -21 -19 -10 -29" stroke={tip} strokeWidth="7" strokeLinecap="round" fill="none" />
        </g>
      </g>

      <g className={walking ? "pet-step" : undefined}>
        <BackGear id={gear.back} dy={dy} />

        {/* patas de trás */}
        {low ? (
          <g>
            <rect x="34" y="75" width="10" height="8" rx="4" fill={tip} />
            <rect x="44" y="76" width="10" height="7" rx="3.5" fill={c.dark} opacity="0.5" />
          </g>
        ) : (
          <>
            <g transform="translate(46,66)">
              <g className={walking ? "pet-leg pet-leg-b" : undefined}>
                <rect x="-4" y="0" width="8" height="16" rx="4" fill={c.dark} opacity="0.75" />
              </g>
            </g>
            <g transform="translate(37,66)">
              <g className={walking ? "pet-leg" : undefined}>
                <rect x="-4.5" y="0" width="9" height="17" rx="4.5" fill={tip} />
              </g>
            </g>
          </>
        )}

        {/* patas da frente */}
        {low ? (
          <g>
            <rect x="70" y="76" width="11" height="7" rx="3.5" fill={c.dark} opacity="0.5" />
            <rect x="76" y="75" width="11" height="8" rx="4" fill={tip} />
          </g>
        ) : (
          <>
            <g transform="translate(70,66)">
              <g className={walking ? "pet-leg" : undefined}>
                <rect x="-4" y="0" width="8" height="16" rx="4" fill={c.dark} opacity="0.75" />
              </g>
            </g>
            <g transform="translate(78,66)">
              <g className={walking ? "pet-leg pet-leg-b" : undefined}>
                <rect x="-4.5" y="0" width="9" height="17" rx="4.5" fill={tip} />
              </g>
            </g>
          </>
        )}

        {/* corpo */}
        <g className="pet-breathe">
          <ellipse cx="56" cy={56 + dy} rx="28" ry={low ? 19 : 17} fill={c.fur} />
          <ellipse cx="59" cy={64 + dy} rx="20" ry="8" fill={c.belly} opacity="0.85" />
          {c.stripes && (
            <g stroke={c.dark} strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.8">
              <path d={`M44 ${43 + dy} q3 5 1 9`} />
              <path d={`M53 ${41 + dy} q3 5 1 10`} />
              <path d={`M62 ${41 + dy} q3 5 1 10`} />
            </g>
          )}
        </g>

        {/* cabeça: o scale da proporção vive no atributo, a animação nos filhos.
            Acessório de cabeça/rosto/pescoço entra aqui e herda o scale. */}
        <g transform={`translate(87,${37 + dy}) scale(${stage.headScale})`}>
          {stage.fluff && <ellipse cx="-2" cy="4" rx="19" ry="15" fill={c.fur} opacity="0.5" />}

          {/* orelhas */}
          <path d="M-15 -7 L-19 -23 L-4 -14 Z" fill={tip} />
          <path d="M1 -14 L9 -25 L15 -7 Z" fill={tip} />
          <path d="M-13.5 -9.5 L-16 -19 L-6.5 -13.5 Z" fill={c.ear} />
          <path d="M3 -13 L8.5 -21 L13 -9 Z" fill={c.ear} />

          <circle r="16" fill={c.fur} />
          {c.stripes && (
            <g stroke={c.dark} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75">
              <path d="M-6 -13 l1.5 5" />
              <path d="M0 -14.5 l0 5" />
              <path d="M6 -13.5 l-1 5" />
            </g>
          )}

          {/* olhos: fechados felizes viram arco, dormindo viram traço */}
          {happy ? (
            <g stroke={c.eye} strokeWidth="1.8" strokeLinecap="round" fill="none">
              <path d="M-9 -2 q3 -4 6 0" />
              <path d="M3 -2 q3 -4 6 0" />
            </g>
          ) : sleeping ? (
            <g stroke={c.eye} strokeWidth="1.6" strokeLinecap="round" fill="none">
              <path d="M-9 -1 h6" />
              <path d="M3 -1 h6" />
            </g>
          ) : (
            <g className="pet-blink">
              <ellipse cx="-6" cy="-1" rx="2.7" ry="3.7" fill={c.eye} />
              <ellipse cx="6" cy="-2" rx="3.5" ry="4.3" fill={c.eye} />
              <circle cx="-5.2" cy="-2.4" r="0.9" fill="#fff" opacity="0.8" />
              <circle cx="7.1" cy="-3.5" r="1.1" fill="#fff" opacity="0.85" />
            </g>
          )}

          {/* focinho, nariz, boca */}
          <ellipse cx="10" cy="5.5" rx="7.5" ry="5.5" fill={c.belly} opacity="0.95" />
          <path d="M13.6 2.6 h4.4 l-2.2 2.8 z" fill={c.ear} />
          <path d="M15.8 5.6 q-1.6 2.8 -4.2 1.4" stroke={c.dark} strokeWidth="1" strokeLinecap="round" fill="none" />
          <g stroke={c.belly} strokeWidth="0.9" strokeLinecap="round" opacity="0.75">
            <path d="M17 4.5 l9 -2.4" />
            <path d="M17 6.5 l9 0.8" />
            <path d="M16.5 8 l8 3.4" />
          </g>

          <FaceGear id={gear.face} />
          {stageCollar && (
            <>
              <path d="M-13 11 Q-1 19 12 9" stroke="var(--color-primary-container)" strokeWidth="3.6" strokeLinecap="round" fill="none" />
              <circle cx="0" cy="16.4" r="2.6" fill="var(--color-badge)" />
            </>
          )}
          <NeckGear id={gear.neck} />
          <HeadGear id={gear.head} />
        </g>
      </g>

      {sleeping && (
        <g className="pet-zzz">
          <text x="102" y="24" fontSize="11" fontWeight="700" fill="var(--color-outline)">
            z
          </text>
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------- vitrine

// A peça do card é a MESMA que vai pro gato: o preview só monta uma cabeça (ou um
// dorso) de mentira em volta pra dar contexto. Ilustração separada por item seria
// uma segunda verdade pra manter em dia.
function GearPreview({ item, coat }) {
  const c = coat;
  const tip = c.points ? c.dark : c.fur;
  if (item.slot === "toy")
    return (
      <div className="grid h-16 place-items-center">
        <Toy id={item.id} />
      </div>
    );
  if (item.slot === "scene")
    return (
      <div className="relative h-16 overflow-hidden rounded-lg bg-surface-container-high">
        <Scene id={item.id} />
      </div>
    );
  if (item.slot === "back")
    return (
      <svg viewBox="20 26 62 40" className="h-16 w-full" aria-hidden="true">
        <BackGear id={item.id} />
        <ellipse cx="56" cy="56" rx="28" ry="17" fill={c.fur} />
        <ellipse cx="59" cy="64" rx="20" ry="8" fill={c.belly} opacity="0.85" />
      </svg>
    );
  return (
    <svg viewBox="-26 -34 52 62" className="h-16 w-full" aria-hidden="true">
      <path d="M-15 -7 L-19 -23 L-4 -14 Z" fill={tip} />
      <path d="M1 -14 L9 -25 L15 -7 Z" fill={tip} />
      <circle r="16" fill={c.fur} />
      <ellipse cx="-6" cy="-1" rx="2.7" ry="3.7" fill={c.eye} />
      <ellipse cx="6" cy="-2" rx="3.5" ry="4.3" fill={c.eye} />
      <ellipse cx="10" cy="5.5" rx="7.5" ry="5.5" fill={c.belly} opacity="0.95" />
      <path d="M13.6 2.6 h4.4 l-2.2 2.8 z" fill={c.ear} />
      <FaceGear id={item.slot === "face" ? item.id : null} />
      <NeckGear id={item.slot === "neck" ? item.id : null} />
      <HeadGear id={item.slot === "head" ? item.id : null} />
    </svg>
  );
}

function Shop({ pet, level, balance, coat, onBuy, onToggle, onClose }) {
  const [slot, setSlot] = useState(PET_SLOTS[0].id);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = PET_ITEMS.filter((i) => i.slot === slot);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto ff-scroll bg-black/40 backdrop-blur-sm p-4 py-8 animate-[fadeIn_.1s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Lojinha do mascote"
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-outline-variant bg-surface-container shadow-2xl shadow-black/25"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-outline-variant/50 p-4 sm:p-5">
          <MI name="storefront" className="text-primary-container text-3xl shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-headline-md text-headline-md text-primary uppercase">Lojinha</h3>
            {/* A frase existe porque a dúvida vem sempre: gastar não derruba nível
                nem tamanho. O total da vida fica intocado; a loja come de um saldo
                separado. */}
            <p className="text-[11px] text-on-surface-variant">
              Paga em XP livre. Comprar <strong className="text-on-surface">não</strong> abaixa seu nível nem encolhe o gato — o XP total fica intocado.
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="shrink-0 p-1 text-outline hover:text-on-surface transition">
            <MI name="close" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-outline-variant/50 px-4 sm:px-5 py-3">
          <span className="flex items-baseline gap-1.5">
            <span className="font-headline-md text-headline-md text-primary tabular-nums">{fmtK(balance)}</span>
            <Caps className="text-outline text-[10px]">XP LIVRE</Caps>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[13px] text-on-surface-variant tabular-nums">{fmtK(pet.spent || 0)}</span>
            <Caps className="text-outline text-[10px]">JÁ GASTO</Caps>
          </span>
          <span className="flex items-baseline gap-1.5 ml-auto">
            <span className="text-[13px] text-on-surface-variant tabular-nums">
              {pet.owned.length}/{PET_ITEMS.length}
            </span>
            <Caps className="text-outline text-[10px]">ITENS</Caps>
          </span>
        </div>

        <div className="flex gap-1 overflow-x-auto ff-scroll border-b border-outline-variant/50 px-4 sm:px-5 py-2">
          {PET_SLOTS.map((sl) => {
            const on = sl.id === slot;
            const all = PET_ITEMS.filter((i) => i.slot === sl.id);
            const have = all.filter((i) => pet.owned.includes(i.id)).length;
            return (
              <button
                key={sl.id}
                onClick={() => setSlot(sl.id)}
                aria-pressed={on}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-label-caps text-[10px] transition ${
                  on
                    ? "border-primary-container bg-primary-container/15 text-primary-container"
                    : "border-outline-variant text-on-surface-variant hover:border-outline"
                }`}
              >
                <MI name={sl.icon} className="text-base" />
                {sl.label}
                <span className="tabular-nums text-outline">
                  {have}/{all.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 sm:p-5">
          {items.map((item) => {
            const owned = pet.owned.includes(item.id);
            const worn = pet.gear?.[item.slot] === item.id;
            const locked = !owned && level < item.minLevel;
            const poor = !owned && !locked && balance < item.price;
            return (
              <div
                key={item.id}
                className={`flex flex-col rounded-xl border p-3 transition ${
                  worn ? "border-primary-container bg-primary-container/10" : "border-outline-variant/60 bg-surface-container-high/40"
                }`}
              >
                <div className={locked ? "opacity-40" : undefined}>
                  <GearPreview item={item} coat={coat} />
                </div>
                <div className="mt-2 min-w-0 flex-1">
                  <div className="text-[13px] leading-tight text-on-surface">{item.name}</div>
                  <div className="text-[10px] leading-tight text-outline">{item.desc}</div>
                </div>
                <div className="mt-2">
                  {owned ? (
                    <button
                      onClick={() => onToggle(item.id)}
                      className={`w-full rounded-lg py-1.5 font-label-caps text-[10px] transition active:scale-[.98] ${
                        worn
                          ? "bg-primary-container text-on-primary-container"
                          : "border border-primary-container/50 text-primary-container hover:bg-primary-container/10"
                      }`}
                    >
                      {worn ? "VESTIDO · TIRAR" : "VESTIR"}
                    </button>
                  ) : locked ? (
                    <div className="flex items-center justify-center gap-1 rounded-lg border border-outline-variant py-1.5 font-label-caps text-[10px] text-outline">
                      <MI name="lock" className="text-sm" /> NÍVEL {item.minLevel}
                    </div>
                  ) : (
                    <button
                      onClick={() => onBuy(item.id)}
                      disabled={poor}
                      title={poor ? `Faltam ${fmtK(item.price - balance)} XP livre` : `Comprar por ${item.price} XP`}
                      className={`w-full rounded-lg py-1.5 font-label-caps text-[10px] tabular-nums transition active:scale-[.98] ${
                        poor ? "border border-outline-variant text-outline" : "border border-primary text-primary hover:bg-primary/10"
                      }`}
                    >
                      {fmtK(item.price)} XP
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- o cercado

const WALK_MIN = 8; // % da largura — margem pra ele não colar nas paredes
const WALK_MAX = 88;

export default function Pet() {
  const { state, setState, toast } = useApp();
  const g = gamify(state.stats);
  const growth = petGrowth(state.stats);
  const stage = growth.cur;
  const pet = state.pet || defaultPet();
  const coat = petCoat(pet.coat);
  const gear = pet.gear || {};
  const name = (pet.name || "").trim();
  const balance = petBalance(state);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [shop, setShop] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [walk, setWalk] = useState({ act: "idle", x: 46, dir: 1, dur: 0 });
  const walkRef = useRef(walk);
  walkRef.current = walk;
  const timer = useRef(null);
  const heartId = useRef(0);

  // Máquina de estados da vagabundagem. Sorteia o que fazer, marca quanto tempo
  // aquilo dura e se agenda de novo. Andar devolve destino + duração, e é a duração
  // que vira a transição de `left` — o navegador interpola o passeio.
  const step = useCallback(() => {
    const cur = walkRef.current;
    const r = Math.random();
    let next;
    let wait;
    if (r < 0.5) {
      const x = WALK_MIN + Math.random() * (WALK_MAX - WALK_MIN);
      const dur = Math.max(700, Math.round(Math.abs(x - cur.x) * 62));
      next = { act: "walk", x, dir: x >= cur.x ? 1 : -1, dur };
      wait = dur + 150;
    } else if (r < 0.74) {
      next = { ...cur, act: "idle", dur: 0 };
      wait = 2400 + Math.random() * 2600;
    } else if (r < 0.92) {
      next = { ...cur, act: "sit", dur: 0 };
      wait = 3000 + Math.random() * 3500;
    } else {
      next = { ...cur, act: "sleep", dur: 0 };
      wait = 6000 + Math.random() * 7000;
    }
    setWalk(next);
    timer.current = setTimeout(step, wait);
  }, []);

  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still) return; // gato parado é o pedido; nem começa
    timer.current = setTimeout(step, 1200);
    return () => clearTimeout(timer.current);
  }, [step]);

  // carinho: interrompe o que ele estava fazendo, ele fica feliz e solta corações
  function stroke() {
    clearTimeout(timer.current);
    setWalk((p) => ({ ...p, act: "happy", dur: 0 }));
    const base = heartId.current;
    heartId.current += 3;
    setHearts((hs) => [...hs, ...[0, 1, 2].map((i) => ({ id: base + i, dx: -14 + i * 14, delay: i * 180 }))]);
    setTimeout(() => setHearts((hs) => hs.filter((h) => h.id >= base + 3)), 1800);
    timer.current = setTimeout(step, 2300);
  }

  const patchPet = (p) => setState((prev) => ({ ...prev, pet: { ...(prev.pet || defaultPet()), ...p } }));

  function saveName() {
    patchPet({ name: draft.trim().slice(0, PET_NAME_LEN) });
    setEditing(false);
  }

  function buy(id) {
    const item = PET_ITEM_BY_ID[id];
    setState((prev) => buyPetItem(prev, id));
    if (item) toast(`${item.name} comprado`, { sub: `−${item.price} XP livre · já vestido`, icon: "shopping_bag" });
  }

  const label = name || "SEM NOME";
  const stageIdx = PET_STAGES.indexOf(stage);
  const wornCount = PET_SLOTS.filter((sl) => gear[sl.id]).length;

  return (
    <section id="mascote" className="scroll-mt-16">
      <div className="flex items-end justify-between mb-4">
        <h3 className="font-headline-md text-headline-md text-primary uppercase">Mascote</h3>
        <Caps className="text-outline">
          {stage.name} · {stageIdx + 1} DE {PET_STAGES.length}
        </Caps>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {/* cercado */}
        <div className="relative h-[190px] overflow-hidden bg-gradient-to-b from-surface-container-high/40 to-transparent">
          <Scene id={gear.scene} />
          <div className="absolute inset-x-0 bottom-0 h-10 border-t border-outline-variant/40 bg-surface-variant/40" />

          {gear.toy && (
            <div className="absolute bottom-7 left-4">
              <Toy id={gear.toy} />
            </div>
          )}

          <button
            onClick={stroke}
            aria-label={`Fazer carinho em ${label.toLowerCase()}`}
            title="Clique pra fazer carinho"
            className="pet-walker absolute bottom-8 cursor-pointer"
            style={{ left: `${walk.x}%`, transform: "translateX(-50%)", transition: walk.dur ? `left ${walk.dur}ms linear` : "none" }}
          >
            <span className="relative block" style={{ transform: `scaleX(${walk.dir})` }}>
              <Cat stage={stage} coat={coat} act={walk.act} gear={gear} />
            </span>
            {hearts.map((h) => (
              <span
                key={h.id}
                className="pet-heart pointer-events-none absolute left-1/2 top-0 text-primary-container"
                style={{ "--pet-dx": `${h.dx}px`, animationDelay: `${h.delay}ms` }}
              >
                <MI name="favorite" fill className="text-base" />
              </span>
            ))}
          </button>
        </div>

        {/* nome, loja, saldos, crescimento e pelagem */}
        <div className="space-y-4 border-t border-outline-variant/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => (e.key === "Enter" ? saveName() : e.key === "Escape" ? setEditing(false) : null)}
                  autoFocus
                  maxLength={PET_NAME_LEN}
                  placeholder="Nome do gato"
                  aria-label="Nome do mascote"
                  className={`${inputCls} font-headline-md text-headline-md max-w-[220px]`}
                />
                <button
                  onClick={saveName}
                  aria-label="Salvar nome"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-primary-container text-on-primary-container transition active:scale-95"
                >
                  <MI name="check" />
                </button>
                <button
                  onClick={() => setEditing(false)}
                  aria-label="Cancelar"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-surface-variant text-on-surface-variant transition active:scale-95"
                >
                  <MI name="close" />
                </button>
              </>
            ) : (
              <>
                <h4 className={`font-headline-md text-headline-md uppercase ${name ? "text-on-surface" : "text-outline"}`}>{label}</h4>
                <button
                  onClick={() => {
                    setDraft(name);
                    setEditing(true);
                  }}
                  aria-label="Dar um nome ao mascote"
                  className="p-1 text-outline transition hover:text-primary-container"
                >
                  <MI name="edit" className="text-lg" />
                </button>
                <button
                  onClick={() => setShop(true)}
                  className="ml-auto flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1.5 font-label-caps text-[10px] text-on-primary-container transition active:scale-95"
                >
                  <MI name="storefront" className="text-base" /> LOJINHA
                </button>
              </>
            )}
          </div>

          {/* dois números, dois papéis: o total faz ele crescer, o livre compra
              coisa. Mostrar só um deles é o que geraria a dúvida de sempre. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[13px] text-primary tabular-nums">{fmtK(balance)}</span>
              <Caps className="text-outline text-[10px]">XP LIVRE</Caps>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[13px] text-on-surface-variant tabular-nums">{fmtK(g.xp)}</span>
              <Caps className="text-outline text-[10px]">XP TOTAL · NÍVEL {g.level}</Caps>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[13px] text-on-surface-variant tabular-nums">
                {pet.owned.length}/{PET_ITEMS.length}
              </span>
              <Caps className="text-outline text-[10px]">ITENS · {wornCount} VESTIDO(S)</Caps>
            </span>
          </div>

          {/* crescimento sai do XP TOTAL: gastar na loja não mexe nesta barra */}
          <div>
            <div className="mb-1 flex justify-between font-label-caps text-[10px] text-outline">
              <span>{stage.name}</span>
              <span>{growth.next ? `FALTAM ${fmtK(growth.missing)} XP PRA ${growth.next.name}` : "TAMANHO MÁXIMO"}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-variant">
              <div className="h-full rounded-full bg-primary-container transition-all" style={{ width: `${growth.pct}%` }} />
            </div>
          </div>

          <div>
            <Caps className="text-outline text-[10px] mb-1.5 block">PELAGEM</Caps>
            <div className="flex flex-wrap gap-1.5">
              {PET_COATS.map((k) => {
                const on = k.id === coat.id;
                return (
                  <button
                    key={k.id}
                    onClick={() => patchPet({ coat: k.id })}
                    aria-pressed={on}
                    title={k.label}
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-1 font-label-caps text-[9px] transition ${
                      on ? "border-primary-container bg-primary-container/10 text-primary-container" : "border-outline-variant text-outline hover:border-outline"
                    }`}
                  >
                    <span className="h-3.5 w-3.5 rounded-full border border-black/20" style={{ background: k.fur }} />
                    {k.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {shop && (
        <Shop
          pet={pet}
          level={g.level}
          balance={balance}
          coat={coat}
          onBuy={buy}
          onToggle={(id) => setState((prev) => togglePetGear(prev, id))}
          onClose={() => setShop(false)}
        />
      )}
    </section>
  );
}
