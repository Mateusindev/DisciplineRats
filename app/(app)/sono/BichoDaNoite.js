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
import { MI, Caps } from "@/components/ui";
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
    ? { icon: "visibility", txt: `AINDA ACORDADO ÀS ${bedtime}`, bad: true }
    : hitsGoal
      ? { icon: "bedtime", txt: quality >= 4 ? "NOITE LIMPA · RONRONANDO" : "NOITE LIMPA", bad: false }
      : { icon: "hourglass_bottom", txt: `COCHILO — ${minutesToHm(durationMin)} DE ${minutesToHm(goalMin)}`, bad: true };

  return (
    <div className="glass-card flex items-center gap-3 rounded-xl p-3">
      <div className="relative grid h-[92px] w-[112px] shrink-0 place-items-end justify-center rounded-lg bg-surface-container-high/60 pb-3">
        <span className="absolute inset-x-3 bottom-[10px] h-px bg-outline-variant/60" />
        <div className="relative">
          <Bicho stage={mini} coat={petCoat(pet.coat)} act={act} gear={pet.gear || {}} species={pet.species} />
          {Array.from({ length: zzz }, (_, i) => (
            <span
              key={i}
              className="pet-zzz pointer-events-none absolute right-1 top-0 font-headline-md text-[11px] text-on-surface-variant"
              style={{ animationDelay: `${i * 650}ms` }}
              aria-hidden="true"
            >
              z
            </span>
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <Caps className="text-outline block text-[9px]">{name ? `${name.toUpperCase()} DIZ` : "A SUA NOITE"}</Caps>

        <div className="flex items-center gap-2">
          <MI name={mood.icon} fill className={`text-base ${mood.bad ? "text-error" : "text-primary"}`} />
          <Caps className={`text-[10px] ${mood.bad ? "text-error" : "text-primary"}`}>{mood.txt}</Caps>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
          <div
            className={`h-full rounded-full transition-all ${hitsGoal ? "bg-primary-container" : "bg-error"}`}
            style={{ width: `${pctGoal}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-label-caps text-[9px] text-outline">
          <span>DEITOU {bedtime}</span>
          <span>ACORDOU {wake}</span>
          <span className={hitsGoal ? "text-primary" : "text-error"}>{minutesToHm(durationMin)}</span>
          <span>META {minutesToHm(goalMin)}</span>
          <span className="flex items-center gap-1">
            <MI name="star" fill className="text-[11px] text-[#f7c948]" />
            {quality}/5
          </span>
        </div>
      </div>

      <Link
        href="/perfil#mascote"
        className="shrink-0 self-start p-1 text-outline transition hover:text-primary-container"
        aria-label="Ver o mascote no perfil"
      >
        <MI name="open_in_new" className="text-base" />
      </Link>
    </div>
  );
}
