"use client";

import { useApp } from "../AppContext";
import { MI, Caps } from "@/components/ui";
import { getDateStr, weekdayShort, minutesToHm, MOOD_OPTIONS } from "@/lib/state";

const N = 14; // janela de dias

function mean(a) {
  return a.reduce((s, x) => s + x, 0) / a.length;
}
// coeficiente de correlação de Pearson; null se n<3 ou variância zero
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}
function strength(r) {
  const a = Math.abs(r);
  if (a < 0.2) return "desprezível";
  if (a < 0.4) return "fraca";
  if (a < 0.6) return "moderada";
  if (a < 0.8) return "forte";
  return "muito forte";
}
function moodColor(v) {
  return v === 5 ? "#ffc107" : v === 1 ? "#ffb4ab" : "#ffe4af";
}

function CorrCard({ icon, title, r, n, positiveHint, negativeHint }) {
  if (r === null) {
    return (
      <div className="glass-card p-6 rounded-xl flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <MI name={icon} /> <Caps>{title}</Caps>
        </div>
        <p className="text-body-md text-on-surface-variant">Dados insuficientes. Registre ao menos 3 dias com ambos pra calcular.</p>
        <Caps className="text-outline text-[10px]">{n} dia(s) com dados</Caps>
      </div>
    );
  }
  const pct = Math.round(Math.abs(r) * 100);
  const positive = r >= 0;
  const hint = positive ? positiveHint : negativeHint;
  return (
    <div className="glass-card p-6 rounded-xl flex flex-col gap-3">
      <div className="flex items-center gap-2 text-primary">
        <MI name={icon} /> <Caps>{title}</Caps>
      </div>
      <div className="flex items-end gap-3">
        <span className="font-headline-lg text-headline-lg text-primary leading-none">{r >= 0 ? "+" : ""}{r.toFixed(2)}</span>
        <span className="font-label-caps text-label-caps text-on-surface-variant mb-1">r · {n} dias</span>
      </div>
      <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden border border-white/5">
        <div className={`h-full rounded-full ${positive ? "bg-primary-container" : "bg-error"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-body-md text-on-surface">
        Correlação <span className="text-primary font-bold">{strength(r)}</span> {positive ? "positiva" : "negativa"}. {hint}
      </p>
    </div>
  );
}

export default function AnalisePage() {
  const { state } = useApp();
  const days = Array.from({ length: N }, (_, i) => getDateStr(-(N - 1 - i)));
  const today = getDateStr(0);

  // treinos por data (soma de minutos)
  const trainByDate = {};
  for (const l of state.exerciseLogs) trainByDate[l.date] = (trainByDate[l.date] || 0) + l.durationMin;

  // linha do dia
  const rows = days.map((d) => ({
    date: d,
    mood: state.mood[d]?.mood ?? null,
    sleepMin: state.sleep[d]?.durationMin ?? null,
    sleepQuality: state.sleep[d]?.quality ?? null,
    trainMin: trainByDate[d] || 0,
    trained: (trainByDate[d] || 0) > 0,
  }));

  // usa TODO o histórico pra correlação (não só a janela de 14d)
  const allDates = new Set([...Object.keys(state.mood), ...Object.keys(state.sleep), ...Object.keys(trainByDate)]);

  // sono (h) × humor
  const sm = [...allDates].filter((d) => state.sleep[d] && state.mood[d]);
  const rSleepMood = pearson(sm.map((d) => state.sleep[d].durationMin / 60), sm.map((d) => state.mood[d].mood));

  // qualidade do sono × humor
  const qm = [...allDates].filter((d) => state.sleep[d]?.quality && state.mood[d]);
  const rQualMood = pearson(qm.map((d) => state.sleep[d].quality), qm.map((d) => state.mood[d].mood));

  // treino × humor: média de humor em dias treinados vs descanso
  const moodDates = [...allDates].filter((d) => state.mood[d]);
  const trainedMoods = moodDates.filter((d) => (trainByDate[d] || 0) > 0).map((d) => state.mood[d].mood);
  const restMoods = moodDates.filter((d) => !(trainByDate[d] || 0)).map((d) => state.mood[d].mood);
  const avgTrained = trainedMoods.length ? mean(trainedMoods) : null;
  const avgRest = restMoods.length ? mean(restMoods) : null;
  const moodDelta = avgTrained !== null && avgRest !== null ? avgTrained - avgRest : null;

  // escala sono do gráfico
  const goalMin = state.settings.sleepGoalMin || 450;
  const maxSleep = Math.max(600, goalMin + 60, ...rows.map((r) => r.sleepMin || 0));

  // pontos de humor pra linha (percentuais, para overlay SVG responsivo)
  const moodPts = rows
    .map((r, i) => (r.mood !== null ? { x: ((i + 0.5) / N) * 100, y: (1 - (r.mood - 1) / 4) * 100, v: r.mood } : null))
    .filter(Boolean);
  // segmentos só entre dias adjacentes com humor
  const segments = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].mood !== null && rows[i - 1].mood !== null) {
      segments.push({
        x1: ((i - 0.5) / N) * 100,
        y1: (1 - (rows[i - 1].mood - 1) / 4) * 100,
        x2: ((i + 0.5) / N) * 100,
        y2: (1 - (rows[i].mood - 1) / 4) * 100,
      });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline-lg text-headline-lg text-primary uppercase mb-2">Análise & Correlações</h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          Como sono e treino impactam seu humor. Quanto mais dias registrados, mais confiável a correlação.
        </p>
      </div>

      {/* Correlation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-card-gap">
        <CorrCard
          icon="bedtime"
          title="SONO → HUMOR"
          r={rSleepMood}
          n={sm.length}
          positiveHint="Dormir mais tende a elevar seu humor."
          negativeHint="Curioso: mais sono não veio acompanhado de humor melhor."
        />
        <CorrCard
          icon="star"
          title="QUALIDADE SONO → HUMOR"
          r={rQualMood}
          n={qm.length}
          positiveHint="Noites bem avaliadas puxam o humor pra cima."
          negativeHint="Qualidade percebida não acompanhou o humor."
        />
        {/* Treino x humor (comparação de médias) */}
        <div className="glass-card p-6 rounded-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-primary">
            <MI name="fitness_center" /> <Caps>TREINO → HUMOR</Caps>
          </div>
          {moodDelta === null ? (
            <p className="text-body-md text-on-surface-variant">Dados insuficientes. Registre humor em dias com e sem treino.</p>
          ) : (
            <>
              <div className="flex items-end gap-3">
                <span className="font-headline-lg text-headline-lg text-primary leading-none">
                  {moodDelta >= 0 ? "+" : ""}{moodDelta.toFixed(1)}
                </span>
                <span className="font-label-caps text-label-caps text-on-surface-variant mb-1">no humor médio</span>
              </div>
              <div className="flex gap-4 text-body-md">
                <div>
                  <Caps className="text-outline text-[10px]">TREINO</Caps>
                  <p className="text-primary font-bold">{avgTrained.toFixed(1)}<span className="text-outline text-xs">/5</span></p>
                </div>
                <div>
                  <Caps className="text-outline text-[10px]">DESCANSO</Caps>
                  <p className="text-on-surface font-bold">{avgRest.toFixed(1)}<span className="text-outline text-xs">/5</span></p>
                </div>
              </div>
              <p className="text-body-md text-on-surface">
                {moodDelta >= 0.1
                  ? "Seu humor é melhor nos dias em que treina."
                  : moodDelta <= -0.1
                  ? "Seu humor tem sido pior nos dias de treino — atenção à carga."
                  : "Treino e humor sem diferença clara até agora."}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Combined daily chart */}
      <section className="glass-card p-6 md:p-8 rounded-xl">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
          <div>
            <h3 className="font-headline-md text-headline-md">PANORAMA DIÁRIO ({N}D)</h3>
            <Caps className="text-on-surface-variant">HUMOR · SONO · TREINO LADO A LADO</Caps>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-[10px] font-label-caps">
              <span className="w-3 h-3 rounded-sm bg-surface-bright" /> SONO (H)
            </div>
            <div className="flex items-center gap-2 text-[10px] font-label-caps">
              <span className="w-3 h-3 rounded-full bg-primary" /> HUMOR (1–5)
            </div>
            <div className="flex items-center gap-2 text-[10px] font-label-caps">
              <MI name="fitness_center" className="text-primary-container text-base" /> TREINO
            </div>
          </div>
        </div>

        <div className="overflow-x-auto ff-scroll">
          <div style={{ minWidth: N * 44 }}>
            {/* plot */}
            <div className="relative flex items-end h-56 gap-1">
              {/* linha de meta de sono */}
              <div
                className="absolute left-0 right-0 border-t border-dashed border-primary/30 pointer-events-none"
                style={{ bottom: `${(goalMin / maxSleep) * 100}%` }}
              >
                <span className="absolute -top-4 right-0 text-[9px] font-label-caps text-primary/50">META SONO</span>
              </div>

              {rows.map((r) => {
                const isToday = r.date === today;
                const h = r.sleepMin ? (r.sleepMin / maxSleep) * 100 : 0;
                return (
                  <div key={r.date} className="flex-1 h-full flex items-end justify-center group relative">
                    {r.sleepMin ? (
                      <div
                        title={`Sono: ${minutesToHm(r.sleepMin)}`}
                        style={{ height: `${h}%` }}
                        className={`w-5 rounded-t-sm transition-colors ${isToday ? "bg-primary/40" : "bg-surface-bright group-hover:bg-primary/30"}`}
                      />
                    ) : (
                      <div className="w-5 h-1 bg-white/5 rounded-full" title="sem registro de sono" />
                    )}
                  </div>
                );
              })}

              {/* overlay humor (linha + pontos) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {segments.map((s, i) => (
                  <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#ffe4af" strokeWidth="0.6" vectorEffect="non-scaling-stroke" opacity="0.7" />
                ))}
              </svg>
              {/* pontos de humor (divs pra ter tooltip + cor) */}
              {moodPts.map((p, i) => (
                <div
                  key={i}
                  className="absolute w-2.5 h-2.5 rounded-full border border-background -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${p.x}%`, top: `${p.y}%`, background: moodColor(p.v) }}
                  title={`Humor: ${MOOD_OPTIONS.find((o) => o.value === p.v)?.label} (${p.v}/5)`}
                />
              ))}
            </div>

            {/* eixo: treino + dia */}
            <div className="flex gap-1 mt-2">
              {rows.map((r) => {
                const isToday = r.date === today;
                return (
                  <div key={r.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="h-5 flex items-center justify-center">
                      {r.trained ? (
                        <MI name="fitness_center" className="text-primary-container text-base" title={`Treino: ${r.trainMin} min`} />
                      ) : (
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                      )}
                    </div>
                    <Caps className={`text-[9px] ${isToday ? "text-primary" : "opacity-50"}`}>{weekdayShort(r.date)}</Caps>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
