"use client";

// ============================================================================
// ARTE DO MASCOTE — o desenho do bicho e das peças, sem nada de estado.
//
// Mora fora de `perfil/Pet.js` porque o mascote deixou de ser exclusivo do perfil:
// a tela de sono e a faixa de todas as seções também o desenham. Um único arquivo
// de arte é o que garante que o bicho da cama é o MESMO do cercado — mesma espécie,
// mesma pelagem, mesmos acessórios — em vez de ilustrações parecidas envelhecendo
// em paralelo.
//
// Espécie troca ORELHA, FOCINHO e RABO; o resto do corpo é o mesmo (ver
// SPECIES_PARTS mais abaixo, e o contrato da cabeça em raio 16).
//
// SVG paramétrico, não sprite. Três razões: (1) não existe asset externo pra
// carregar — o app é auto-contido e a CSP não deixaria; (2) o mesmo desenho serve
// os cinco tamanhos só mudando números, então "crescer" muda PROPORÇÃO (filhote
// tem cabeça grande) e não só escala, que pareceria zoom; (3) acessório é código,
// então o MESMO desenho serve pro bicho e pra vitrine da loja — a peça que aparece
// no card é a peça que vai pro mascote.
//
// A ordem de desenho não é detalhe: cabeça/rosto/pescoço vêm DEPOIS da cabeça e
// DENTRO do grupo dela, pra herdarem o `headScale` — assim o chapéu do filhote é
// grande junto com a cabeça dele, de graça. Brinquedo e cenário NÃO moram no bicho:
// são do cercado, senão o novelo sairia andando junto quando ele passeia.
// ============================================================================

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
// tamanho do bicho.

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
    // ---- pagos ----
    case "ushanka":
      return (
        <g>
          <path d="M-14.5 -7 a14.5 14.5 0 0 1 29 0 z" fill="#6b7686" />
          <path d="M-15.5 -10 q-5 6 -2 13 q4 2 6 -2 z" fill="#d8d2c4" />
          <path d="M15.5 -10 q5 6 2 13 q-4 2 -6 -2 z" fill="#d8d2c4" />
          <rect x="-15.5" y="-11.5" width="31" height="6" rx="3" fill="#e6e0d2" />
        </g>
      );
    case "helmet":
      return (
        <g>
          <circle r="19.5" fill={T.sky} opacity="0.28" />
          <circle r="19.5" fill="none" stroke={T.cloth} strokeWidth="2.2" />
          <path d="M-13 -13 a19.5 19.5 0 0 1 9 -5" stroke="#fff" strokeWidth="2.4" fill="none" opacity="0.7" />
          <path d="M-19 12 q19 9 38 0" stroke={T.cloth} strokeWidth="4" fill="none" />
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
    // ---- pagos ----
    case "starshades": {
      const star = "M0 -6.4 L1.9 -2 L6.6 -1.6 L3 1.6 L4.1 6.2 L0 3.7 L-4.1 6.2 L-3 1.6 L-6.6 -1.6 L-1.9 -2 Z";
      return (
        <g>
          <path d="M-1.4 -2.6 h3" stroke={T.plum} strokeWidth="1.6" />
          <path d="M-12 -4.4 l-3.4 -1.4" stroke={T.plum} strokeWidth="1.4" />
          <g transform="translate(-6,-1)" fill={T.plum}>
            <path d={star} />
          </g>
          <g transform="translate(6.5,-2)" fill={T.plum}>
            <path d={star} />
          </g>
        </g>
      );
    }
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
    // ---- pagos ----
    case "plaid":
      return (
        <g>
          <path d="M-13.5 10 Q-1 20 12.5 8" stroke="#8d3b34" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M-7 16 q-3 10 -1 17 l7 1 q-1 -10 1 -16 z" fill="#8d3b34" />
          <g stroke="#e8dcc6" strokeWidth="1.1" opacity="0.85">
            <path d="M-9 13 q10 7 21 -3" />
            <path d="M-6.5 22 h7" />
            <path d="M-5.5 29 h7" />
            <path d="M-3 16 q-1 9 0 17" />
          </g>
        </g>
      );
    case "spikes":
      return (
        <g>
          <path d="M-13 11 Q-1 19 12 9" stroke={T.ink} strokeWidth="4.4" fill="none" strokeLinecap="round" />
          <g fill="#c9ccd4">
            <path d="M-10 14.5 l-3.5 4.6 l4.4 -0.6 z" />
            <path d="M-2 18 l-1.6 5.4 l3.6 -3.4 z" />
            <path d="M6 16.5 l1.4 5.2 l2.6 -4.2 z" />
          </g>
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
      {id === "cocoa" && (
        <g>
          <path d="M11 14 h16 l-1.6 15 h-12.8 z" fill={T.cloth} />
          <ellipse cx="19" cy="14" rx="8" ry="2.4" fill="#6b4a35" />
          <path d="M27 17 q6 1 5 5 q-1 3 -5 3" stroke={T.cloth} strokeWidth="2" fill="none" />
          <g stroke="#c9ccd4" strokeWidth="1.2" fill="none" opacity="0.7">
            <path d="M16 10 q3 -3 0 -6" />
            <path d="M22 10 q3 -3 0 -6" />
          </g>
        </g>
      )}
      {id === "rocket" && (
        <g>
          <path d="M20 3 q6 6 6 15 h-12 q0 -9 6 -15 z" fill={T.cloth} />
          <path d="M14 18 l-5 8 h5 z" fill={T.wool} />
          <path d="M26 18 l5 8 h-5 z" fill={T.wool} />
          <circle cx="20" cy="12" r="2.8" fill={T.sky} />
          <path d="M16 26 q4 6 4 6 q0 0 4 -6 z" fill="#f6a23c" />
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
      {id === "snow" && (
        <g>
          <rect x="0" y="0" width="120" height="64" fill="#c9dced" opacity="0.35" />
          <path d="M14 58 l7 -20 l7 20 z" fill="#3f6b52" opacity="0.55" />
          <path d="M96 58 l9 -26 l9 26 z" fill="#3f6b52" opacity="0.5" />
          <g fill="#ffffff" opacity="0.85">
            {[
              [22, 10],
              [40, 22],
              [58, 8],
              [70, 30],
              [88, 16],
              [104, 40],
              [12, 34],
              [50, 44],
            ].map(([x, y]) => (
              <circle key={`sn-${x}-${y}`} cx={x} cy={y} r="1.5" />
            ))}
          </g>
        </g>
      )}
      {id === "space" && (
        <g>
          <rect x="0" y="0" width="120" height="64" fill="#0d1428" opacity="0.85" />
          <circle cx="26" cy="18" r="11" fill="#3f6fa8" />
          <path d="M26 13 q6 3 11 1 q-4 6 -11 4 z" fill="#4f8f5e" opacity="0.85" />
          <ellipse cx="98" cy="34" rx="13" ry="3.4" fill="none" stroke="#c2a86a" strokeWidth="1.6" transform="rotate(-18 98 34)" />
          <circle cx="98" cy="34" r="6.5" fill="#c9a25f" />
          <g fill="#f4f0d8" opacity="0.9">
            {[
              [56, 10],
              [70, 22],
              [46, 34],
              [84, 12],
              [110, 20],
              [64, 46],
              [16, 44],
            ].map(([x, y]) => (
              <circle key={`sp-${x}-${y}`} cx={x} cy={y} r="1" />
            ))}
          </g>
        </g>
      )}
      {id === "stage" && (
        <g>
          <rect x="0" y="0" width="120" height="64" fill="#161320" opacity="0.85" />
          <path d="M24 0 l14 0 l22 60 l-40 0 z" fill="#f0dc8a" opacity="0.18" />
          <path d="M96 0 l-14 0 l-22 60 l40 0 z" fill="#f0dc8a" opacity="0.18" />
          <circle cx="31" cy="4" r="4" fill="#f0dc8a" opacity="0.8" />
          <circle cx="89" cy="4" r="4" fill="#f0dc8a" opacity="0.8" />
          <rect x="0" y="56" width="120" height="8" fill="#2a2338" />
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

// ---------------------------------------------------------------- espécies
// O que muda de um bicho pro outro é ORELHA, FOCINHO e RABO — e só. Sombra, patas,
// corpo, olhos, respiração e as âncoras de acessório são compartilhados, porque a
// cabeça de TODA espécie é o mesmo círculo de raio 16 com os olhos em (-6,-1) e
// (6,-2). É esse contrato que faz os 31 acessórios servirem em qualquer bicho sem
// uma linha nova; mexer no raio é redesenhar 31 peças, uma por uma.
//
// Coordenadas: orelha e focinho vivem no sistema LOCAL da cabeça (origem no centro).
// O rabo vive no sistema do corpo, já transladado pelo chamador.

function CatEars({ c, tip }) {
  return (
    <g>
      <path d="M-15 -7 L-19 -23 L-4 -14 Z" fill={tip} />
      <path d="M1 -14 L9 -25 L15 -7 Z" fill={tip} />
      <path d="M-13.5 -9.5 L-16 -19 L-6.5 -13.5 Z" fill={c.ear} />
      <path d="M3 -13 L8.5 -21 L13 -9 Z" fill={c.ear} />
    </g>
  );
}

// Orelha de rato é disco, não triângulo — e fica bem alta e aberta pros lados, de
// propósito: gorro e cartola ocupam a calota do meio, então a orelha só sobrevive
// visualmente se passar da borda do chapéu.
function RatEars({ c, tip }) {
  return (
    <g>
      <circle cx="-14.5" cy="-12.5" r="8.6" fill={tip} />
      <circle cx="10.5" cy="-15" r="9.2" fill={tip} />
      <circle cx="-14" cy="-12" r="5.2" fill={c.ear} />
      <circle cx="11" cy="-14.5" r="5.7" fill={c.ear} />
    </g>
  );
}

function CatMuzzle({ c }) {
  return (
    <g>
      <ellipse cx="10" cy="5.5" rx="7.5" ry="5.5" fill={c.belly} opacity="0.95" />
      <path d="M13.6 2.6 h4.4 l-2.2 2.8 z" fill={c.ear} />
      <path d="M15.8 5.6 q-1.6 2.8 -4.2 1.4" stroke={c.dark} strokeWidth="1" strokeLinecap="round" fill="none" />
      <g stroke={c.belly} strokeWidth="0.9" strokeLinecap="round" opacity="0.75">
        <path d="M17 4.5 l9 -2.4" />
        <path d="M17 6.5 l9 0.8" />
        <path d="M16.5 8 l8 3.4" />
      </g>
    </g>
  );
}

// Focinho de rato: mais comprido, nariz redondo em vez de triângulo e os dois
// incisivos. O dentão é a assinatura do bicho — sem ele vira hamster.
function RatMuzzle({ c }) {
  return (
    <g>
      <ellipse cx="12.5" cy="5.8" rx="10" ry="4.9" fill={c.belly} opacity="0.95" />
      <circle cx="21.6" cy="5.4" r="2.1" fill={c.ear} />
      {/* dentão: nasce 1,5px DENTRO da elipse do focinho de propósito. Encostado na
          borda ele lê como peça solta flutuando embaixo do bicho. */}
      <path d="M15.6 8.4 h4.6 l-0.7 4.2 h-3.2 z" fill="#fdfdfb" />
      <path d="M17.9 8.4 v4.2" stroke={c.dark} strokeWidth="0.6" opacity="0.4" />
      {/* bigode para em x=26, igual ao do gato: além disso ele sai do viewBox da
          vitrine (-26 -34 52 62) e aparece cortado no card da loja. */}
      <g stroke={c.belly} strokeWidth="0.9" strokeLinecap="round" opacity="0.75">
        <path d="M20.5 2.6 l5.5 -2.2" />
        <path d="M21.4 4.6 l4.6 0.2" />
        <path d="M20.6 7.6 l5.2 2.4" />
      </g>
    </g>
  );
}

function CatTail({ tip }) {
  return <path d="M0 0 C-15 -3 -21 -19 -10 -29" stroke={tip} strokeWidth="7" strokeLinecap="round" fill="none" />;
}

// Rabo de rato: comprido, fino e pelado — por isso sai na cor da orelha, não na da
// pelagem. Traço fino também é o que impede que ele leia como rabo de gato magro.
function RatTail({ c }) {
  return (
    <path
      d="M2 2 C-16 7 -28 -3 -23 -14 C-20 -21 -12 -22 -8 -17"
      stroke={c.ear}
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
      opacity="0.95"
    />
  );
}

// `stripes: false` no rato VETA a listra mesmo em pelagem listrada: laranja
// malhado é padrão de gato, e um rato tigrado parece bug, não variação.
const SPECIES_PARTS = {
  gato: { Ears: CatEars, Muzzle: CatMuzzle, Tail: CatTail, stripes: true },
  rato: { Ears: RatEars, Muzzle: RatMuzzle, Tail: RatTail, stripes: false },
};
const partsOf = (id) => SPECIES_PARTS[id] || SPECIES_PARTS.gato;

function Bicho({ stage, coat, act, gear, species }) {
  const c = coat;
  const low = act === "sit" || act === "sleep"; // sentado: corpo desce, patas dobram
  const walking = act === "walk";
  const happy = act === "happy";
  const sleeping = act === "sleep";
  const tip = c.points ? c.dark : c.fur; // siamês: extremidades escuras
  const dy = low ? 5 : 0;
  const P = partsOf(species);
  const stripes = c.stripes && P.stripes;
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
          <P.Tail c={c} tip={tip} />
        </g>
      </g>

      <g className={walking ? "pet-step" : undefined}>
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
          {stripes && (
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

          {/* orelhas — antes do círculo da cabeça, pra a base ficar por baixo */}
          <P.Ears c={c} tip={tip} />

          <circle r="16" fill={c.fur} />
          {stripes && (
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
          <P.Muzzle c={c} tip={tip} />

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
// A cabeça de mentira que serve as duas vitrines: a do acessório e a da espécie.
// Mesmas peças do bicho de verdade — nada de ilustração paralela pra manter em dia.
function FakeHead({ coat, species, children }) {
  const c = coat;
  const tip = c.points ? c.dark : c.fur;
  const P = partsOf(species);
  return (
    <>
      <P.Ears c={c} tip={tip} />
      <circle r="16" fill={c.fur} />
      <ellipse cx="-6" cy="-1" rx="2.7" ry="3.7" fill={c.eye} />
      <ellipse cx="6" cy="-2" rx="3.5" ry="4.3" fill={c.eye} />
      <P.Muzzle c={c} tip={tip} />
      {children}
    </>
  );
}

// Vitrine da espécie: só o bicho, sem acessório nenhum, porque o que está à venda
// aqui é o bicho.
function SpeciesPreview({ species, coat, small = false }) {
  return (
    <svg viewBox="-26 -34 52 62" className={`${small ? "h-11" : "h-16"} w-full`} aria-hidden="true">
      <FakeHead coat={coat} species={species} />
    </svg>
  );
}

function GearPreview({ item, coat, species, small = false }) {
  const c = coat;
  const h = small ? "h-11" : "h-16";
  if (item.slot === "toy")
    return (
      <div className={`grid ${h} place-items-center`}>
        <Toy id={item.id} />
      </div>
    );
  if (item.slot === "scene")
    return (
      <div className={`relative ${h} overflow-hidden rounded-lg bg-surface-container-high`}>
        <Scene id={item.id} />
      </div>
    );
  return (
    <svg viewBox="-26 -34 52 62" className={`${h} w-full`} aria-hidden="true">
      <FakeHead coat={c} species={species}>
        <FaceGear id={item.slot === "face" ? item.id : null} />
        <NeckGear id={item.slot === "neck" ? item.id : null} />
        <HeadGear id={item.slot === "head" ? item.id : null} />
      </FakeHead>
    </svg>
  );
}

export { T, HeadGear, FaceGear, NeckGear, Toy, Scene, Bicho, GearPreview, SpeciesPreview };
