"use client";

import { Caps } from "@/components/ui";

// Editor de metas em sliders, largura cheia (grid responsivo).
// fields: [{ key, label, type:"number"|"time", value, min, max, step, unit, onChange }]

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const timeInput = (f, cls = "") => (
  <input
    type="time"
    value={f.value}
    onChange={(e) => e.target.value && f.onChange(e.target.value)}
    aria-label={f.label}
    className={`bg-surface-container-highest px-3 py-1.5 rounded-lg border border-white/10 focus:border-primary/50 outline-none text-on-surface font-headline-md text-headline-md ${cls}`}
  />
);

export default function MetasEditor({ fields }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-body-md text-on-surface-variant">{f.label}</span>
            <span className="font-label-caps text-primary tabular-nums">
              {f.format ? f.format(f.value) : `${f.value}${f.type === "number" && f.unit ? ` ${f.unit}` : ""}`}
            </span>
          </div>
          {f.type === "time" ? (
            timeInput(f, "self-start")
          ) : (
            <input
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={f.value}
              onChange={(e) => f.onChange(clamp(Number(e.target.value), f.min, f.max))}
              aria-label={f.label}
              className="w-full accent-primary-container"
            />
          )}
        </div>
      ))}
    </div>
  );
}
