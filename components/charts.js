"use client";

import { useId } from "react";
import { weekdayShort } from "@/lib/state";

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
export function LineChart({ days, values, today, yMax, yMin = 0, goal = null, format = (v) => v, xLabel = weekdayShort, ariaLabel = "" }) {
  const gid = useId();
  const W = 320;
  const H = 190;
  const PAD_X = 14;
  const PAD_TOP = 26;
  const PAD_BOT = 30;
  const span = yMax - yMin || 1;
  const xFor = (i) => PAD_X + (i * (W - PAD_X * 2)) / Math.max(1, days.length - 1);
  const yFor = (v) => PAD_TOP + (1 - (Math.min(v, yMax) - yMin) / span) * (H - PAD_TOP - PAD_BOT);

  const pts = days
    .map((d, i) => (values[i] != null ? { x: xFor(i), y: yFor(values[i]), date: d, v: values[i] } : null))
    .filter(Boolean);

  const line = smoothPath(pts);
  const area = pts.length >= 2 ? `${line} L ${pts[pts.length - 1].x} ${H - PAD_BOT} L ${pts[0].x} ${H - PAD_BOT} Z` : "";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
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
            <text x={W - PAD_X} y={yFor(goal.value) - 4} textAnchor="end" className="fill-current text-outline" style={{ fontSize: 8, fontFamily: "inherit" }}>
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
        return (
          <g key={p.date} className="cursor-help">
            <circle cx={p.x} cy={p.y} r={isToday ? 5 : 3.5} fill="var(--color-primary-container)" stroke="var(--color-background)" strokeWidth="1.5" />
            {isToday && <circle cx={p.x} cy={p.y} r="9" fill="none" stroke="var(--color-primary-container)" strokeOpacity="0.35" strokeWidth="2" />}
            <text x={p.x} y={p.y - 10} textAnchor="middle" className="fill-current text-on-surface" style={{ fontSize: 8.5, fontWeight: 700, fontFamily: "inherit" }}>
              {format(p.v)}
            </text>
            <title>{`${xLabel(p.date)} · ${format(p.v)}`}</title>
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
          style={{ fontSize: 9, fontWeight: d === today ? 800 : 500, textTransform: "uppercase", fontFamily: "inherit" }}
        >
          {xLabel(d)}
        </text>
      ))}
    </svg>
  );
}
