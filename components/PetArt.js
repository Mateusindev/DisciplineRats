"use client";

// ============================================================================
// ARTE DO MASCOTE — o rato, sem nada de estado.
//
// Um bicho só, fixo: o rato do logo (é o app Discipline Rats). Não há espécie,
// pelagem, acessório nem crescimento — o mascote não depende de progresso nenhum,
// ele só acompanha as telas (components/BichoDaTela.js) e a noite
// (sono/BichoDaNoite.js). Um único arquivo de arte garante que os dois desenham o
// MESMO rato.
//
// SVG paramétrico, não sprite: não há asset externo pra carregar e o mesmo desenho
// serve qualquer tamanho via `size`.
//
// CSS `transform` sobrescreve o atributo `transform` do SVG, então toda peça
// animada é um <g> FILHO do que carrega translate/scale.
// ============================================================================

// Cor de bicho, não token de tema: o rato é cinza-azulado nos dois temas, como no logo.
const COAT = { fur: "#9aa3b5", dark: "#798294", belly: "#e6ebf3", ear: "#eeb0a4", eye: "#2f3540" };
// Proporção de adulto: cabeça levemente maior que o corpo pede, sem cara de filhote.
const STAGE = { size: 80, headScale: 1.06 };

// Orelha de rato é disco, não triângulo — bem alta e aberta pros lados, como no logo.
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
      <g stroke={c.belly} strokeWidth="0.9" strokeLinecap="round" opacity="0.75">
        <path d="M20.5 2.6 l5.5 -2.2" />
        <path d="M21.4 4.6 l4.6 0.2" />
        <path d="M20.6 7.6 l5.2 2.4" />
      </g>
    </g>
  );
}

// Rabo de rato: comprido, fino e pelado — por isso sai na cor da orelha, não na da
// pelagem.
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

export function Bicho({ act = "idle", size = STAGE.size }) {
  const c = COAT;
  const stage = STAGE;
  const low = act === "sit" || act === "sleep"; // sentado: corpo desce, patas dobram
  const walking = act === "walk";
  const happy = act === "happy";
  const sleeping = act === "sleep";
  const tip = c.fur;
  const dy = low ? 5 : 0;

  return (
    <svg viewBox="0 0 120 92" style={{ height: size }} className="block overflow-visible" aria-hidden="true">
      {/* sombra no chão: encolhe junto com o corpo quando ele senta */}
      <ellipse cx="58" cy="84" rx={low ? 25 : 28} ry="3.6" fill="var(--color-outline)" opacity="0.28" />

      {/* rabo — o <g> de fora carrega o translate (atributo), o de dentro a
          animação (CSS). Juntos no mesmo <g>, o CSS apagaria o translate. */}
      <g transform={`translate(31,${57 + dy})`}>
        <g className={`pet-tail ${walking || happy ? "pet-tail-fast" : ""}`}>
          <RatTail c={c} />
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
        </g>

        {/* cabeça: o scale da proporção vive no atributo, a animação nos filhos */}
        <g transform={`translate(87,${37 + dy}) scale(${stage.headScale})`}>
          {/* orelhas — antes do círculo da cabeça, pra a base ficar por baixo */}
          <RatEars c={c} tip={tip} />

          <circle r="16" fill={c.fur} />

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
          <RatMuzzle c={c} />
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
