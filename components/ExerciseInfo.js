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
  const fill = (id) => (full ? HI : on.has(id) ? HI : BASE);
  const op = (id) => (full ? 0.5 : on.has(id) ? 1 : 0.55);

  // silhueta simples reutilizável (cabeça + tronco + membros) por view
  const Body = ({ label, parts }) => (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 100 200" className="w-full max-w-[130px]" role="img" aria-label={`Corpo ${label}`}>
        {/* silhueta base */}
        <g fill={SKIN} stroke="var(--color-outline-variant)" strokeWidth="0.8">
          <circle cx="50" cy="16" r="10" />
          <rect x="34" y="27" width="32" height="45" rx="8" />
          {/* braços */}
          <rect x="20" y="30" width="12" height="46" rx="6" />
          <rect x="68" y="30" width="12" height="46" rx="6" />
          <rect x="20" y="74" width="11" height="40" rx="5" />
          <rect x="69" y="74" width="11" height="40" rx="5" />
          {/* quadril + pernas */}
          <rect x="35" y="70" width="30" height="20" rx="6" />
          <rect x="36" y="88" width="13" height="52" rx="6" />
          <rect x="51" y="88" width="13" height="52" rx="6" />
          <rect x="37" y="138" width="12" height="46" rx="5" />
          <rect x="51" y="138" width="12" height="46" rx="5" />
        </g>
        {/* músculos destacáveis */}
        <g stroke="none">{parts}</g>
      </svg>
      <Caps className="text-[9px] text-outline">{label}</Caps>
    </div>
  );

  const front = (
    <>
      <rect id="deltF" x="30" y="29" width="10" height="10" rx="4" fill={fill("deltF")} opacity={op("deltF")} />
      <rect id="deltF2" x="60" y="29" width="10" height="10" rx="4" fill={fill("deltF")} opacity={op("deltF")} />
      <rect id="chest" x="36" y="31" width="28" height="16" rx="5" fill={fill("chest")} opacity={op("chest")} />
      <rect id="abs" x="40" y="49" width="20" height="20" rx="4" fill={fill("abs")} opacity={op("abs")} />
      <rect id="biceps" x="21" y="48" width="9" height="20" rx="4" fill={fill("biceps")} opacity={op("biceps")} />
      <rect id="biceps2" x="70" y="48" width="9" height="20" rx="4" fill={fill("biceps")} opacity={op("biceps")} />
      <rect id="forearmF" x="21" y="76" width="9" height="34" rx="4" fill={fill("forearmF")} opacity={op("forearmF")} />
      <rect id="forearmF2" x="70" y="76" width="9" height="34" rx="4" fill={fill("forearmF")} opacity={op("forearmF")} />
      <rect id="quads" x="37" y="90" width="11" height="44" rx="5" fill={fill("quads")} opacity={op("quads")} />
      <rect id="quads2" x="52" y="90" width="11" height="44" rx="5" fill={fill("quads")} opacity={op("quads")} />
      <rect id="calfF" x="38" y="140" width="10" height="40" rx="4" fill={fill("calfF")} opacity={op("calfF")} />
      <rect id="calfF2" x="52" y="140" width="10" height="40" rx="4" fill={fill("calfF")} opacity={op("calfF")} />
    </>
  );

  const back = (
    <>
      <rect id="traps" x="40" y="28" width="20" height="10" rx="4" fill={fill("traps")} opacity={op("traps")} />
      <rect id="deltB" x="30" y="29" width="10" height="10" rx="4" fill={fill("deltB")} opacity={op("deltB")} />
      <rect id="deltB2" x="60" y="29" width="10" height="10" rx="4" fill={fill("deltB")} opacity={op("deltB")} />
      <rect id="lats" x="36" y="39" width="28" height="24" rx="5" fill={fill("lats")} opacity={op("lats")} />
      <rect id="triceps" x="21" y="48" width="9" height="22" rx="4" fill={fill("triceps")} opacity={op("triceps")} />
      <rect id="triceps2" x="70" y="48" width="9" height="22" rx="4" fill={fill("triceps")} opacity={op("triceps")} />
      <rect id="forearmB" x="21" y="78" width="9" height="34" rx="4" fill={fill("forearmB")} opacity={op("forearmB")} />
      <rect id="forearmB2" x="70" y="78" width="9" height="34" rx="4" fill={fill("forearmB")} opacity={op("forearmB")} />
      <rect id="glutes" x="37" y="71" width="26" height="16" rx="5" fill={fill("glutes")} opacity={op("glutes")} />
      <rect id="hams" x="37" y="90" width="11" height="44" rx="5" fill={fill("hams")} opacity={op("hams")} />
      <rect id="hams2" x="52" y="90" width="11" height="44" rx="5" fill={fill("hams")} opacity={op("hams")} />
      <rect id="calfB" x="38" y="140" width="10" height="40" rx="4" fill={fill("calfB")} opacity={op("calfB")} />
      <rect id="calfB2" x="52" y="140" width="10" height="40" rx="4" fill={fill("calfB")} opacity={op("calfB")} />
    </>
  );

  return (
    <div className="flex justify-center gap-6">
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
