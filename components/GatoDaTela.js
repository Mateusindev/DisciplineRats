"use client";

// ============================================================================
// A FAIXA DO GATO — o mascote acompanhando a tela em que você está.
//
// Mora no Chrome (`app/(app)/layout.js`), acima do conteúdo, e NÃO dentro de cada
// página: assim é um lugar só pra ajustar, aparece igual em todas as seções e
// nenhuma página precisa saber que o gato existe. Quem decide o que ele acha é
// `lib/petMood.js`; aqui só se desenha.
//
// Some sozinho onde não faz sentido: no Sono (lá ele tem a cena inteira, deitado
// na cama), no Perfil (lá ele tem o cercado) e em qualquer rota que não esteja em
// TABS. `petScene` devolvendo null é o único gatilho — sem lista de exceções pra
// manter em dia.
//
// É o mesmo bicho das outras telas: espécie, pelagem, degrau de crescimento e
// acessórios vêm do estado. Só o tamanho é reduzido, e por `size` — a proporção (`headScale`)
// fica intacta, senão o filhote perderia a cabeça grande que o faz ser filhote.
// ============================================================================

import Link from "next/link";
import { Caps } from "@/components/ui";
import { Bicho } from "@/components/PetArt";
import { petScene } from "@/lib/petMood";
import { TABS, petCoat, petGrowth, petSpecies, defaultPet } from "@/lib/state";

const TONE = {
  good: "text-primary",
  warn: "text-error",
  idle: "text-on-surface-variant",
};

export default function GatoDaTela({ state, pathname }) {
  const tab = TABS.find((t) => t.path === pathname);
  const sc = tab ? petScene(tab.id, state) : null;
  if (!sc) return null;

  const pet = state.pet || defaultPet();
  const stage = petGrowth(state.stats).cur;
  const mini = { ...stage, size: Math.round(stage.size * 0.62) };
  const nome = (pet.name || "").trim().toUpperCase();
  const bicho = petSpecies(pet.species);

  return (
    <div className="glass-card relative mb-6 flex items-center gap-3 overflow-hidden rounded-xl pr-4 sm:gap-4">
      <Link
        href="/perfil#mascote"
        title={`Meu ${bicho.label.toLowerCase()}`}
        aria-label="Ver meu mascote no perfil"
        className="relative grid h-[78px] w-[100px] shrink-0 place-items-end justify-center pb-3 transition active:scale-95 sm:w-[112px]"
      >
        <span className="absolute inset-x-3 bottom-[10px] h-px bg-outline-variant/60" />
        <Bicho stage={mini} coat={petCoat(pet.coat)} act={sc.act} gear={pet.gear || {}} species={pet.species} />
      </Link>

      <div className="min-w-0 flex-1 py-3">
        <Caps className="text-outline text-[9px] block">{nome ? `${nome} DIZ` : `O ${bicho.label} DIZ`}</Caps>
        <p className={`font-label-caps text-[11px] leading-tight mt-0.5 ${TONE[sc.tone] || TONE.idle}`}>{sc.line}</p>
        {sc.pct !== null && (
          <div className="mt-2 h-1 w-full max-w-[280px] overflow-hidden rounded-full bg-surface-variant">
            <div
              className={`h-full rounded-full transition-all ${sc.tone === "warn" ? "bg-error" : "bg-primary-container"}`}
              style={{ width: `${sc.pct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
