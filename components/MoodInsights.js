"use client";

// Diagnóstico do humor: o que aparece junto com humor melhor e pior.
//
// A tela mostra DIFERENÇA, não média solta — "4,2 nos dias de treino" só significa
// algo ao lado de "3,1 nos dias sem". Cada linha carrega o n dos dois lados, e fator
// com amostra pequena não recebe barra nenhuma: vai pra lista de "falta dado".
//
// Cor não é o que codifica o sinal (o accent do tema é vermelho no escuro e azul no
// claro, então "vermelho = ruim" mentiria em metade dos casos): quem codifica é o
// LADO da linha de base, mais o sinal + / − escrito no número.

import { useState } from "react";
import { MI, Caps } from "@/components/ui";
import { MOOD_MIN_SIDE, MOOD_OPTIONS, moodDiagnostics } from "@/lib/state";

const RANGES = [
  { id: 30, label: "30D" },
  { id: 90, label: "90D" },
  { id: 0, label: "TUDO" },
];

const num = (n) => (n === null || n === undefined ? "—" : n.toFixed(2).replace(".", ","));
const signed = (n) => (n === null || n === undefined ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2).replace(".", ",")}`);
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const FACE = { 1: "sentiment_very_dissatisfied", 2: "sentiment_dissatisfied", 3: "sentiment_neutral", 4: "sentiment_satisfied", 5: "sentiment_very_satisfied" };
const faceOf = (v) => FACE[Math.max(1, Math.min(5, Math.round(v || 3)))];

// Uma linha do ranking: rótulo, barra saindo da linha de base pro lado do efeito,
// e o par com/sem por extenso. `max` normaliza a largura entre todas as linhas.
function EffectRow({ item, max }) {
  const up = item.delta > 0;
  const pct = Math.min(100, (Math.abs(item.delta) / (max || 1)) * 100);
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="flex items-center gap-1.5 w-[46%] min-w-0">
        <MI name={item.icon || "label"} className="text-outline text-[15px] shrink-0" />
        <span className="text-[12px] text-on-surface truncate" title={item.label}>
          {item.label}
        </span>
        {item.level === "registro" && (
          <span className="text-[9px] text-outline shrink-0" title="Etiqueta: medida por registro de período, não por dia">
            ·per
          </span>
        )}
      </div>

      {/* eixo: metade esquerda = derruba, metade direita = levanta */}
      <div className="flex-1 h-4 flex items-center min-w-[70px]">
        <div className="flex-1 h-2 flex justify-end">
          {!up && <div className="h-full rounded-l-sm bg-outline/70" style={{ width: `${pct}%` }} />}
        </div>
        <div className="w-px h-4 bg-outline-variant/70 shrink-0" />
        <div className="flex-1 h-2">
          {up && <div className="h-full rounded-r-sm bg-primary-container" style={{ width: `${pct}%` }} />}
        </div>
      </div>

      <span className={`text-[12px] tabular-nums font-bold w-12 text-right shrink-0 ${up ? "text-primary" : "text-on-surface-variant"}`}>
        {signed(item.delta)}
      </span>
      <span
        className="text-[10px] text-outline tabular-nums w-24 text-right shrink-0 hidden sm:block"
        title={`Com: ${num(item.withAvg)} em ${item.withN} · Sem: ${num(item.withoutAvg)} em ${item.withoutN}`}
      >
        {num(item.withAvg)} vs {num(item.withoutAvg)}
      </span>
    </div>
  );
}

function Bars({ rows, unitLabel }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.delta ?? 0)), 0.2);
  return (
    <div className="divide-y divide-white/5">
      {rows.map((r) => (
        <EffectRow key={r.id || r.key || r.dow} item={r} max={max} />
      ))}
      {unitLabel && <p className="text-[10px] text-outline pt-2">{unitLabel}</p>}
    </div>
  );
}

// perfil simples numa escala 1–5 (períodos e dias da semana): média + n
function ProfileBars({ rows, baseline }) {
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const has = r.withAvg !== null && r.withN > 0;
        const pct = has ? ((r.withAvg - 1) / 4) * 100 : 0;
        const basePct = baseline ? ((baseline - 1) / 4) * 100 : null;
        return (
          <div key={r.key || r.dow} className="flex items-center gap-2">
            <Caps className="text-outline text-[10px] w-14 shrink-0">{r.label.toUpperCase()}</Caps>
            <div className="flex-1 h-5 rounded bg-surface-variant/50 relative overflow-hidden">
              {has && <div className="h-full bg-primary-container/70" style={{ width: `${pct}%` }} />}
              {basePct !== null && (
                <div className="absolute top-0 bottom-0 w-px bg-on-surface/50" style={{ left: `${basePct}%` }} title={`Média geral ${num(baseline)}`} />
              )}
            </div>
            {has ? (
              <>
                <MI name={faceOf(r.withAvg)} fill className="text-[16px] text-on-surface-variant shrink-0" />
                <span className="text-[12px] tabular-nums text-on-surface w-8 text-right shrink-0">{num(r.withAvg)}</span>
                <span className="text-[10px] text-outline tabular-nums w-14 text-right shrink-0">{r.withN} reg.</span>
              </>
            ) : (
              <span className="text-[11px] text-outline flex-1 text-right">sem registro</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MoodInsights({ state }) {
  const [range, setRange] = useState(90);
  const [showMissing, setShowMissing] = useState(false);
  const d = moodDiagnostics(state, range);
  const rangeLabel = (RANGES.find((r) => r.id === range) || {}).label;

  if (!d.dayBaseline.n) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <h3 className="font-headline-md text-headline-md text-primary mb-1">Diagnóstico do humor</h3>
        <p className="text-[13px] text-on-surface-variant">
          Sem registro nenhum ainda. Marque o humor dos períodos por alguns dias — e use as etiquetas, porque é elas que transformam número em explicação.
        </p>
      </div>
    );
  }

  const best = d.periods.reduce((m, p) => (p.withAvg !== null && (!m || p.withAvg > m.withAvg) ? p : m), null);
  const worst = d.periods.reduce((m, p) => (p.withAvg !== null && (!m || p.withAvg < m.withAvg) ? p : m), null);

  return (
    <div className="glass-card p-6 rounded-xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-headline-md text-headline-md text-primary">Diagnóstico do humor</h3>
          <p className="text-[12px] text-on-surface-variant max-w-xl">
            O que apareceu junto com humor melhor ou pior. Comparação é sempre <span className="text-on-surface">com vs sem</span> — média solta não diz nada.
          </p>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-white/10 shrink-0">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-3 py-1.5 font-label-caps text-[10px] transition ${
                range === r.id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* resumo da janela */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg bg-surface-container-high p-3">
          <Caps className="text-outline text-[9px] block">MÉDIA · {rangeLabel}</Caps>
          <div className="flex items-center gap-1.5">
            <MI name={faceOf(d.dayBaseline.avg)} fill className="text-[20px] text-primary" />
            <span className="font-headline-md text-[20px] text-primary tabular-nums leading-none">{num(d.dayBaseline.avg)}</span>
          </div>
          <span className="text-[10px] text-outline">{d.dayBaseline.n} dia(s) · {d.recordBaseline.n} registros</span>
        </div>
        <div className="rounded-lg bg-surface-container-high p-3">
          <Caps className="text-outline text-[9px] block">MELHOR PERÍODO</Caps>
          <div className="font-headline-md text-[20px] text-on-surface leading-none">{best ? best.label : "—"}</div>
          <span className="text-[10px] text-outline">{best ? `${num(best.withAvg)} de média` : "sem dado"}</span>
        </div>
        <div className="rounded-lg bg-surface-container-high p-3">
          <Caps className="text-outline text-[9px] block">PIOR PERÍODO</Caps>
          <div className="font-headline-md text-[20px] text-on-surface leading-none">{worst ? worst.label : "—"}</div>
          <span className="text-[10px] text-outline">{worst ? `${num(worst.withAvg)} de média` : "sem dado"}</span>
        </div>
        <div className="rounded-lg bg-surface-container-high p-3">
          <Caps className="text-outline text-[9px] block">EXTREMOS</Caps>
          <div className="text-[12px] text-on-surface tabular-nums leading-tight">
            {d.best ? `${dm(d.best.date)} · ${num(d.best.avg)}` : "—"}
          </div>
          <span className="text-[10px] text-outline tabular-nums">{d.worst ? `pior: ${dm(d.worst.date)} · ${num(d.worst.avg)}` : ""}</span>
        </div>
      </div>

      {/* levanta */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MI name="trending_up" className="text-primary-container text-lg" />
          <Caps className="text-primary text-[10px]">O QUE LEVANTA</Caps>
        </div>
        {d.ups.length ? (
          <Bars rows={d.ups} />
        ) : (
          <p className="text-[12px] text-outline py-2">Nada com efeito positivo mensurável nessa janela.</p>
        )}
      </div>

      {/* derruba */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MI name="trending_down" className="text-outline text-lg" />
          <Caps className="text-on-surface-variant text-[10px]">O QUE DERRUBA</Caps>
        </div>
        {d.downs.length ? (
          <Bars rows={d.downs} />
        ) : (
          <p className="text-[12px] text-outline py-2">Nada com efeito negativo mensurável nessa janela.</p>
        )}
      </div>

      <p className="text-[11px] text-outline">
        A barra sai da linha do meio: à direita levanta, à esquerda derruba. O número é a diferença na escala de 1 a 5, e ao lado vem a média{" "}
        <span className="text-on-surface-variant">com vs sem</span>. Linha marcada com <span className="text-on-surface-variant">·per</span> é etiqueta, medida por
        registro de período; as outras são por dia.
      </p>

      {/* medido e sem efeito */}
      {d.flat.length > 0 && (
        <div>
          <Caps className="text-outline text-[9px] block mb-1.5">MEDIDO E SEM EFEITO VISÍVEL</Caps>
          <div className="flex flex-wrap gap-1.5">
            {d.flat.map((x) => (
              <span
                key={x.id}
                title={`${num(x.withAvg)} com · ${num(x.withoutAvg)} sem`}
                className="px-2 py-1 rounded-full border border-white/10 text-[10px] font-label-caps text-outline"
              >
                {x.label} {signed(x.delta)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* perfis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
        <div>
          <Caps className="text-outline text-[9px] block mb-2">HUMOR POR PERÍODO DO DIA</Caps>
          <ProfileBars rows={d.periods} baseline={d.recordBaseline.avg} />
        </div>
        <div>
          <Caps className="text-outline text-[9px] block mb-2">HUMOR POR DIA DA SEMANA</Caps>
          <ProfileBars rows={d.weekdays} baseline={d.dayBaseline.avg} />
        </div>
      </div>
      <p className="text-[11px] text-outline">
        A linha vertical clara nas barras é a média geral da janela — o que passa dela está acima do seu normal. Escala:{" "}
        {MOOD_OPTIONS.map((o) => `${o.value} ${o.label.toLowerCase()}`).join(" · ")}.
      </p>

      {/* falta dado */}
      {d.missing.length > 0 && (
        <div className="pt-1">
          <button onClick={() => setShowMissing((v) => !v)} className="flex items-center gap-1.5 text-[11px] text-outline hover:text-on-surface-variant transition">
            <MI name="expand_more" className={`text-base transition-transform ${showMissing ? "rotate-180" : ""}`} />
            {d.missing.length} fator(es) sem dado suficiente
          </button>
          {showMissing && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.missing.map((x) => (
                <span key={x.id} className="px-2 py-1 rounded-full border border-white/10 text-[10px] font-label-caps text-outline">
                  {x.label} · {x.withN}×{x.withoutN}
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-outline mt-2">
            Precisa de pelo menos {MOOD_MIN_SIDE} observações de cada lado pra virar número. Abaixo disso seria opinião com aparência de estatística.
          </p>
        </div>
      )}

      <p className="text-[11px] text-outline border-t border-white/5 pt-3">
        Isto é <strong className="font-semibold">associação, não causa</strong>: treino aparecer junto de humor melhor pode ser você treinar quando já está bem. O
        uso certo é levantar hipótese e testar de propósito — mude uma coisa por duas semanas e volte aqui.
      </p>
    </div>
  );
}
