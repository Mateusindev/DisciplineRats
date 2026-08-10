"use client";

import { useEffect } from "react";
import Model from "react-body-highlighter";
import { MI, Caps } from "@/components/ui";

// grupo (pt-BR do catálogo) → músculos do react-body-highlighter
const MAP = {
  Peito: ["chest"],
  Costas: ["upper-back", "lower-back"],
  Ombros: ["front-deltoids", "back-deltoids"],
  Trapézio: ["trapezius"],
  Bíceps: ["biceps"],
  Tríceps: ["triceps"],
  Antebraço: ["forearm"],
  Abdômen: ["abs", "obliques"],
  Quadríceps: ["quadriceps"],
  Posterior: ["hamstring"],
  Glúteos: ["gluteal"],
  Panturrilha: ["calves"],
};

const FULL = new Set(["Cardio", "Corpo inteiro"]);

// infere o grupo muscular pelo nome quando o exercício não está no catálogo
export function guessMuscle(name) {
  const n = (name || "").toLowerCase();
  const has = (...ks) => ks.some((k) => n.includes(k));
  if (has("punho")) return "Antebraço";
  if (has("rosca inversa")) return "Antebraço";
  if (has("rosca")) return "Bíceps";
  if (has("tríceps", "triceps", "testa", "coice", "mergulho", "supino fechado")) return "Tríceps";
  if (has("crucifixo inverso")) return "Ombros";
  if (has("supino", "crucifixo", "crossover", "voador", "flexão", "flexao", "peck", "peitoral")) return "Peito";
  if (has("encolhimento", "trapézio", "trapezio")) return "Trapézio";
  if (has("desenvolvimento", "elevação lateral", "elevacao lateral", "elevação frontal", "arnold", "deltoid", "remada alta", "ombro")) return "Ombros";
  if (has("puxada", "remada", "barra fixa", "pulldown", "pull-over", "pullover", "serrote", "terra", "dorsal", "costas")) return "Costas";
  if (has("panturrilha", "gêmeos", "gemeos", "soleus")) return "Panturrilha";
  if (has("stiff", "romeno", "flexora", "posterior")) return "Posterior";
  if (has("glúteo", "gluteo", "hip thrust", "pélvica", "pelvica", "abdutora", "sumô", "sumo")) return "Glúteos";
  if (has("agachamento", "leg press", "extensora", "afundo", "avanço", "avanco", "hack", "búlgaro", "bulgaro", "passada", "quadríceps", "quadriceps", "perna")) return "Quadríceps";
  if (has("abdominal", "prancha", "abdômen", "abdomen", "russian", "elevação de pernas", "elevacao de pernas", "oblíquo", "obliquo")) return "Abdômen";
  if (has("corrida", "esteira", "bicicleta", "bike", "elíptico", "eliptico", "corda", "remo", "escada", "caminhada", "cardio")) return "Cardio";
  if (has("burpee", "kettlebell", "clean", "swing", "thruster")) return "Corpo inteiro";
  return "";
}
const ALL_MUSCLES = [
  "trapezius", "upper-back", "lower-back", "chest", "biceps", "triceps", "forearm",
  "back-deltoids", "front-deltoids", "abs", "obliques", "hamstring", "quadriceps",
  "calves", "gluteal",
];

// cores conforme o tema atual (accent + corpo base)
function themeColors() {
  const light = typeof document !== "undefined" && document.documentElement.classList.contains("light");
  return {
    accent: light ? "#2b88f5" : "#3b82f6",
    body: light ? "#c7d0db" : "#1e293b",
  };
}

export function MuscleMap({ muscle }) {
  const { accent, body } = themeColors();
  const muscles = FULL.has(muscle) ? ALL_MUSCLES : MAP[muscle] || [];
  const data = [{ name: muscle || "", muscles }];
  const common = {
    data,
    bodyColor: body,
    highlightedColors: [accent],
    style: { width: "100%" },
  };
  return (
    <div className="flex justify-center gap-6">
      <div className="flex flex-col items-center gap-1.5 w-[42%] max-w-[150px]">
        <Model {...common} type="anterior" />
        <Caps className="text-[9px] text-outline">FRENTE</Caps>
      </div>
      <div className="flex flex-col items-center gap-1.5 w-[42%] max-w-[150px]">
        <Model {...common} type="posterior" />
        <Caps className="text-[9px] text-outline">COSTAS</Caps>
      </div>
    </div>
  );
}

export function ExerciseModal({ name, muscle, videoId, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const searchYoutube = () =>
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent("como fazer " + name)}`, "_blank", "noopener");

  const full = FULL.has(muscle);
  const known = full || !!MAP[muscle];

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-label={`Exercício ${name}`}
    >
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={(e) => e.stopPropagation()}>
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

        {videoId && (
          <div className="rounded-xl overflow-hidden mb-4 border border-white/10 aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title={`Demonstração: ${name}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        )}

        <div className="bg-surface-container-high rounded-xl p-4 mb-4">
          <MuscleMap muscle={muscle} />
          {!known && <p className="text-[11px] text-outline text-center mt-2">Sem mapa muscular pra esse exercício.</p>}
          {full && <p className="text-[11px] text-outline text-center mt-2">Trabalha o corpo todo.</p>}
        </div>

        {!videoId && (
          <button
            onClick={searchYoutube}
            className="w-full py-3 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-[11px] flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <MI name="play_circle" className="text-lg" /> VER NO YOUTUBE
          </button>
        )}
      </div>
    </div>
  );
}
