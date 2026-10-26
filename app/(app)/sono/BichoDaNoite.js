"use client";

// ============================================================================
// A NOITE DO BICHO — o mascote na tela de sono.
//
// Faixa fina, e não cena: o registro de sono já é desenhado logo acima, no anel de
// duração e nos dois chips de veredito. Repetir aquilo como paisagem competia com o
// formulário em vez de ajudar — e um bloco de céu colorido no meio de uma tela de
// tokens escuros nunca pertenceu ali. Aqui o mascote comenta o registro no MESMO
// formato da faixa que ele já ocupa em todas as outras seções, e a tela de sono
// deixa de ser a exceção visual.
//
// Lê o ESTADO DO FORMULÁRIO, não o registro salvo: mexer no horário muda a pose e a
// barra na hora, antes de salvar. A pose é o veredito — dorme (meta batida no
// horário), cochila (no horário, mas curto) ou fica acordado (deitou tarde), que é o
// único caso em que o bicho não dorme, de propósito.
//
// É o mesmo bicho do perfil: espécie, pelagem, degrau de crescimento e acessórios
// comprados vêm do estado, porque o desenho vem de `components/PetArt.js`.
// ============================================================================

import Link from "next/link";
import { MI } from "@/components/ui";
import { Bicho } from "@/components/PetArt";
import { petCoat, petGrowth, defaultPet, bedtimeLateness, minutesToHm } from "@/lib/state";

export default function BichoDaNoite({ state, bedtime, wake, durationMin, goalMin, limit, quality }) {
  const pet = state.pet || defaultPet();
  const stage = petGrowth(state.stats).cur;
  // 0,7 do tamanho do cercado: a proporção (headScale) fica intacta, então o
  // filhote continua de cabeça grande — encolher por `size` é o que preserva isso.
  const mini = { ...stage, size: Math.round(stage.size * 0.7) };
  const name = (pet.name || "").trim();

  const onTime = bedtimeLateness(bedtime, limit) <= 0;
  const hitsGoal = durationMin >= goalMin;
  const act = !onTime ? "idle" : hitsGoal ? "sleep" : "sit";
  const zzz = onTime ? Math.max(1, Math.min(4, Math.round(durationMin / 120))) : 0;
  const pctGoal = Math.min(100, Math.round((durationMin / Math.max(1, goalMin)) * 100));

  const mood = !onTime
    ? { icon: "visibility", txt: `Ainda acordado às ${bedtime}`, bad: true }
    : hitsGoal
      ? { icon: "bedtime", txt: quality >= 4 ? "Noite limpa · ronronando" : "Noite limpa", bad: false }
      : { icon: "hourglass_bottom", txt: `Cochilo — ${minutesToHm(durationMin)} de ${minutesToHm(goalMin)}`, bad: true };

  return (
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container p-3">
      <div className="relative grid h-[92px] w-[112px] shrink-0 place-items-end justify-center rounded-lg bg-surface-container-high pb-3">
        <span className="absolute inset-x-3 bottom-[10px] h-px bg-outline-variant" />
        <div className="relative">
          <Bicho stage={mini} coat={petCoat(pet.coat)} act={act} gear={pet.gear || {}} species={pet.species} />
          {Array.from({ length: zzz }, (_, i) => (
            <span
              key={i}
              className="pet-zzz pointer-events-none absolute right-1 top-0 text-[11px] font-medium text-on-surface-variant"
              style={{ animationDelay: `${i * 650}ms` }}
              aria-hidden="true"
            >
              z
            </span>
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-xs text-outline">{name ? `${name} diz` : "Sua noite"}</div>

        <div className={`flex items-center gap-1.5 text-sm font-medium ${mood.bad ? "text-error" : "text-on-surface"}`}>
          <MI name={mood.icon} className={`shrink-0 text-[18px] ${mood.bad ? "text-error" : "text-on-surface-variant"}`} />
          <span className="leading-snug">{mood.txt}</span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
          <div
            className={`h-full rounded-full transition-all ${hitsGoal ? "bg-primary-container" : "bg-error"}`}
            style={{ width: `${pctGoal}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-outline">
          <span>{bedtime} → {wake}</span>
          <span className={hitsGoal ? "text-on-surface" : "text-error"}>{minutesToHm(durationMin)}</span>
          <span>Meta {minutesToHm(goalMin)}</span>
          <span className="flex items-center gap-0.5">
            <MI name="star" className="text-[14px]" />
            {quality}/5
          </span>
        </div>
      </div>

      <Link
        href="/perfil#mascote"
        className="grid size-8 shrink-0 place-items-center self-start rounded-md text-outline transition-colors hover:bg-surface-variant hover:text-on-surface focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
        aria-label="Ver o mascote no perfil"
      >
        <MI name="open_in_new" className="text-[16px]" />
      </Link>
    </div>
  );
}
