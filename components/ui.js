"use client";

export const inputCls =
  "bg-surface-container-high text-on-surface border border-white/5 rounded-lg px-3 py-2 text-body-md outline-none focus:border-primary-container/50 transition-colors";

export function MI({ name, className = "", fill = false, style }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: fill ? "'FILL' 1" : undefined, ...style }}
    >
      {name}
    </span>
  );
}

export function Caps({ children, className = "" }) {
  return <span className={`font-label-caps text-label-caps ${className}`}>{children}</span>;
}

export function StarRating({ value, onChange, size = "text-xl" }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const v = i + 1;
        const filled = v <= value;
        return (
          <button key={v} type="button" onClick={() => onChange(v)} aria-label={`Nota ${v} de 5`}>
            <MI name="star" fill={filled} className={`${size} ${filled ? "text-primary-container" : "text-outline-variant"}`} />
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ label, value, onDec, onInc, suffix = "" }) {
  return (
    <div className="flex items-center justify-between">
      {label && <span className="text-on-surface text-body-md">{label}</span>}
      <div className="flex items-center gap-3">
        <button
          onClick={onDec}
          aria-label={`Diminuir ${label || ""}`}
          className="w-8 h-8 rounded-full bg-surface-variant text-on-surface flex items-center justify-center hover:brightness-125 active:scale-95 transition"
        >
          −
        </button>
        <span className="font-label-caps w-12 text-center text-primary">{value}{suffix}</span>
        <button
          onClick={onInc}
          aria-label={`Aumentar ${label || ""}`}
          className="w-8 h-8 rounded-full bg-surface-variant text-on-surface flex items-center justify-center hover:brightness-125 active:scale-95 transition"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function StatTile({ label, value, children }) {
  return (
    <div className="glass-card p-6 rounded-xl relative overflow-hidden">
      <div className="text-outline-variant font-label-caps text-[10px] mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-headline-lg font-headline-lg text-primary">{value}</span>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-8">
      <h2 className="font-headline-lg text-headline-lg text-primary uppercase">{title}</h2>
      <p className="text-on-surface-variant text-body-md">{subtitle}</p>
    </div>
  );
}
