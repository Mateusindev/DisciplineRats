"use client";

// ============================================================================
// A FAIXA DO BICHO — o mascote acompanhando a tela em que você está.
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
import { Bicho } from "@/components/PetArt";
import { petScene } from "@/lib/petMood";
import { TABS, petCoat, petGrowth, petSpecies, defaultPet } from "@/lib/state";

const TONE = {
  good: "text-on-surface",
  warn: "text-error",
  idle: "text-on-surface",
};

export default function BichoDaTela({ state, pathname }) {
  const tab = TABS.find((t) => t.path === pathname);
  const sc = tab ? petScene(tab.id, state) : null;
  if (!sc) return null;

  const pet = state.pet || defaultPet();
  const stage = petGrowth(state.stats).cur;
  const mini = { ...stage, size: Math.round(stage.size * 0.62) };
  const nome = (pet.name || "").trim();
  const bicho = petSpecies(pet.species);

  return (
    <div className="relative mb-6 flex items-center gap-3 overflow-hidden rounded-xl border border-outline-variant bg-surface-container pr-4 sm:gap-4">
      <Link
        href="/perfil#mascote"
        title={`Meu ${bicho.label.toLowerCase()}`}
        aria-label="Ver meu mascote no perfil"
        className="relative grid h-[72px] w-[96px] shrink-0 place-items-end justify-center pb-2.5 transition active:scale-95 sm:w-[104px]"
      >
        <span className="absolute inset-x-3 bottom-[9px] h-px bg-outline-variant" />
        <Bicho stage={mini} coat={petCoat(pet.coat)} act={sc.act} gear={pet.gear || {}} species={pet.species} />
      </Link>

      <div className="min-w-0 flex-1 py-3">
        <p className="text-xs text-outline">{nome ? nome : `O ${bicho.label.toLowerCase()}`}</p>
        {/* as falas vêm em caixa baixa de lib/petMood.js; a primeira letra sobe aqui */}
        <p className={`mt-0.5 text-sm font-medium leading-snug first-letter:uppercase ${TONE[sc.tone] || TONE.idle}`}>{sc.line}</p>
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
