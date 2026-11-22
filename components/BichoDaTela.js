"use client";

// ============================================================================
// A FAIXA DO BICHO — o mascote acompanhando a tela em que você está.
//
// Mora no Chrome (`app/(app)/layout.js`), acima do conteúdo, e NÃO dentro de cada
// página: assim é um lugar só pra ajustar, aparece igual em todas as seções e
// nenhuma página precisa saber que o gato existe. Quem decide o que ele acha é
// `lib/petMood.js`; aqui só se desenha.
//
// Some sozinho onde não faz sentido: no Sono (lá ele tem a faixa da noite) e em
// qualquer rota que não esteja em TABS. `petScene` devolvendo null é o único
// gatilho — sem lista de exceções pra manter em dia.
//
// É sempre o rato (components/PetArt.js) — sem espécie, pelagem nem crescimento.
// ============================================================================

import { Bicho } from "@/components/PetArt";
import { petScene } from "@/lib/petMood";
import { TABS } from "@/lib/state";

const TONE = {
  good: "text-on-surface",
  warn: "text-error",
  idle: "text-on-surface",
};

export default function BichoDaTela({ state, pathname }) {
  const tab = TABS.find((t) => t.path === pathname);
  const sc = tab ? petScene(tab.id, state) : null;
  if (!sc) return null;


  return (
    <div className="relative mb-6 flex items-center gap-3 overflow-hidden rounded-xl border border-outline-variant bg-surface-container pr-4 sm:gap-4">
      <div className="relative grid h-[72px] w-[96px] shrink-0 place-items-end justify-center pb-2.5 sm:w-[104px]" aria-hidden="true">
        <span className="absolute inset-x-3 bottom-[9px] h-px bg-outline-variant" />
        <Bicho size={50} act={sc.act} />
      </div>

      <div className="min-w-0 flex-1 py-3">
        <p className="text-xs text-outline">O rato</p>
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
