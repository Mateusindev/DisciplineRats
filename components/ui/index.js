"use client";

import { useState, useRef, useEffect } from "react";

// Campo no padrão shadcn (components/ui/input.jsx): borda de controle um degrau
// acima da borda de card, anel de foco neutro. Exportado como string porque há
// <input>/<select> crus espalhados que só precisam vestir a mesma roupa.
export const inputCls =
  "bg-transparent dark:bg-input/30 text-on-surface border border-input rounded-md px-3 py-2 text-sm shadow-xs outline-none placeholder:text-outline transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

export const textareaCls =
  "w-full bg-transparent dark:bg-input/30 text-on-surface border border-input rounded-md px-3 py-2.5 text-sm shadow-xs outline-none resize-none placeholder:text-outline transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

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

// Rótulo pequeno. O nome ficou da época do mono em caixa alta; hoje é 12px/500
// em caixa normal — o texto que vem em caixa alta é responsabilidade de quem chama.
export function Caps({ children, className = "" }) {
  return <span className={`text-label-caps font-medium ${className}`}>{children}</span>;
}

export function StarRating({ value, onChange, size = "text-xl" }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const v = i + 1;
        const filled = v <= value;
        return (
          <button key={v} type="button" onClick={() => onChange(v)} aria-label={`Nota ${v} de 5`}>
            <MI name="star" fill={filled} className={`${size} ${filled ? "text-primary-container" : "text-outline/40"}`} />
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ label, value, onDec, onInc, suffix = "" }) {
  return (
    <div className="flex items-center justify-between">
      {label && <span className="text-on-surface text-sm">{label}</span>}
      <div className="flex items-center gap-3">
        <button
          onClick={onDec}
          aria-label={`Diminuir ${label || ""}`}
          className="size-8 rounded-md border border-input text-on-surface flex items-center justify-center hover:bg-surface-variant active:scale-95 transition"
        >
          −
        </button>
        <span className="w-12 text-center text-sm font-medium tabular-nums text-on-surface">{value}{suffix}</span>
        <button
          onClick={onInc}
          aria-label={`Aumentar ${label || ""}`}
          className="size-8 rounded-md border border-input text-on-surface flex items-center justify-center hover:bg-surface-variant active:scale-95 transition"
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
        className={`w-full h-9 flex items-center justify-between gap-2 bg-transparent dark:bg-input/30 border rounded-md px-3 text-sm text-left shadow-xs transition-[color,box-shadow] disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? "border-ring ring-[3px] ring-ring/50" : "border-input"
        }`}
      >
        <span className={`truncate ${selected ? "text-on-surface" : "text-outline"}`}>{selected ? selected.label : placeholder}</span>
        <MI name="expand_more" className={`text-outline text-[18px] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto ff-scroll rounded-md border border-outline-variant bg-popover p-1 shadow-md animate-[fadeIn_.1s_ease-out]"
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
                className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer transition-colors text-on-surface ${
                  i === active ? "bg-surface-variant" : ""
                }`}
              >
                <MI name="check" className={`text-[16px] shrink-0 ${isSel ? "" : "opacity-0"}`} />
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
      className={`inline-block rounded-full border-2 border-surface-variant border-t-on-surface-variant animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// Tela de carregamento full-screen (marca + spinner).
export function Loader({ label = "Carregando..." }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-background">
      <img src="/logo.jpg" alt="" width={40} height={40} className="size-10 rounded-lg" />
      <div className="flex items-center gap-2 text-sm text-outline">
        <Spinner size={14} /> {label}
      </div>
    </div>
  );
}

// Número com rótulo em cima. Sem ícone em círculo, sem cor: o valor é tinta,
// o rótulo é cinza. `children` entra ao lado do valor (unidade, um sinal).
export function StatTile({ label, value, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-outline-variant bg-surface-container p-4 ${className}`}>
      <div className="text-xs text-outline">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums text-on-surface">{value}</span>
        {children}
      </div>
    </div>
  );
}

// Título da tela: um h1 de 24px, uma linha de contexto, e as ações à direita.
export function PageHeader({ title, subtitle, actions, className = "" }) {
  return (
    <div className={`mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-on-surface">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
