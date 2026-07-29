"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { daysBetween, weekdayShort } from "@/lib/state";

// largura real do container (viewBox 1:1) → altura fixa e texto em tamanho nativo,
// em vez de esticar proporcionalmente com w-full.
function useWidth(min = 260) {
  const ref = useRef(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(min, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, w];
}

// ticks "redondos" dentro de um domínio (1 / 2 / 2,5 / 5 × potência de 10)
function niceTicks(min, max, count = 4) {
  const raw = (max - min) / Math.max(1, count) || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const kg1 = (n) => `${(Math.round(n * 10) / 10).toString().replace(".", ",")}`;

// path suave (Catmull-Rom → cubic bezier) pelos pontos
export function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// Gráfico de linha (estilo cotação): curva suave + área em gradiente + pontos.
// days: ["YYYY-MM-DD"]; values: number|null alinhado a days (null = sem registro).
// goal: { value, label } opcional — linha tracejada horizontal.
// format(v): label do ponto (texto ou emoji).
export function LineChart({ days, values, today, yMax, yMin = 0, goal = null, format = (v) => v, xLabel = weekdayShort, ariaLabel = "", height = 200, flags = null, reasons = null }) {
  const gid = useId();
  const [wrapRef, W] = useWidth();
  const H = height;
  const PAD_X = 18;
  const PAD_TOP = 28;
  const PAD_BOT = 30;
  const span = yMax - yMin || 1;
  const xFor = (i) => PAD_X + (i * (W - PAD_X * 2)) / Math.max(1, days.length - 1);
  const yFor = (v) => PAD_TOP + (1 - (Math.min(v, yMax) - yMin) / span) * (H - PAD_TOP - PAD_BOT);

  const pts = days
    .map((d, i) => (values[i] != null ? { x: xFor(i), y: yFor(values[i]), date: d, v: values[i], flag: !!(flags && flags[i]), reason: (reasons && reasons[i]) || "" } : null))
    .filter(Boolean);

  const line = smoothPath(pts);
  const area = pts.length >= 2 ? `${line} L ${pts[pts.length - 1].x} ${H - PAD_BOT} L ${pts[0].x} ${H - PAD_BOT} Z` : "";

  return (
    <div ref={wrapRef} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="w-full" role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary-container)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-primary-container)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {goal && (
        <>
          <line x1={PAD_X} x2={W - PAD_X} y1={yFor(goal.value)} y2={yFor(goal.value)} stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" className="text-outline-variant" />
          {goal.label && (
            <text x={W - PAD_X} y={yFor(goal.value) - 5} textAnchor="end" className="fill-current text-outline" style={{ fontSize: 10, fontFamily: "inherit" }}>
              {goal.label}
            </text>
          )}
        </>
      )}

      {area && <path d={area} fill={`url(#${gid})`} />}
      {line && pts.length >= 2 && (
        <path d={line} fill="none" stroke="var(--color-primary-container)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {pts.map((p) => {
        const isToday = p.date === today;
        const color = p.flag ? "var(--color-error)" : "var(--color-primary-container)";
        return (
          <g key={p.date} className="cursor-help">
            {/* noite suja (deitou tarde): anel de alerta em volta do ponto */}
            {p.flag && <circle cx={p.x} cy={p.y} r={isToday ? 8 : 7} fill="none" stroke="var(--color-error)" strokeOpacity="0.4" strokeWidth="2" />}
            <circle cx={p.x} cy={p.y} r={isToday ? 5 : 4} fill={color} stroke="var(--color-background)" strokeWidth="1.5" />
            {isToday && !p.flag && <circle cx={p.x} cy={p.y} r="9" fill="none" stroke="var(--color-primary-container)" strokeOpacity="0.35" strokeWidth="2" />}
            <text x={p.x} y={p.y - 11} textAnchor="middle" className="fill-current" style={{ fontSize: 11, fontWeight: 700, fontFamily: "inherit", fill: p.flag ? "var(--color-error)" : "var(--color-on-surface)" }}>
              {format(p.v)}
            </text>
            <title>{`${xLabel(p.date)} · ${format(p.v)}${p.flag ? " · deitou tarde (suja)" : ""}${p.flag && p.reason ? `\nMotivo: ${p.reason}` : ""}`}</title>
          </g>
        );
      })}

      {days.map((d, i) => (
        <text
          key={d}
          x={xFor(i)}
          y={H - 8}
          textAnchor="middle"
          className={`fill-current ${d === today ? "text-primary" : "text-secondary"}`}
          style={{ fontSize: 10, fontWeight: d === today ? 800 : 500, textTransform: "uppercase", fontFamily: "inherit" }}
        >
          {xLabel(d)}
        </text>
      ))}
      </svg>
    </div>
  );
}

// ============================================================================
// Gráfico de peso — pesagens (pontos) + média móvel de 7 dias (linha).
//
// Três decisões que o gráfico antigo errava:
//   1. eixo X é TEMPO REAL, não índice da pesagem. Pesar 4× numa semana e depois
//      só no mês seguinte tem que virar um buraco no gráfico; espaçar igual
//      inventa uma inclinação que não existe.
//   2. eixo Y é escalado nos dados (não em 0..max). Variação de peso é de 1 a 2%
//      do valor — começar em zero achata a curva até virar uma reta plana.
//   3. buraco longo (>21 dias) NÃO é ligado com linha cheia: entra tracejado,
//      porque não há dado nenhum ali pra sustentar a curva.
//
// series: [{ date:"YYYY-MM-DD", kg, avg, n }] em ordem de data (weightSeries()).
// ============================================================================
const GAP_DAYS = 21;

export function WeightChart({ series, targetKg = null, height = 240, ariaLabel = "Evolução do peso" }) {
  const gid = useId();
  const [wrapRef, W] = useWidth();
  const [hover, setHover] = useState(null); // índice do ponto sob o cursor
  const H = height;
  const PAD_L = 36;
  const PAD_R = 16;
  const PAD_TOP = 18;
  const PAD_BOT = 26;

  const geo = useMemo(() => {
    if (!series || series.length < 2) return null;
    const d0 = series[0].date;
    const span = Math.max(1, daysBetween(d0, series[series.length - 1].date));
    const vals = series.flatMap((s) => [s.kg, s.avg]);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    // alvo entra na escala só se estiver perto do intervalo real — alvo distante
    // comprimiria toda a variação recente num traço.
    const reach = Math.max(4, (hi - lo) * 2);
    const targetIn = targetKg != null && targetKg >= lo - reach && targetKg <= hi + reach;
    if (targetIn) {
      lo = Math.min(lo, targetKg);
      hi = Math.max(hi, targetKg);
    }
    const pad = Math.max(0.4, (hi - lo) * 0.18);
    const yMin = lo - pad;
    const yMax = hi + pad;
    const xFor = (date) => PAD_L + (daysBetween(d0, date) / span) * (W - PAD_L - PAD_R);
    const yFor = (v) => PAD_TOP + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD_TOP - PAD_BOT);
    const pts = series.map((s, i) => ({ ...s, i, x: xFor(s.date), y: yFor(s.kg), ya: yFor(s.avg) }));

    // segmentos da média: quebra onde o intervalo entre pesagens passa de GAP_DAYS
    const segs = [];
    let cur = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (daysBetween(pts[i - 1].date, pts[i].date) > GAP_DAYS) {
        segs.push(cur);
        cur = [];
      }
      cur.push(pts[i]);
    }
    segs.push(cur);

    return { pts, segs, yMin, yMax, ticks: niceTicks(yMin, yMax, 4), xFor, yFor, span, d0, targetIn };
  }, [series, targetKg, W, H]);

  if (!geo) return null;

  const { pts, segs, ticks, yFor, targetIn } = geo;
  const hasAvg = series.some((s) => s.n >= 2);
  const last = pts[pts.length - 1];

  // rótulos de data: no máximo 5, sempre incluindo primeiro e último
  const nLabels = Math.min(5, pts.length);
  const labelIdx = new Set(Array.from({ length: nLabels }, (_, k) => Math.round((k * (pts.length - 1)) / Math.max(1, nLabels - 1))));

  function onMove(e) {
    const box = e.currentTarget.getBoundingClientRect();
    // o viewBox é 1:1 com a largura medida, mas entre o resize e o re-render as duas
    // divergem — reescalar evita o cursor apontar pro ponto errado nesse intervalo.
    const x = ((e.clientX - box.left) * W) / (box.width || W);
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].x - x) < Math.abs(pts[best].x - x)) best = i;
    setHover(best);
  }

  const hp = hover != null ? pts[hover] : null;
  const prev = hp && hover > 0 ? pts[hover - 1] : null;
  const tipX = hp ? Math.min(W - 76, Math.max(76, hp.x)) : 0;

  return (
    <div className="w-full">
      <div ref={wrapRef} className="relative w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="w-full touch-none"
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary-container)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--color-primary-container)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* grade + escala em kg (recessiva: a curva é o dado, a grade é régua) */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yFor(t)} y2={yFor(t)} stroke="currentColor" strokeWidth="1" className="text-outline-variant" strokeOpacity="0.35" />
              <text x={PAD_L - 6} y={yFor(t) + 3} textAnchor="end" className="fill-current text-outline" style={{ fontSize: 9, fontFamily: "inherit" }}>
                {kg1(t)}
              </text>
            </g>
          ))}

          {targetKg != null &&
            (targetIn ? (
              <>
                <line x1={PAD_L} x2={W - PAD_R} y1={yFor(targetKg)} y2={yFor(targetKg)} stroke="var(--color-primary)" strokeWidth="1.5" strokeDasharray="5 4" strokeOpacity="0.7" />
                {/* rótulo do alvo à esquerda: à direita ele bateria no rótulo do último ponto */}
                <text x={PAD_L + 4} y={yFor(targetKg) - 5} textAnchor="start" className="fill-current text-primary" style={{ fontSize: 9, fontWeight: 700, fontFamily: "inherit" }}>
                  {`ALVO ${kg1(targetKg)} KG`}
                </text>
              </>
            ) : (
              // Alvo longe demais: entra como marca na borda, não na escala. Esticar o eixo
              // até um alvo 10 kg abaixo achataria a variação do mês num traço reto.
              <text
                x={W - PAD_R}
                y={targetKg < geo.yMin ? H - PAD_BOT - 5 : PAD_TOP + 9}
                textAnchor="end"
                className="fill-current text-primary"
                style={{ fontSize: 9, fontWeight: 700, fontFamily: "inherit" }}
              >
                {`ALVO ${kg1(targetKg)} KG ${targetKg < geo.yMin ? "↓" : "↑"} FORA DA ESCALA`}
              </text>
            ))}

          {/* área + média móvel, um caminho por segmento; buraco longo fica tracejado */}
          {segs.map((seg, si) => {
            const path = smoothPath(seg.map((p) => ({ x: p.x, y: p.ya })));
            const prevSeg = segs[si - 1];
            return (
              <g key={`seg-${seg[0].date}`}>
                {prevSeg && (
                  <line
                    x1={prevSeg[prevSeg.length - 1].x}
                    y1={prevSeg[prevSeg.length - 1].ya}
                    x2={seg[0].x}
                    y2={seg[0].ya}
                    stroke="var(--color-primary-container)"
                    strokeWidth="1.5"
                    strokeDasharray="3 5"
                    strokeOpacity="0.45"
                  />
                )}
                {seg.length >= 2 && (
                  <>
                    <path d={`${path} L ${seg[seg.length - 1].x} ${H - PAD_BOT} L ${seg[0].x} ${H - PAD_BOT} Z`} fill={`url(#${gid})`} />
                    <path d={path} fill="none" stroke="var(--color-primary-container)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )}
              </g>
            );
          })}

          {/* crosshair do hover */}
          {hp && <line x1={hp.x} x2={hp.x} y1={PAD_TOP} y2={H - PAD_BOT} stroke="var(--color-primary)" strokeWidth="1" strokeOpacity="0.35" />}

          {/* pesagens do dia: ponto discreto com anel da superfície (não briga com a linha) */}
          {pts.map((p) => (
            <circle
              key={p.date}
              cx={p.x}
              cy={p.y}
              r={hp && hp.i === p.i ? 4.5 : 2.8}
              fill="var(--color-on-surface-variant)"
              stroke="var(--color-background)"
              strokeWidth="1.5"
            />
          ))}

          {/* rótulo direto só no último ponto — número em todo ponto vira ruído */}
          <circle cx={last.x} cy={last.ya} r="4.5" fill="var(--color-primary-container)" stroke="var(--color-background)" strokeWidth="2" />
          {!hp && (
            <text
              x={Math.min(W - PAD_R, last.x)}
              y={last.ya - 11}
              textAnchor="end"
              className="fill-current text-on-surface"
              style={{ fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}
            >
              {`${kg1(last.avg)} kg`}
            </text>
          )}

          {pts.map((p) =>
            labelIdx.has(p.i) ? (
              <text
                key={`x-${p.date}`}
                x={Math.min(W - PAD_R, Math.max(PAD_L, p.x))}
                y={H - 8}
                textAnchor={p.i === 0 ? "start" : p.i === pts.length - 1 ? "end" : "middle"}
                className="fill-current text-outline"
                style={{ fontSize: 9, fontFamily: "inherit" }}
              >
                {dm(p.date)}
              </text>
            ) : null
          )}
        </svg>

        {hp && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-surface-container-high/95 px-2.5 py-1.5 shadow-lg backdrop-blur"
            style={{ left: tipX, top: Math.max(28, Math.min(hp.y, hp.ya) - 10) }}
          >
            <div className="text-[10px] font-label-caps text-outline">{`${weekdayShort(hp.date).toUpperCase()} ${dm(hp.date)}`}</div>
            <div className="text-[13px] tabular-nums text-on-surface">
              {`${kg1(hp.kg)} kg`}
              {prev && (
                <span className={`ml-1.5 text-[11px] ${hp.kg - prev.kg > 0 ? "text-error" : hp.kg - prev.kg < 0 ? "text-primary" : "text-outline"}`}>
                  {`${hp.kg - prev.kg > 0 ? "+" : ""}${kg1(hp.kg - prev.kg)}`}
                </span>
              )}
            </div>
            <div className="text-[10px] tabular-nums text-on-surface-variant">
              {hp.n >= 2 ? `média 7d ${kg1(hp.avg)} kg · ${hp.n} pesagens` : "1 pesagem na janela de 7d"}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
          <span className="h-[3px] w-4 rounded-full" style={{ background: "var(--color-primary-container)" }} />
          {hasAvg ? "MÉDIA 7 DIAS" : "MÉDIA 7 DIAS (1 pesagem por janela)"}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-on-surface-variant)" }} />
          PESAGEM DO DIA
        </span>
        {segs.length > 1 && <span className="text-[10px] text-outline">TRACEJADO = MAIS DE {GAP_DAYS} DIAS SEM PESAR</span>}
      </div>
    </div>
  );
}
