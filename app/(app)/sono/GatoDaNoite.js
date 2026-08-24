"use client";

// ============================================================================
// A NOITE DO GATO — o mascote deitado na tela de sono.
//
// Não é enfeite: é o mesmo gráfico que os números acima já contam, desenhado como
// cena. O arco é a noite inteira (19h → 7h), o trecho grosso é o seu sono, a lua
// marca a hora que você deitou e o traço marca o limite que você definiu. Quem
// olha vê na hora se a lua passou do traço — que é exatamente a pergunta que a
// tela faz.
//
// Três amarrações com o resto do app, todas de propósito:
//   • as estrelas ACESAS são a nota de qualidade do descanso — a mesma que está
//     nas estrelinhas do formulário, só que no céu;
//   • o gato dorme, cochila ou fica acordado conforme o registro que você está
//     digitando AGORA (não o salvo) — mexer no horário move a lua e muda a pose;
//   • é o gato de verdade: mesma pelagem, mesmo degrau de crescimento e mesmos
//     acessórios da lojinha, porque o desenho vem de `components/PetArt.js`.
//
// Coordenadas: o SVG do arco usa preserveAspectRatio="none" sobre a MESMA caixa
// que posiciona a lua e o sol em %, então os dois usam a fórmula `arcY` e caem
// sempre no mesmo ponto, em qualquer largura.
// ============================================================================

import Link from "next/link";
import { MI, Caps } from "@/components/ui";
import { Cat } from "@/components/PetArt";
import { petCoat, petGrowth, defaultPet, bedtimeLateness, minutesToHm } from "@/lib/state";

// A noite desenhada vai das 19h às 7h. Fora disso o valor encosta na borda em vez
// de sumir — dormir às 17h é raro, mas nunca deve quebrar o desenho.
const ARC_FROM = 19 * 60;
const ARC_SPAN = 12 * 60;

const toMin = (s) => {
  const [h, m] = String(s || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
// Antes do meio-dia é "do outro lado" da meia-noite: 01:00 vem depois das 23:00.
const arcT = (min) => {
  const v = min < 12 * 60 ? min + 24 * 60 : min;
  return Math.max(0, Math.min(1, (v - ARC_FROM) / ARC_SPAN));
};
const arcY = (t) => 80 - 62 * Math.sin(Math.PI * t); // em % da caixa do arco

function arcPath(from, to, steps = 40) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    pts.push(`${(t * 100).toFixed(2)},${arcY(t).toFixed(2)}`);
  }
  return pts.join(" ");
}

// Céu fixo em hex, mesma regra da pelagem: noite é noite nos dois temas — mas um
// ANOITECER, não meia-noite fechada. O azul-marinho quase preto virava um bloco
// morto no meio da tela; este é um lusco-fusco cor de pervinca, claro o bastante
// pra o painel continuar sendo parte do app.
//
// A escala continua: quanto mais tarde você deitou, mais fundo fica — só que os
// três degraus inteiros subiram de luz. Trocar a paleta é trocar estas 9 cores.
function skyOf(lateMin) {
  if (lateMin <= 0) return "linear-gradient(180deg, #59689c 0%, #7b81b0 55%, #a08fa8 100%)";
  if (lateMin <= 60) return "linear-gradient(180deg, #46558a 0%, #656ba0 58%, #877e9c 100%)";
  return "linear-gradient(180deg, #35426f 0%, #4e5589 60%, #6d6890 100%)";
}

// 5 pousos fixos pras estrelas de qualidade. Fixos e não sorteados porque estrela
// que troca de lugar a cada tecla digitada vira ruído.
const STAR_SPOTS = [
  { l: 7, t: 30 },
  { l: 24, t: 12 },
  { l: 50, t: 6 },
  { l: 76, t: 12 },
  { l: 93, t: 28 },
];

export default function GatoDaNoite({ state, bedtime, wake, durationMin, goalMin, limit, quality }) {
  const pet = state.pet || defaultPet();
  const coat = petCoat(pet.coat);
  const stage = petGrowth(state.stats).cur;
  const gear = pet.gear || {};
  const name = (pet.name || "").trim();

  const lateMin = bedtimeLateness(bedtime, limit);
  const onTime = lateMin <= 0;
  const hitsGoal = durationMin >= goalMin;

  const tBed = arcT(toMin(bedtime));
  const tWake = arcT(toMin(wake));
  const tLimit = arcT(toMin(limit));

  // A pose é o veredito do registro. Deitar tarde é o único caso em que ele NÃO
  // dorme: o gato fica acordado junto, que é o ponto da tela.
  const act = !onTime ? "idle" : hitsGoal ? "sleep" : "sit";
  const zzz = onTime ? Math.max(1, Math.min(4, Math.round(durationMin / 120))) : 0;

  const mood = !onTime
    ? { icon: "visibility", txt: `AINDA ACORDADO ÀS ${bedtime}`, bad: true }
    : hitsGoal
      ? { icon: "bedtime", txt: quality >= 4 ? "NOITE LIMPA · RONRONANDO" : "NOITE LIMPA", bad: false }
      : { icon: "hourglass_bottom", txt: `COCHILO — ${minutesToHm(durationMin)} DE ${minutesToHm(goalMin)}`, bad: true };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4">
        <h3 className="font-headline-md text-headline-md text-on-surface uppercase">A noite {name ? `de ${name}` : "do gato"}</h3>
        <Link href="/perfil#mascote" className="p-1 text-outline transition hover:text-primary-container" aria-label="Ver o mascote no perfil">
          <MI name="open_in_new" className="text-base" />
        </Link>
      </div>

      <div className="relative mt-3 h-[190px] overflow-hidden" style={{ background: skyOf(lateMin) }}>
        {/* céu: arco da noite + astros. inset-x-6 dá margem pra lua não cortar */}
        <div className="absolute inset-x-6 top-3 h-[104px]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            {/* a noite inteira, de leve */}
            <polyline points={arcPath(0, 1)} fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
            {/* o seu sono */}
            <polyline
              points={arcPath(Math.min(tBed, tWake), Math.max(tBed, tWake))}
              fill="none"
              stroke={onTime ? "var(--color-primary-container)" : "var(--color-error)"}
              strokeWidth="4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {/* o limite que você mesmo definiu */}
            <line
              x1={tLimit * 100}
              y1={arcY(tLimit) - 9}
              x2={tLimit * 100}
              y2={arcY(tLimit) + 9}
              stroke="#ffffff"
              strokeOpacity="0.75"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* estrelas = qualidade do descanso */}
          {STAR_SPOTS.map((s, i) => {
            const on = i < quality;
            return (
              <span
                key={i}
                className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${on ? "pet-twinkle text-[#f7c948]" : "text-white/55"}`}
                style={{ left: `${s.l}%`, top: `${s.t}%`, animationDelay: `${i * 420}ms` }}
                aria-hidden="true"
              >
                <MI name="star" fill className={on ? "text-[13px]" : "text-[10px]"} />
              </span>
            );
          })}

          {/* lua = hora que deitou; sol = hora que acordou */}
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${tBed * 100}%`, top: `${arcY(tBed)}%` }}
            aria-hidden="true"
          >
            <MI name="bedtime" fill className={`text-xl ${onTime ? "text-[#f7c948]" : "text-error"}`} />
          </span>
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[#ffcf83]"
            style={{ left: `${tWake * 100}%`, top: `${arcY(tWake)}%` }}
            aria-hidden="true"
          >
            <MI name="wb_twilight" fill className="text-lg" />
          </span>
        </div>

        {/* chão do quarto */}
        <div className="absolute inset-x-0 bottom-0 h-9 border-t border-white/10 bg-black/20" />

        {/* cama */}
        <div className="absolute bottom-4 left-1/2 h-7 w-[164px] -translate-x-1/2 rounded-full border border-white/25 bg-white/25" />
        <div className="absolute bottom-[26px] left-[calc(50%-64px)] h-5 w-11 rounded-lg border border-white/25 bg-white/40" />

        {/* o gato: o mesmo do perfil, com o que ele estiver vestindo */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <Cat stage={stage} coat={coat} act={act} gear={gear} />
          {Array.from({ length: zzz }, (_, i) => (
            <span
              key={i}
              className="pet-zzz pointer-events-none absolute right-1 top-0 font-headline-md text-[11px] text-white/85"
              style={{ animationDelay: `${i * 650}ms` }}
              aria-hidden="true"
            >
              z
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-outline-variant/40 p-4">
        <div className="flex items-center gap-2">
          <MI name={mood.icon} fill className={`text-base ${mood.bad ? "text-error" : "text-primary"}`} />
          <Caps className={`text-[10px] ${mood.bad ? "text-error" : "text-primary"}`}>{mood.txt}</Caps>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-label-caps text-[9px] text-outline">
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full" style={{ background: onTime ? "var(--color-primary-container)" : "var(--color-error)" }} />
            SEU SONO
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 border-l border-dashed border-on-surface-variant" />
            LIMITE {limit}
          </span>
          <span className="flex items-center gap-1.5">
            <MI name="star" fill className="text-[11px] text-[#f7c948]" />
            {quality}/5 DE DESCANSO
          </span>
        </div>
        {!name && (
          <Link href="/perfil#mascote" className="inline-flex items-center gap-1 font-label-caps text-[10px] text-primary-container hover:underline">
            <MI name="edit" className="text-sm" /> DÊ UM NOME A ELE
          </Link>
        )}
      </div>
    </div>
  );
}
