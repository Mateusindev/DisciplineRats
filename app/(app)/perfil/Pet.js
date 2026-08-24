"use client";

// ============================================================================
// MASCOTE — um gato que cresce com o XP e mora no perfil.
//
// SVG paramétrico, não sprite. Três razões: (1) não existe asset externo pra
// carregar — o app é auto-contido; (2) o mesmo desenho serve os cinco tamanhos só
// mudando números, então "crescer" muda PROPORÇÃO (filhote tem cabeça grande) e
// não só escala, que pareceria zoom; (3) a pelagem é trocável sem repintar arte.
//
// O gato vagabundeia sozinho: uma máquina de estados simples sorteia andar, parar,
// sentar e dormir. Andar é uma transição de `left` em CSS — o JS só escolhe o
// destino e a duração, o navegador interpola. Clicar nele faz carinho.
//
// Quem pede menos movimento (prefers-reduced-motion) recebe um gato parado: as
// keyframes morrem no CSS e a vagabundagem nem começa aqui.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, inputCls } from "@/components/ui";
import { fmtK, gamify, petGrowth, PET_STAGES } from "@/lib/state";

// Pelagem é COR DE BICHO, não token de tema: um gato laranja é laranja no claro e
// no escuro. Por isso hex fixo aqui em vez das variáveis do design system.
const COATS = [
  { id: "laranja", label: "LARANJA", fur: "#e0954a", dark: "#bf7631", belly: "#f8e7cf", ear: "#f0b3a6", eye: "#2f3540", stripes: true },
  { id: "cinza", label: "CINZA", fur: "#9aa3b5", dark: "#798294", belly: "#e6ebf3", ear: "#eeb0a4", eye: "#2f3540", stripes: true },
  { id: "smoking", label: "SMOKING", fur: "#3f4551", dark: "#2b3038", belly: "#f3f5f9", ear: "#dfa197", eye: "#d9c04a", stripes: false },
  { id: "creme", label: "CREME", fur: "#ead6b1", dark: "#cdb587", belly: "#faf3e6", ear: "#f2b8ab", eye: "#6f9a5e", stripes: false },
  { id: "siames", label: "SIAMÊS", fur: "#e2d7c6", dark: "#6c5a4d", belly: "#f6f0e6", ear: "#d6a196", eye: "#4e94c6", stripes: false, points: true },
];
const coatOf = (id) => COATS.find((c) => c.id === id) || COATS[0];

// ---------------------------------------------------------------- o desenho

// `act` decide a pose; `stage` decide o tamanho e a proporção. Tudo em unidades da
// viewBox, então nada muda de posição quando o gato cresce.
function Cat({ stage, coat, act }) {
  const c = coat;
  const low = act === "sit" || act === "sleep"; // sentado: corpo desce, patas dobram
  const walking = act === "walk";
  const happy = act === "happy";
  const sleeping = act === "sleep";
  const tip = c.points ? c.dark : c.fur; // siamês: extremidades escuras
  const dy = low ? 5 : 0;

  return (
    <svg viewBox="0 0 120 92" style={{ height: stage.size }} className="block overflow-visible" aria-hidden="true">
      {/* sombra no chão: some junto com o corpo quando ele senta */}
      <ellipse cx="58" cy="84" rx={low ? 25 : 28} ry="3.6" fill="var(--color-outline)" opacity="0.28" />

      {/* rabo — o <g> de fora carrega o translate (atributo), o de dentro a
          animação (CSS). Juntos no mesmo <g>, o CSS apagaria o translate. */}
      <g transform={`translate(31,${57 + dy})`}>
        <g className={`pet-tail ${walking || happy ? "pet-tail-fast" : ""}`}>
          <path d="M0 0 C-15 -3 -21 -19 -10 -29" stroke={tip} strokeWidth="7" strokeLinecap="round" fill="none" />
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
          {c.stripes && (
            <g stroke={c.dark} strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.8">
              <path d={`M44 ${43 + dy} q3 5 1 9`} />
              <path d={`M53 ${41 + dy} q3 5 1 10`} />
              <path d={`M62 ${41 + dy} q3 5 1 10`} />
            </g>
          )}
        </g>

        {/* cabeça: o scale da proporção vive no atributo, a animação nos filhos */}
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

          {/* coleira: só a partir de ADULTO, quando há pescoço pra ela caber */}
          {stage.collar && (
            <>
              <path d="M-13 11 Q-1 19 12 9" stroke="var(--color-primary-container)" strokeWidth="3.6" strokeLinecap="round" fill="none" />
              <circle cx="0" cy="16.4" r="2.6" fill="var(--color-badge)" />
            </>
          )}
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

// ---------------------------------------------------------------- o cercado

const WALK_MIN = 8; // % da largura — margem pra ele não colar nas paredes
const WALK_MAX = 88;

export default function Pet() {
  const { state, setSetting } = useApp();
  const g = gamify(state.stats);
  const growth = petGrowth(state.stats);
  const stage = growth.cur;
  const coat = coatOf(state.settings.petCoat);
  const name = (state.settings.petName || "").trim();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [hearts, setHearts] = useState([]);
  const [pet, setPet] = useState({ act: "idle", x: 46, dir: 1, dur: 0 });
  const petRef = useRef(pet);
  petRef.current = pet;
  const timer = useRef(null);
  const heartId = useRef(0);

  // Máquina de estados da vagabundagem. Sorteia o que fazer, marca quanto tempo
  // aquilo dura e se agenda de novo. Andar devolve destino + duração, e é a
  // duração que vira a transição de `left` — o navegador interpola o passeio.
  const step = useCallback(() => {
    const cur = petRef.current;
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
    setPet(next);
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
    setPet((p) => ({ ...p, act: "happy", dur: 0 }));
    const base = heartId.current;
    heartId.current += 3;
    setHearts((hs) => [...hs, ...[0, 1, 2].map((i) => ({ id: base + i, dx: -14 + i * 14, delay: i * 180 }))]);
    setTimeout(() => setHearts((hs) => hs.filter((h) => h.id >= base + 3)), 1800);
    timer.current = setTimeout(step, 2300);
  }

  function saveName() {
    setSetting("petName", draft.trim().slice(0, 18));
    setEditing(false);
  }

  const label = name || "SEM NOME";
  const stageIdx = PET_STAGES.indexOf(stage);

  return (
    // id + scroll-mt: o atalho da patinha no canto da tela chega por âncora, e sem a
    // margem de rolagem o título encostaria na borda de cima
    <section id="mascote" className="scroll-mt-16">
      <div className="flex items-end justify-between mb-4">
        <h3 className="font-headline-md text-headline-md text-primary uppercase">Mascote</h3>
        <Caps className="text-outline">
          {stage.name} · {stageIdx + 1} DE {PET_STAGES.length}
        </Caps>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {/* cercado */}
        <div className="relative h-[190px] bg-gradient-to-b from-surface-container-high/40 to-transparent">
          <div className="absolute inset-x-0 bottom-0 h-10 bg-surface-variant/40 border-t border-outline-variant/40" />

          <button
            onClick={stroke}
            aria-label={`Fazer carinho em ${label.toLowerCase()}`}
            title="Clique pra fazer carinho"
            className="pet-walker absolute bottom-8 cursor-pointer"
            style={{ left: `${pet.x}%`, transform: "translateX(-50%)", transition: pet.dur ? `left ${pet.dur}ms linear` : "none" }}
          >
            <span className="relative block" style={{ transform: `scaleX(${pet.dir})` }}>
              <Cat stage={stage} coat={coat} act={pet.act} />
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

        {/* nome, pelagem e crescimento */}
        <div className="border-t border-outline-variant/40 p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => (e.key === "Enter" ? saveName() : e.key === "Escape" ? setEditing(false) : null)}
                  autoFocus
                  maxLength={18}
                  placeholder="Nome do gato"
                  aria-label="Nome do mascote"
                  className={`${inputCls} font-headline-md text-headline-md max-w-[220px]`}
                />
                <button
                  onClick={saveName}
                  aria-label="Salvar nome"
                  className="w-9 h-9 rounded-lg bg-primary-container text-on-primary-container grid place-items-center active:scale-95 transition"
                >
                  <MI name="check" />
                </button>
                <button
                  onClick={() => setEditing(false)}
                  aria-label="Cancelar"
                  className="w-9 h-9 rounded-lg bg-surface-variant text-on-surface-variant grid place-items-center active:scale-95 transition"
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
                  className="text-outline hover:text-primary-container transition p-1"
                >
                  <MI name="edit" className="text-lg" />
                </button>
                <Caps className="text-outline text-[10px] ml-auto">NÍVEL {g.level} · {fmtK(g.xp)} XP</Caps>
              </>
            )}
          </div>

          {/* crescimento: em XP, porque XP é o que o usuário vê subir */}
          <div>
            <div className="flex justify-between text-[10px] font-label-caps text-outline mb-1">
              <span>{stage.name}</span>
              <span>{growth.next ? `FALTAM ${fmtK(growth.missing)} XP PRA ${growth.next.name}` : "TAMANHO MÁXIMO"}</span>
            </div>
            <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
              <div className="bg-primary-container h-full rounded-full transition-all" style={{ width: `${growth.pct}%` }} />
            </div>
          </div>

          <div>
            <Caps className="text-outline text-[10px] mb-1.5 block">PELAGEM</Caps>
            <div className="flex flex-wrap gap-1.5">
              {COATS.map((k) => {
                const on = k.id === coat.id;
                return (
                  <button
                    key={k.id}
                    onClick={() => setSetting("petCoat", k.id)}
                    aria-pressed={on}
                    title={k.label}
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-1 font-label-caps text-[9px] transition ${
                      on ? "border-primary-container text-primary-container bg-primary-container/10" : "border-outline-variant text-outline hover:border-outline"
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
    </section>
  );
}
