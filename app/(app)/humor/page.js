"use client";

// Página de Humor = registro + diagnóstico.
//
// Registro e diagnóstico moram juntos: a pergunta "o que melhora e o que piora meu humor"
// precisa de janela longa e comparação, e ler o resultado no mesmo lugar onde se registra é
// o que faz alguém marcar a etiqueta. O /sono ficou só com a faixa de carinhas dos mesmos
// 7 dias do gráfico de sono — leitura da correlação, não segundo formulário.

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader } from "@/components/ui";
import MoodPanel from "@/components/MoodPanel";
import MoodInsights from "@/components/MoodInsights";
import { LineChart } from "@/components/charts";
import { getDateStr, shiftDate, moodDayAvg, moodHasContent, moodPeriods, MOOD_OPTIONS, MOOD_TAGS } from "@/lib/state";

const HISTORY_RANGES = [
  { id: 14, label: "14D" },
  { id: 30, label: "30D" },
];
const tagLabel = (id) => (MOOD_TAGS.find((t) => t.id === id) || {}).label || id;

function moodStreak(moodMap) {
  let streak = 0;
  let off = moodHasContent(moodMap?.[getDateStr(0)]) ? 0 : -1;
  while (moodHasContent(moodMap?.[getDateStr(off)])) {
    streak++;
    off--;
  }
  return streak;
}

export default function HumorPage() {
  const { state, setState } = useApp();
  const [histRange, setHistRange] = useState(14);
  const mood = state.mood || {};
  const today = getDateStr(0);

  const days = Array.from({ length: histRange }, (_, i) => shiftDate(today, -(histRange - 1 - i)));
  const values = days.map((d) => moodDayAvg(mood[d]));
  const hasHistory = values.some((v) => v !== null);
  const streak = moodStreak(mood);
  const filled = days.filter((d) => moodHasContent(mood[d])).length;

  // notas recentes: é onde mora o "por quê" que nenhum número explica
  const notes = [];
  for (const d of Object.keys(mood).sort().reverse()) {
    for (const p of moodPeriods(mood[d])) {
      if (p.note) notes.push({ date: d, ...p });
    }
    if (notes.length >= 6) break;
  }

  return (
    <>
      <PageHeader
        title="HUMOR"
        subtitle="Registre os três períodos e veja o que levanta e o que derruba. Sem etiqueta o número não explica nada."
      />

      <div className="grid grid-cols-1 gap-gutter">
        {/* registro de hoje — mesmo painel do /sono */}
        <div className="grid grid-cols-1 md:grid-cols-12">
          <MoodPanel state={state} setState={setState} />
        </div>

        {/* diagnóstico */}
        <MoodInsights state={state} />

        {/* histórico */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-headline-md text-headline-md text-primary">Histórico</h3>
              <p className="text-[12px] text-on-surface-variant">
                Média do dia na escala 1–5. {filled} de {histRange} dias registrados · sequência atual de {streak} dia(s).
              </p>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-white/10 shrink-0">
              {HISTORY_RANGES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setHistRange(r.id)}
                  className={`px-3 py-1.5 font-label-caps text-[10px] transition ${
                    histRange === r.id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {hasHistory ? (
            <LineChart
              days={days}
              values={values}
              today={today}
              yMin={1}
              yMax={5.4}
              format={(v) => MOOD_OPTIONS.find((o) => o.value === Math.round(v))?.emoji || v.toFixed(1)}
              xLabel={(d) => d.slice(8, 10)}
              ariaLabel="Média de humor por dia (escala 1 a 5)"
              height={190}
            />
          ) : (
            <p className="text-[13px] text-outline text-center py-8">Sem registro nessa janela — marque o humor de hoje pra começar.</p>
          )}
        </div>

        {/* notas */}
        {notes.length > 0 && (
          <div className="glass-card p-6 rounded-xl">
            <h3 className="font-headline-md text-headline-md text-primary mb-1">Últimas notas</h3>
            <p className="text-[12px] text-on-surface-variant mb-3">O contexto que o número não guarda. Serve pra ler junto do diagnóstico.</p>
            <div className="space-y-2">
              {notes.slice(0, 6).map((n, i) => (
                <div key={`${n.date}-${n.key}-${i}`} className="flex items-start gap-2 rounded-lg bg-surface-container-high px-3 py-2">
                  <MI name="format_quote" className="text-outline text-base shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12px] text-on-surface">{n.note}</p>
                    <span className="text-[10px] text-outline tabular-nums">
                      {n.date.slice(8, 10)}/{n.date.slice(5, 7)} · nota {n.mood}
                      {(n.tags || []).length > 0 && ` · ${n.tags.map(tagLabel).join(", ")}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-outline text-center px-4 pb-2">
          <Caps className="text-[9px] text-outline">SEM XP</Caps> — registrar humor não pontua. Métrica que paga vira número inflado, e aqui o número precisa ser
          honesto pra servir de diagnóstico.
        </p>
      </div>
    </>
  );
}
