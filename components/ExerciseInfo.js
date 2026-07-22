"use client";

import { useEffect } from "react";
import { MI, Caps } from "@/components/ui";

// Mapa muscular 2D estilizado (frente/costas). Destaca o grupo `muscle`.
// Valores casam com exercises.muscle do seed.
const HI = "var(--color-primary-container)";
const BASE = "var(--color-surface-variant)";
const SKIN = "var(--color-surface-container-high)";

const FULL = new Set(["Cardio", "Corpo inteiro"]);

// quais regiões acendem por grupo (chaves = ids das shapes)
const REGIONS = {
  Peito: ["chest"],
  Ombros: ["deltF", "deltB"],
  Trapézio: ["traps"],
  Costas: ["lats"],
  Bíceps: ["biceps"],
  Tríceps: ["triceps"],
  Antebraço: ["forearmF", "forearmB"],
  Abdômen: ["abs"],
  Quadríceps: ["quads"],
  Posterior: ["hams"],
  Glúteos: ["glutes"],
  Panturrilha: ["calfF", "calfB"],
};

export function MuscleMap({ muscle }) {
  const full = FULL.has(muscle);
  const on = new Set(full ? [] : REGIONS[muscle] || []);
  const fill = (id) => (full || on.has(id) ? HI : BASE);
  const op = (id) => (full ? 0.55 : on.has(id) ? 1 : 0.5);
  // atalho: elipse de músculo (destacável)
  const M = (id, cx, cy, rx, ry, rot = 0) => (
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined} fill={fill(id)} opacity={op(id)} />
  );

  // silhueta base (mesma p/ frente e costas)
  const silhouette = (
    <g fill={SKIN} stroke="var(--color-outline-variant)" strokeWidth="1" strokeLinejoin="round">
      {/* cabeça + pescoço */}
      <circle cx="60" cy="20" r="12" />
      <path d="M54 30 h12 v8 h-12 z" stroke="none" />
      {/* tronco com taper atlético */}
      <path d="M60 38 C72 38 80 42 83 51 C85 66 78 94 74 118 C73 126 76 131 75 136 L45 136 C44 131 47 126 46 118 C42 94 35 66 37 51 C40 42 48 38 60 38 Z" />
      {/* braços */}
      <ellipse cx="31" cy="72" rx="8" ry="21" transform="rotate(10 31 72)" />
      <ellipse cx="89" cy="72" rx="8" ry="21" transform="rotate(-10 89 72)" />
      <ellipse cx="23" cy="112" rx="6.5" ry="20" transform="rotate(8 23 112)" />
      <ellipse cx="97" cy="112" rx="6.5" ry="20" transform="rotate(-8 97 112)" />
      <circle cx="19" cy="133" r="5" />
      <circle cx="101" cy="133" r="5" />
      {/* pernas */}
      <path d="M46 136 h13 v54 q0 6 -6.5 6 h0 q-6.5 0 -6.5 -6 z" />
      <path d="M61 136 h13 v54 q0 6 -6.5 6 h0 q-6.5 0 -6.5 -6 z" />
      <path d="M48 196 h11 v40 q0 5 -5.5 5 h0 q-5.5 0 -5.5 -5 z" />
      <path d="M61 196 h11 v40 q0 5 -5.5 5 h0 q-5.5 0 -5.5 -5 z" />
      <ellipse cx="53" cy="240" rx="7" ry="4" />
      <ellipse cx="67" cy="240" rx="7" ry="4" />
    </g>
  );

  const front = (
    <>
      {M("deltF", 39, 55, 8, 8)}
      {M("deltF", 81, 55, 8, 8)}
      {M("chest", 52, 60, 9.5, 7)}
      {M("chest", 68, 60, 9.5, 7)}
      {M("biceps", 31, 72, 6, 15, 10)}
      {M("biceps", 89, 72, 6, 15, -10)}
      {M("forearmF", 23, 112, 5, 16, 8)}
      {M("forearmF", 97, 112, 5, 16, -8)}
      <rect x="51" y="74" width="18" height="34" rx="6" fill={fill("abs")} opacity={op("abs")} />
      {M("quads", 53, 160, 6.5, 24)}
      {M("quads", 67, 160, 6.5, 24)}
      {M("calfF", 53, 212, 5, 16)}
      {M("calfF", 67, 212, 5, 16)}
    </>
  );

  const back = (
    <>
      <path d="M48 40 Q60 34 72 40 L66 58 Q60 55 54 58 Z" fill={fill("traps")} opacity={op("traps")} />
      {M("deltB", 39, 55, 8, 8)}
      {M("deltB", 81, 55, 8, 8)}
      {M("lats", 50, 76, 8, 17, 8)}
      {M("lats", 70, 76, 8, 17, -8)}
      {M("triceps", 31, 74, 6, 15, 10)}
      {M("triceps", 89, 74, 6, 15, -10)}
      {M("forearmB", 23, 112, 5, 16, 8)}
      {M("forearmB", 97, 112, 5, 16, -8)}
      {M("glutes", 53, 142, 8.5, 10)}
      {M("glutes", 67, 142, 8.5, 10)}
      {M("hams", 53, 166, 6.5, 22)}
      {M("hams", 67, 166, 6.5, 22)}
      {M("calfB", 53, 212, 5, 16)}
      {M("calfB", 67, 212, 5, 16)}
    </>
  );

  const Body = ({ label, parts }) => (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 120 250" className="w-full max-w-[128px]" role="img" aria-label={`Corpo ${label}`}>
        {silhouette}
        <g stroke="none">{parts}</g>
      </svg>
      <Caps className="text-[9px] text-outline">{label}</Caps>
    </div>
  );

  return (
    <div className="flex justify-center gap-8">
      <Body label="FRENTE" parts={front} />
      <Body label="COSTAS" parts={back} />
    </div>
  );
}

export function ExerciseModal({ name, muscle, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const searchYoutube = () =>
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent("como fazer " + name)}`, "_blank", "noopener");

  const full = FULL.has(muscle);
  const known = full || !!REGIONS[muscle];

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-label={`Exercício ${name}`}
    >
      <div className="glass-card rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-headline-md text-headline-md text-primary leading-tight">{name}</h3>
            {muscle ? (
              <Caps className="text-primary-container text-[10px]">{muscle}</Caps>
            ) : (
              <Caps className="text-outline text-[10px]">grupo não catalogado</Caps>
            )}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition p-1 shrink-0">
            <MI name="close" />
          </button>
        </div>

        <div className="bg-surface-container-high rounded-xl p-4 mb-4">
          <MuscleMap muscle={muscle} />
          {!known && <p className="text-[11px] text-outline text-center mt-2">Sem mapa muscular pra esse exercício.</p>}
          {full && <p className="text-[11px] text-outline text-center mt-2">Trabalha o corpo todo.</p>}
        </div>

        <button
          onClick={searchYoutube}
          className="w-full py-3 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-[11px] flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <MI name="play_circle" className="text-lg" /> VER NO YOUTUBE
        </button>
      </div>
    </div>
  );
}
