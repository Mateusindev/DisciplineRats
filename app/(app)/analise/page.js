"use client";

import { useApp } from "../AppContext";
import { MI, Caps } from "@/components/ui";
import { getDateStr, weekdayShort, minutesToHm, lastNDates, MOOD_OPTIONS, bedtimeLateness, SLEEP_LIMIT_DEFAULT } from "@/lib/state";

const N = 30; // janela de dias do panorama combinado

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

function dayOfMonth(dateStr) {
  return Number(dateStr.slice(8, 10));
}

// gráfico de barras por dia (valor genérico), com linha de meta opcional
function BarTimeChart({ rows, max, today, goalRatio, goalLabel }) {
  const BW = 26;
  return (
    <div className="overflow-x-auto ff-scroll">
      <div style={{ minWidth: rows.length * BW }}>
        <div className="relative flex items-end h-40 gap-1">
          {goalRatio != null && (
            <div
              className="absolute left-0 right-0 border-t border-dashed border-primary/30 pointer-events-none"
              style={{ bottom: `${goalRatio * 100}%` }}
            >
              <span className="absolute -top-4 right-0 text-[9px] font-label-caps text-primary/50">{goalLabel}</span>
            </div>
          )}
          {rows.map((r) => {
            const isToday = r.date === today;
            const h = r.value ? (r.value / max) * 100 : 0;
            return (
              <div key={r.date} className="flex-1 h-full flex items-end justify-center group relative">
                {r.value ? (
                  <div
                    title={r.tooltip}
                    style={{ height: `${Math.max(h, 4)}%` }}
                    className={`w-full max-w-4 rounded-t-sm transition-colors ${
                      isToday ? "bg-primary" : "bg-primary-container/70 group-hover:bg-primary-container"
                    }`}
                  />
                ) : (
                  <div className="w-full max-w-4 h-1 bg-white/5 rounded-full" title={r.tooltip} />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-2">
          {rows.map((r, i) => {
            const isToday = r.date === today;
            const show = isToday || i === 0 || dayOfMonth(r.date) % 5 === 0;
            return (
              <div key={r.date} className="flex-1 flex justify-center">
                <Caps className={`text-[9px] ${isToday ? "text-primary" : "opacity-40"}`}>{show ? dayOfMonth(r.date) : ""}</Caps>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, hint }) {
  return (
    <div className="bg-surface-container rounded-xl p-4 border border-white/5">
      <Caps className="text-outline text-[10px]">{label}</Caps>
      <p className="font-headline-lg text-headline-lg text-primary leading-none mt-1">{value}</p>
      {hint && <Caps className="text-on-surface-variant text-[10px]">{hint}</Caps>}
    </div>
  );
}

export default function AnalisePage() {
  const { state } = useApp();
  const days = Array.from({ length: N }, (_, i) => getDateStr(-(N - 1 - i)));
  const today = getDateStr(0);

  // ===== Retrospecto de foco (30 dias) =====
  const FN = 30;
  const fh = state.focusHistory || {};
  const focusRows = lastNDates(FN).map((d) => ({
    date: d,
    sessions: fh[d]?.sessions || 0,
    minutes: fh[d]?.minutes || 0,
  }));
  const focusTotSessions = focusRows.reduce((s, r) => s + r.sessions, 0);
  const focusTotMinutes = focusRows.reduce((s, r) => s + r.minutes, 0);
  const focusActiveDays = focusRows.filter((r) => r.sessions > 0).length;
  const focusBest = focusRows.reduce((best, r) => (r.sessions > (best?.sessions || 0) ? r : best), null);
  const focusAvgPerActive = focusActiveDays ? focusTotSessions / focusActiveDays : 0;
  const focusMaxMin = Math.max(1, ...focusRows.map((r) => r.minutes));
  const focusConsistency = Math.round((focusActiveDays / FN) * 100);

  // ===== Sono (30 dias) =====
  const goalMin30 = state.settings.sleepGoalMin || 450;
  const sleepRows = lastNDates(FN).map((d) => {
    const s = state.sleep[d];
    const min = s?.durationMin || 0;
    const quality = s?.quality || 0;
    return {
      date: d,
      value: min,
      tooltip: s ? `${weekdayShort(d)} ${dayOfMonth(d)} · ${minutesToHm(min)}${quality ? ` · qualidade ${quality}/5` : ""}` : `${weekdayShort(d)} ${dayOfMonth(d)} · sem registro`,
      has: !!s,
      quality,
    };
  });
  const sleepNights = sleepRows.filter((r) => r.has).length;
  const sleepAvgMin = sleepNights ? Math.round(sleepRows.reduce((a, r) => a + r.value, 0) / sleepNights) : 0;
  const sleepOnGoal = sleepRows.filter((r) => r.has && r.value >= goalMin30).length;
  const qNights = sleepRows.filter((r) => r.has && r.quality > 0);
  const sleepAvgQual = qNights.length ? qNights.reduce((a, r) => a + r.quality, 0) / qNights.length : 0;
  const sleepChartMax = Math.max(goalMin30 + 60, 600, ...sleepRows.map((r) => r.value));

  // ===== Exercício (30 dias) =====
  const exByDate = {};
  for (const l of state.exerciseLogs) {
    const e = exByDate[l.date] || { minutes: 0, count: 0, types: new Set() };
    e.minutes += l.durationMin;
    e.count += 1;
    if (l.type) e.types.add(l.type);
    exByDate[l.date] = e;
  }
  const exRows = lastNDates(FN).map((d) => {
    const e = exByDate[d];
    const types = e ? [...e.types].join(", ") : "";
    return {
      date: d,
      value: e?.minutes || 0,
      tooltip: e
        ? `${weekdayShort(d)} ${dayOfMonth(d)} · ${e.count} treino(s) · ${minutesToHm(e.minutes)}${types ? ` · ${types}` : ""}`
        : `${weekdayShort(d)} ${dayOfMonth(d)} · sem treino`,
      has: !!e,
    };
  });
  const exDays = exRows.filter((r) => r.has).length;
  const exTotMin = exRows.reduce((a, r) => a + r.value, 0);
  const exTotSessions = exRows.reduce((a, r) => a + (exByDate[r.date]?.count || 0), 0);
  const exChartMax = Math.max(1, ...exRows.map((r) => r.value));

  // treinos por data (soma de minutos)
  const trainByDate = {};
  for (const l of state.exerciseLogs) trainByDate[l.date] = (trainByDate[l.date] || 0) + l.durationMin;

  // linha do dia
  const sleepLimit = state.settings.sleepLimit || SLEEP_LIMIT_DEFAULT;
  const rows = days.map((d) => {
    const s = state.sleep[d];
    return {
      date: d,
      mood: state.mood[d]?.mood ?? null,
      sleepMin: s?.durationMin ?? null,
      sleepQuality: s?.quality ?? null,
      sleepBed: s?.bedtime ?? null,
      // noite suja: deitou tarde (passou do limite) — não conta como meta limpa
      sleepLate: s ? bedtimeLateness(s.bedtime, sleepLimit) > 0 : false,
      trainMin: trainByDate[d] || 0,
      trained: (trainByDate[d] || 0) > 0,
    };
  });

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

      {/* Retrospecto de foco (30d) */}
      <section className="glass-card p-6 md:p-8 rounded-xl">
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-8">
          <div>
            <h3 className="font-headline-md text-headline-md text-primary uppercase">Retrospecto de Foco (30D)</h3>
            <Caps className="text-on-surface-variant">COMO FORAM SUAS SESSÕES NO ÚLTIMO MÊS</Caps>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-label-caps text-on-surface-variant">
            <span className="w-3 h-3 rounded-sm bg-primary-container" /> MINUTOS DE FOCO / DIA
          </div>
        </div>

        {focusTotSessions === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <MI name="timer" className="text-outline text-4xl" />
            <p className="text-body-md text-on-surface-variant">Nenhuma sessão registrada ainda.</p>
            <Caps className="text-outline text-[10px]">Complete sessões na aba Foco — o histórico começa a contar a partir de agora.</Caps>
          </div>
        ) : (
          <>
            {/* stat tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-card-gap mb-8">
              <div className="bg-surface-container rounded-xl p-4 border border-white/5">
                <Caps className="text-outline text-[10px]">SESSÕES</Caps>
                <p className="font-headline-lg text-headline-lg text-primary leading-none mt-1">{focusTotSessions}</p>
              </div>
              <div className="bg-surface-container rounded-xl p-4 border border-white/5">
                <Caps className="text-outline text-[10px]">TEMPO FOCADO</Caps>
                <p className="font-headline-lg text-headline-lg text-primary leading-none mt-1">{minutesToHm(focusTotMinutes)}</p>
              </div>
              <div className="bg-surface-container rounded-xl p-4 border border-white/5">
                <Caps className="text-outline text-[10px]">DIAS ATIVOS</Caps>
                <p className="font-headline-lg text-headline-lg text-primary leading-none mt-1">
                  {focusActiveDays}<span className="text-outline text-base">/{FN}</span>
                </p>
                <Caps className="text-on-surface-variant text-[10px]">{focusConsistency}% dos dias</Caps>
              </div>
              <div className="bg-surface-container rounded-xl p-4 border border-white/5">
                <Caps className="text-outline text-[10px]">MÉDIA / DIA ATIVO</Caps>
                <p className="font-headline-lg text-headline-lg text-primary leading-none mt-1">{focusAvgPerActive.toFixed(1)}</p>
                <Caps className="text-on-surface-variant text-[10px]">sessões</Caps>
              </div>
            </div>

            {/* bar chart: minutos por dia */}
            <div className="overflow-x-auto ff-scroll">
              <div style={{ minWidth: FN * 26 }}>
                <div className="relative flex items-end h-40 gap-1">
                  {focusRows.map((r) => {
                    const isToday = r.date === today;
                    const h = r.minutes ? (r.minutes / focusMaxMin) * 100 : 0;
                    return (
                      <div key={r.date} className="flex-1 h-full flex items-end justify-center group relative">
                        {r.minutes ? (
                          <div
                            title={`${weekdayShort(r.date)} ${dayOfMonth(r.date)} · ${r.sessions} sessão(ões) · ${minutesToHm(r.minutes)}`}
                            style={{ height: `${Math.max(h, 4)}%` }}
                            className={`w-full max-w-4 rounded-t-sm transition-colors ${
                              isToday ? "bg-primary" : "bg-primary-container/70 group-hover:bg-primary-container"
                            }`}
                          />
                        ) : (
                          <div className="w-full max-w-4 h-1 bg-white/5 rounded-full" title={`${weekdayShort(r.date)} ${dayOfMonth(r.date)} · sem foco`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* eixo: dia do mês (a cada ~5 dias) */}
                <div className="flex gap-1 mt-2">
                  {focusRows.map((r, i) => {
                    const isToday = r.date === today;
                    const show = isToday || i === 0 || dayOfMonth(r.date) % 5 === 0;
                    return (
                      <div key={r.date} className="flex-1 flex justify-center">
                        <Caps className={`text-[9px] ${isToday ? "text-primary" : "opacity-40"}`}>{show ? dayOfMonth(r.date) : ""}</Caps>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {focusBest && focusBest.sessions > 0 && (
              <p className="text-body-md text-on-surface mt-6">
                Melhor dia: <span className="text-primary font-bold">{weekdayShort(focusBest.date)} {dayOfMonth(focusBest.date)}</span> com{" "}
                <span className="text-primary font-bold">{focusBest.sessions} sessão(ões)</span> ({minutesToHm(focusBest.minutes)}).{" "}
                {focusConsistency >= 60
                  ? "Consistência forte — mantenha o ritmo."
                  : focusConsistency >= 30
                  ? "Ritmo irregular. Tente fixar um horário diário de foco."
                  : "Poucos dias com foco. Comece com 1 sessão por dia."}
              </p>
            )}
          </>
        )}
      </section>

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
            <h3 className="font-headline-md text-headline-md uppercase">Correlação Sono/Humor/Treino ({N}D)</h3>
            <Caps className="text-on-surface-variant">HUMOR · SONO · TREINO LADO A LADO</Caps>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-[10px] font-label-caps">
              <span className="w-3 h-3 rounded-sm bg-surface-bright" /> SONO (H)
            </div>
            <div className="flex items-center gap-2 text-[10px] font-label-caps">
              <span className="w-3 h-3 rounded-sm bg-error" /> DEITOU TARDE
            </div>
            <div className="flex items-center gap-2 text-[10px] font-label-caps">
              <span className="w-3 h-3 rounded-full bg-primary" /> HUMOR (1–5)
            </div>
            <div className="flex items-center gap-2 text-[10px] font-label-caps">
              <MI name="fitness_center" className="text-primary-container text-base" /> TREINO
            </div>
          </div>
        </div>

        <p className="text-[11px] text-outline mb-4">
          Barra vermelha = deitou depois de {sleepLimit} (madrugada não conta como meta limpa). Barra mais apagada = qualidade do sono mais baixa.
        </p>

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
                // qualidade module a opacidade da barra (qual. baixa = mais apagada); sem nota = cheia
                const qOpacity = r.sleepQuality ? 0.4 + (r.sleepQuality / 5) * 0.6 : 1;
                const tip = r.sleepMin
                  ? `Sono: ${minutesToHm(r.sleepMin)}${r.sleepBed ? ` · deitou ${r.sleepBed}` : ""}${r.sleepLate ? " (tarde/suja)" : ""}${r.sleepQuality ? ` · qualidade ${r.sleepQuality}/5` : ""}`
                  : "sem registro de sono";
                return (
                  <div key={r.date} className="flex-1 h-full flex items-end justify-center group relative">
                    {r.sleepMin ? (
                      <div
                        title={tip}
                        style={{ height: `${h}%`, opacity: qOpacity }}
                        className={`w-5 rounded-t-sm transition-colors ${
                          r.sleepLate ? "bg-error group-hover:bg-error/80" : isToday ? "bg-primary/40" : "bg-surface-bright group-hover:bg-primary/30"
                        }`}
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

      {/* Sono isolado (30d) */}
      <section className="glass-card p-6 md:p-8 rounded-xl">
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-8">
          <div>
            <h3 className="font-headline-md text-headline-md text-primary uppercase">Sono (30D)</h3>
            <Caps className="text-on-surface-variant">DURAÇÃO POR NOITE · LINHA = META</Caps>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-label-caps text-on-surface-variant">
            <span className="w-3 h-3 rounded-sm bg-primary-container" /> HORAS DORMIDAS
          </div>
        </div>
        {sleepNights === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <MI name="bedtime" className="text-outline text-4xl" />
            <p className="text-body-md text-on-surface-variant">Nenhuma noite registrada nos últimos 30 dias.</p>
            <Caps className="text-outline text-[10px]">Registre seu sono na aba Sono.</Caps>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-card-gap mb-8">
              <MetricTile label="MÉDIA / NOITE" value={minutesToHm(sleepAvgMin)} />
              <MetricTile label="NOITES REGISTRADAS" value={`${sleepNights}/${FN}`} />
              <MetricTile label="NOITES NA META" value={sleepOnGoal} hint={`meta ${minutesToHm(goalMin30)}`} />
              <MetricTile label="QUALIDADE MÉDIA" value={sleepAvgQual ? `${sleepAvgQual.toFixed(1)}/5` : "—"} />
            </div>
            <BarTimeChart
              rows={sleepRows}
              max={sleepChartMax}
              today={today}
              goalRatio={goalMin30 / sleepChartMax}
              goalLabel="META SONO"
            />
          </>
        )}
      </section>

      {/* Exercício isolado (30d) */}
      <section className="glass-card p-6 md:p-8 rounded-xl">
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-8">
          <div>
            <h3 className="font-headline-md text-headline-md text-primary uppercase">Exercícios (30D)</h3>
            <Caps className="text-on-surface-variant">VOLUME DE TREINO POR DIA</Caps>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-label-caps text-on-surface-variant">
            <span className="w-3 h-3 rounded-sm bg-primary-container" /> MINUTOS DE TREINO
          </div>
        </div>
        {exDays === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <MI name="fitness_center" className="text-outline text-4xl" />
            <p className="text-body-md text-on-surface-variant">Nenhum treino registrado nos últimos 30 dias.</p>
            <Caps className="text-outline text-[10px]">Registre treinos na aba Exercício.</Caps>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-card-gap mb-8">
              <MetricTile label="TREINOS" value={exTotSessions} />
              <MetricTile label="TEMPO TOTAL" value={minutesToHm(exTotMin)} />
              <MetricTile label="DIAS TREINADOS" value={`${exDays}/${FN}`} />
              <MetricTile label="MÉDIA / DIA TREINADO" value={exDays ? minutesToHm(Math.round(exTotMin / exDays)) : "—"} />
            </div>
            <BarTimeChart rows={exRows} max={exChartMax} today={today} />
          </>
        )}
      </section>
    </div>
  );
}
