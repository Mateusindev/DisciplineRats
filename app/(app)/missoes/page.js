"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, inputCls } from "@/components/ui";
import {
  getDateStr,
  toggleBoardCardState,
  MISSOES_VIEWS,
  missoesView,
  boardLabels,
  cardLabels,
  addBoardLabel,
  updateBoardLabel,
  removeBoardLabel,
  toggleCardLabel,
  BOARD_LABEL_COLORS,
  BOARD_LABELS_MAX,
  BOARD_LABEL_LEN,
} from "@/lib/state";
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners, DragOverlay, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Prioridade como PONTO, não como chip gritado. O quadro é pra ser lido de longe:
// três chips coloridos por card competiam com a etiqueta, que é a informação que o
// usuário escolheu. O texto continua no tooltip e no card aberto.
const PRI = {
  1: { label: "BAIXA", dot: "bg-outline", text: "text-on-surface-variant" },
  2: { label: "MÉDIA", dot: "bg-primary-container", text: "text-primary-container" },
  3: { label: "ALTA", dot: "bg-error", text: "text-error" },
};
const uid = () => crypto.randomUUID();
const stop = (e) => e.stopPropagation();
const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// ---------------------------------------------------------------- etiquetas

// Etiqueta com nome vira chip legível; sem nome vira barra de cor, do jeito do Trello.
// Barra pra tudo obrigaria decorar cores; chip pra tudo estoura a largura do card.
function LabelMark({ label, small = false }) {
  if (!label.text)
    return <span className={`rounded-full ${small ? "h-1.5 w-6" : "h-2 w-8"}`} style={{ background: label.color }} title="Etiqueta sem nome" />;
  return (
    <span
      className={`rounded font-semibold text-white/95 leading-none ${small ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-[3px]"}`}
      style={{ background: label.color }}
    >
      {label.text}
    </span>
  );
}

// Gerenciador de etiquetas do quadro. Editar aqui muda em TODO card — é o ponto da
// mudança, e a tela avisa isso por escrito antes de deixar apagar.
function LabelPopover({ card, colId, onClose, ctx }) {
  const { state, setState } = ctx;
  const cat = boardLabels(state);
  const on = new Set(card.labelIds || []);
  const [editing, setEditing] = useState(null); // id em edição | "new"
  const [draft, setDraft] = useState({ text: "", color: BOARD_LABEL_COLORS[0] });

  const openNew = () => {
    setDraft({ text: "", color: BOARD_LABEL_COLORS[cat.length % BOARD_LABEL_COLORS.length] });
    setEditing("new");
  };
  const openEdit = (l) => {
    setDraft({ text: l.text, color: l.color });
    setEditing(l.id);
  };
  const save = () => {
    if (editing === "new") {
      const id = uid();
      setState((prev) => toggleCardLabel(addBoardLabel(prev, { id, ...draft }), colId, card.id, id));
    } else {
      setState((prev) => updateBoardLabel(prev, editing, draft));
    }
    setEditing(null);
  };
  const drop = async (id) => {
    const ok = await ctx.confirm({
      title: "Excluir etiqueta do quadro?",
      body: "Ela sai deste e de todos os outros cards que a usam. Os cards continuam lá.",
      confirmLabel: "EXCLUIR",
    });
    if (!ok) return;
    setState((prev) => removeBoardLabel(prev, id));
    setEditing(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-[160]" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 z-[170] w-72 rounded-xl border border-outline-variant bg-surface-container-highest p-3 shadow-2xl shadow-black/50 animate-[fadeIn_.1s_ease-out]">
        <div className="flex items-center justify-between mb-2">
          <Caps className="text-outline text-[10px]">ETIQUETAS DO QUADRO</Caps>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition">
            <MI name="close" className="text-base" />
          </button>
        </div>

        {editing ? (
          <div className="rounded-lg border border-outline-variant/60 p-2.5">
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {BOARD_LABEL_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setDraft((d) => ({ ...d, color: c }))}
                  aria-label={`Cor ${c}`}
                  aria-pressed={draft.color === c}
                  className={`h-7 w-7 rounded-md transition ${draft.color === c ? "ring-2 ring-offset-2 ring-offset-surface-container-highest ring-on-surface" : "hover:scale-110"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <input
              value={draft.text}
              onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              onKeyDown={(e) => (e.key === "Enter" ? save() : e.key === "Escape" ? setEditing(null) : null)}
              maxLength={BOARD_LABEL_LEN}
              autoFocus
              placeholder="Nome (opcional)"
              aria-label="Nome da etiqueta"
              className={`${inputCls} w-full text-[13px] py-1.5`}
            />
            <div className="flex items-center gap-2 mt-2.5">
              <button onClick={save} className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-[10px] active:scale-95 transition">
                {editing === "new" ? "CRIAR" : "SALVAR"}
              </button>
              <button onClick={() => setEditing(null)} className="font-label-caps text-[10px] text-on-surface-variant hover:text-on-surface transition">
                CANCELAR
              </button>
              {editing !== "new" && (
                <button onClick={() => drop(editing)} className="ml-auto font-label-caps text-[10px] text-error hover:underline transition">
                  EXCLUIR
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <ul className="space-y-1 max-h-64 overflow-y-auto ff-scroll pr-0.5">
              {cat.map((l) => {
                const active = on.has(l.id);
                return (
                  <li key={l.id} className="flex items-center gap-1">
                    <button
                      onClick={() => setState((prev) => toggleCardLabel(prev, colId, card.id, l.id))}
                      role="checkbox"
                      aria-checked={active}
                      className="flex-1 min-w-0 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-variant/50 transition text-left"
                    >
                      <span className="h-5 w-5 rounded shrink-0" style={{ background: l.color }} />
                      <span className="flex-1 min-w-0 truncate text-[13px] text-on-surface">{l.text || "Sem nome"}</span>
                      <MI name={active ? "check_box" : "check_box_outline_blank"} className={`text-lg shrink-0 ${active ? "text-primary-container" : "text-outline"}`} />
                    </button>
                    <button onClick={() => openEdit(l)} aria-label={`Editar etiqueta ${l.text || l.color}`} className="p-1 text-outline hover:text-on-surface transition shrink-0">
                      <MI name="edit" className="text-base" />
                    </button>
                  </li>
                );
              })}
              {cat.length === 0 && <li className="px-2 py-3 text-[12px] text-outline">Nenhuma etiqueta ainda. Crie uma e ela fica disponível pra todos os cards.</li>}
            </ul>
            <button
              onClick={openNew}
              disabled={cat.length >= BOARD_LABELS_MAX}
              className="mt-2 w-full py-2 rounded-lg border border-dashed border-outline-variant/60 font-label-caps text-[10px] text-on-surface-variant hover:border-primary/50 hover:text-primary disabled:opacity-40 transition"
            >
              {cat.length >= BOARD_LABELS_MAX ? `LIMITE DE ${BOARD_LABELS_MAX} ETIQUETAS` : "CRIAR ETIQUETA"}
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- card

function DueBadge({ due, done, small = false }) {
  const today = getDateStr(0);
  const late = !done && due < today;
  const now = !done && due === today;
  const tone = done
    ? "text-on-surface-variant"
    : late
      ? "bg-error-container/40 text-error"
      : now
        ? "bg-primary-container/25 text-primary-container"
        : "text-on-surface-variant";
  return (
    <span className={`flex items-center gap-1 rounded font-label-caps tabular-nums ${small ? "text-[9px] px-1 py-0.5" : "text-[10px] px-1.5 py-0.5"} ${tone}`} title={late ? "Atrasado" : now ? "Vence hoje" : "Prazo"}>
      <MI name={late ? "event_busy" : "event"} className={small ? "text-[12px]" : "text-[13px]"} /> {ddmm(due)}
    </span>
  );
}

function CardTile({ card, labels, onToggleDone, dragging }) {
  const p = PRI[card.priority] || PRI[2];
  return (
    <div
      className={`rounded-lg border bg-surface-container-lowest px-3 pt-2.5 pb-2 shadow-sm transition ${
        card.done ? "border-primary-container/40" : "border-outline-variant/40"
      } ${dragging ? "opacity-40" : "hover:border-outline hover:shadow-md"}`}
    >
      {labels.length > 0 && <div className="flex flex-wrap items-center gap-1 mb-2">{labels.map((l) => <LabelMark key={l.id} label={l} />)}</div>}
      <div className="flex items-start gap-2">
        <button onPointerDown={stop} onClick={(e) => { e.stopPropagation(); onToggleDone(); }} aria-label={card.done ? "Reabrir cartão" : "Concluir cartão"} className="shrink-0 mt-px">
          <MI name={card.done ? "check_circle" : "radio_button_unchecked"} fill={card.done} className={`text-[18px] ${card.done ? "text-primary-container" : "text-outline hover:text-on-surface-variant"}`} />
        </button>
        <p className={`flex-1 text-[13.5px] leading-snug ${card.done ? "line-through text-on-surface-variant" : "text-on-surface"}`}>{card.text}</p>
      </div>
      <div className="flex items-center gap-2 mt-1.5 pl-6 min-h-[18px]">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.dot}`} title={`Prioridade ${p.label.toLowerCase()}`} />
        {card.due && <DueBadge due={card.due} done={card.done} />}
        {card.desc && <MI name="notes" className="text-outline text-[14px]" title="Tem descrição" />}
        {card.archived && <MI name="inventory_2" className="text-outline text-[14px]" title="Arquivado" />}
      </div>
    </div>
  );
}

// Linha da visão em lista: uma altura de linha, metadados à direita. O tile de três
// linhas empilhado na vertical desperdiçava a tela inteira em espaço vazio.
function CardRow({ card, labels, onToggleDone, dragging }) {
  const p = PRI[card.priority] || PRI[2];
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border bg-surface-container-lowest px-3 py-2 transition ${
        card.done ? "border-primary-container/40" : "border-outline-variant/40"
      } ${dragging ? "opacity-40" : "hover:border-outline"}`}
    >
      <button onPointerDown={stop} onClick={(e) => { e.stopPropagation(); onToggleDone(); }} aria-label={card.done ? "Reabrir cartão" : "Concluir cartão"} className="shrink-0">
        <MI name={card.done ? "check_circle" : "radio_button_unchecked"} fill={card.done} className={`text-lg ${card.done ? "text-primary-container" : "text-outline"}`} />
      </button>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.dot}`} title={`Prioridade ${p.label.toLowerCase()}`} />
      <p className={`flex-1 min-w-0 truncate text-[13px] ${card.done ? "line-through text-on-surface-variant" : "text-on-surface"}`}>{card.text}</p>
      {labels.length > 0 && <span className="hidden sm:flex items-center gap-1 shrink-0">{labels.map((l) => <LabelMark key={l.id} label={l} small />)}</span>}
      {card.desc && <MI name="notes" className="text-outline text-[14px] shrink-0" title="Tem descrição" />}
      {card.due && <DueBadge due={card.due} done={card.done} small />}
    </div>
  );
}

function SortableCard({ card, labels, onToggleDone, onOpen, compact }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const Body = compact ? CardRow : CardTile;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={`cursor-grab active:cursor-grabbing ${compact ? "mb-1.5" : "mb-2"}`}
    >
      <Body card={card} labels={labels} onToggleDone={onToggleDone} dragging={isDragging} />
    </div>
  );
}

// ---------------------------------------------------------------- coluna

// Compositor no rodapé da lista, do jeito do Trello: um link discreto que vira campo.
// Input sempre aberto em toda coluna enchia o quadro de caixas vazias competindo com
// os cards. Fica aberto entre adições — quem cria um card costuma criar três.
function Composer({ colId, onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t) return setOpen(false);
    onAdd(colId, t);
    setText("");
  };
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 w-full flex items-center gap-1.5 rounded-lg px-2 py-2 text-left font-label-caps text-[10px] text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface transition"
      >
        <MI name="add" className="text-base" /> ADICIONAR CARTÃO
      </button>
    );
  return (
    <div className="mt-1">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            setText("");
            setOpen(false);
          }
        }}
        rows={2}
        autoFocus
        placeholder="Título do cartão. Enter adiciona."
        aria-label="Título do novo cartão"
        className={`${inputCls} w-full text-[13px] resize-none`}
      />
      <div className="flex items-center gap-2 mt-1.5">
        <button onClick={submit} className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-[10px] active:scale-95 transition">
          ADICIONAR
        </button>
        <button onClick={() => { setText(""); setOpen(false); }} aria-label="Fechar" className="text-outline hover:text-on-surface transition">
          <MI name="close" className="text-lg" />
        </button>
      </div>
    </div>
  );
}

function Column({ col, totalCount, hiddenCount, canAdd, compact, ctx }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const { renameColumn, removeColumn, toggleDone, openCard, addCard, labelsOf } = ctx;
  return (
    // Lista de largura fixa no quadro, largura cheia empilhada na visão em lista.
    // O dnd-kit não liga pro layout, então arrastar funciona igual nos dois.
    <div
      className={`group/col rounded-xl bg-surface-container border transition ${compact ? "w-full p-3" : "w-[286px] shrink-0 flex flex-col max-h-full p-2.5"} ${
        isOver ? "border-primary/50 bg-surface-container-high" : "border-outline-variant/50"
      }`}
    >
      <div className={`flex items-center gap-1.5 px-1 ${compact ? "mb-2" : "mb-2"}`}>
        <input
          value={col.name}
          onChange={(e) => renameColumn(col.id, e.target.value)}
          aria-label="Nome da lista"
          maxLength={60}
          className="flex-1 min-w-0 bg-transparent rounded px-1.5 py-1 text-[13px] font-semibold text-on-surface outline-none hover:bg-surface-variant/40 focus:bg-surface-variant/60 focus:ring-1 focus:ring-primary/40 transition"
        />
        <span className="shrink-0 rounded-full bg-surface-variant px-2 py-0.5 text-[10px] font-bold tabular-nums text-on-surface-variant">{col.cards.length}</span>
        <button
          onClick={() => removeColumn(col.id, col.name, totalCount)}
          aria-label="Excluir lista"
          title="Excluir lista"
          className="shrink-0 p-1 rounded text-outline opacity-0 group-hover/col:opacity-100 focus:opacity-100 hover:text-error hover:bg-error/10 transition"
        >
          <MI name="delete" className="text-base" />
        </button>
      </div>

      <div ref={setNodeRef} className={`flex flex-col min-h-[8px] ${compact ? "" : "overflow-y-auto ff-scroll pr-0.5 flex-1"}`}>
        <SortableContext items={col.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {col.cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              labels={labelsOf(card)}
              compact={compact}
              onToggleDone={() => toggleDone(col.id, card.id)}
              onOpen={() => openCard(col.id, card.id)}
            />
          ))}
        </SortableContext>
        {col.cards.length === 0 && (
          <div className={`rounded-lg border border-dashed border-outline-variant/40 text-center text-[11px] text-outline ${compact ? "p-2.5" : "p-3"}`}>
            {hiddenCount > 0 ? `${hiddenCount} escondido(s) pelo filtro` : canAdd ? "Solte um cartão aqui" : "Nada arquivado aqui"}
          </div>
        )}
        {col.cards.length > 0 && hiddenCount > 0 && (
          <p className="px-1 pt-1 text-[10px] text-outline">{hiddenCount} escondido(s) pelo filtro</p>
        )}
      </div>

      {canAdd && <Composer colId={col.id} onAdd={addCard} />}
    </div>
  );
}

function AddList({ onAdd, compact }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const submit = () => {
    const n = name.trim();
    if (!n) return setOpen(false);
    onAdd(n);
    setName("");
  };
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 rounded-xl border border-dashed border-outline-variant/50 px-3 py-2.5 font-label-caps text-[10px] text-on-surface-variant hover:border-primary/50 hover:text-primary transition ${
          compact ? "w-full justify-center" : "w-[286px] shrink-0 self-start"
        }`}
      >
        <MI name="add" className="text-base" /> ADICIONAR LISTA
      </button>
    );
  return (
    <div className={`rounded-xl bg-surface-container border border-outline-variant/50 p-2.5 ${compact ? "w-full" : "w-[286px] shrink-0 self-start"}`}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => (e.key === "Enter" ? submit() : e.key === "Escape" ? (setName(""), setOpen(false)) : null)}
        autoFocus
        maxLength={60}
        placeholder="Nome da lista"
        aria-label="Nome da nova lista"
        className={`${inputCls} w-full text-[13px] py-1.5`}
      />
      <div className="flex items-center gap-2 mt-2">
        <button onClick={submit} className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-[10px] active:scale-95 transition">
          CRIAR LISTA
        </button>
        <button onClick={() => { setName(""); setOpen(false); }} aria-label="Fechar" className="text-outline hover:text-on-surface transition">
          <MI name="close" className="text-lg" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- card aberto

function CardModal({ card, colId, colName, ctx }) {
  const { closeCard, updateCard, removeCard, toggleDone, labelsOf } = ctx;
  const [pickingLabel, setPickingLabel] = useState(false);
  const labels = labelsOf(card);
  const p = PRI[card.priority] || PRI[2];

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !pickingLabel && closeCard();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeCard, pickingLabel]);

  const Side = ({ children }) => <div className="space-y-1.5">{children}</div>;
  const sideBtn = "w-full flex items-center gap-2 rounded-lg bg-surface-variant/60 px-3 py-2 font-label-caps text-[10px] text-on-surface hover:bg-surface-variant transition";

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto ff-scroll bg-black/60 p-4 py-10 animate-[fadeIn_.1s_ease-out]" onClick={closeCard} role="dialog" aria-label="Detalhes do cartão">
      <div className="w-full max-w-2xl rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl shadow-black/50" onClick={stop}>
        {/* cabeça: estado + título + de onde ele veio */}
        <div className="flex items-start gap-3 border-b border-outline-variant/50 p-5">
          <button
            onClick={() => toggleDone(colId, card.id)}
            role="switch"
            aria-checked={card.done}
            aria-label={card.done ? "Reabrir cartão" : "Concluir cartão"}
            className="mt-0.5 shrink-0"
          >
            <MI name={card.done ? "check_circle" : "radio_button_unchecked"} fill={card.done} className={`text-2xl ${card.done ? "text-primary-container" : "text-outline hover:text-on-surface"}`} />
          </button>
          <div className="flex-1 min-w-0">
            <textarea
              value={card.text}
              onChange={(e) => updateCard(colId, card.id, { text: e.target.value })}
              rows={1}
              maxLength={280}
              aria-label="Título do cartão"
              className="w-full resize-none bg-transparent font-headline-md text-headline-md text-on-surface outline-none rounded px-1 -mx-1 hover:bg-surface-variant/30 focus:bg-surface-variant/40 transition"
            />
            <p className="mt-1 px-1 text-[11px] text-outline">
              na lista <span className="text-on-surface-variant">{colName}</span>
              {card.archived && " · arquivado"}
            </p>
          </div>
          <button onClick={closeCard} aria-label="Fechar" className="shrink-0 p-1 text-outline hover:text-on-surface transition">
            <MI name="close" />
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[1fr_180px]">
          {/* coluna principal */}
          <div className="min-w-0 space-y-5">
            {labels.length > 0 && (
              <div>
                <Caps className="text-outline text-[10px] mb-1.5 block">ETIQUETAS</Caps>
                <div className="flex flex-wrap items-center gap-1.5">
                  {labels.map((l) => <LabelMark key={l.id} label={l} />)}
                </div>
              </div>
            )}

            <div>
              <Caps className="text-outline text-[10px] mb-1.5 block">DESCRIÇÃO</Caps>
              <textarea
                value={card.desc || ""}
                onChange={(e) => updateCard(colId, card.id, { desc: e.target.value })}
                rows={6}
                maxLength={2000}
                placeholder="O que precisa ser feito, links, passos..."
                aria-label="Descrição do cartão"
                className={`${inputCls} w-full resize-y text-[13px]`}
              />
            </div>
          </div>

          {/* barra lateral de ações, como no Trello */}
          <div className="space-y-4">
            <div>
              <Caps className="text-outline text-[10px] mb-1.5 block">ADICIONAR AO CARTÃO</Caps>
              <Side>
                <div className="relative">
                  <button onClick={() => setPickingLabel((v) => !v)} aria-expanded={pickingLabel} className={sideBtn}>
                    <MI name="label" className="text-base" /> ETIQUETAS
                  </button>
                  {pickingLabel && <LabelPopover card={card} colId={colId} onClose={() => setPickingLabel(false)} ctx={ctx} />}
                </div>
                <label className="block">
                  <span className="sr-only">Prazo</span>
                  <input
                    type="date"
                    value={card.due || ""}
                    onChange={(e) => updateCard(colId, card.id, { due: e.target.value })}
                    aria-label="Prazo"
                    className={`${inputCls} w-full text-[12px] py-2`}
                  />
                </label>
              </Side>
            </div>

            <div>
              <Caps className="text-outline text-[10px] mb-1.5 block">PRIORIDADE</Caps>
              <div className="flex gap-1">
                {[1, 2, 3].map((pv) => {
                  const active = (card.priority || 2) === pv;
                  return (
                    <button
                      key={pv}
                      onClick={() => updateCard(colId, card.id, { priority: pv })}
                      aria-pressed={active}
                      className={`flex-1 flex flex-col items-center gap-1 rounded-lg py-2 font-label-caps text-[9px] transition ${
                        active ? `bg-surface-variant ${PRI[pv].text}` : "text-outline hover:bg-surface-variant/50"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${PRI[pv].dot}`} />
                      {PRI[pv].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Caps className="text-outline text-[10px] mb-1.5 block">AÇÕES</Caps>
              <Side>
                <button onClick={() => updateCard(colId, card.id, { archived: !card.archived })} className={sideBtn}>
                  <MI name={card.archived ? "unarchive" : "archive"} className="text-base" />
                  {card.archived ? "DESARQUIVAR" : "ARQUIVAR"}
                </button>
                <button onClick={() => removeCard(colId, card.id)} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 font-label-caps text-[10px] text-error hover:bg-error/10 transition">
                  <MI name="delete" className="text-base" /> EXCLUIR
                </button>
              </Side>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- página

export default function MissoesPage() {
  const { state, setState, confirm } = useApp();
  const columns = state.board?.columns || [];
  const cat = boardLabels(state);

  const [activeCard, setActiveCard] = useState(null);
  const [editing, setEditing] = useState(null); // { colId, cardId }
  const [showArchived, setShowArchived] = useState(false); // arquivo é uma visão do mesmo quadro
  const [query, setQuery] = useState("");
  const [labelFilter, setLabelFilter] = useState([]); // ids; vazio = tudo

  // Formato escolhido pelo usuário. Fica em settings (não em useState) porque a
  // escolha é preferência, não estado de tela: tem que sobreviver ao reload.
  const view = missoesView(state.settings?.missoesView);
  const isList = view === "lista";
  const setView = (id) => setState((prev) => ({ ...prev, settings: { ...prev.settings, missoesView: id } }));

  const setCols = (fn) => setState((prev) => ({ ...prev, board: { ...prev.board, columns: fn(prev.board?.columns || []) } }));
  const labelsOf = (card) => cardLabels(state, card);

  const addColumn = (name) => setCols((cols) => [...cols, { id: uid(), name, cards: [] }]);
  const renameColumn = (id, name) => setCols((cols) => cols.map((c) => (c.id === id ? { ...c, name } : c)));
  async function removeColumn(id, name, count) {
    if (count > 0) {
      const ok = await confirm({ title: "Excluir lista?", body: `"${name}" e seus ${count} cartão(ões) serão removidos.`, confirmLabel: "EXCLUIR" });
      if (!ok) return;
    }
    setCols((cols) => cols.filter((c) => c.id !== id));
  }
  const addCard = (colId, text) =>
    setCols((cols) =>
      cols.map((c) => (c.id === colId ? { ...c, cards: [...c.cards, { id: uid(), text, priority: 2, done: false, due: "", desc: "", labelIds: [], archived: false }] } : c))
    );
  const removeCard = (colId, cardId) => {
    setCols((cols) => cols.map((c) => (c.id === colId ? { ...c, cards: c.cards.filter((x) => x.id !== cardId) } : c)));
    setEditing(null);
  };
  const updateCard = (colId, cardId, patch) =>
    setCols((cols) => cols.map((c) => (c.id === colId ? { ...c, cards: c.cards.map((x) => (x.id === cardId ? { ...x, ...patch } : x)) } : c)));
  // reducer compartilhado com /foco — a regra de mover pra coluna de concluídos vive em um lugar
  const toggleDone = (colId, cardId) => setState((prev) => toggleBoardCardState(prev, colId, cardId));

  // ---- arquivo ----
  // Card arquivado ganha a marca `archived` e sai da visão normal; nada é apagado, então
  // espelho no Mapa continua resolvendo e o histórico fica.
  const doneOpen = columns.reduce((n, c) => n + c.cards.filter((k) => k.done && !k.archived).length, 0);
  const archivedCount = columns.reduce((n, c) => n + c.cards.filter((k) => k.archived).length, 0);
  const activeCards = columns.reduce((s, c) => s + c.cards.filter((k) => !k.archived).length, 0);

  async function archiveDone() {
    if (!doneOpen) return;
    const ok = await confirm({
      title: `Arquivar ${doneOpen} cartão(ões) concluído(s)?`,
      body: "Eles saem do quadro mas continuam guardados — dá pra consultar e restaurar em ARQUIVADOS.",
      confirmLabel: "ARQUIVAR",
    });
    if (!ok) return;
    setCols((cols) => cols.map((c) => ({ ...c, cards: c.cards.map((k) => (k.done && !k.archived ? { ...k, archived: true } : k)) })));
  }

  // ---- filtro (só visão; nenhuma mutação passa por aqui) ----
  const q = query.trim().toLowerCase();
  const filterOn = !!q || labelFilter.length > 0;
  const matches = (k) => {
    if (q && !`${k.text} ${k.desc || ""}`.toLowerCase().includes(q)) return false;
    if (labelFilter.length && !labelFilter.every((id) => (k.labelIds || []).includes(id))) return false;
    return true;
  };
  const viewCols = useMemo(
    () =>
      columns.map((c) => {
        const inScope = c.cards.filter((k) => (showArchived ? k.archived : !k.archived));
        const shown = inScope.filter(matches);
        return { id: c.id, name: c.name, cards: shown, hidden: inScope.length - shown.length, total: c.cards.length };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, showArchived, q, labelFilter]
  );
  const shownTotal = viewCols.reduce((n, c) => n + c.cards.length, 0);
  const toggleLabelFilter = (id) => setLabelFilter((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

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

  const editCol = editing && columns.find((c) => c.id === editing.colId);
  const editCard = editCol && editCol.cards.find((c) => c.id === editing.cardId);

  const ctx = {
    state,
    setState,
    confirm,
    labelsOf,
    renameColumn,
    removeColumn,
    toggleDone,
    addCard,
    removeCard,
    updateCard,
    openCard: (colId, cardId) => setEditing({ colId, cardId }),
    closeCard: () => setEditing(null),
  };

  const chip = "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-label-caps text-[10px] transition";

  return (
    // lista rola com a página; quadro precisa de altura fixa pra rolar as listas por dentro
    <div className={`flex flex-col ${isList ? "" : "h-[calc(100vh-8rem)]"}`}>
      <section className="mb-3">
        <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
          Missões
          <MI name="verified" className="text-primary-container text-xl" fill />
        </h1>
        <p className="text-body-md text-on-surface-variant">
          {activeCards} cartão(ões) no quadro{filterOn ? ` · ${shownTotal} no filtro` : ""} · toque pra abrir, segure pra arrastar
        </p>
      </section>

      {/* barra de controle: buscar, filtrar por etiqueta, formato, arquivo */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container px-2 py-1 focus-within:border-primary/50 transition">
          <MI name="search" className="text-outline text-base" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no quadro"
            aria-label="Buscar cartão"
            className="w-40 bg-transparent text-[13px] text-on-surface placeholder:text-outline outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Limpar busca" className="text-outline hover:text-on-surface transition">
              <MI name="close" className="text-base" />
            </button>
          )}
        </div>

        {cat.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {cat.map((l) => {
              const on = labelFilter.includes(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => toggleLabelFilter(l.id)}
                  aria-pressed={on}
                  title={`Filtrar por ${l.text || "etiqueta sem nome"}`}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
                    on ? "border-transparent text-white/95" : "border-outline-variant text-on-surface-variant hover:border-outline"
                  }`}
                  style={on ? { background: l.color } : undefined}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                  {l.text || "—"}
                </button>
              );
            })}
            {labelFilter.length > 0 && (
              <button onClick={() => setLabelFilter([])} className="font-label-caps text-[10px] text-outline hover:text-on-surface transition px-1">
                LIMPAR
              </button>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {doneOpen > 0 && !showArchived && (
            <button onClick={archiveDone} className={`${chip} border border-outline-variant text-on-surface-variant hover:bg-surface-container-high`}>
              <MI name="archive" className="text-base" /> ARQUIVAR CONCLUÍDOS ({doneOpen})
            </button>
          )}
          {(archivedCount > 0 || showArchived) && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              aria-pressed={showArchived}
              className={`${chip} border ${showArchived ? "border-primary text-primary bg-primary/10" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-high"}`}
            >
              <MI name={showArchived ? "arrow_back" : "inventory_2"} className="text-base" />
              {showArchived ? "VOLTAR PRO QUADRO" : `ARQUIVADOS (${archivedCount})`}
            </button>
          )}
          <div className="flex items-center gap-0.5 rounded-lg border border-outline-variant p-0.5" role="group" aria-label="Formato do quadro">
            {MISSOES_VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                aria-pressed={view === v.id}
                title={v.label}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-label-caps text-[10px] transition ${
                  view === v.id ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <MI name={v.icon} className="text-base" /> {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showArchived && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <MI name="inventory_2" className="text-primary text-lg" />
          <span className="text-[13px] text-on-surface">
            Vendo o arquivo. Abra um cartão e use <strong className="font-semibold">DESARQUIVAR</strong> pra trazer de volta.
          </span>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveCard(null)}>
        <div className={isList ? "flex flex-col gap-3 pb-4" : "flex gap-3 overflow-x-auto ff-scroll pb-4 flex-1 items-start"}>
          {viewCols.map((col) => (
            <Column key={col.id} col={col} totalCount={col.total} hiddenCount={col.hidden} canAdd={!showArchived} compact={isList} ctx={ctx} />
          ))}
          {!showArchived && <AddList onAdd={addColumn} compact={isList} />}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className={isList ? "opacity-95" : "w-[264px] rotate-2"}>
              {isList ? (
                <CardRow card={activeCard} labels={labelsOf(activeCard)} onToggleDone={() => {}} />
              ) : (
                <CardTile card={activeCard} labels={labelsOf(activeCard)} onToggleDone={() => {}} />
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {editCard && <CardModal card={editCard} colId={editing.colId} colName={editCol.name} ctx={ctx} />}
    </div>
  );
}
