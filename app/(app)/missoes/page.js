"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, inputCls } from "@/components/ui";

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

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-headline-lg text-headline-lg text-primary uppercase">Missões</h2>
        <p className="font-body-md text-on-surface-variant">Seu quadro. Crie colunas, adicione cards e mova entre elas.</p>
      </section>

      <div className="flex gap-3 overflow-x-auto ff-scroll pb-2 items-start">
        {columns.map((col, colIdx) => (
          <div key={col.id} className="w-72 shrink-0 bg-surface-container rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                value={col.name}
                onChange={(e) => renameColumn(col.id, e.target.value)}
                aria-label="Nome da coluna"
                className="flex-1 min-w-0 bg-transparent font-label-caps text-label-caps text-primary outline-none border-b border-transparent focus:border-primary-container/40 transition"
              />
              <Caps className="text-outline text-[10px]">{col.cards.length}</Caps>
              <button onClick={() => removeColumn(col.id, col.name, col.cards.length)} aria-label="Excluir coluna" className="text-outline hover:text-error transition">
                <MI name="delete" className="text-base" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {col.cards.map((card) => {
                const p = PRI[card.priority] || PRI[2];
                return (
                  <div key={card.id} className="bg-surface-container-high rounded-lg p-3 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <span className="flex-1 text-[13px] leading-snug text-on-surface">{card.text}</span>
                      <button onClick={() => removeCard(col.id, card.id)} aria-label="Excluir card" className="text-outline hover:text-error transition shrink-0">
                        <MI name="close" className="text-base" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => cyclePri(col.id, card.id)} className={`font-label-caps text-[8px] px-1.5 py-0.5 rounded-full ${p.chip}`} title="Trocar prioridade">
                        {p.label}
                      </button>
                      <div className="flex-1" />
                      <button onClick={() => moveCard(colIdx, card.id, -1)} disabled={colIdx === 0} aria-label="Mover pra esquerda" className="text-outline hover:text-primary transition disabled:opacity-30">
                        <MI name="chevron_left" className="text-lg" />
                      </button>
                      <button onClick={() => moveCard(colIdx, card.id, 1)} disabled={colIdx === columns.length - 1} aria-label="Mover pra direita" className="text-outline hover:text-primary transition disabled:opacity-30">
                        <MI name="chevron_right" className="text-lg" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-1.5 mt-1">
              <input
                value={cardInput[col.id] || ""}
                onChange={(e) => setCardInput((s) => ({ ...s, [col.id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addCard(col.id)}
                placeholder="+ card"
                className={`${inputCls} flex-1 text-[13px] py-1.5`}
              />
              <button onClick={() => addCard(col.id)} aria-label="Adicionar card" className="px-2.5 rounded-lg bg-primary-container text-on-primary-container active:scale-95 transition shrink-0">
                <MI name="add" className="text-lg" />
              </button>
            </div>
          </div>
        ))}

        {/* nova coluna */}
        <div className="w-64 shrink-0 bg-surface-container/50 rounded-xl p-3 flex gap-1.5 items-center border border-dashed border-white/10">
          <input
            value={newCol}
            onChange={(e) => setNewCol(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addColumn()}
            placeholder="+ nova coluna"
            className={`${inputCls} flex-1 text-[13px] py-1.5`}
          />
          <button onClick={addColumn} aria-label="Adicionar coluna" className="px-2.5 rounded-lg border border-primary/40 text-primary active:scale-95 transition shrink-0">
            <MI name="add" className="text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
}
