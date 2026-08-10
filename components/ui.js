"use client";

import { useState, useRef, useEffect } from "react";

export const inputCls =
  "bg-surface-container-high text-on-surface border border-white/5 rounded-lg px-3 py-2 text-body-md outline-none focus:border-primary-container/50 transition-colors";

export const textareaCls =
  "w-full bg-surface-container-high text-on-surface border border-white/5 rounded-lg px-3 py-2.5 text-body-md outline-none resize-none focus:border-primary-container/50 transition-colors placeholder:text-outline";

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

// Select custom, themed. options: array de strings ou {value,label}.
export function Select({ value, options = [], onChange, placeholder = "Selecione", disabled = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // índice destacado por teclado
  const ref = useRef(null);
  const opts = options.map((o) => (typeof o === "object" ? o : { value: o, label: o }));
  const selected = opts.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(v) {
    onChange?.(v);
    setOpen(false);
  }
  function onKey(e) {
    if (disabled) return;
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open && active >= 0) pick(opts[active].value);
      else setOpen((o) => !o);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => {
        const n = opts.length;
        return n ? (a < 0 ? (dir > 0 ? 0 : n - 1) : (a + dir + n) % n) : -1;
      });
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 bg-surface-container-high border rounded-lg px-3 py-2.5 text-body-md text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? "border-primary-container/60" : "border-white/5 hover:border-white/10"
        }`}
      >
        <span className={`truncate ${selected ? "text-on-surface" : "text-outline"}`}>{selected ? selected.label : placeholder}</span>
        <MI name="expand_more" className={`text-outline text-xl shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1.5 w-full max-h-60 overflow-y-auto ff-scroll rounded-lg border border-white/10 bg-surface-container-highest shadow-xl shadow-black/40 py-1 animate-[fadeIn_.1s_ease-out]"
        >
          {opts.length === 0 && <li className="px-3 py-2 text-[13px] text-outline">Sem opções</li>}
          {opts.map((o, i) => {
            const isSel = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
                className={`flex items-center gap-2 px-3 py-2 text-body-md cursor-pointer transition-colors ${
                  i === active ? "bg-primary-container/15" : ""
                } ${isSel ? "text-primary" : "text-on-surface"}`}
              >
                <MI name="check" className={`text-lg shrink-0 ${isSel ? "text-primary-container" : "opacity-0"}`} />
                <span className="truncate">{o.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Spinner reutilizável. size em px.
export function Spinner({ size = 24, className = "" }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={`inline-block rounded-full border-2 border-surface-variant border-t-primary-container animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// Tela de carregamento full-screen (marca + spinner).
export function Loader({ label = "Carregando..." }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-background">
      <div className="relative flex items-center justify-center">
        <Spinner size={64} />
        <MI name="bolt" fill className="absolute text-primary-container text-3xl animate-pulse" />
      </div>
      <div className="text-center">
        <p className="font-headline-md text-headline-md text-primary tracking-widest uppercase">Discipline Rats</p>
        <Caps className="text-outline mt-1 block">{label}</Caps>
      </div>
    </div>
  );
}

export function StatTile({ label, value, children }) {
  return (
    <div className="glass-card p-6 rounded-xl relative overflow-hidden">
      <div className="text-outline font-label-caps text-[10px] mb-1">{label}</div>
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
