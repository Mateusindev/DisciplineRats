"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI } from "@/components/ui";

const PRI = {
  1: { label: "BAIXA", chip: "bg-surface-variant text-on-surface-variant" },
  2: { label: "MÉDIA", chip: "bg-primary-container/20 text-primary-container border border-primary-container/40" },
  3: { label: "ALTA", chip: "bg-error-container/40 text-error border border-error/40" },
};

const uid = () => crypto.randomUUID();

export default function MissoesPage() {
  const { state, setState, confirm } = useApp();
  const columns = state.board?.columns || [];
  const [cardInput, setCardInput] = useState({}); // { [colId]: text }
  const [newCol, setNewCol] = useState("");

  const setCols = (fn) => setState((prev) => ({ ...prev, board: { ...prev.board, columns: fn(prev.board?.columns || []) } }));

  function addColumn() {
    const name = newCol.trim();
    if (!name) return;
    setCols((cols) => [...cols, { id: uid(), name, cards: [] }]);
    setNewCol("");
  }
  function renameColumn(id, name) {
    setCols((cols) => cols.map((c) => (c.id === id ? { ...c, name } : c)));
  }
  async function removeColumn(id, name, count) {
    if (count > 0) {
      const ok = await confirm({ title: "Excluir coluna?", body: `"${name}" e seus ${count} card(s) serão removidos.`, confirmLabel: "EXCLUIR" });
      if (!ok) return;
    }
    setCols((cols) => cols.filter((c) => c.id !== id));
  }
  function addCard(colId) {
    const text = (cardInput[colId] || "").trim();
    if (!text) return;
    setCols((cols) => cols.map((c) => (c.id === colId ? { ...c, cards: [...c.cards, { id: uid(), text, priority: 2 }] } : c)));
    setCardInput((s) => ({ ...s, [colId]: "" }));
  }
  function removeCard(colId, cardId) {
    setCols((cols) => cols.map((c) => (c.id === colId ? { ...c, cards: c.cards.filter((x) => x.id !== cardId) } : c)));
  }
  function cyclePri(colId, cardId) {
    setCols((cols) => cols.map((c) => (c.id === colId ? { ...c, cards: c.cards.map((x) => (x.id === cardId ? { ...x, priority: ((x.priority || 2) % 3) + 1 } : x)) } : c)));
  }
  function moveCard(colIdx, cardId, dir) {
    setCols((cols) => {
      const target = colIdx + dir;
      if (target < 0 || target >= cols.length) return cols;
      const card = cols[colIdx].cards.find((x) => x.id === cardId);
      if (!card) return cols;
      return cols.map((c, i) => (i === colIdx ? { ...c, cards: c.cards.filter((x) => x.id !== cardId) } : i === target ? { ...c, cards: [...c.cards, card] } : c));
    });
  }

  const totalCards = columns.reduce((s, c) => s + c.cards.length, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <section className="mb-6">
        <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
          Missões
          <MI name="verified" className="text-primary-container text-xl" fill />
        </h1>
        <p className="text-body-md text-on-surface-variant">Seu quadro · {totalCards} card(s) em {columns.length} coluna(s)</p>
      </section>

      {/* board */}
      <div className="flex gap-4 overflow-x-auto ff-scroll pb-4 flex-1 items-start">
        {columns.map((col, colIdx) => (
          <div key={col.id} className="glass-card rounded-2xl p-4 w-[300px] shrink-0 flex flex-col max-h-full">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  value={col.name}
                  onChange={(e) => renameColumn(col.id, e.target.value)}
                  aria-label="Nome da coluna"
                  className="flex-1 min-w-0 bg-transparent font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant outline-none border-b border-transparent focus:border-primary-container/40 transition"
                />
                <span className="bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0">{col.cards.length}</span>
              </div>
              <button onClick={() => removeColumn(col.id, col.name, col.cards.length)} aria-label="Excluir coluna" className="text-outline hover:text-error transition p-1 shrink-0">
                <MI name="more_horiz" className="text-base" />
              </button>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto ff-scroll pr-1 flex-1">
              {col.cards.map((card) => {
                const p = PRI[card.priority] || PRI[2];
                return (
                  <div key={card.id} className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <button onClick={() => cyclePri(col.id, card.id)} className={`font-label-caps text-[9px] px-2 py-0.5 rounded uppercase ${p.chip}`} title="Trocar prioridade">
                        {p.label}
                      </button>
                      <button onClick={() => removeCard(col.id, card.id)} aria-label="Excluir card" className="text-outline hover:text-error transition shrink-0">
                        <MI name="close" className="text-base" />
                      </button>
                    </div>
                    <p className="font-body-sm text-[14px] font-semibold text-on-surface leading-snug mb-3">{card.text}</p>
                    <div className="flex items-center justify-end gap-1 border-t border-outline-variant/20 pt-2">
                      <button onClick={() => moveCard(colIdx, card.id, -1)} disabled={colIdx === 0} aria-label="Mover pra esquerda" className="text-outline hover:text-primary transition disabled:opacity-25 p-1">
                        <MI name="chevron_left" className="text-lg" />
                      </button>
                      <button onClick={() => moveCard(colIdx, card.id, 1)} disabled={colIdx === columns.length - 1} aria-label="Mover pra direita" className="text-outline hover:text-primary transition disabled:opacity-25 p-1">
                        <MI name="chevron_right" className="text-lg" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-1.5 mt-3">
              <input
                value={cardInput[col.id] || ""}
                onChange={(e) => setCardInput((s) => ({ ...s, [col.id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addCard(col.id)}
                placeholder="+ adicionar card"
                className="flex-1 bg-transparent border-2 border-dashed border-primary/20 rounded-lg px-3 py-2 text-[13px] text-on-surface placeholder:text-primary/50 focus:border-primary/40 outline-none transition"
              />
              <button onClick={() => addCard(col.id)} aria-label="Adicionar card" className="px-2.5 rounded-lg bg-primary-container text-on-primary-container active:scale-95 transition shrink-0">
                <MI name="add" className="text-lg" />
              </button>
            </div>
          </div>
        ))}

        {/* nova coluna */}
        <div className="w-[260px] shrink-0 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-primary/20 hover:bg-primary/5 transition self-stretch min-h-[160px]">
          <MI name="add" className="text-primary text-3xl" />
          <div className="flex gap-1.5 w-full">
            <input
              value={newCol}
              onChange={(e) => setNewCol(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addColumn()}
              placeholder="Nova coluna"
              className="flex-1 min-w-0 bg-surface-container-lowest rounded-lg px-3 py-2 text-[13px] text-on-surface border border-outline-variant/30 focus:border-primary/40 outline-none transition"
            />
            <button onClick={addColumn} aria-label="Adicionar coluna" className="px-2.5 rounded-lg bg-primary text-on-primary active:scale-95 transition shrink-0">
              <MI name="add" className="text-lg" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
