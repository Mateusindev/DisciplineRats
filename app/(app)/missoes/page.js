"use client";

import { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { MI, inputCls } from "@/components/ui";
import { getDateStr } from "@/lib/state";
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners, DragOverlay, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PRI = {
  1: { label: "BAIXA", chip: "bg-surface-variant text-on-surface-variant" },
  2: { label: "MÉDIA", chip: "bg-primary-container/20 text-primary-container border border-primary-container/40" },
  3: { label: "ALTA", chip: "bg-error-container/40 text-error border border-error/40" },
};
const LABEL_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];
const uid = () => crypto.randomUUID();
const stop = (e) => e.stopPropagation();
const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function CardBody({ card, onToggleDone, dragging }) {
  const p = PRI[card.priority] || PRI[2];
  const today = getDateStr(0);
  const overdue = card.due && !card.done && card.due < today;
  const labels = card.labels || [];
  return (
    <div className={`bg-surface-container-lowest rounded-xl p-3.5 border shadow-sm transition ${card.done ? "border-primary-container/40 opacity-70" : "border-outline-variant/30"} ${dragging ? "opacity-40" : "hover:shadow-md"}`}>
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {labels.map((l) => (
            <span key={l.id} className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded" style={{ background: l.color }}>
              {l.text || ""}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-start gap-2">
        <button onPointerDown={stop} onClick={(e) => { e.stopPropagation(); onToggleDone(); }} aria-label={card.done ? "Reabrir" : "Concluir"} className="shrink-0 mt-0.5">
          <MI name={card.done ? "check_circle" : "radio_button_unchecked"} fill={card.done} className={card.done ? "text-primary-container" : "text-outline"} />
        </button>
        <p className={`flex-1 font-body-sm text-[14px] font-semibold leading-snug ${card.done ? "line-through text-on-surface-variant" : "text-on-surface"}`}>{card.text}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap mt-2 pl-7">
        <span className={`font-label-caps text-[8px] px-1.5 py-0.5 rounded uppercase ${p.chip}`}>{p.label}</span>
        {card.due && (
          <span className={`flex items-center gap-1 text-[10px] font-label-caps px-1.5 py-0.5 rounded ${overdue ? "bg-error-container/40 text-error" : "text-on-surface-variant"}`}>
            <MI name="event" className="text-[13px]" /> {ddmm(card.due)}
          </span>
        )}
        {card.desc && <MI name="notes" className="text-outline text-[14px]" title="Tem detalhes" />}
      </div>
    </div>
  );
}

function SortableCard({ card, onToggleDone, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onOpen} className="mb-3 cursor-grab active:cursor-grabbing">
      <CardBody card={card} onToggleDone={onToggleDone} dragging={isDragging} />
    </div>
  );
}

export default function MissoesPage() {
  const { state, setState, confirm } = useApp();
  const columns = state.board?.columns || [];
  const [cardInput, setCardInput] = useState({});
  const [newCol, setNewCol] = useState("");
  const [activeCard, setActiveCard] = useState(null);
  const [editing, setEditing] = useState(null); // { colId, cardId }

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
    setCols((cols) => cols.map((c) => (c.id === colId ? { ...c, cards: [...c.cards, { id: uid(), text, priority: 2, done: false, due: "", desc: "", labels: [] }] } : c)));
    setCardInput((s) => ({ ...s, [colId]: "" }));
  }
  const removeCard = (colId, cardId) => setCols((cols) => cols.map((c) => (c.id === colId ? { ...c, cards: c.cards.filter((x) => x.id !== cardId) } : c)));
  const updateCard = (colId, cardId, patch) => setCols((cols) => cols.map((c) => (c.id === colId ? { ...c, cards: c.cards.map((x) => (x.id === cardId ? { ...x, ...patch } : x)) } : c)));
  function toggleDone(colId, cardId, done) {
    const nd = !done;
    setCols((cols) => {
      const src = cols.find((c) => c.id === colId);
      const card = src?.cards.find((k) => k.id === cardId);
      if (!card) return cols;
      const updated = { ...card, done: nd };
      // reabrir, ou concluir já estando na coluna de concluídos → só atualiza no lugar
      const doneCol = cols.find((c) => /conclu|feito|done/i.test(c.name)) || cols[cols.length - 1];
      if (!nd || !doneCol || doneCol.id === colId) {
        return cols.map((c) => (c.id === colId ? { ...c, cards: c.cards.map((k) => (k.id === cardId ? updated : k)) } : c));
      }
      // concluir → move pro fim da coluna de concluídos
      return cols.map((c) => {
        if (c.id === colId) return { ...c, cards: c.cards.filter((k) => k.id !== cardId) };
        if (c.id === doneCol.id) return { ...c, cards: [...c.cards, updated] };
        return c;
      });
    });
  }

  // ---- dnd-kit ----
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );
  const colOf = (id) => (columns.some((c) => c.id === id) ? id : columns.find((c) => c.cards.some((k) => k.id === id))?.id);
  const findCard = (id) => { for (const c of columns) { const k = c.cards.find((x) => x.id === id); if (k) return k; } return null; };

  const onDragStart = ({ active }) => setActiveCard(findCard(active.id));
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
  const editCol = editing && columns.find((c) => c.id === editing.colId);
  const editCard = editCol && editCol.cards.find((c) => c.id === editing.cardId);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <section className="mb-6">
        <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
          Missões
          <MI name="verified" className="text-primary-container text-xl" fill />
        </h1>
        <p className="text-body-md text-on-surface-variant">Seu quadro · {totalCards} card(s) · toque pra detalhes, segure pra arrastar</p>
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveCard(null)}>
        <div className="flex gap-4 overflow-x-auto ff-scroll pb-4 flex-1 items-start">
          {columns.map((col) => (
            <Column key={col.id} col={col} renameColumn={renameColumn} removeColumn={removeColumn} toggleDone={toggleDone} openCard={(cardId) => setEditing({ colId: col.id, cardId })} cardInput={cardInput} setCardInput={setCardInput} addCard={addCard} />
          ))}

          <div className="w-[260px] shrink-0 self-start flex items-center gap-1 rounded-2xl p-2 border-2 border-dashed border-outline-variant/40 hover:border-primary/40 focus-within:border-primary/40 transition">
            <input value={newCol} onChange={(e) => setNewCol(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addColumn()} placeholder="Nova coluna" className="flex-1 min-w-0 bg-transparent px-3 py-2 text-[13px] text-on-surface placeholder:text-outline outline-none" />
            <button onClick={addColumn} aria-label="Adicionar coluna" className="h-8 w-8 grid place-items-center rounded-md text-primary hover:bg-primary/10 active:scale-95 transition shrink-0">
              <MI name="add" className="text-lg" />
            </button>
          </div>
        </div>

        <DragOverlay>{activeCard ? <div className="rotate-2 w-[268px]"><CardBody card={activeCard} onToggleDone={() => {}} /></div> : null}</DragOverlay>
      </DndContext>

      {editCard && (
        <CardModal
          card={editCard}
          onToggleDone={() => toggleDone(editing.colId, editing.cardId, editCard.done)}
          onClose={() => setEditing(null)}
          onPatch={(patch) => updateCard(editing.colId, editing.cardId, patch)}
          onDelete={async () => {
            const ok = await confirm({ title: "Excluir card?", body: editCard.text, confirmLabel: "EXCLUIR" });
            if (ok) { removeCard(editing.colId, editing.cardId); setEditing(null); }
          }}
        />
      )}
    </div>
  );
}

function Column({ col, renameColumn, removeColumn, toggleDone, openCard, cardInput, setCardInput, addCard }) {
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
            <SortableCard key={card.id} card={card} onToggleDone={() => toggleDone(col.id, card.id, card.done)} onOpen={() => openCard(card.id)} />
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

function CardModal({ card, onToggleDone, onClose, onPatch, onDelete }) {
  const [labelText, setLabelText] = useState("");
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const labels = card.labels || [];
  const addLabel = () => {
    onPatch({ labels: [...labels, { id: uid(), color: labelColor, text: labelText.trim().slice(0, 20) }] });
    setLabelText("");
  };
  const removeLabel = (id) => onPatch({ labels: labels.filter((l) => l.id !== id) });

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label="Detalhes do card">
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={stop}>
        <div className="flex items-center justify-between mb-4 gap-3">
          <button onClick={onToggleDone} className={`flex items-center gap-2 font-label-caps text-[11px] px-3 py-1.5 rounded-lg transition ${card.done ? "bg-primary-container text-on-primary-container" : "border border-outline-variant/50 text-on-surface-variant"}`}>
            <MI name={card.done ? "check_circle" : "radio_button_unchecked"} fill={card.done} className="text-base" /> {card.done ? "CONCLUÍDO" : "MARCAR CONCLUÍDO"}
          </button>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition p-1">
            <MI name="close" />
          </button>
        </div>

        <label className="block mb-4">
          <span className="font-label-caps text-[10px] text-outline uppercase">Título</span>
          <input value={card.text} onChange={(e) => onPatch({ text: e.target.value })} className={`${inputCls} w-full mt-1`} />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="font-label-caps text-[10px] text-outline uppercase">Prazo</span>
            <input type="date" value={card.due || ""} onChange={(e) => onPatch({ due: e.target.value })} className={`${inputCls} w-full mt-1`} />
          </label>
          <div>
            <span className="font-label-caps text-[10px] text-outline uppercase">Prioridade</span>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3].map((pv) => (
                <button key={pv} onClick={() => onPatch({ priority: pv })} className={`flex-1 font-label-caps text-[9px] py-2 rounded transition ${(card.priority || 2) === pv ? PRI[pv].chip : "bg-surface-container-high text-outline"}`}>
                  {PRI[pv].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="block mb-4">
          <span className="font-label-caps text-[10px] text-outline uppercase">Detalhes</span>
          <textarea value={card.desc || ""} onChange={(e) => onPatch({ desc: e.target.value })} rows={4} placeholder="Notas, checklist, links..." className={`${inputCls} w-full mt-1 resize-none`} />
        </label>

        <div className="mb-5">
          <span className="font-label-caps text-[10px] text-outline uppercase">Labels</span>
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
              {labels.map((l) => (
                <span key={l.id} className="flex items-center gap-1 text-[10px] font-bold text-white px-2 py-0.5 rounded" style={{ background: l.color }}>
                  {l.text || "•"}
                  <button onClick={() => removeLabel(l.id)} aria-label="Remover label" className="opacity-80 hover:opacity-100"><MI name="close" className="text-[12px]" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex gap-1">
              {LABEL_COLORS.map((c) => (
                <button key={c} onClick={() => setLabelColor(c)} aria-label={`Cor ${c}`} className={`w-6 h-6 rounded-full transition ${labelColor === c ? "ring-2 ring-offset-2 ring-offset-surface-container-lowest ring-on-surface" : ""}`} style={{ background: c }} />
              ))}
            </div>
            <input value={labelText} onChange={(e) => setLabelText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLabel()} placeholder="Nome (opcional)" className={`${inputCls} flex-1 text-[13px] py-1.5`} />
            <button onClick={addLabel} aria-label="Adicionar label" className="h-9 w-9 grid place-items-center rounded-lg bg-primary-container text-on-primary-container active:scale-95 transition shrink-0"><MI name="add" /></button>
          </div>
        </div>

        <button onClick={onDelete} className="flex items-center gap-2 text-error hover:bg-error/10 px-3 py-1.5 rounded-lg font-label-caps text-[11px] transition">
          <MI name="delete" className="text-base" /> EXCLUIR CARD
        </button>
      </div>
    </div>
  );
}
