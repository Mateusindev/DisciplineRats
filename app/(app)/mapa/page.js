"use client";

// Mapa — planejamento de longo prazo em swimlanes.
// Colunas = horizonte de tempo, faixas = área da vida. Card na coluna da esquerda é
// compromisso mais próximo; ordem dentro da célula é prioridade. Arrastar tem consequência.
// Nós "espelho" apontam pra hábitos/missões/metas/livros que já existem e mostram progresso
// vivo lido do state — o mapa é lente do app, não silo paralelo.

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useApp } from "../AppContext";
import { MI, Caps, Select, inputCls, textareaCls } from "@/components/ui";
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners, DragOverlay, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MAPA_HORIZONS,
  MAPA_META_STATUS,
  MAPA_EDGE_KINDS,
  MAPA_LANE_COLORS,
  MAPA_NOTE_COLORS,
  MAPA_MAX_NODES,
  MAPA_LIMITS,
  mapaStatus,
  resolveMirror,
  mapaRefOptions,
} from "@/lib/state";

const uid = () => crypto.randomUUID();
const stop = (e) => e.stopPropagation();

// célula = cruzamento horizonte × área. "none" = raia "Sem área".
const cellKey = (h, lane) => `${h}::${lane ?? "none"}`;
const parseCell = (key) => {
  const [h, lane] = key.split("::");
  return { h, lane: lane === "none" ? null : lane };
};
const NO_LANE = { id: null, label: "Sem área", icon: "help", color: "#b0b6be" };
const emptyMapa = () => ({ lanes: [], nodes: [], edges: [], focusId: null });

export default function MapaPage() {
  const { state, setState, confirm, toast } = useApp();
  const mapa = state.mapa || emptyMapa();
  const lanes = mapa.lanes || [];
  const nodes = mapa.nodes || [];
  const edges = mapa.edges || [];

  const [editingId, setEditingId] = useState(null);
  const [showLanes, setShowLanes] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dragging, setDragging] = useState(null);

  // raias visíveis: as do usuário + "Sem área" só quando tem órfão (senão é linha morta)
  const rows = useMemo(() => {
    const orphans = nodes.some((n) => (n.lane ?? null) === null);
    return orphans ? [...lanes, NO_LANE] : lanes;
  }, [lanes, nodes]);

  // ---- mutações ----
  const setMapa = (fn) => setState((p) => ({ ...p, mapa: fn(p.mapa || emptyMapa()) }));
  const patchNode = (id, patch) => setMapa((m) => ({ ...m, nodes: (m.nodes || []).map((n) => (n.id === id ? { ...n, ...patch } : n)) }));

  function addNode(kind, at) {
    if (nodes.length >= MAPA_MAX_NODES) {
      toast("Mapa cheio", { sub: `Limite de ${MAPA_MAX_NODES} itens — apague algo antes.`, icon: "warning" });
      return;
    }
    const payload =
      kind === "meta"
        ? { title: "", why: "", status: "ideia", target: "" }
        : kind === "mirror"
        ? { ref: null, fallbackLabel: "", note: "" }
        : { text: "", color: MAPA_NOTE_COLORS[0] };
    const n = { id: uid(), kind, h: at?.h || MAPA_HORIZONS[0].id, lane: at?.lane ?? lanes[0]?.id ?? null, ...payload };
    setMapa((m) => ({ ...m, nodes: [...(m.nodes || []), n] }));
    setEditingId(n.id);
  }

  const nodeLabel = (id) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return "?";
    if (n.kind === "meta") return n.title || "meta sem título";
    if (n.kind === "note") return n.text || "nota";
    return resolveMirror(state, n.ref).label;
  };

  async function removeNode(id) {
    const ok = await confirm({ title: "Excluir item?", body: nodeLabel(id) || "Sai do mapa junto com as ligações dele.", confirmLabel: "EXCLUIR" });
    if (!ok) return;
    setMapa((m) => ({
      ...m,
      nodes: (m.nodes || []).filter((x) => x.id !== id),
      edges: (m.edges || []).filter((e) => e.from !== id && e.to !== id),
      focusId: m.focusId === id ? null : m.focusId,
    }));
    setEditingId(null);
  }

  const toggleFocus = (id) => setMapa((m) => ({ ...m, focusId: m.focusId === id ? null : id }));

  async function removeEdge(id) {
    const e = edges.find((x) => x.id === id);
    const ok = await confirm({
      title: "Remover ligação?",
      body: e ? `${nodeLabel(e.from)} ${MAPA_EDGE_KINDS.find((k) => k.id === e.kind)?.label || ""} ${nodeLabel(e.to)}` : "",
      confirmLabel: "REMOVER",
    });
    if (ok) setMapa((m) => ({ ...m, edges: (m.edges || []).filter((x) => x.id !== id) }));
  }

  function addEdge(from, to, kind) {
    if (!from || !to || from === to) return;
    if (edges.some((e) => e.from === from && e.to === to && e.kind === kind)) {
      toast("Ligação já existe");
      return;
    }
    setMapa((m) => ({ ...m, edges: [...(m.edges || []), { id: uid(), from, to, kind }] }));
  }

  const addLane = () =>
    setMapa((m) => {
      const ls = m.lanes || [];
      if (ls.length >= 8) return m;
      return { ...m, lanes: [...ls, { id: uid(), label: "Nova área", icon: "circle", color: MAPA_LANE_COLORS[ls.length % MAPA_LANE_COLORS.length] }] };
    });
  const patchLane = (id, patch) => setMapa((m) => ({ ...m, lanes: (m.lanes || []).map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const moveLane = (id, dir) =>
    setMapa((m) => {
      const ls = [...(m.lanes || [])];
      const i = ls.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return m;
      [ls[i], ls[j]] = [ls[j], ls[i]];
      return { ...m, lanes: ls };
    });
  async function removeLane(id) {
    const l = lanes.find((x) => x.id === id);
    const orphans = nodes.filter((n) => n.lane === id).length;
    const ok = await confirm({
      title: "Excluir área?",
      body: orphans ? `${orphans} item(ns) vão pra "Sem área" — nada é apagado.` : `"${l?.label || ""}" será removida.`,
      confirmLabel: "EXCLUIR",
    });
    if (!ok) return;
    setMapa((m) => ({
      ...m,
      lanes: (m.lanes || []).filter((x) => x.id !== id),
      nodes: (m.nodes || []).map((n) => (n.lane === id ? { ...n, lane: null } : n)),
    }));
  }

  // ---- dnd-kit: mesma configuração de /missoes ----
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  // id pode ser de nó ou de célula (o droppable vazio)
  const cellOf = (id) => {
    if (typeof id === "string" && id.includes("::")) return id;
    const n = nodes.find((x) => x.id === id);
    return n ? cellKey(n.h, n.lane) : null;
  };

  // Move na lista global e reposiciona. Uma função serve pros dois casos: trocar de célula
  // (onDragOver) e reordenar dentro dela (onDragEnd) — inserir no índice do `over` é o mesmo.
  function moveNode(activeId, overId, targetKey) {
    const { h, lane } = parseCell(targetKey);
    setMapa((m) => {
      const ns = [...(m.nodes || [])];
      const ai = ns.findIndex((n) => n.id === activeId);
      if (ai < 0) return m;
      const node = { ...ns[ai], h, lane };
      ns.splice(ai, 1);
      let oi = ns.findIndex((n) => n.id === overId);
      if (oi < 0) {
        // soltou na célula (não sobre um card) → vai pro fim da célula
        let last = -1;
        ns.forEach((n, i) => {
          if (n.h === h && (n.lane ?? null) === lane) last = i;
        });
        oi = last + 1;
      }
      ns.splice(oi, 0, node);
      return { ...m, nodes: ns };
    });
  }

  function onDragOver({ active, over }) {
    if (!over) return;
    const from = cellOf(active.id);
    const to = cellOf(over.id);
    if (!from || !to || from === to) return;
    moveNode(active.id, over.id, to);
  }

  function onDragEnd({ active, over }) {
    setDragging(null);
    if (!over || active.id === over.id) return;
    const to = cellOf(over.id);
    if (to && cellOf(active.id) === to) moveNode(active.id, over.id, to);
  }

  const degreeOf = (id) => edges.filter((e) => e.from === id || e.to === id).length;
  const editing = nodes.find((n) => n.id === editingId) || null;
  const metaCount = nodes.filter((n) => n.kind === "meta").length;
  const mirrorCount = nodes.filter((n) => n.kind === "mirror").length;

  return (
    <div className="relative">
      <section className="mb-5">
        <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2 uppercase">
          Mapa
          <MI name="explore" className="text-primary-container text-xl" fill />
          <button
            onClick={() => setShowHelp(true)}
            aria-label="Como o Mapa funciona"
            title="Como o Mapa funciona"
            className="ml-1 w-6 h-6 rounded-full grid place-items-center text-outline hover:text-primary hover:bg-surface-variant/40 transition"
          >
            <MI name="help" className="text-[18px]" />
          </button>
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Horizonte nas colunas, área da vida nas faixas · {metaCount} meta(s) · {mirrorCount} espelho(s)
        </p>
      </section>

      <Toolbar onAdd={(kind) => addNode(kind)} onLanes={() => setShowLanes(true)} />

      {/* mapa novo: convite discreto pra explicação, desaparece depois do primeiro item */}
      {nodes.length === 0 && rows.length > 0 && (
        <button onClick={() => setShowHelp(true)} className="mb-5 flex items-center gap-1.5 text-[12px] text-outline hover:text-primary transition">
          <MI name="lightbulb" className="text-[15px]" />
          Primeira vez aqui? Veja como o Mapa funciona
        </button>
      )}

      {rows.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <MI name="explore" className="text-outline text-3xl" />
          <p className="mt-2 text-[13px] text-outline">Nenhuma área da vida configurada.</p>
          <button onClick={() => setShowLanes(true)} className="mt-4 px-4 py-2 rounded-lg border border-primary/40 text-primary font-label-caps text-[11px]">
            CONFIGURAR ÁREAS
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={({ active }) => setDragging(nodes.find((n) => n.id === active.id) || null)} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          {/* cabeçalho dos horizontes — some no mobile, onde cada célula rotula a si mesma */}
          <div className="hidden lg:block sticky top-0 z-20 -mx-1 px-1 py-3 mb-2 bg-background/95 backdrop-blur-md border-b border-outline-variant/20">
            <div className="grid grid-cols-4 gap-4">
              {MAPA_HORIZONS.map((h, i) => (
                <div key={h.id} className="flex flex-col gap-1">
                  <Caps className={`uppercase tracking-widest ${i === 0 ? "text-primary" : "text-on-surface-variant"}`}>{h.label}</Caps>
                  <span className="text-[10px] text-outline leading-none">{h.hint}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-10">
            {rows.map((lane) => {
              const laneNodes = nodes.filter((n) => (n.lane ?? null) === (lane.id ?? null));
              return (
              <section key={lane.id || "none"}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-1.5 h-7 rounded-full shrink-0" style={{ background: lane.color }} />
                  <MI name={lane.icon} className="text-lg shrink-0" style={{ color: lane.color }} />
                  <h3 className="font-headline-md text-headline-md uppercase tracking-tight text-on-surface truncate">{lane.label}</h3>
                  <span className="h-px flex-1 bg-outline-variant/20" />
                  {lane.id && (
                    <button onClick={() => setShowLanes(true)} aria-label="Gerenciar áreas" className="w-8 h-8 rounded-full grid place-items-center text-outline hover:text-on-surface hover:bg-surface-variant/40 transition shrink-0">
                      <MI name="more_horiz" className="text-xl" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                  {MAPA_HORIZONS.map((h) => (
                    <Cell
                      key={h.id}
                      horizon={h}
                      lane={lane}
                      nodes={nodes.filter((n) => n.h === h.id && (n.lane ?? null) === (lane.id ?? null))}
                      state={state}
                      focusId={mapa.focusId}
                      degreeOf={degreeOf}
                      onOpen={setEditingId}
                      onAdd={() => addNode("meta", { h: h.id, lane: lane.id })}
                    />
                  ))}
                </div>

                {/* área sem nada: no mobile as células ficam escondidas, então dá um CTA só */}
                {laneNodes.length === 0 && (
                  <button
                    onClick={() => addNode("meta", { h: MAPA_HORIZONS[0].id, lane: lane.id })}
                    className="lg:hidden w-full py-4 rounded-xl border-2 border-dashed border-outline-variant/25 text-outline-variant hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-2"
                  >
                    <MI name="add_circle" className="text-lg" />
                    <Caps className="text-[10px]">NOVO OBJETIVO EM {lane.label.toUpperCase()}</Caps>
                  </button>
                )}
              </section>
              );
            })}
          </div>

          <DragOverlay>
            {dragging ? (
              <div className="w-[264px] rotate-2">
                <NodeCard node={dragging} lane={rows.find((l) => (l.id ?? null) === (dragging.lane ?? null))} state={state} focused={false} degree={degreeOf(dragging.id)} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* marca d'água */}
      <div className="fixed bottom-0 right-0 pointer-events-none select-none z-0 hidden lg:block overflow-hidden">
        <div className="font-headline-lg text-[240px] leading-none text-on-surface/[0.04] -mb-16 -mr-12 rotate-[-12deg]">EVOLUÇÃO</div>
      </div>

      {editing && (
        <Inspector
          node={editing}
          lanes={lanes}
          state={state}
          edges={edges}
          nodes={nodes}
          nodeLabel={nodeLabel}
          focused={mapa.focusId === editing.id}
          onPatch={(patch) => patchNode(editing.id, patch)}
          onToggleFocus={() => toggleFocus(editing.id)}
          onAddEdge={(to, kind) => addEdge(editing.id, to, kind)}
          onRemoveEdge={removeEdge}
          onDelete={() => removeNode(editing.id)}
          onClose={() => setEditingId(null)}
        />
      )}

      {showLanes && (
        <LaneManager lanes={lanes} nodes={nodes} onAdd={addLane} onPatch={patchLane} onMove={moveLane} onRemove={removeLane} onClose={() => setShowLanes(false)} />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

// ---------- barra de ferramentas ----------
function Toolbar({ onAdd, onLanes }) {
  const primary = "px-4 py-2 rounded-lg border border-primary text-primary hover:bg-primary hover:text-on-primary transition-all font-label-caps text-label-caps flex items-center gap-2";
  const ghost = "px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-all font-label-caps text-label-caps flex items-center gap-2";
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <button onClick={() => onAdd("meta")} className={primary} title="Objetivo escrito por você — o progresso é seu de acompanhar">
        <MI name="add_circle" className="text-[18px]" /> META
      </button>
      <button onClick={() => onAdd("mirror")} className={ghost} title="Atalho vivo pra algo que já existe no app: hábito, missão, meta de economia ou livro. A barra é lida de lá.">
        <MI name="link" className="text-[18px]" /> ESPELHO
      </button>
      <button onClick={() => onAdd("note")} className={ghost} title="Ideia solta, pergunta, lembrete">
        <MI name="note_alt" className="text-[18px]" /> NOTA
      </button>
      <button onClick={onLanes} className={ghost} title="Áreas da vida — as faixas horizontais do mapa">
        <MI name="category" className="text-[18px]" /> ÁREAS
      </button>
    </div>
  );
}

// ---------- ajuda ----------
const MIRROR_SOURCES = [
  { icon: "check_circle", what: "Hábito diário", bar: "sequência atual / 21 dias" },
  { icon: "repeat", what: "Hábito semanal", bar: "dias na semana / meta da semana" },
  { icon: "block", what: "Vício em corte", bar: "dias limpo / próximo marco" },
  { icon: "flag", what: "Missão", bar: "0% ou 100%, com coluna e prazo" },
  { icon: "savings", what: "Meta de economia", bar: "guardado / alvo" },
  { icon: "menu_book", what: "Livro", bar: "página atual / total" },
];

function HelpModal({ onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label="Como o Mapa funciona">
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={stop}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-md text-headline-md text-primary">Como o Mapa funciona</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition p-1">
            <MI name="close" />
          </button>
        </div>

        <div className="space-y-5 text-body-md text-on-surface-variant">
          <div>
            <Caps className="text-primary text-[10px] mb-1.5 block">OS DOIS EIXOS</Caps>
            <p>
              <strong className="text-on-surface">Colunas = horizonte de tempo.</strong> De <em>Agora</em> até <em>3+ / algum dia</em>. Arrastar um item pra
              esquerda é se comprometer com ele mais cedo — a posição não é decoração.
            </p>
            <p className="mt-1.5">
              <strong className="text-on-surface">Faixas = área da vida.</strong> Editáveis em ÁREAS. A ordem dos cards dentro de uma célula é a prioridade.
            </p>
          </div>

          <div>
            <Caps className="text-primary text-[10px] mb-1.5 block">TRÊS TIPOS DE ITEM</Caps>
            <div className="space-y-2">
              <p>
                <MI name="add_circle" className="text-[15px] align-middle mr-1 text-on-surface-variant" />
                <strong className="text-on-surface">Meta</strong> — o que você quer. Texto seu; ninguém mede pra você.
              </p>
              <p>
                <MI name="link" className="text-[15px] align-middle mr-1 text-primary" />
                <strong className="text-on-surface">Espelho</strong> — atalho vivo pra algo que <em>já existe</em> no app. A barra é lida de lá na hora: marca o
                hábito em Hábitos e ela mexe aqui sozinha. Renomeia lá, renomeia aqui. Não é cópia.
              </p>
              <p>
                <MI name="note_alt" className="text-[15px] align-middle mr-1 text-on-surface-variant" />
                <strong className="text-on-surface">Nota</strong> — ideia solta, pergunta, lembrete.
              </p>
            </div>
          </div>

          <div>
            <Caps className="text-primary text-[10px] mb-1.5 block">DE ONDE O ESPELHO TIRA A BARRA</Caps>
            <div className="rounded-lg border border-white/10 divide-y divide-white/5 overflow-hidden">
              {MIRROR_SOURCES.map((s) => (
                <div key={s.what} className="flex items-center gap-2 px-3 py-2">
                  <MI name={s.icon} className="text-[16px] text-primary-container shrink-0" />
                  <span className="text-[13px] text-on-surface w-[130px] shrink-0">{s.what}</span>
                  <span className="text-[12px] text-outline truncate">{s.bar}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px]">
              Apagou o item original? O card fica vermelho com <em>Referência perdida</em> e oferece reapontar ou excluir — a posição e as ligações não se perdem
              junto.
            </p>
          </div>

          <div>
            <Caps className="text-primary text-[10px] mb-1.5 block">POR QUE ISSO IMPORTA</Caps>
            <p>
              Uma meta sozinha não se move. Coloque ao lado dela o espelho do hábito que a sustenta e ligue os dois com <em>leva a</em> — aí o mapa mostra não só o
              que você quer, mas se o comportamento que leva até lá está de fato acontecendo.
            </p>
          </div>

          <div>
            <Caps className="text-primary text-[10px] mb-1.5 block">FOCO DO TRIMESTRE</Caps>
            <p>Fixe um item (botão dentro dele) e ele aparece no topo da Home, com progresso, todo dia.</p>
          </div>
        </div>

        <button onClick={onClose} className="mt-6 w-full py-2.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 font-label-caps text-[11px] active:scale-95 transition">
          ENTENDI
        </button>
      </div>
    </div>,
    document.body
  );
}

// ---------- célula (horizonte × área) ----------
function Cell({ horizon, lane, nodes, state, focusId, degreeOf, onOpen, onAdd }) {
  const id = cellKey(horizon.id, lane.id);
  const { setNodeRef, isOver } = useDroppable({ id });
  const empty = nodes.length === 0;
  return (
    // célula vazia só aparece no desktop: no celular, 4 colunas × N áreas de tracejado
    // vazio viraria uma parede de nada
    <div ref={setNodeRef} className={`rounded-xl transition ${empty ? "hidden lg:block" : ""} ${isOver ? "ring-2 ring-primary/40 bg-primary/[0.04]" : ""}`}>
      {/* no mobile não existe o cabeçalho de colunas, então a célula se rotula */}
      {!empty && <Caps className="lg:hidden text-outline text-[10px] uppercase tracking-widest mb-2 block">{horizon.label}</Caps>}

      {empty ? (
        <button
          onClick={onAdd}
          className="w-full h-32 rounded-xl border-2 border-dashed border-outline-variant/25 hover:border-primary/40 text-outline-variant hover:text-primary transition-colors flex flex-col items-center justify-center gap-1.5"
        >
          <MI name="add_circle" className="text-xl" />
          <Caps className="text-[10px]">NOVO OBJETIVO</Caps>
        </button>
      ) : (
        <>
          <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            {nodes.map((n) => (
              <SortableNode
                key={n.id}
                node={n}
                lane={lane}
                state={state}
                focused={focusId === n.id}
                degree={degreeOf(n.id)}
                onOpen={() => onOpen(n.id)}
              />
            ))}
          </SortableContext>
          <button onClick={onAdd} aria-label="Adicionar nesta célula" className="w-full py-2 rounded-lg text-outline-variant hover:text-primary hover:bg-surface-variant/30 transition flex items-center justify-center gap-1.5">
            <MI name="add" className="text-base" />
            <Caps className="text-[10px]">ADICIONAR</Caps>
          </button>
        </>
      )}
    </div>
  );
}

function SortableNode({ node, lane, state, focused, degree, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className="mb-3 cursor-grab active:cursor-grabbing group"
    >
      <NodeCard node={node} lane={lane} state={state} focused={focused} degree={degree} dragging={isDragging} />
    </div>
  );
}

// ---------- card ----------
function NodeCard({ node, lane, state, focused, degree = 0, dragging = false }) {
  const color = lane?.color || "#b0b6be";
  const shell = `bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 transition-all ${
    dragging ? "opacity-40" : "hover:shadow-md hover:-translate-y-0.5"
  }`;

  if (node.kind === "note") {
    const c = node.color || MAPA_NOTE_COLORS[0];
    return (
      <div className={`rounded-xl p-4 shadow-sm transition-all ${dragging ? "opacity-40" : "hover:shadow-md hover:-translate-y-0.5"}`} style={{ background: `${c}1f`, border: `1px solid ${c}55` }}>
        <div className="flex items-start justify-between mb-1.5">
          <MI name="sticky_note_2" className="text-[16px]" style={{ color: c }} />
          <MI name="drag_indicator" className="text-[16px] text-outline opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="font-label-sm text-on-surface leading-snug whitespace-pre-line line-clamp-5">
          {node.text || <span className="text-outline italic">Nota vazia</span>}
        </p>
      </div>
    );
  }

  if (node.kind === "mirror") {
    const m = resolveMirror(state, node.ref);
    if (!m.ok) {
      return (
        <div className={`rounded-xl p-4 shadow-sm border border-error/40 bg-error/5 transition-all ${dragging ? "opacity-40" : "hover:shadow-md"}`}>
          <div className="flex items-center justify-between mb-2">
            <Caps className="text-error text-[10px] uppercase">Referência perdida</Caps>
            <MI name="link_off" className="text-[16px] text-error" />
          </div>
          <h4 className="font-body-md font-semibold text-on-surface truncate">{node.fallbackLabel || m.label}</h4>
          <p className="font-label-sm text-on-surface-variant mt-1">Toque pra reapontar ou excluir</p>
        </div>
      );
    }
    return (
      <div className={`${shell} p-4 border-l-4`} style={{ borderLeftColor: color }}>
        <div className="flex items-center justify-between mb-2">
          <Caps className="text-primary text-[10px] uppercase flex items-center gap-1">
            <MI name={m.icon} className="text-[14px]" /> Espelho
          </Caps>
          <div className="flex items-center gap-1.5">
            {focused && <MI name="push_pin" fill className="text-[14px] text-primary" />}
            {degree > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-on-surface-variant">
                <MI name="link" className="text-[12px]" />
                {degree}
              </span>
            )}
            <MI name="drag_indicator" className="text-[16px] text-outline opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <h4 className="font-body-md font-semibold text-on-surface mb-3 leading-snug">{m.label}</h4>
        <div className="bg-surface-container h-1.5 rounded-full w-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${m.done ? "bg-primary" : "bg-primary-container"}`} style={{ width: `${m.pct}%` }} />
        </div>
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-outline-variant/10">
          <span className="font-label-sm text-on-surface-variant truncate">{m.sub}</span>
          <span className="font-label-caps text-[10px] text-primary shrink-0">{m.pct}%</span>
        </div>
      </div>
    );
  }

  const st = mapaStatus(node.status);
  const done = node.status === "feito";
  return (
    <div className={`${shell} p-4 border-l-4`} style={{ borderLeftColor: done ? "var(--color-primary)" : color }}>
      <div className="flex items-center justify-between mb-2">
        <Caps className={`text-[10px] uppercase flex items-center gap-1 ${done ? "text-primary" : "text-on-surface-variant"}`}>
          <MI name={st.icon} className="text-[14px]" /> {st.label}
        </Caps>
        <div className="flex items-center gap-1.5">
          {focused && <MI name="push_pin" fill className="text-[14px] text-primary" />}
          {degree > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-on-surface-variant">
              <MI name="link" className="text-[12px]" />
              {degree}
            </span>
          )}
          <MI name="drag_indicator" className="text-[16px] text-outline opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      <h4 className={`font-body-md font-semibold leading-snug ${done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>
        {node.title || <span className="text-outline italic font-normal">Sem título</span>}
      </h4>
      {node.why && <p className="font-label-sm text-on-surface-variant line-clamp-2 mt-1.5">{node.why}</p>}
      {node.target && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-outline-variant/10 text-on-surface-variant">
          <MI name="target" className="text-[14px]" />
          <span className="font-label-sm truncate">{node.target}</span>
        </div>
      )}
    </div>
  );
}

// ---------- inspetor ----------
function Inspector({ node, lanes, state, edges, nodes, nodeLabel, focused, onPatch, onToggleFocus, onAddEdge, onRemoveEdge, onDelete, onClose }) {
  const [linkTo, setLinkTo] = useState(null);
  const [linkKind, setLinkKind] = useState("leva");

  const refOptions = useMemo(() => {
    const flat = [];
    for (const g of mapaRefOptions(state)) for (const it of g.items) flat.push({ value: it.value, label: `${g.group} · ${it.label}` });
    return flat;
  }, [state]);

  const mirror = node.kind === "mirror" ? resolveMirror(state, node.ref) : null;
  const myEdges = edges.filter((e) => e.from === node.id || e.to === node.id);
  const linkOptions = nodes.filter((n) => n.id !== node.id).map((n) => ({ value: n.id, label: nodeLabel(n.id) }));
  const title = node.kind === "meta" ? "Meta" : node.kind === "mirror" ? "Espelho" : "Nota";

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label={title}>
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={stop}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-md text-headline-md text-primary">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition p-1">
            <MI name="close" />
          </button>
        </div>

        <div className="space-y-4">
          {node.kind === "meta" && (
            <>
              <input
                value={node.title || ""}
                onChange={(e) => onPatch({ title: e.target.value })}
                autoFocus
                placeholder="O que você quer alcançar"
                maxLength={MAPA_LIMITS.title}
                className={`${inputCls} w-full`}
              />
              <div>
                <Caps className="text-outline text-[10px] mb-1.5 block">POR QUÊ</Caps>
                <textarea
                  value={node.why || ""}
                  onChange={(e) => onPatch({ why: e.target.value })}
                  placeholder="A razão. É isso que segura a meta quando a vontade cai."
                  maxLength={MAPA_LIMITS.why}
                  rows={3}
                  className={textareaCls}
                />
              </div>
              <div>
                <Caps className="text-outline text-[10px] mb-1.5 block">STATUS</Caps>
                <div className="flex flex-wrap gap-1.5">
                  {MAPA_META_STATUS.map((s) => {
                    const on = (node.status || "ideia") === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => onPatch({ status: s.id })}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-label-caps flex items-center gap-1.5 border transition ${
                          on ? "border-primary text-primary bg-primary/10" : "text-outline border-white/10 hover:border-white/25"
                        }`}
                      >
                        <MI name={s.icon} className="text-[13px]" /> {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Caps className="text-outline text-[10px] mb-1.5 block">MEDIDA (OPCIONAL)</Caps>
                <input
                  value={node.target || ""}
                  onChange={(e) => onPatch({ target: e.target.value })}
                  placeholder="ex: 80kg · 30k na reserva · 12 livros"
                  maxLength={MAPA_LIMITS.target}
                  className={`${inputCls} w-full`}
                />
              </div>
            </>
          )}

          {node.kind === "mirror" && (
            <>
              <div>
                <Caps className="text-outline text-[10px] mb-1.5 block">ESPELHAR</Caps>
                <Select
                  value={node.ref ? `${node.ref.type}:${node.ref.id}` : null}
                  options={refOptions}
                  placeholder="Escolha um hábito, missão, meta ou livro"
                  onChange={(v) => {
                    const [type, ...rest] = v.split(":");
                    const label = refOptions.find((o) => o.value === v)?.label || "";
                    onPatch({ ref: { type, id: rest.join(":") }, fallbackLabel: label.split(" · ").slice(1).join(" · ") || label });
                  }}
                />
                <p className="mt-1.5 text-[11px] text-outline">
                  {refOptions.length
                    ? "Atalho vivo: a barra é lida do item original na hora, não copiada. Progresso e nome acompanham."
                    : "Nada pra espelhar ainda — crie um hábito, missão ou meta primeiro."}
                </p>
              </div>
              {mirror && (
                <div className={`rounded-lg border p-3 ${mirror.ok ? "border-white/10 bg-surface-container-high" : "border-error/40 bg-error/5"}`}>
                  <div className="flex items-center gap-1.5">
                    <MI name={mirror.icon} className={`text-base ${mirror.ok ? "text-primary-container" : "text-error"}`} />
                    <span className="text-[13px] text-on-surface truncate flex-1">{mirror.ok ? mirror.label : node.fallbackLabel || mirror.label}</span>
                    {mirror.ok && <span className="text-[11px] font-label-caps text-on-surface-variant">{mirror.pct}%</span>}
                  </div>
                  <p className="text-[11px] text-outline mt-1">{mirror.sub}</p>
                  {mirror.ok && mirror.href && (
                    <Link href={mirror.href} className="mt-2 inline-flex items-center gap-1 text-[11px] font-label-caps text-primary hover:underline">
                      ABRIR <MI name="arrow_forward" className="text-[13px]" />
                    </Link>
                  )}
                </div>
              )}
              <div>
                <Caps className="text-outline text-[10px] mb-1.5 block">NOTA</Caps>
                <textarea
                  value={node.note || ""}
                  onChange={(e) => onPatch({ note: e.target.value })}
                  placeholder="Por que isso está no mapa (opcional)"
                  maxLength={MAPA_LIMITS.note}
                  rows={2}
                  className={textareaCls}
                />
              </div>
            </>
          )}

          {node.kind === "note" && (
            <>
              <textarea
                value={node.text || ""}
                onChange={(e) => onPatch({ text: e.target.value })}
                autoFocus
                placeholder="Ideia, pergunta, lembrete..."
                maxLength={MAPA_LIMITS.note}
                rows={4}
                className={textareaCls}
              />
              <div className="flex items-center gap-2">
                {MAPA_NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => onPatch({ color: c })}
                    aria-label={`Cor ${c}`}
                    className={`w-7 h-7 rounded-full border-2 transition ${node.color === c ? "border-on-surface scale-110" : "border-transparent"}`}
                    style={{ background: `${c}55` }}
                  />
                ))}
              </div>
            </>
          )}

          {/* posição — caminho sem arraste (teclado, leitor de tela, celular) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Caps className="text-outline text-[10px] mb-1.5 block">HORIZONTE</Caps>
              <Select value={node.h} options={MAPA_HORIZONS.map((h) => ({ value: h.id, label: h.label }))} onChange={(h) => onPatch({ h })} />
            </div>
            <div>
              <Caps className="text-outline text-[10px] mb-1.5 block">ÁREA</Caps>
              <Select
                value={node.lane ?? "__none"}
                options={[...lanes.map((l) => ({ value: l.id, label: l.label })), { value: "__none", label: "Sem área" }]}
                onChange={(v) => onPatch({ lane: v === "__none" ? null : v })}
              />
            </div>
          </div>

          <button
            onClick={onToggleFocus}
            className={`w-full py-2.5 rounded-lg border font-label-caps text-[11px] flex items-center justify-center gap-1.5 transition ${
              focused ? "border-primary text-primary bg-primary/10" : "border-white/10 text-on-surface-variant hover:border-white/25"
            }`}
          >
            <MI name="push_pin" fill={focused} className="text-base" />
            {focused ? "FIXADO COMO FOCO DO TRIMESTRE" : "FIXAR COMO FOCO DO TRIMESTRE"}
          </button>

          {/* ligações: sem seta desenhada, a relação vive aqui */}
          <div>
            <Caps className="text-outline text-[10px] mb-1.5 block">LIGAÇÕES</Caps>
            {myEdges.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {myEdges.map((e) => {
                  const out = e.from === node.id;
                  const kind = MAPA_EDGE_KINDS.find((k) => k.id === e.kind)?.label || e.kind;
                  return (
                    <div key={e.id} className="flex items-center gap-2 rounded-lg bg-surface-container-high px-2.5 py-2">
                      <MI name={out ? "arrow_forward" : "arrow_back"} className="text-outline text-base shrink-0" />
                      <span className="text-[12px] text-on-surface-variant truncate flex-1">{out ? `${kind} ${nodeLabel(e.to)}` : `${nodeLabel(e.from)} ${kind} isto`}</span>
                      <button onClick={() => onRemoveEdge(e.id)} aria-label="Remover ligação" className="text-outline hover:text-error transition shrink-0">
                        <MI name="close" className="text-base" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {linkOptions.length > 0 ? (
              <div className="flex items-center gap-2">
                <Select value={linkKind} options={MAPA_EDGE_KINDS.map((k) => ({ value: k.id, label: k.label }))} onChange={setLinkKind} className="w-32 shrink-0" />
                <Select value={linkTo} options={linkOptions} placeholder="Escolha um item" onChange={setLinkTo} className="flex-1 min-w-0" />
                <button
                  onClick={() => {
                    if (!linkTo) return;
                    onAddEdge(linkTo, linkKind);
                    setLinkTo(null);
                  }}
                  disabled={!linkTo}
                  aria-label="Criar ligação"
                  className="w-10 h-10 shrink-0 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-30 transition grid place-items-center"
                >
                  <MI name="add" className="text-lg" />
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-outline">Precisa de outro item no mapa pra criar ligação.</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6">
          <button onClick={onDelete} className="px-4 py-2.5 rounded-lg border border-error/40 text-error hover:bg-error/10 transition font-label-caps text-[11px]">
            EXCLUIR
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 font-label-caps text-[11px] active:scale-95 transition">
            FECHAR
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------- gerenciador de áreas ----------
function LaneManager({ lanes, nodes, onAdd, onPatch, onMove, onRemove, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label="Áreas da vida">
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={stop}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-headline-md text-headline-md text-primary">Áreas da vida</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition p-1">
            <MI name="close" />
          </button>
        </div>
        <p className="text-[12px] text-outline mb-4">São as faixas do mapa. Reordenar não move nenhum item de área.</p>

        <div className="space-y-2">
          {lanes.map((l, i) => (
            <div key={l.id} className="flex items-center gap-2 rounded-lg bg-surface-container-high px-2.5 py-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.color }} />
              <input
                value={l.label}
                onChange={(e) => onPatch(l.id, { label: e.target.value.slice(0, MAPA_LIMITS.lane) })}
                aria-label="Nome da área"
                className="flex-1 min-w-0 bg-transparent text-[13px] text-on-surface outline-none border-b border-transparent focus:border-primary-container/40 transition"
              />
              <span className="text-[10px] text-outline shrink-0">{nodes.filter((n) => n.lane === l.id).length}</span>
              <button onClick={() => onMove(l.id, -1)} disabled={i === 0} aria-label="Subir" className="text-outline hover:text-on-surface disabled:opacity-25 transition">
                <MI name="keyboard_arrow_up" className="text-base" />
              </button>
              <button onClick={() => onMove(l.id, 1)} disabled={i === lanes.length - 1} aria-label="Descer" className="text-outline hover:text-on-surface disabled:opacity-25 transition">
                <MI name="keyboard_arrow_down" className="text-base" />
              </button>
              <button onClick={() => onRemove(l.id)} aria-label="Excluir área" className="text-outline hover:text-error transition">
                <MI name="delete" className="text-base" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {MAPA_LANE_COLORS.map((c) => (
            <span key={c} className="w-5 h-5 rounded-full opacity-40" style={{ background: c }} />
          ))}
        </div>

        <button
          onClick={onAdd}
          disabled={lanes.length >= 8}
          className="mt-4 w-full py-2.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 font-label-caps text-[11px] disabled:opacity-40 transition"
        >
          ADICIONAR ÁREA
        </button>
      </div>
    </div>,
    document.body
  );
}
