"use client";

// ============================================================================
// A NOITE DO BICHO — o mascote na tela de sono, em 5 layouts pra escolher.
//
// PRÉVIA: os cinco convivem atrás de um seletor local (`useState`), que some
// junto com os quatro perdedores assim que houver decisão. Nenhum deles grava
// nada; a escolha não é preferência de usuário, é decisão de produto.
//
// O que TODOS compartilham é a leitura, não o desenho: a pose sai do veredito do
// registro (dorme / cochila / fica acordado), as estrelas acesas são a nota de
// qualidade, e tudo lê o ESTADO DO FORMULÁRIO — mexer no horário muda a cena na
// hora, antes de salvar. O bicho é o mesmo do perfil: espécie, pelagem, degrau de
// crescimento e acessórios comprados.
//
//   arco     cena grande: céu, arco da noite (19h→7h) e o bicho na cama
//   faixa    barra fina, sem céu, no formato da faixa das outras telas
//   cama     só o bicho, grande, sem cenário — cores do tema
//   relogio  mostrador de 24h com a janela de sono e o bicho no centro
//   janela   quarto onde o céu cabe só dentro da janela
// ============================================================================

import { useState } from "react";
import Link from "next/link";
import { MI, Caps } from "@/components/ui";
import { Bicho } from "@/components/PetArt";
import { petCoat, petGrowth, petSpecies, defaultPet, bedtimeLateness, minutesToHm } from "@/lib/state";

export const LAYOUTS = [
  { id: "arco", label: "ARCO", hint: "cena grande: céu, arco da noite e o bicho na cama" },
  { id: "faixa", label: "FAIXA", hint: "barra fina, sem céu — mesmo formato da faixa das outras telas" },
  { id: "cama", label: "CAMA", hint: "só o bicho, grande, sem cenário nenhum" },
  { id: "relogio", label: "RELÓGIO", hint: "mostrador de 24h com o sono marcado e o bicho no centro" },
  { id: "janela", label: "JANELA", hint: "quarto onde o céu cabe só dentro da janela" },
];

// ---------------------------------------------------------------- a noite em números
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
// ANOITECER, não meia-noite fechada. Quanto mais tarde você deitou, mais fundo.
// Trocar a paleta é trocar estas 9 cores.
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

// ---------------------------------------------------------------- peças reusadas

function Estrelas({ quality, spots = STAR_SPOTS, size = 13 }) {
  return spots.map((s, i) => {
    const on = i < quality;
    return (
      <span
        key={i}
        className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${on ? "pet-twinkle text-[#f7c948]" : "text-white/55"}`}
        style={{ left: `${s.l}%`, top: `${s.t}%`, animationDelay: `${i * 420}ms` }}
        aria-hidden="true"
      >
        <MI name="star" fill style={{ fontSize: on ? size : size - 3 }} />
      </span>
    );
  });
}

function Zzz({ n, className = "text-white/85" }) {
  return Array.from({ length: n }, (_, i) => (
    <span
      key={i}
      className={`pet-zzz pointer-events-none absolute right-1 top-0 font-headline-md text-[11px] ${className}`}
      style={{ animationDelay: `${i * 650}ms` }}
      aria-hidden="true"
    >
      z
    </span>
  ));
}

function Titulo({ v }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4">
      <h3 className="font-headline-md text-headline-md text-on-surface uppercase">
        A noite {v.name ? `de ${v.name}` : `do ${v.bicho.label.toLowerCase()}`}
      </h3>
      <Link href="/perfil#mascote" className="p-1 text-outline transition hover:text-primary-container" aria-label="Ver o mascote no perfil">
        <MI name="open_in_new" className="text-base" />
      </Link>
    </div>
  );
}

function Veredito({ v }) {
  return (
    <div className="flex items-center gap-2">
      <MI name={v.mood.icon} fill className={`text-base ${v.mood.bad ? "text-error" : "text-primary"}`} />
      <Caps className={`text-[10px] ${v.mood.bad ? "text-error" : "text-primary"}`}>{v.mood.txt}</Caps>
    </div>
  );
}

function Numeros({ v }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-label-caps text-[9px] text-outline">
      <span>DEITOU {v.bedtime}</span>
      <span>ACORDOU {v.wake}</span>
      <span className={v.hitsGoal ? "text-primary" : "text-error"}>{minutesToHm(v.durationMin)}</span>
      <span>META {minutesToHm(v.goalMin)}</span>
      <span className="flex items-center gap-1">
        <MI name="star" fill className="text-[11px] text-[#f7c948]" />
        {v.quality}/5
      </span>
    </div>
  );
}

function Rodape({ v, children }) {
  return (
    <div className="space-y-2 border-t border-outline-variant/40 p-4">
      <Veredito v={v} />
      {children}
      <Numeros v={v} />
      {!v.name && (
        <Link href="/perfil#mascote" className="inline-flex items-center gap-1 font-label-caps text-[10px] text-primary-container hover:underline">
          <MI name="edit" className="text-sm" /> DÊ UM NOME A ELE
        </Link>
      )}
    </div>
  );
}

// barra de duração contra a meta — some quando o layout já mostra o tempo de outro jeito
function BarraMeta({ v }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
      <div
        className={`h-full rounded-full transition-all ${v.hitsGoal ? "bg-primary-container" : "bg-error"}`}
        style={{ width: `${v.pctGoal}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- 1. ARCO

function Arco({ v }) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <Titulo v={v} />
      <div className="relative mt-3 h-[190px] overflow-hidden" style={{ background: skyOf(v.lateMin) }}>
        {/* céu: arco da noite + astros. inset-x-6 dá margem pra lua não cortar */}
        <div className="absolute inset-x-6 top-3 h-[104px]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <polyline points={arcPath(0, 1)} fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
            <polyline
              points={arcPath(Math.min(v.tBed, v.tWake), Math.max(v.tBed, v.tWake))}
              fill="none"
              stroke={v.onTime ? "var(--color-primary-container)" : "var(--color-error)"}
              strokeWidth="4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={v.tLimit * 100}
              y1={arcY(v.tLimit) - 9}
              x2={v.tLimit * 100}
              y2={arcY(v.tLimit) + 9}
              stroke="#ffffff"
              strokeOpacity="0.75"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <Estrelas quality={v.quality} />

          <span className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${v.tBed * 100}%`, top: `${arcY(v.tBed)}%` }} aria-hidden="true">
            <MI name="bedtime" fill className={`text-xl ${v.onTime ? "text-[#f7c948]" : "text-error"}`} />
          </span>
          <span className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[#ffcf83]" style={{ left: `${v.tWake * 100}%`, top: `${arcY(v.tWake)}%` }} aria-hidden="true">
            <MI name="wb_twilight" fill className="text-lg" />
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-9 border-t border-white/10 bg-black/20" />
        <div className="absolute bottom-4 left-1/2 h-7 w-[164px] -translate-x-1/2 rounded-full border border-white/25 bg-white/25" />
        <div className="absolute bottom-[26px] left-[calc(50%-64px)] h-5 w-11 rounded-lg border border-white/25 bg-white/40" />

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <Bicho stage={v.stage} coat={v.coat} act={v.act} gear={v.gear} species={v.species} />
          <Zzz n={v.zzz} />
        </div>
      </div>
      <Rodape v={v}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-label-caps text-[9px] text-outline">
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full" style={{ background: v.onTime ? "var(--color-primary-container)" : "var(--color-error)" }} />
            SEU SONO
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 border-l border-dashed border-on-surface-variant" />
            LIMITE {v.limit}
          </span>
        </div>
      </Rodape>
    </div>
  );
}

// ---------------------------------------------------------------- 2. FAIXA

function Faixa({ v }) {
  const mini = { ...v.stage, size: Math.round(v.stage.size * 0.7) };
  return (
    <div className="glass-card flex items-center gap-3 rounded-xl p-3">
      <div className="relative grid h-[92px] w-[112px] shrink-0 place-items-end justify-center rounded-lg bg-surface-container-high/60 pb-3">
        <span className="absolute inset-x-3 bottom-[10px] h-px bg-outline-variant/60" />
        <div className="relative">
          <Bicho stage={mini} coat={v.coat} act={v.act} gear={v.gear} species={v.species} />
          <Zzz n={v.zzz} className="text-on-surface-variant" />
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <Caps className="text-outline block text-[9px]">{v.name ? `${v.name.toUpperCase()} DIZ` : "A SUA NOITE"}</Caps>
        <Veredito v={v} />
        <BarraMeta v={v} />
        <Numeros v={v} />
      </div>

      <Link href="/perfil#mascote" className="shrink-0 self-start p-1 text-outline transition hover:text-primary-container" aria-label="Ver o mascote no perfil">
        <MI name="open_in_new" className="text-base" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------- 3. CAMA

function Cama({ v }) {
  return (
    <div className="glass-card overflow-hidden rounded-xl">
      <Titulo v={v} />
      {/* Sem céu: só tokens do tema. É o layout pra quem quer o bicho, não a cena. */}
      <div className="relative mt-2 h-[200px] bg-gradient-to-b from-surface-container-high/70 to-transparent">
        <div className="absolute inset-x-0 bottom-0 h-10 border-t border-outline-variant/50 bg-surface-variant/30" />

        {/* cama: colchão, travesseiro e cobertor */}
        <div className="absolute bottom-5 left-1/2 h-9 w-[216px] -translate-x-1/2 rounded-2xl border border-outline-variant bg-surface-container-highest" />
        <div className="absolute bottom-[30px] left-[calc(50%-84px)] h-6 w-14 rounded-lg border border-outline-variant bg-surface-container-low" />
        <div className="absolute bottom-5 left-[calc(50%-12px)] h-8 w-[120px] rounded-l-sm rounded-r-2xl border border-primary-container/40 bg-primary-container/20" />

        <div className="absolute bottom-[38px] left-1/2 -translate-x-1/2">
          <Bicho stage={v.stage} coat={v.coat} act={v.act} gear={v.gear} species={v.species} />
          <Zzz n={v.zzz} className="text-on-surface-variant" />
        </div>

        {/* as estrelas viram um cantinho discreto, não um céu */}
        <div className="absolute right-4 top-3 h-12 w-24">
          <Estrelas quality={v.quality} size={12} />
        </div>
      </div>
      <Rodape v={v}>
        <BarraMeta v={v} />
      </Rodape>
    </div>
  );
}

// ---------------------------------------------------------------- 4. RELÓGIO

// Mostrador de 24h: meia-noite no topo, sentido horário. O ângulo é a hora, então a
// janela de sono vira um arco cuja ABERTURA é a duração — dá pra ver que dormiu
// pouco sem ler número nenhum.
const ang = (min) => ((min % 1440) / 1440) * 360;
const pol = (r, a) => [100 + r * Math.sin((a * Math.PI) / 180), 100 - r * Math.cos((a * Math.PI) / 180)];
function dialArc(r, a0, a1) {
  const [x0, y0] = pol(r, a0);
  const [x1, y1] = pol(r, a1);
  const sweep = (a1 - a0 + 360) % 360;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function Relogio({ v }) {
  const aBed = ang(toMin(v.bedtime));
  const aWake = ang(toMin(v.wake));
  const aLimit = ang(toMin(v.limit));
  const mini = { ...v.stage, size: Math.round(v.stage.size * 0.72) };
  const R = 78;

  return (
    <div className="glass-card overflow-hidden rounded-xl">
      <Titulo v={v} />
      <div className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-center">
        <div className="relative h-[180px] w-[180px] shrink-0">
          <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-surface-variant)" strokeWidth="12" />
            {/* marcas de 3 em 3 horas */}
            {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
              const [x0, y0] = pol(R - 9, ang(h * 60));
              const [x1, y1] = pol(R + 9, ang(h * 60));
              return <line key={h} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--color-outline-variant)" strokeWidth="1.5" />;
            })}
            {/* Deitar e acordar no mesmo horário são 24h de sono: o arco A do SVG
                não desenha nada quando começa e termina no mesmo ponto, então esse
                caso vira círculo cheio na mão. */}
            {(aWake - aBed + 360) % 360 < 0.5 ? (
              <circle cx="100" cy="100" r={R} fill="none" stroke={v.onTime ? "var(--color-primary-container)" : "var(--color-error)"} strokeWidth="12" />
            ) : (
              <path
                d={dialArc(R, aBed, aWake)}
                fill="none"
                stroke={v.onTime ? "var(--color-primary-container)" : "var(--color-error)"}
                strokeWidth="12"
                strokeLinecap="round"
              />
            )}
            {/* o limite que você definiu, atravessando o anel */}
            <line
              x1={pol(R - 12, aLimit)[0]}
              y1={pol(R - 12, aLimit)[1]}
              x2={pol(R + 12, aLimit)[0]}
              y2={pol(R + 12, aLimit)[1]}
              stroke="var(--color-on-surface)"
              strokeWidth="2"
              strokeDasharray="3 2"
            />
            {[
              { h: 0, t: "0h" },
              { h: 6, t: "6h" },
              { h: 12, t: "12h" },
              { h: 18, t: "18h" },
            ].map(({ h, t }) => {
              const [x, y] = pol(R - 22, ang(h * 60));
              return (
                <text key={h} x={x} y={y + 3} textAnchor="middle" fontSize="9" fill="var(--color-outline)" fontFamily="var(--font-label-caps)">
                  {t}
                </text>
              );
            })}
          </svg>

          {/* lua e sol nas pontas do arco */}
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pol(R, aBed)[0] / 2}%`, top: `${pol(R, aBed)[1] / 2}%` }}
            aria-hidden="true"
          >
            <MI name="bedtime" fill className={`text-[15px] ${v.onTime ? "text-on-primary-container" : "text-on-error-container"}`} />
          </span>
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pol(R, aWake)[0] / 2}%`, top: `${pol(R, aWake)[1] / 2}%` }}
            aria-hidden="true"
          >
            <MI name="wb_twilight" fill className="text-[15px] text-on-primary-container" />
          </span>

          {/* o bicho dorme no meio do mostrador */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[42%]">
            <Bicho stage={mini} coat={v.coat} act={v.act} gear={v.gear} species={v.species} />
            <Zzz n={v.zzz} className="text-on-surface-variant" />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <Veredito v={v} />
          <div className="font-headline-md text-headline-md text-on-surface">{minutesToHm(v.durationMin)}</div>
          <BarraMeta v={v} />
          <Numeros v={v} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-label-caps text-[9px] text-outline">
            <span className="flex items-center gap-1.5">
              <span className="h-3 border-l border-dashed border-on-surface" />
              LIMITE {v.limit}
            </span>
            <span className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <MI key={i} name="star" fill className={`text-[11px] ${i < v.quality ? "text-[#f7c948]" : "text-outline-variant"}`} />
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 5. JANELA

// Estrelas apertadas: dentro da janela o espaço é um sexto do céu do layout ARCO.
const STAR_SPOTS_JANELA = [
  { l: 14, t: 26 },
  { l: 34, t: 12 },
  { l: 56, t: 22 },
  { l: 74, t: 10 },
  { l: 88, t: 30 },
];

function Janela({ v }) {
  return (
    <div className="glass-card overflow-hidden rounded-xl">
      <Titulo v={v} />
      {/* O céu não é mais o fundo: ele cabe dentro do caixilho. Resolve o bloco de
          cor no meio da tela sem perder que é noite lá fora. */}
      <div className="relative mt-2 h-[210px] bg-surface-container-high/50">
        <div className="absolute right-5 top-4 h-[104px] w-[138px] overflow-hidden rounded-md border-[5px] border-[#8b6b45] shadow-lg shadow-black/20">
          <div className="absolute inset-0" style={{ background: skyOf(v.lateMin) }} />
          <Estrelas quality={v.quality} spots={STAR_SPOTS_JANELA} size={12} />
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${12 + v.tBed * 76}%`, top: `${arcY(v.tBed) * 0.72}%` }}
            aria-hidden="true"
          >
            <MI name="bedtime" fill className={`text-lg ${v.onTime ? "text-[#f7c948]" : "text-error"}`} />
          </span>
          {/* caixilho */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#8b6b45]" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-[#8b6b45]" />
        </div>

        {/* piso e rodapé do quarto */}
        <div className="absolute inset-x-0 bottom-0 h-12 border-t-2 border-outline-variant bg-surface-variant/40" />

        {/* cama encostada na parede da esquerda */}
        <div className="absolute bottom-7 left-6 h-8 w-[168px] rounded-xl border border-outline-variant bg-surface-container-highest" />
        <div className="absolute bottom-[30px] left-8 h-6 w-12 rounded-md border border-outline-variant bg-surface-container-low" />

        <div className="absolute bottom-[54px] left-[86px] -translate-x-1/2">
          <Bicho stage={v.stage} coat={v.coat} act={v.act} gear={v.gear} species={v.species} />
          <Zzz n={v.zzz} className="text-on-surface-variant" />
        </div>
      </div>
      <Rodape v={v}>
        <BarraMeta v={v} />
      </Rodape>
    </div>
  );
}

const RENDER = { arco: Arco, faixa: Faixa, cama: Cama, relogio: Relogio, janela: Janela };

// ---------------------------------------------------------------- entrada

export default function BichoDaNoite({ state, bedtime, wake, durationMin, goalMin, limit, quality }) {
  const [layout, setLayout] = useState(LAYOUTS[0].id);

  const pet = state.pet || defaultPet();
  const lateMin = bedtimeLateness(bedtime, limit);
  const onTime = lateMin <= 0;
  const hitsGoal = durationMin >= goalMin;

  const v = {
    pet,
    species: pet.species,
    bicho: petSpecies(pet.species),
    coat: petCoat(pet.coat),
    stage: petGrowth(state.stats).cur,
    gear: pet.gear || {},
    name: (pet.name || "").trim(),
    bedtime,
    wake,
    durationMin,
    goalMin,
    limit,
    quality,
    lateMin,
    onTime,
    hitsGoal,
    tBed: arcT(toMin(bedtime)),
    tWake: arcT(toMin(wake)),
    tLimit: arcT(toMin(limit)),
    pctGoal: Math.min(100, Math.round((durationMin / Math.max(1, goalMin)) * 100)),
    // A pose é o veredito do registro. Deitar tarde é o único caso em que ele NÃO
    // dorme: o bicho fica acordado junto, que é o ponto da tela.
    act: !onTime ? "idle" : hitsGoal ? "sleep" : "sit",
    zzz: onTime ? Math.max(1, Math.min(4, Math.round(durationMin / 120))) : 0,
    mood: !onTime
      ? { icon: "visibility", txt: `AINDA ACORDADO ÀS ${bedtime}`, bad: true }
      : hitsGoal
        ? { icon: "bedtime", txt: quality >= 4 ? "NOITE LIMPA · RONRONANDO" : "NOITE LIMPA", bad: false }
        : { icon: "hourglass_bottom", txt: `COCHILO — ${minutesToHm(durationMin)} DE ${minutesToHm(goalMin)}`, bad: true },
  };

  const Render = RENDER[layout] || Arco;
  const atual = LAYOUTS.find((l) => l.id === layout);

  return (
    <div className="space-y-2">
      {/* SELETOR DE PRÉVIA — temporário. Sai junto com os layouts não escolhidos. */}
      <div className="rounded-xl border border-dashed border-outline-variant/70 p-2.5">
        <div className="mb-2 flex items-center gap-1.5">
          <MI name="science" className="text-sm text-outline" />
          <Caps className="text-outline text-[9px]">PRÉVIA · ESCOLHA UM LAYOUT</Caps>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LAYOUTS.map((l) => {
            const on = l.id === layout;
            return (
              <button
                key={l.id}
                onClick={() => setLayout(l.id)}
                aria-pressed={on}
                className={`rounded-full border px-2.5 py-1 font-label-caps text-[9px] transition ${
                  on ? "border-primary-container bg-primary-container/15 text-primary-container" : "border-outline-variant text-outline hover:border-outline"
                }`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] leading-tight text-outline">{atual?.hint}</p>
      </div>

      <Render v={v} />
    </div>
  );
}
