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
  BOARD_CHECKS_MAX,
  BOARD_CHECK_LEN,
  cardChecks,
  cardCheckProgress,
} from "@/lib/state";
import Prancheta from "./Prancheta";
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners, DragOverlay, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Prioridade = ponto + PALAVRA. A versão só-ponto obrigava decorar a legenda de
// cores (e no daltônico não dizia nada); o texto sem fundo colorido resolve isso
// sem virar chip gritado — a cor fica no ponto e na tinta da palavra, e a etiqueta
// do usuário segue sendo o único elemento com fundo pintado.
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

  // Esc fecha O POPOVER, não o cartão atrás dele. Registrado na fase de captura
  // com stopImmediatePropagation porque o modal também escuta Esc no window: sem
  // isso os dois fechavam de uma vez, e quem só queria sair da lista de etiquetas
  // perdia o cartão de vista.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[160]" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 z-[170] w-72 rounded-xl border border-outline-variant bg-surface-container-highest p-3 shadow-2xl shadow-black/25 animate-[fadeIn_.1s_ease-out]">
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

// Prioridade legível em qualquer lugar (tile, linha, chip do layout FOCO).
function PriTag({ priority, small = false }) {
  const p = PRI[priority] || PRI[2];
  return (
    <span
      title={`Prioridade ${p.label.toLowerCase()}`}
      className={`flex items-center gap-1 shrink-0 font-label-caps ${small ? "text-[9px]" : "text-[10px]"} ${p.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  );
}

// Avanço da checklist visto de fora do cartão: checklist que só existe com o cartão
// aberto não ajuda a escolher o que fazer agora.
function ChecksBadge({ card, small = false }) {
  const p = cardCheckProgress(card);
  if (!p) return null;
  return (
    <span
      title={`Checklist: ${p.done} de ${p.total}`}
      className={`flex items-center gap-1 shrink-0 font-label-caps tabular-nums ${small ? "text-[9px]" : "text-[10px]"} ${
        p.complete ? "text-primary-container" : "text-outline"
      }`}
    >
      <MI name="checklist" className={small ? "text-[12px]" : "text-[13px]"} />
      {p.done}/{p.total}
    </span>
  );
}

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
  return (
    <div
      // container-high, não container-lowest: o lowest é #070a11, quase preto, e
      // sobre a coluna (container) o cartão virava buraco em vez de peça em cima
      className={`rounded-lg border bg-surface-container-high px-3 pt-2.5 pb-2 shadow-sm transition ${
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 pl-6 min-h-[18px]">
        <PriTag priority={card.priority} />
        {card.due && <DueBadge due={card.due} done={card.done} />}
        <ChecksBadge card={card} />
        {card.desc && <MI name="notes" className="text-outline text-[14px]" title="Tem descrição" />}
        {card.archived && <MI name="inventory_2" className="text-outline text-[14px]" title="Arquivado" />}
      </div>
    </div>
  );
}

// Linha da visão em lista: uma altura de linha, metadados à direita. O tile de três
// linhas empilhado na vertical desperdiçava a tela inteira em espaço vazio.
function CardRow({ card, labels, onToggleDone, dragging }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border bg-surface-container-high px-3 py-2 transition ${
        card.done ? "border-primary-container/40" : "border-outline-variant/40"
      } ${dragging ? "opacity-40" : "hover:border-outline"}`}
    >
      <button onPointerDown={stop} onClick={(e) => { e.stopPropagation(); onToggleDone(); }} aria-label={card.done ? "Reabrir cartão" : "Concluir cartão"} className="shrink-0">
        <MI name={card.done ? "check_circle" : "radio_button_unchecked"} fill={card.done} className={`text-lg ${card.done ? "text-primary-container" : "text-outline"}`} />
      </button>
      <PriTag priority={card.priority} small />
      <p className={`flex-1 min-w-0 truncate text-[13px] ${card.done ? "line-through text-on-surface-variant" : "text-on-surface"}`}>{card.text}</p>
      {labels.length > 0 && <span className="hidden sm:flex items-center gap-1 shrink-0">{labels.map((l) => <LabelMark key={l.id} label={l} small />)}</span>}
      <ChecksBadge card={card} small />
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

// ============================================================================
// PREVIEW — 5 LAYOUTS PRO DETALHE DO CARTÃO
//
// Mesmo conteúdo nos 5 (concluir, título, lista de origem, etiquetas, descrição,
// prazo, prioridade, arquivar, excluir): o que muda é a ARRUMAÇÃO. Switch em
// state local, dentro do próprio modal, pra dar pra trocar olhando.
// Depois de escolher um, os outros 4 (e este comentário) somem.
// ============================================================================

const CARD_LAYOUTS = [
  { id: "stack", label: "PILHA", icon: "view_agenda", w: "max-w-lg", hint: "Uma coluna só, na ordem de leitura — sem barra lateral" },
  { id: "props", label: "PROPRIEDADES", icon: "list_alt", w: "max-w-2xl", hint: "Campos como linhas rótulo/valor, descrição embaixo" },
  { id: "tabs", label: "ABAS", icon: "tab", w: "max-w-xl", hint: "Detalhes, campos e ações em abas — janela baixa" },
  { id: "hero", label: "CAPA", icon: "crop_16_9", w: "max-w-2xl", hint: "Faixa de topo com título e chips; ações no rodapé" },
  { id: "focus", label: "FOCO", icon: "notes", w: "max-w-3xl", hint: "Descrição manda; campos viram chips que abrem ao clicar" },
];

function CardLayoutSwitcher({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 flex-wrap border-b border-outline-variant/50 px-3 py-2">
      <Caps className="text-outline text-[9px] flex items-center gap-1 mr-1 shrink-0">
        <MI name="science" className="text-[13px]" /> PREVIEW
      </Caps>
      {CARD_LAYOUTS.map((l) => {
        const on = value === l.id;
        return (
          <button
            key={l.id}
            onClick={() => onChange(l.id)}
            aria-pressed={on}
            title={l.hint}
            className={`flex items-center gap-1 px-2 h-6 rounded-full font-label-caps text-[9px] border transition ${
              on ? "bg-primary/15 text-primary border-primary/40" : "border-outline-variant text-outline hover:text-on-surface-variant"
            }`}
          >
            <MI name={l.icon} className="text-[13px]" />
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- peças compartilhadas: cada layout só decide ONDE elas ficam ----

const SIDE_BTN = "w-full flex items-center gap-2 rounded-lg bg-surface-variant/60 px-3 py-2 font-label-caps text-[10px] text-on-surface hover:bg-surface-variant transition";
const CHIP_BTN = "flex items-center gap-1.5 rounded-full border border-outline-variant px-2.5 py-1 font-label-caps text-[10px] text-on-surface-variant hover:border-outline hover:text-on-surface transition";

function DoneToggle({ card, colId, ctx, size = "text-2xl" }) {
  return (
    <button
      onClick={() => ctx.toggleDone(colId, card.id)}
      role="switch"
      aria-checked={card.done}
      aria-label={card.done ? "Reabrir cartão" : "Concluir cartão"}
      className="mt-0.5 shrink-0"
    >
      <MI
        name={card.done ? "check_circle" : "radio_button_unchecked"}
        fill={card.done}
        className={`${size} ${card.done ? "text-primary-container" : "text-outline hover:text-on-surface"}`}
      />
    </button>
  );
}

function TitleField({ card, colId, ctx, cls = "font-headline-md text-headline-md" }) {
  return (
    <textarea
      value={card.text}
      onChange={(e) => ctx.updateCard(colId, card.id, { text: e.target.value })}
      rows={1}
      maxLength={280}
      aria-label="Título do cartão"
      className={`w-full resize-none bg-transparent ${cls} text-on-surface outline-none rounded px-1 -mx-1 hover:bg-surface-variant/30 focus:bg-surface-variant/40 transition`}
    />
  );
}

function DescField({ card, colId, ctx, rows = 6 }) {
  return (
    <textarea
      value={card.desc || ""}
      onChange={(e) => ctx.updateCard(colId, card.id, { desc: e.target.value })}
      rows={rows}
      maxLength={2000}
      placeholder="O que precisa ser feito, links, passos..."
      aria-label="Descrição do cartão"
      className={`${inputCls} w-full resize-y text-[13px]`}
    />
  );
}

// ---- checklist ----
// Sem modo de edição separado: caixa, texto editável no lugar, remover. Checklist
// se mexe ENQUANTO se trabalha, e um botão "editar lista" entre a intenção e o
// clique é atrito puro. O X aparece no hover no desktop e fica visível (fraco) no
// toque, onde hover não existe.
function ChecklistField({ card, colId, ctx }) {
  const items = cardChecks(card);
  const prog = cardCheckProgress(card);
  const [draft, setDraft] = useState("");
  const full = items.length >= BOARD_CHECKS_MAX;
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    ctx.addCheck(colId, card.id, t);
    setDraft("");
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Caps className="text-outline text-[10px] flex items-center gap-1">
          <MI name="checklist" className="text-sm" /> CHECKLIST
        </Caps>
        {prog && (
          <Caps className={`text-[10px] tabular-nums ${prog.complete ? "text-primary-container" : "text-outline"}`}>
            {prog.done}/{prog.total}
          </Caps>
        )}
      </div>
      {prog && (
        <div className="w-full h-1 bg-surface-variant rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-primary-container rounded-full transition-all"
            style={{ width: `${Math.round((prog.done / prog.total) * 100)}%` }}
          />
        </div>
      )}
      {items.length > 0 && (
        <ul className="space-y-0.5 mb-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-1.5 group">
              <button
                onClick={() => ctx.toggleCheck(colId, card.id, it.id)}
                role="checkbox"
                aria-checked={it.done}
                aria-label={it.text}
                className="shrink-0"
              >
                <MI
                  name={it.done ? "check_box" : "check_box_outline_blank"}
                  fill={it.done}
                  className={`text-lg ${it.done ? "text-primary-container" : "text-outline hover:text-on-surface-variant"}`}
                />
              </button>
              <input
                value={it.text}
                onChange={(e) => ctx.renameCheck(colId, card.id, it.id, e.target.value)}
                maxLength={BOARD_CHECK_LEN}
                aria-label="Item da checklist"
                className={`flex-1 min-w-0 bg-transparent outline-none rounded px-1 -mx-1 text-[13px] transition hover:bg-surface-variant/30 focus:bg-surface-variant/40 ${
                  it.done ? "line-through text-on-surface-variant" : "text-on-surface"
                }`}
              />
              <button
                onClick={() => ctx.removeCheck(colId, card.id, it.id)}
                aria-label="Remover item"
                className="shrink-0 p-0.5 text-outline hover:text-error transition opacity-60 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
              >
                <MI name="close" className="text-sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          disabled={full}
          maxLength={BOARD_CHECK_LEN}
          placeholder={full ? `Limite de ${BOARD_CHECKS_MAX} itens` : "Adicionar item..."}
          aria-label="Novo item da checklist"
          className={`${inputCls} flex-1 min-w-0 text-[12px] py-1.5 disabled:opacity-50`}
        />
        <button
          onClick={add}
          disabled={full}
          aria-label="Adicionar item"
          className="h-8 w-8 grid place-items-center rounded-md text-primary hover:bg-primary/10 active:scale-95 disabled:opacity-30 transition shrink-0"
        >
          <MI name="add" className="text-lg" />
        </button>
      </div>
    </div>
  );
}

function DueField({ card, colId, ctx }) {
  return (
    <input
      type="date"
      value={card.due || ""}
      onChange={(e) => ctx.updateCard(colId, card.id, { due: e.target.value })}
      aria-label="Prazo"
      className={`${inputCls} w-full text-[12px] py-2`}
    />
  );
}

// horizontal: três pastilhas lado a lado; o ponto colorido carrega a escala
function PriorityPicker({ card, colId, ctx }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((pv) => {
        const active = (card.priority || 2) === pv;
        return (
          <button
            key={pv}
            onClick={() => ctx.updateCard(colId, card.id, { priority: pv })}
            aria-pressed={active}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 font-label-caps text-[9px] transition ${
              active ? `bg-surface-variant ${PRI[pv].text}` : "text-outline hover:bg-surface-variant/50"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${PRI[pv].dot}`} />
            {PRI[pv].label}
          </button>
        );
      })}
    </div>
  );
}

function LabelsRow({ card, ctx, empty = null }) {
  const labels = ctx.labelsOf(card);
  if (!labels.length) return empty;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.map((l) => (
        <LabelMark key={l.id} label={l} />
      ))}
    </div>
  );
}

// botão + popover de etiquetas. O wrapper `relative` é o que ancora o popover,
// então ele viaja junto com o botão em qualquer layout.
function LabelButton({ card, colId, ctx, className = SIDE_BTN, label = "ETIQUETAS" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className={className}>
        <MI name="label" className="text-base" /> {label}
      </button>
      {open && <LabelPopover card={card} colId={colId} onClose={() => setOpen(false)} ctx={ctx} />}
    </div>
  );
}

function ActionButtons({ card, colId, ctx, vertical = true }) {
  const arch = (
    <button onClick={() => ctx.updateCard(colId, card.id, { archived: !card.archived })} className={vertical ? SIDE_BTN : CHIP_BTN}>
      <MI name={card.archived ? "unarchive" : "archive"} className="text-base" />
      {card.archived ? "DESARQUIVAR" : "ARQUIVAR"}
    </button>
  );
  const del = (
    <button
      onClick={() => ctx.removeCard(colId, card.id)}
      className={
        vertical
          ? "w-full flex items-center gap-2 rounded-lg px-3 py-2 font-label-caps text-[10px] text-error hover:bg-error/10 transition"
          : "flex items-center gap-1.5 rounded-full border border-error/40 px-2.5 py-1 font-label-caps text-[10px] text-error hover:bg-error/10 transition"
      }
    >
      <MI name="delete" className="text-base" /> EXCLUIR
    </button>
  );
  return <div className={vertical ? "space-y-1.5" : "flex items-center gap-2"}>{arch}{del}</div>;
}

function ModalHead({ card, colId, colName, ctx, onClose, titleCls }) {
  return (
    <div className="flex items-start gap-3 border-b border-outline-variant/50 p-5">
      <DoneToggle card={card} colId={colId} ctx={ctx} />
      <div className="flex-1 min-w-0">
        <TitleField card={card} colId={colId} ctx={ctx} cls={titleCls} />
        <p className="mt-1 px-1 text-[11px] text-outline">
          na lista <span className="text-on-surface-variant">{colName}</span>
          {card.archived && " · arquivado"}
        </p>
      </div>
      <button onClick={onClose} aria-label="Fechar" className="shrink-0 p-1 text-outline hover:text-on-surface transition">
        <MI name="close" />
      </button>
    </div>
  );
}

const FieldLabel = ({ children }) => <Caps className="text-outline text-[10px] mb-1.5 block">{children}</Caps>;

// ---- 1. PILHA: uma coluna, ordem de leitura, ações no rodapé ----
function CardStack(props) {
  const { card, colId, ctx } = props;
  return (
    <>
      <ModalHead {...props} />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <LabelsRow card={card} ctx={ctx} />
          <LabelButton card={card} colId={colId} ctx={ctx} className={CHIP_BTN} label="ETIQUETAS" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>PRAZO</FieldLabel>
            <DueField card={card} colId={colId} ctx={ctx} />
          </div>
          <div>
            <FieldLabel>PRIORIDADE</FieldLabel>
            <PriorityPicker card={card} colId={colId} ctx={ctx} />
          </div>
        </div>
        <div>
          <FieldLabel>DESCRIÇÃO</FieldLabel>
          <DescField card={card} colId={colId} ctx={ctx} rows={7} />
        </div>
        <ChecklistField card={card} colId={colId} ctx={ctx} />
      </div>
      <div className="flex justify-end border-t border-outline-variant/50 px-5 py-3">
        <ActionButtons card={card} colId={colId} ctx={ctx} vertical={false} />
      </div>
    </>
  );
}

// ---- 2. PROPRIEDADES: campos como linhas rótulo/valor, tipo registro ----
function CardProps(props) {
  const { card, colId, colName, ctx } = props;
  const Row = ({ label, children }) => (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3 border-b border-outline-variant/30 px-5 py-2.5 last:border-b-0">
      <Caps className="text-outline text-[10px]">{label}</Caps>
      <div className="min-w-0">{children}</div>
    </div>
  );
  return (
    <>
      <ModalHead {...props} />
      <div className="border-b border-outline-variant/50">
        <Row label="LISTA">
          <span className="text-[13px] text-on-surface-variant">{colName}</span>
        </Row>
        <Row label="PRAZO">
          <div className="flex items-center gap-2">
            <div className="w-40">
              <DueField card={card} colId={colId} ctx={ctx} />
            </div>
            {card.due && <DueBadge due={card.due} done={card.done} />}
          </div>
        </Row>
        <Row label="PRIORIDADE">
          <div className="max-w-xs">
            <PriorityPicker card={card} colId={colId} ctx={ctx} />
          </div>
        </Row>
        <Row label="ETIQUETAS">
          <div className="flex flex-wrap items-center gap-2">
            <LabelsRow card={card} ctx={ctx} />
            <LabelButton card={card} colId={colId} ctx={ctx} className={CHIP_BTN} label="EDITAR" />
          </div>
        </Row>
        <Row label="AÇÕES">
          <ActionButtons card={card} colId={colId} ctx={ctx} vertical={false} />
        </Row>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <FieldLabel>DESCRIÇÃO</FieldLabel>
          <DescField card={card} colId={colId} ctx={ctx} rows={8} />
        </div>
        <ChecklistField card={card} colId={colId} ctx={ctx} />
      </div>
    </>
  );
}

// ---- 3. ABAS: janela baixa; cada assunto no seu painel ----
const CARD_TABS = [
  { id: "desc", label: "DETALHES", icon: "notes" },
  { id: "checks", label: "CHECKLIST", icon: "checklist" },
  { id: "fields", label: "CAMPOS", icon: "tune" },
  { id: "acts", label: "AÇÕES", icon: "more_horiz" },
];

function CardTabs(props) {
  const { card, colId, ctx } = props;
  const [tab, setTab] = useState("desc");
  return (
    <>
      <ModalHead {...props} />
      <div role="tablist" className="flex border-b border-outline-variant/50">
        {CARD_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-label-caps text-[10px] border-b-2 transition ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:bg-surface-variant/40"
            }`}
          >
            <MI name={t.icon} className="text-base" /> {t.label}
            {t.id === "checks" && cardCheckProgress(card) && (
              <span className="tabular-nums text-[9px] text-outline">
                {cardCheckProgress(card).done}/{cardCheckProgress(card).total}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="p-5">
        {tab === "desc" && <DescField card={card} colId={colId} ctx={ctx} rows={9} />}
        {tab === "checks" && <ChecklistField card={card} colId={colId} ctx={ctx} />}
        {tab === "fields" && (
          <div className="space-y-4">
            <div>
              <FieldLabel>PRAZO</FieldLabel>
              <div className="max-w-xs">
                <DueField card={card} colId={colId} ctx={ctx} />
              </div>
            </div>
            <div>
              <FieldLabel>PRIORIDADE</FieldLabel>
              <div className="max-w-sm">
                <PriorityPicker card={card} colId={colId} ctx={ctx} />
              </div>
            </div>
            <div>
              <FieldLabel>ETIQUETAS</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <LabelsRow card={card} ctx={ctx} />
                <LabelButton card={card} colId={colId} ctx={ctx} className={CHIP_BTN} label="EDITAR" />
              </div>
            </div>
          </div>
        )}
        {tab === "acts" && (
          <div className="max-w-xs">
            <ActionButtons card={card} colId={colId} ctx={ctx} />
          </div>
        )}
      </div>
    </>
  );
}

// ---- 4. CAPA: faixa de topo com tudo resumido, corpo só descrição ----
function CardHero(props) {
  const { card, colId, colName, ctx, onClose } = props;
  const p = PRI[card.priority] || PRI[2];
  return (
    <>
      <div className="relative overflow-hidden rounded-t-2xl bg-surface-variant/40 p-5">
        {/* barra de prioridade na borda: cor sem pintar a faixa inteira */}
        <span className={`absolute left-0 top-0 h-full w-1.5 ${p.dot}`} />
        <div className="flex items-start gap-3">
          <DoneToggle card={card} colId={colId} ctx={ctx} size="text-3xl" />
          <div className="flex-1 min-w-0">
            <TitleField card={card} colId={colId} ctx={ctx} cls="font-headline-lg text-headline-lg" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Caps className="text-outline text-[10px]">{colName}</Caps>
              {card.archived && <Caps className="text-outline text-[10px]">· ARQUIVADO</Caps>}
              {card.due && <DueBadge due={card.due} done={card.done} />}
              <PriTag priority={card.priority} />
              <LabelsRow card={card} ctx={ctx} />
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="shrink-0 p-1 text-outline hover:text-on-surface transition">
            <MI name="close" />
          </button>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <DescField card={card} colId={colId} ctx={ctx} rows={8} />
        <ChecklistField card={card} colId={colId} ctx={ctx} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-40">
            <DueField card={card} colId={colId} ctx={ctx} />
          </div>
          <div className="w-56">
            <PriorityPicker card={card} colId={colId} ctx={ctx} />
          </div>
          <LabelButton card={card} colId={colId} ctx={ctx} className={CHIP_BTN} label="ETIQUETAS" />
        </div>
      </div>
      <div className="flex justify-end border-t border-outline-variant/50 px-5 py-3">
        <ActionButtons card={card} colId={colId} ctx={ctx} vertical={false} />
      </div>
    </>
  );
}

// ---- 5. FOCO: descrição é o assunto; campo só aparece quando pedido ----
function CardFocus(props) {
  const { card, colId, ctx } = props;
  const [panel, setPanel] = useState(null); // "due" | "pri" | "acts" | null
  const toggle = (id) => setPanel((cur) => (cur === id ? null : id));
  return (
    <>
      <ModalHead {...props} />
      <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant/50 px-5 py-2.5">
        <LabelsRow card={card} ctx={ctx} />
        <LabelButton card={card} colId={colId} ctx={ctx} className={CHIP_BTN} label="ETIQUETAS" />
        <button onClick={() => toggle("due")} aria-expanded={panel === "due"} className={CHIP_BTN}>
          <MI name="event" className="text-base" />
          {card.due ? ddmm(card.due) : "PRAZO"}
        </button>
        <button onClick={() => toggle("pri")} aria-expanded={panel === "pri"} className={CHIP_BTN}>
          <PriTag priority={card.priority} />
        </button>
        <button onClick={() => toggle("acts")} aria-expanded={panel === "acts"} aria-label="Mais ações" className={`${CHIP_BTN} ml-auto`}>
          <MI name="more_horiz" className="text-base" />
        </button>
      </div>
      {panel && (
        <div className="border-b border-outline-variant/50 bg-surface-variant/20 px-5 py-3">
          {panel === "due" && (
            <div className="max-w-xs">
              <DueField card={card} colId={colId} ctx={ctx} />
            </div>
          )}
          {panel === "pri" && (
            <div className="max-w-sm">
              <PriorityPicker card={card} colId={colId} ctx={ctx} />
            </div>
          )}
          {panel === "acts" && <ActionButtons card={card} colId={colId} ctx={ctx} vertical={false} />}
        </div>
      )}
      <div className="space-y-4 p-5">
        <DescField card={card} colId={colId} ctx={ctx} rows={10} />
        <ChecklistField card={card} colId={colId} ctx={ctx} />
      </div>
    </>
  );
}

const CARD_BODIES = { stack: CardStack, props: CardProps, tabs: CardTabs, hero: CardHero, focus: CardFocus };

function CardModal({ card, colId, colName, ctx }) {
  const { closeCard } = ctx;
  const [layout, setLayout] = useState("stack");
  const conf = CARD_LAYOUTS.find((l) => l.id === layout) || CARD_LAYOUTS[0];
  const Body = CARD_BODIES[layout] || CardStack;

  useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("cardLayoutPreview");
    if (saved && CARD_LAYOUTS.some((l) => l.id === saved)) setLayout(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("cardLayoutPreview", layout);
  }, [layout]);

  // Escape fecha, menos quando um popover está aberto por cima — daí ele fecha
  // primeiro. Cada popover cuida do seu, então aqui basta o cartão.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeCard();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeCard]);

  return (
    <div
      // véu mais leve + desfoque em vez de chapa preta: o preto sólido a 60%
      // achatava o quadro atrás num retângulo morto
      className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto ff-scroll bg-black/40 backdrop-blur-sm p-4 py-10 animate-[fadeIn_.1s_ease-out]"
      onClick={closeCard}
      role="dialog"
      aria-label="Detalhes do cartão"
    >
      {/* container (não container-lowest): o lowest é #070a11, preto de fato, e é
          nele que se passa o tempo mexendo no cartão. Os campos usam
          container-high, então eles sobem em cima deste fundo em vez de sumir. */}
      <div className={`w-full ${conf.w} rounded-2xl border border-outline-variant bg-surface-container shadow-2xl shadow-black/25`} onClick={stop}>
        <CardLayoutSwitcher value={layout} onChange={setLayout} />
        <Body card={card} colId={colId} colName={colName} ctx={ctx} onClose={closeCard} />
      </div>
    </div>
  );
}

// Seletor de formato. Extraído porque a prancheta também precisa dele, e ela não
// tem barra de busca/etiqueta/arquivo pra pendurar o seletor dentro.
function ViewSwitch({ view, setView }) {
  return (
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
  const isCanvas = view === "prancheta";
  const canvasPageCount = (state.canvasPages || []).length;
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
      cols.map((c) => (c.id === colId ? { ...c, cards: [...c.cards, { id: uid(), text, priority: 2, done: false, due: "", desc: "", labelIds: [], archived: false, checks: [] }] } : c))
    );
  const removeCard = (colId, cardId) => {
    setCols((cols) => cols.map((c) => (c.id === colId ? { ...c, cards: c.cards.filter((x) => x.id !== cardId) } : c)));
    setEditing(null);
  };
  const updateCard = (colId, cardId, patch) =>
    setCols((cols) => cols.map((c) => (c.id === colId ? { ...c, cards: c.cards.map((x) => (x.id === cardId ? { ...x, ...patch } : x)) } : c)));

  // ---- checklist do cartão ----
  // Tudo por cima de `updateCard`: um caminho só de mutação pro cartão, então o
  // quadro não ganha um segundo jeito de escrever card que possa divergir.
  const patchChecks = (colId, cardId, fn) =>
    setCols((cols) =>
      cols.map((c) =>
        c.id === colId ? { ...c, cards: c.cards.map((x) => (x.id === cardId ? { ...x, checks: fn(cardChecks(x)) } : x)) } : c
      )
    );
  const addCheck = (colId, cardId, text) =>
    patchChecks(colId, cardId, (items) =>
      items.length >= BOARD_CHECKS_MAX ? items : [...items, { id: uid(), text: text.slice(0, BOARD_CHECK_LEN), done: false }]
    );
  const toggleCheck = (colId, cardId, checkId) =>
    patchChecks(colId, cardId, (items) => items.map((i) => (i.id === checkId ? { ...i, done: !i.done } : i)));
  const renameCheck = (colId, cardId, checkId, text) =>
    patchChecks(colId, cardId, (items) => items.map((i) => (i.id === checkId ? { ...i, text: text.slice(0, BOARD_CHECK_LEN) } : i)));
  const removeCheck = (colId, cardId, checkId) => patchChecks(colId, cardId, (items) => items.filter((i) => i.id !== checkId));
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
    // a checklist entra na busca: item digitado ali é conteúdo do cartão como
    // qualquer outro, e ficar de fora fazia a busca mentir
    if (q && !`${k.text} ${k.desc || ""} ${cardChecks(k).map((i) => i.text).join(" ")}`.toLowerCase().includes(q)) return false;
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
    addCheck,
    toggleCheck,
    renameCheck,
    removeCheck,
    openCard: (colId, cardId) => setEditing({ colId, cardId }),
    closeCard: () => setEditing(null),
  };

  const chip = "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-label-caps text-[10px] transition";

  return (
    // lista rola com a página; quadro e prancheta precisam de altura fixa pra rolar
    // (ou desenhar) por dentro — min-h-0 pra folha da prancheta poder encolher
    <div className={`flex flex-col ${isList ? "" : "h-[calc(100vh-8rem)] min-h-0"}`}>
      <section className="mb-3">
        <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
          Missões
          <MI name="verified" className="text-primary-container text-xl" fill />
        </h1>
        <p className="text-body-md text-on-surface-variant">
          {isCanvas
            ? `${canvasPageCount} página(s) de rascunho · desenhe o plano antes de virar cartão`
            : `${activeCards} cartão(ões) no quadro${filterOn ? ` · ${shownTotal} no filtro` : ""} · toque pra abrir, segure pra arrastar`}
        </p>
      </section>

      {isCanvas ? (
        <>
          <div className="mb-2 flex items-center justify-end">
            <ViewSwitch view={view} setView={setView} />
          </div>
          <Prancheta />
        </>
      ) : (
        <>
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
          <ViewSwitch view={view} setView={setView} />
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
        </>
      )}
    </div>
  );
}
