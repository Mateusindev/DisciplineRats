"use client";

// Botão "?" global + modal de tutorial. Um só componente serve todas as páginas: o conteúdo
// vem de lib/help.js indexado pelo pathname, então adicionar ajuda numa página nova é
// adicionar uma entrada de dado — nenhuma página importa nada disso.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MI, Caps } from "@/components/ui";
import { helpFor, HELP_GLOBAL } from "@/lib/help";

// Negrito inline sem parser de markdown: quebra em ** e embrulha os índices ímpares.
function RichText({ text, className = "" }) {
  const parts = String(text).split("**");
  return (
    <p className={className}>
      {parts.map((p, i) => (i % 2 ? <strong key={i} className="text-on-surface font-semibold">{p}</strong> : p))}
    </p>
  );
}

function Table({ table }) {
  return (
    <div className="rounded-lg border border-white/10 overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-1.5 bg-surface-container-high">
        <Caps className="text-outline text-[10px] flex-1">{table.head[0]}</Caps>
        <Caps className="text-outline text-[10px] flex-1">{table.head[1]}</Caps>
      </div>
      <div className="divide-y divide-white/5">
        {table.rows.map((r) => (
          <div key={r[0]} className="flex items-start gap-3 px-3 py-2">
            <span className="text-[12px] text-on-surface flex-1">{r[0]}</span>
            <span className="text-[12px] text-on-surface-variant flex-1">{r[1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Os rótulos de lib/help.js foram escritos em CAIXA ALTA pro mono antigo.
// Aqui viram caixa normal, sem reescrever o conteúdo inteiro.
const sentence = (t) => (typeof t === "string" && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t);

function Section({ label, body, list, table }) {
  return (
    <section>
      <Caps className="text-on-surface mb-2 block">{sentence(label)}</Caps>
      <div className="space-y-2">
        {body?.map((t, i) => <RichText key={i} text={t} className="text-body-md text-on-surface-variant" />)}
        {list && (
          <ul className="space-y-1.5">
            {list.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary-container mt-[7px] shrink-0 w-1 h-1 rounded-full bg-current" />
                <RichText text={t} className="text-body-md text-on-surface-variant flex-1" />
              </li>
            ))}
          </ul>
        )}
        {table && <Table table={table} />}
      </div>
    </section>
  );
}

function HelpModal({ entry, onClose }) {
  // Esc fecha — o modal é a única coisa em foco quando está aberto
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const xp = entry.xp;
  return createPortal(
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/50 animate-[fadeIn_.1s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Como usar: ${entry.title}`}
    >
      <div
        className="bg-popover rounded-xl w-full max-w-lg shadow-lg border border-outline-variant max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-6 pb-4 shrink-0 border-b border-white/5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MI name={entry.icon} className="text-on-surface-variant text-[20px]" />
              <h3 className="text-base font-semibold text-on-surface">{entry.title}</h3>
            </div>
            <RichText text={entry.tagline} className="text-[13px] text-on-surface-variant mt-1.5" />
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition p-1 shrink-0">
            <MI name="close" />
          </button>
        </div>

        <div className="p-6 pt-5 space-y-6 overflow-y-auto ff-scroll overscroll-contain">
          {entry.sections.map((s) => <Section key={s.label} {...s} />)}

          {xp && (
            <section>
              <Caps className="text-on-surface mb-2 block">
                {xp.none ? "Esta página não tem XP" : "XP desta página"}
              </Caps>
              <div className="space-y-2">
                {xp.rows && (
                  <div className="rounded-lg border border-white/10 divide-y divide-white/5 overflow-hidden">
                    {xp.rows.map((r) => (
                      <div key={r[0]} className="flex items-center gap-3 px-3 py-2">
                        <span className="text-[12px] text-on-surface flex-1">{r[0]}</span>
                        <span className={`text-xs font-medium tabular-nums shrink-0 ${String(r[1]).includes("−") ? "text-error" : "text-on-surface"}`}>{r[1]}</span>
                      </div>
                    ))}
                  </div>
                )}
                {xp.note && <RichText text={xp.note} className="text-[12px] text-on-surface-variant" />}
              </div>
            </section>
          )}

          {entry.tips?.length > 0 && (
            <section className="rounded-lg bg-surface-container-high/60 border border-white/5 p-4">
              <Caps className="text-outline mb-2 block">Na prática</Caps>
              <ul className="space-y-2">
                {entry.tips.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <MI name="arrow_right" className="text-primary-container text-[16px] shrink-0 mt-px" />
                    <RichText text={t} className="text-[12px] text-on-surface-variant flex-1" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* sistema global, recolhido: vale pra todas as páginas, não faz sentido repetir */}
          <details className="rounded-lg border border-white/10 group">
            <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 list-none">
              <MI name="expand_more" className="text-outline text-lg transition-transform group-open:rotate-180" />
              <Caps className="text-outline">{sentence(HELP_GLOBAL.label)}</Caps>
            </summary>
            <div className="px-4 pb-4 space-y-2">
              {HELP_GLOBAL.body.map((t, i) => <RichText key={i} text={t} className="text-[12px] text-on-surface-variant" />)}
              <div className="pt-1">
                <Table table={HELP_GLOBAL.table} />
              </div>
            </div>
          </details>
        </div>

        <div className="p-6 pt-4 shrink-0 border-t border-white/5">
          <button
            onClick={onClose}
            className="w-full h-9 rounded-md border border-input text-on-surface hover:bg-surface-variant text-sm font-medium active:scale-[.98] transition"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Some sozinho em rota sem ajuda (login, perfil) — sem botão morto.
export function HelpButton({ pathname, className = "" }) {
  const [open, setOpen] = useState(false);
  const entry = helpFor(pathname);
  if (!entry) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Como usar: ${entry.title}`}
        title={`Como usar: ${entry.title}`}
        className={`size-8 rounded-md grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition ${className}`}
      >
        <MI name="help" className="text-[18px]" />
      </button>
      {open && <HelpModal entry={entry} onClose={() => setOpen(false)} />}
    </>
  );
}
