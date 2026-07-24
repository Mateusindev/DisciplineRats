"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI } from "@/components/ui";
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners, DragOverlay, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PRI = {
  1: { label: "BAIXA", chip: "bg-surface-variant text-on-surface-variant" },
  2: { label: "MÉDIA", chip: "bg-primary-container/20 text-primary-container border border-primary-container/40" },
  3: { label: "ALTA", chip: "bg-error-container/40 text-error border border-error/40" },
};
const uid = () => crypto.randomUUID();
const stop = (e) => e.stopPropagation();

// visual do card (reutilizado no card sortable e no overlay)
function CardBody({ card, onCycle, onRemove, dragging }) {
  const p = PRI[card.priority] || PRI[2];
  return (
    <div className={`bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-sm ${dragging ? "opacity-40" : "hover:shadow-md"} transition`}>
      <div className="flex justify-between items-start mb-2 gap-2">
        <button onPointerDown={stop} onClick={onCycle} className={`font-label-caps text-[9px] px-2 py-0.5 rounded uppercase ${p.chip}`} title="Trocar prioridade">
          {p.label}
        </button>
        <button onPointerDown={stop} onClick={onRemove} aria-label="Excluir card" className="text-outline hover:text-error transition shrink-0">
          <MI name="close" className="text-base" />
        </button>
      </div>
      <p className="font-body-sm text-[14px] font-semibold text-on-surface leading-snug">{card.text}</p>
    </div>
  );
}

function SortableCard({ card, onCycle, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3 cursor-grab active:cursor-grabbing">
      <CardBody card={card} onCycle={onCycle} onRemove={onRemove} dragging={isDragging} />
    </div>
  );
}

export default function MissoesPage() {
  const { state, setState, confirm } = useApp();
  const columns = state.board?.columns || [];
  const [cardInput, setCardInput] = useState({});
  const [newCol, setNewCol] = useState("");
  const [activeCard, setActiveCard] = useState(null);

  const setCols = (fn) => setState((prev) => ({ ...prev, board: { ...prev.board, columns: fn(prev.board?.columns || []) } }));

  function addColumn() {
    const name = newCol.trim();
    if (!name) return;
    setCols((cols) => [...cols, { id: uid(), name, cards: [] }]);
    setNewCol("");
  }
  const renameColumn = (id, name) => setCols((cols) => cols.map((c) => (c.id === id ? { ...c, name } : c)));
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
  const removeCard = (colId, cardId) => setCols((cols) => cols.map((c) => (c.id === colId ? { ...c, cards: c.cards.filter((x) => x.id !== cardId) } : c)));
  const cyclePri = (colId, cardId) => setCols((cols) => cols.map((c) => (c.id === colId ? { ...c, cards: c.cards.map((x) => (x.id === cardId ? { ...x, priority: ((x.priority || 2) % 3) + 1 } : x)) } : c)));

  // ---- dnd-kit ----
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );
  const colOf = (id) => (columns.some((c) => c.id === id) ? id : columns.find((c) => c.cards.some((k) => k.id === id))?.id);
  const findCard = (id) => { for (const c of columns) { const k = c.cards.find((x) => x.id === id); if (k) return k; } return null; };

  function onDragStart({ active }) {
    setActiveCard(findCard(active.id));
  }
  function onDragOver({ active, over }) {
    if (!over) return;
    const from = colOf(active.id);
    const to = colOf(over.id);
    if (!from || !to || from === to) return;
    setCols((cols) => {
      const fromCol = cols.find((c) => c.id === from);
      const card = fromCol?.cards.find((k) => k.id === active.id);
      if (!card) return cols;
      const toCol = cols.find((c) => c.id === to);
      let idx = toCol.cards.findIndex((k) => k.id === over.id);
      if (idx < 0) idx = toCol.cards.length;
      return cols.map((c) => {
        if (c.id === from) return { ...c, cards: c.cards.filter((k) => k.id !== active.id) };
        if (c.id === to) { const nc = [...c.cards]; nc.splice(idx, 0, card); return { ...c, cards: nc }; }
        return c;
      });
    });
  }
  function onDragEnd({ active, over }) {
    setActiveCard(null);
    if (!over) return;
    const col = colOf(over.id);
    if (col && colOf(active.id) === col) {
      setCols((cols) => cols.map((c) => {
        if (c.id !== col) return c;
        const oldI = c.cards.findIndex((k) => k.id === active.id);
        const newI = c.cards.findIndex((k) => k.id === over.id);
        if (oldI < 0 || newI < 0 || oldI === newI) return c;
        return { ...c, cards: arrayMove(c.cards, oldI, newI) };
      }));
    }
  }

  const totalCards = columns.reduce((s, c) => s + c.cards.length, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <section className="mb-6">
        <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
          Missões
          <MI name="verified" className="text-primary-container text-xl" fill />
        </h1>
        <p className="text-body-md text-on-surface-variant">Seu quadro · {totalCards} card(s) · segure e arraste o card pra mover</p>
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveCard(null)}>
        <div className="flex gap-4 overflow-x-auto ff-scroll pb-4 flex-1 items-start">
          {columns.map((col) => (
            <Column key={col.id} col={col} colCount={columns.length} renameColumn={renameColumn} removeColumn={removeColumn} cyclePri={cyclePri} removeCard={removeCard} cardInput={cardInput} setCardInput={setCardInput} addCard={addCard} />
          ))}

          <div className="w-[260px] shrink-0 self-start flex items-center gap-1 rounded-2xl p-2 border-2 border-dashed border-outline-variant/40 hover:border-primary/40 focus-within:border-primary/40 transition">
            <input value={newCol} onChange={(e) => setNewCol(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addColumn()} placeholder="Nova coluna" className="flex-1 min-w-0 bg-transparent px-3 py-2 text-[13px] text-on-surface placeholder:text-outline outline-none" />
            <button onClick={addColumn} aria-label="Adicionar coluna" className="h-8 w-8 grid place-items-center rounded-md text-primary hover:bg-primary/10 active:scale-95 transition shrink-0">
              <MI name="add" className="text-lg" />
            </button>
          </div>
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="rotate-2">
              <CardBody card={activeCard} onCycle={() => {}} onRemove={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ col, colCount, renameColumn, removeColumn, cyclePri, removeCard, cardInput, setCardInput, addCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div className={`glass-card rounded-2xl p-4 w-[300px] shrink-0 flex flex-col max-h-full transition ${isOver ? "ring-2 ring-primary/40" : ""}`}>
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input value={col.name} onChange={(e) => renameColumn(col.id, e.target.value)} aria-label="Nome da coluna" className="flex-1 min-w-0 bg-transparent font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant outline-none border-b border-transparent focus:border-primary-container/40 transition" />
          <span className="bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0">{col.cards.length}</span>
        </div>
        <button onClick={() => removeColumn(col.id, col.name, col.cards.length)} aria-label="Excluir coluna" className="text-outline hover:text-error transition p-1 shrink-0">
          <MI name="more_horiz" className="text-base" />
        </button>
      </div>

      <div ref={setNodeRef} className="flex flex-col overflow-y-auto ff-scroll pr-1 flex-1 min-h-[40px]">
        <SortableContext items={col.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {col.cards.map((card) => (
            <SortableCard key={card.id} card={card} onCycle={() => cyclePri(col.id, card.id)} onRemove={() => removeCard(col.id, card.id)} />
          ))}
        </SortableContext>
        {col.cards.length === 0 && <div className="rounded-lg border border-dashed border-outline-variant/30 p-4 text-center text-[11px] text-outline">Solte aqui</div>}
      </div>

      <div className="flex items-center gap-1 mt-3 border-2 border-dashed border-outline-variant/40 rounded-lg focus-within:border-primary/40 transition">
        <input value={cardInput[col.id] || ""} onChange={(e) => setCardInput((s) => ({ ...s, [col.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addCard(col.id)} placeholder="Adicionar card" className="flex-1 min-w-0 bg-transparent px-3 py-2 text-[13px] text-on-surface placeholder:text-outline outline-none" />
        <button onClick={() => addCard(col.id)} aria-label="Adicionar card" className="mr-1 h-8 w-8 grid place-items-center rounded-md text-primary hover:bg-primary/10 active:scale-95 transition shrink-0">
          <MI name="add" className="text-lg" />
        </button>
      </div>
    </div>
  );
}
