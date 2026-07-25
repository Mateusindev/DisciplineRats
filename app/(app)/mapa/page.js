"use client";

// Mapa — planejamento de longo prazo num grid semântico.
// x = horizonte de tempo (bandas), y = área da vida (raias). Posição carrega significado:
// arrastar pra esquerda é se comprometer. Nós "espelho" apontam pra hábitos/missões/metas/livros
// que já existem e mostram progresso vivo — o mapa é lente do app, não silo paralelo.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useApp } from "../AppContext";
import { MI, Caps, Select, inputCls, textareaCls } from "@/components/ui";
import { useCanvas } from "@/components/canvas";
import {
  MAPA_HORIZONS,
  MAPA_META_STATUS,
  MAPA_EDGE_KINDS,
  MAPA_LANE_COLORS,
  MAPA_NOTE_COLORS,
  MAPA_MAX_NODES,
  MAPA_LIMITS,
  mapaHorizon,
  mapaStatus,
  resolveMirror,
  mapaRefOptions,
} from "@/lib/state";

const uid = () => crypto.randomUUID();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => clamp(Number.isFinite(+v) ? +v : 0.5, 0, 1);
const quant = (v, steps) => Math.round(clamp01(v) * steps) / steps;

// geometria do mundo (px)
const BAND_W = 400;
const LANE_H = 260;
const HEADER_H = 46; // faixa de rótulos de horizonte, no topo do mundo
const GUTTER_W = 136; // coluna de rótulos de raia, à esquerda
const NODE_W = 244;
const NODE_H = 96;
const PAD = 16;
const RANGE_X = BAND_W - NODE_W - PAD * 2; // amplitude livre do ox dentro da célula
const RANGE_Y = LANE_H - NODE_H - PAD * 2;

// raia sintética: sempre presente, é onde caem os nós de raia apagada
const NO_LANE = { id: null, label: "Sem área", icon: "help", color: "#b0b6be" };

// posições de cortesia pra nó novo não nascer empilhado
const SLOTS = [
  [0.08, 0.06],
  [0.86, 0.58],
  [0.46, 0.3],
  [0.06, 0.88],
  [0.88, 0.06],
  [0.5, 0.94],
];

function makeLayout(lanes) {
  const rows = [...lanes, NO_LANE];
  const WORLD_W = GUTTER_W + MAPA_HORIZONS.length * BAND_W;
  const WORLD_H = HEADER_H + rows.length * LANE_H;
  const bandIdx = (h) => {
    const i = MAPA_HORIZONS.findIndex((x) => x.id === h);
    return i < 0 ? 0 : i;
  };
  const rowIdx = (lane) => {
    const i = rows.findIndex((r) => r.id === (lane ?? null));
    return i < 0 ? rows.length - 1 : i;
  };
  const cell = (h, lane) => ({ x: GUTTER_W + bandIdx(h) * BAND_W, y: HEADER_H + rowIdx(lane) * LANE_H, w: BAND_W, h: LANE_H });
  const nodeRect = (n) => {
    const c = cell(n.h, n.lane);
    return { x: c.x + PAD + clamp01(n.ox) * RANGE_X, y: c.y + PAD + clamp01(n.oy) * RANGE_Y, w: NODE_W, h: NODE_H };
  };
  // px do canto do nó → banda/raia/offset. Decide banda e raia pelo CENTRO do card.
  const fromWorld = (wx, wy) => {
    const bi = clamp(Math.floor((wx + NODE_W / 2 - GUTTER_W) / BAND_W), 0, MAPA_HORIZONS.length - 1);
    const ri = clamp(Math.floor((wy + NODE_H / 2 - HEADER_H) / LANE_H), 0, rows.length - 1);
    const cx = GUTTER_W + bi * BAND_W;
    const cy = HEADER_H + ri * LANE_H;
    return { h: MAPA_HORIZONS[bi].id, lane: rows[ri].id, ox: (wx - cx - PAD) / RANGE_X, oy: (wy - cy - PAD) / RANGE_Y };
  };
  return { rows, WORLD_W, WORLD_H, cell, nodeRect, fromWorld };
}

function freeSlot(nodes, h, lane) {
  const used = (nodes || []).filter((n) => n.h === h && (n.lane ?? null) === (lane ?? null));
  for (const [ox, oy] of SLOTS) {
    if (!used.some((n) => Math.abs(clamp01(n.ox) - ox) < 0.14 && Math.abs(clamp01(n.oy) - oy) < 0.14)) return { ox, oy };
  }
  return { ox: quant(0.1 + used.length * 0.06, 12), oy: quant(0.45 + used.length * 0.05, 8) };
}

// ponto na borda do retângulo na direção de (tx,ty)
function borderPoint(r, tx, ty) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const s = Math.min(dx ? r.w / 2 / Math.abs(dx) : Infinity, dy ? r.h / 2 / Math.abs(dy) : Infinity);
  return { x: cx + dx * s, y: cy + dy * s };
}

// caminho da aresta: reta clipada nas bordas + arco de 8% (sinal por id, pra par A↔B não sobrepor).
// null quando os cards estão perto demais e a seta inverteria — a UI mostra badge no lugar.
function edgeGeom(a, b, flip) {
  if (!a || !b) return null;
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const A = borderPoint(a, bc.x, bc.y);
  const B = borderPoint(b, ac.x, ac.y);
  const vx = B.x - A.x;
  const vy = B.y - A.y;
  if (vx * (bc.x - ac.x) + vy * (bc.y - ac.y) <= 16) return null; // sobrepostos
  const len = Math.hypot(vx, vy) || 1;
  const k = 0.08 * len * (flip ? -1 : 1);
  const cx = (A.x + B.x) / 2 + (-vy / len) * k;
  const cy = (A.y + B.y) / 2 + (vx / len) * k;
  return { d: `M ${A.x} ${A.y} Q ${cx} ${cy} ${B.x} ${B.y}`, mx: (A.x + 2 * cx + B.x) / 4, my: (A.y + 2 * cy + B.y) / 4 };
}

const emptyMapa = () => ({ lanes: [], nodes: [], edges: [], focusId: null });

export default function MapaPage() {
  const { state, setState, confirm, toast } = useApp();
  const mapa = state.mapa || emptyMapa();
  const lanes = mapa.lanes || [];
  const nodes = mapa.nodes || [];
  const edges = mapa.edges || [];

  const [isWide, setIsWide] = useState(false);
  const [view, setView] = useState("canvas");
  const [editingId, setEditingId] = useState(null);
  const [showLanes, setShowLanes] = useState(false);
  const [linking, setLinking] = useState(null); // null | { from: id|null, kind }

  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const dragRef = useRef(null);
  const justDragged = useRef(false);
  const rectsRef = useRef(new Map());
  const markerId = useId().replace(/:/g, "");

  const canvasOn = isWide && view === "canvas"; // canvas só no desktop; celular usa a lista

  const { cam, camRef, bind, zoomBy, fitTo, screenToWorld } = useCanvas(viewportRef, worldRef, { enabled: canvasOn });
  const layout = useMemo(() => makeLayout(lanes), [lanes]);

  const rects = useMemo(() => {
    const m = new Map();
    for (const n of nodes) m.set(n.id, layout.nodeRect(n));
    return m;
  }, [nodes, layout]);
  rectsRef.current = rects;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // enquadra ao entrar no canvas: no foco fixado, senão no mapa todo
  useEffect(() => {
    if (!canvasOn) return;
    const f = mapa.focusId && rectsRef.current.get(mapa.focusId);
    if (f) fitTo({ x: f.x - 220, y: f.y - 150, w: NODE_W + 440, h: NODE_H + 300 });
    else fitTo({ x: 0, y: 0, w: layout.WORLD_W, h: layout.WORLD_H });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasOn]);

  useEffect(() => {
    if (!linking) return;
    const onKey = (e) => e.key === "Escape" && setLinking(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [linking]);

  // ---- mutações ----
  const setMapa = (fn) => setState((p) => ({ ...p, mapa: fn(p.mapa || emptyMapa()) }));
  const patchNode = (id, patch) => setMapa((m) => ({ ...m, nodes: (m.nodes || []).map((n) => (n.id === id ? { ...n, ...patch } : n)) }));

  function cellAtCenter() {
    const vp = viewportRef.current;
    if (!vp) return { h: MAPA_HORIZONS[0].id, lane: lanes[0]?.id ?? null };
    const r = vp.getBoundingClientRect();
    const w = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
    const p = layout.fromWorld(w.x - NODE_W / 2, w.y - NODE_H / 2);
    return { h: p.h, lane: p.lane };
  }

  function addNode(kind) {
    if (nodes.length >= MAPA_MAX_NODES) {
      toast("Mapa cheio", { sub: `Limite de ${MAPA_MAX_NODES} nós — apague algo antes.`, icon: "warning" });
      return;
    }
    const at = canvasOn ? cellAtCenter() : { h: MAPA_HORIZONS[0].id, lane: lanes[0]?.id ?? null };
    const payload =
      kind === "meta"
        ? { title: "", why: "", status: "ideia", target: "" }
        : kind === "mirror"
        ? { ref: null, fallbackLabel: "", note: "" }
        : { text: "", color: MAPA_NOTE_COLORS[0] };
    const n = { id: uid(), kind, h: at.h, lane: at.lane, ...freeSlot(nodes, at.h, at.lane), ...payload };
    setMapa((m) => ({ ...m, nodes: [...(m.nodes || []), n] }));
    setEditingId(n.id);
  }

  async function removeNode(id) {
    const n = nodes.find((x) => x.id === id);
    const label = n?.kind === "meta" ? n.title : n?.kind === "note" ? n.text : n?.fallbackLabel;
    const ok = await confirm({ title: "Excluir nó?", body: label || "Este item sai do mapa junto com as ligações dele.", confirmLabel: "EXCLUIR" });
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

  function addEdge(from, to, kind) {
    if (from === to) return;
    if (edges.some((e) => e.from === from && e.to === to && e.kind === kind)) {
      toast("Ligação já existe");
      return;
    }
    setMapa((m) => ({ ...m, edges: [...(m.edges || []), { id: uid(), from, to, kind }] }));
  }

  async function removeEdge(id) {
    const e = edges.find((x) => x.id === id);
    const name = (nid) => {
      const n = nodes.find((x) => x.id === nid);
      if (!n) return "?";
      if (n.kind === "meta") return n.title || "meta sem título";
      if (n.kind === "note") return n.text || "nota";
      return resolveMirror(state, n.ref).label;
    };
    const ok = await confirm({
      title: "Remover ligação?",
      body: e ? `${name(e.from)} ${MAPA_EDGE_KINDS.find((k) => k.id === e.kind)?.label || ""} ${name(e.to)}` : "",
      confirmLabel: "REMOVER",
    });
    if (ok) setMapa((m) => ({ ...m, edges: (m.edges || []).filter((x) => x.id !== id) }));
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

  // ---- drag de nó (imperativo: 2 setState por arraste, zero por frame) ----
  function redrawEdges(id, rect) {
    rectsRef.current.set(id, rect);
    const root = worldRef.current;
    if (!root) return;
    root.querySelectorAll(`path[data-from="${id}"], path[data-to="${id}"]`).forEach((p) => {
      const g = edgeGeom(rectsRef.current.get(p.dataset.from), rectsRef.current.get(p.dataset.to), p.dataset.from < p.dataset.to);
      p.style.opacity = g ? "" : "0";
      if (g) p.setAttribute("d", g.d);
    });
  }

  function onNodeDown(e, n) {
    if (linking) return; // no modo aresta o card inteiro é alvo de clique
    e.stopPropagation(); // senão o pan do fundo começa junto
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    const r = rectsRef.current.get(n.id) || layout.nodeRect(n);
    dragRef.current = { id: n.id, pid: e.pointerId, sx: e.clientX, sy: e.clientY, x0: r.x, y0: r.y, cur: { x: r.x, y: r.y }, moved: false, el };
    el.style.zIndex = "50";
  }

  function onNodeMove(e) {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) d.moved = true;
    const z = camRef.current.z || 1; // dividir por z é toda a correção de zoom
    const x = clamp(d.x0 + (e.clientX - d.sx) / z, 0, layout.WORLD_W - NODE_W);
    const y = clamp(d.y0 + (e.clientY - d.sy) / z, 0, layout.WORLD_H - NODE_H);
    d.cur = { x, y };
    d.el.style.left = `${x}px`;
    d.el.style.top = `${y}px`;
    redrawEdges(d.id, { x, y, w: NODE_W, h: NODE_H });
  }

  // idempotente: pointerup e lostpointercapture chamam os dois
  function onNodeUp(e) {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    dragRef.current = null;
    d.el.style.zIndex = "";
    justDragged.current = d.moved;
    if (!d.moved) return;
    const p = layout.fromWorld(d.cur.x, d.cur.y);
    const free = e.altKey; // Alt solta do sub-grid
    patchNode(d.id, { h: p.h, lane: p.lane, ox: free ? clamp01(p.ox) : quant(p.ox, 12), oy: free ? clamp01(p.oy) : quant(p.oy, 8) });
  }

  function onNodeClick(n) {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    if (linking) {
      if (!linking.from) setLinking({ ...linking, from: n.id });
      else {
        addEdge(linking.from, n.id, linking.kind);
        setLinking({ ...linking, from: null });
      }
      return;
    }
    setEditingId(n.id);
  }

  const editing = nodes.find((n) => n.id === editingId) || null;
  const metaCount = nodes.filter((n) => n.kind === "meta").length;
  const mirrorCount = nodes.filter((n) => n.kind === "mirror").length;

  return (
    <div className="flex flex-col">
      <section className="mb-5">
        <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
          Mapa
          <MI name="explore" className="text-primary-container text-xl" fill />
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Horizonte no eixo horizontal, área da vida no vertical · {metaCount} meta(s) · {mirrorCount} espelho(s)
        </p>
      </section>

      <Toolbar
        canvasOn={canvasOn}
        isWide={isWide}
        view={view}
        setView={setView}
        onAdd={addNode}
        linking={linking}
        setLinking={setLinking}
        onLanes={() => setShowLanes(true)}
        zoomBy={zoomBy}
        onFit={() => fitTo({ x: 0, y: 0, w: layout.WORLD_W, h: layout.WORLD_H })}
        zoom={cam.z}
      />

      {linking && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
          <MI name="polyline" className="text-primary text-lg" />
          <span className="text-[13px] text-on-surface">
            {linking.from ? "Agora clique no nó de destino" : "Clique no nó de origem"} · Esc cancela
          </span>
        </div>
      )}

      {canvasOn ? (
        <div
          ref={viewportRef}
          {...bind}
          className="relative overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface-container-lowest h-[calc(100vh-22rem)] min-h-[420px] select-none cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none", overscrollBehavior: "contain" }}
        >
          <div
            ref={worldRef}
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: layout.WORLD_W, height: layout.WORLD_H, transform: `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.z})` }}
          >
            <Grid layout={layout} />
            <Edges layout={layout} edges={edges} rects={rects} markerId={markerId} onPick={removeEdge} />

            {nodes.map((n) => {
              const r = rects.get(n.id);
              if (!r) return null;
              return (
                <div
                  key={n.id}
                  className="absolute"
                  style={{ left: r.x, top: r.y, width: NODE_W, height: NODE_H, zIndex: 10 }}
                  onPointerDown={(e) => onNodeDown(e, n)}
                  onPointerMove={onNodeMove}
                  onPointerUp={onNodeUp}
                  onPointerCancel={onNodeUp}
                  onLostPointerCapture={onNodeUp}
                  onClick={() => onNodeClick(n)}
                >
                  <NodeBody
                    node={n}
                    lane={layout.rows.find((l) => l.id === (n.lane ?? null))}
                    state={state}
                    focused={mapa.focusId === n.id}
                    linkingFrom={linking?.from === n.id}
                    degree={edges.filter((e) => e.from === n.id || e.to === n.id).length}
                  />
                </div>
              );
            })}
          </div>

          {nodes.length === 0 && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <p className="text-[13px] text-outline text-center max-w-xs">
                Mapa vazio. Crie uma meta e arraste pra banda de horizonte em que você se compromete com ela.
              </p>
            </div>
          )}
        </div>
      ) : (
        <MapaList
          layout={layout}
          nodes={nodes}
          edges={edges}
          state={state}
          focusId={mapa.focusId}
          onOpen={(id) => setEditingId(id)}
          onAdd={addNode}
        />
      )}

      {editing && (
        <Inspector
          node={editing}
          lanes={lanes}
          state={state}
          edges={edges}
          nodes={nodes}
          focused={mapa.focusId === editing.id}
          onPatch={(patch) => patchNode(editing.id, patch)}
          onToggleFocus={() => toggleFocus(editing.id)}
          onRemoveEdge={removeEdge}
          onDelete={() => removeNode(editing.id)}
          onClose={() => setEditingId(null)}
        />
      )}

      {showLanes && (
        <LaneManager
          lanes={lanes}
          nodes={nodes}
          onAdd={addLane}
          onPatch={patchLane}
          onMove={moveLane}
          onRemove={removeLane}
          onClose={() => setShowLanes(false)}
        />
      )}
    </div>
  );
}

// ---------- barra de ferramentas ----------
function Toolbar({ canvasOn, isWide, view, setView, onAdd, linking, setLinking, onLanes, zoomBy, onFit, zoom }) {
  const btn = "px-3 py-2 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 active:scale-95 transition font-label-caps text-[11px] flex items-center gap-1.5";
  const ghost = "px-2.5 py-2 rounded-lg border border-white/10 text-on-surface-variant hover:border-white/25 transition flex items-center gap-1.5 text-[11px] font-label-caps";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button onClick={() => onAdd("meta")} className={btn}>
        <MI name="add" className="text-base" /> META
      </button>
      <button onClick={() => onAdd("mirror")} className={btn}>
        <MI name="link" className="text-base" /> ESPELHO
      </button>
      <button onClick={() => onAdd("note")} className={ghost}>
        <MI name="sticky_note_2" className="text-base" /> NOTA
      </button>
      <button onClick={onLanes} className={ghost}>
        <MI name="view_agenda" className="text-base" /> ÁREAS
      </button>

      {canvasOn && (
        <>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button
            onClick={() => setLinking(linking ? null : { from: null, kind: "leva" })}
            className={linking ? `${btn} bg-primary/15` : ghost}
          >
            <MI name="polyline" className="text-base" /> LIGAR
          </button>
          {linking && (
            <Select
              value={linking.kind}
              options={MAPA_EDGE_KINDS.map((k) => ({ value: k.id, label: k.label }))}
              onChange={(kind) => setLinking({ ...linking, kind })}
              className="w-36"
            />
          )}
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button onClick={() => zoomBy(1 / 1.2)} aria-label="Diminuir zoom" className={ghost}>
            <MI name="remove" className="text-base" />
          </button>
          <span className="text-[11px] font-label-caps text-outline w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => zoomBy(1.2)} aria-label="Aumentar zoom" className={ghost}>
            <MI name="add" className="text-base" />
          </button>
          <button onClick={onFit} className={ghost}>
            <MI name="fit_screen" className="text-base" /> AJUSTAR
          </button>
        </>
      )}

      {isWide && (
        <button onClick={() => setView(view === "canvas" ? "list" : "canvas")} className={`${ghost} ml-auto`}>
          <MI name={view === "canvas" ? "list" : "account_tree"} className="text-base" />
          {view === "canvas" ? "LISTA" : "MAPA"}
        </button>
      )}
    </div>
  );
}

// ---------- grid de fundo ----------
function Grid({ layout }) {
  return (
    <>
      {MAPA_HORIZONS.map((h, i) => (
        <div
          key={h.id}
          className={`absolute top-0 border-l border-outline-variant/20 ${i === 0 ? "bg-primary/[0.03]" : ""}`}
          style={{ left: GUTTER_W + i * BAND_W, width: BAND_W, height: layout.WORLD_H }}
        />
      ))}
      {layout.rows.map((r, i) => (
        <div
          key={r.id || "none"}
          className="absolute left-0 border-t border-outline-variant/20"
          style={{ top: HEADER_H + i * LANE_H, width: layout.WORLD_W, height: LANE_H }}
        />
      ))}

      {/* rótulos de horizonte */}
      {MAPA_HORIZONS.map((h, i) => (
        <div key={`h-${h.id}`} className="absolute flex flex-col justify-center px-4" style={{ left: GUTTER_W + i * BAND_W, top: 0, width: BAND_W, height: HEADER_H }}>
          <Caps className={i === 0 ? "text-primary text-[11px]" : "text-on-surface-variant text-[11px]"}>{h.label}</Caps>
          <span className="text-[10px] text-outline leading-none">{h.hint}</span>
        </div>
      ))}

      {/* rótulos de raia */}
      {layout.rows.map((r, i) => (
        <div
          key={`l-${r.id || "none"}`}
          className="absolute flex items-center gap-2 px-4"
          style={{ left: 0, top: HEADER_H + i * LANE_H, width: GUTTER_W, height: LANE_H }}
        >
          <span className="w-1.5 h-10 rounded-full shrink-0" style={{ background: r.color }} />
          <div className="min-w-0">
            <MI name={r.icon} className="text-lg block" style={{ color: r.color }} />
            <span className="text-[11px] font-label-caps uppercase tracking-wide text-on-surface-variant break-words leading-tight">{r.label}</span>
          </div>
        </div>
      ))}
    </>
  );
}

// ---------- arestas ----------
// duas camadas: a visível fica ABAIXO dos nós (nunca come clique); a de hit fica acima com
// svg pointer-events:none e paths pointer-events:stroke (alvo gordo sem bloquear o drag).
function Edges({ layout, edges, rects, markerId, onPick }) {
  const geoms = edges.map((e) => ({ e, g: edgeGeom(rects.get(e.from), rects.get(e.to), e.from < e.to) })).filter((x) => x.g);
  const svgProps = {
    width: layout.WORLD_W,
    height: layout.WORLD_H,
    className: "absolute top-0 left-0",
    style: { pointerEvents: "none" },
  };
  return (
    <>
      <svg {...svgProps} style={{ ...svgProps.style, zIndex: 0 }}>
        <defs>
          <marker id={`arrow-${markerId}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-outline" />
          </marker>
        </defs>
        {geoms.map(({ e, g }) => (
          <g key={e.id}>
            <path
              data-from={e.from}
              data-to={e.to}
              d={g.d}
              fill="none"
              stroke="currentColor"
              className={e.kind === "depende" ? "text-outline-variant" : "text-primary-container/70"}
              strokeWidth="1.75"
              strokeDasharray={e.kind === "depende" ? "5 4" : undefined}
              markerEnd={`url(#arrow-${markerId})`}
            />
          </g>
        ))}
      </svg>

      <svg {...svgProps} style={{ ...svgProps.style, zIndex: 20 }}>
        {geoms.map(({ e, g }) => (
          <path
            key={e.id}
            data-from={e.from}
            data-to={e.to}
            d={g.d}
            fill="none"
            stroke="transparent"
            strokeWidth="14"
            style={{ pointerEvents: "stroke", cursor: "pointer" }}
            onClick={() => onPick(e.id)}
          />
        ))}
      </svg>
    </>
  );
}

// ---------- corpo do nó (compartilhado entre canvas e lista) ----------
function NodeBody({ node, lane, state, focused, linkingFrom, degree = 0 }) {
  const color = lane?.color || "#b0b6be";
  const ring = linkingFrom ? "border-primary ring-2 ring-primary/40" : "border-outline-variant/30";

  if (node.kind === "note") {
    return (
      <div
        className={`h-full w-full rounded-xl border p-3 overflow-hidden ${ring}`}
        style={{ background: `${node.color || MAPA_NOTE_COLORS[0]}1f`, borderColor: linkingFrom ? undefined : `${node.color || MAPA_NOTE_COLORS[0]}66` }}
      >
        <div className="flex items-start gap-1.5">
          <MI name="sticky_note_2" className="text-base shrink-0" style={{ color: node.color }} />
          <p className="text-[12px] text-on-surface leading-snug line-clamp-4">{node.text || <span className="text-outline">Nota vazia</span>}</p>
        </div>
      </div>
    );
  }

  if (node.kind === "mirror") {
    const m = resolveMirror(state, node.ref);
    if (!m.ok) {
      return (
        <div className={`h-full w-full rounded-xl border border-error/40 bg-error/5 p-3 overflow-hidden ${linkingFrom ? "ring-2 ring-primary/40" : ""}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <MI name="link_off" className="text-error text-base" />
            <Caps className="text-error text-[10px]">REFERÊNCIA PERDIDA</Caps>
          </div>
          <p className="text-[12px] text-on-surface-variant truncate">{node.fallbackLabel || m.label}</p>
          <p className="text-[10px] text-outline mt-0.5">Toque pra reapontar ou excluir</p>
        </div>
      );
    }
    return (
      <div className={`h-full w-full rounded-xl border bg-surface-container-lowest p-3 overflow-hidden border-l-4 ${ring}`} style={{ borderLeftColor: color }}>
        <div className="flex items-center gap-1.5">
          <MI name={m.icon} className="text-base shrink-0 text-primary-container" />
          <span className="text-[13px] text-on-surface truncate flex-1">{m.label}</span>
          {focused && <MI name="push_pin" fill className="text-primary text-sm shrink-0" />}
          {degree > 0 && <span className="text-[10px] text-outline shrink-0">{degree}</span>}
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-surface-variant overflow-hidden">
          <div className={`h-full rounded-full ${m.done ? "bg-primary" : "bg-primary-container"}`} style={{ width: `${m.pct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] text-outline truncate">{m.sub}</span>
          <span className="text-[10px] font-label-caps text-on-surface-variant shrink-0">{m.pct}%</span>
        </div>
      </div>
    );
  }

  const st = mapaStatus(node.status);
  return (
    <div className={`h-full w-full rounded-xl border bg-surface-container-lowest p-3 overflow-hidden border-l-4 ${ring}`} style={{ borderLeftColor: color }}>
      <div className="flex items-center gap-1.5">
        <MI name={st.icon} className={`text-base shrink-0 ${node.status === "feito" ? "text-primary" : "text-primary-container"}`} />
        <span className={`text-[13px] truncate flex-1 ${node.status === "feito" ? "text-outline line-through" : "text-on-surface"}`}>
          {node.title || <span className="text-outline italic">Sem título</span>}
        </span>
        {focused && <MI name="push_pin" fill className="text-primary text-sm shrink-0" />}
        {degree > 0 && <span className="text-[10px] text-outline shrink-0">{degree}</span>}
      </div>
      {node.why && <p className="mt-1 text-[11px] text-on-surface-variant leading-snug line-clamp-2">{node.why}</p>}
      {node.target && (
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] text-on-surface-variant">
          <MI name="target" className="text-[12px]" /> {node.target}
        </span>
      )}
    </div>
  );
}

// ---------- view de lista (mobile + toggle no desktop) ----------
// Mesmo state, mesmo inspetor. Também é o caminho de teclado/leitor de tela:
// posicionar só por arraste seria inacessível.
function MapaList({ layout, nodes, edges, state, focusId, onOpen, onAdd }) {
  if (!nodes.length) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <MI name="explore" className="text-outline text-3xl" />
        <p className="mt-2 text-[13px] text-outline">Nada no mapa ainda. Comece por uma meta do trimestre.</p>
        <button onClick={() => onAdd("meta")} className="mt-4 px-4 py-2 rounded-lg border border-primary/40 text-primary font-label-caps text-[11px]">
          CRIAR META
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {MAPA_HORIZONS.map((h) => {
        const inBand = nodes.filter((n) => n.h === h.id);
        return (
          <section key={h.id}>
            <div className="flex items-baseline gap-2 mb-2">
              <Caps className="text-primary text-[11px]">{h.label}</Caps>
              <span className="text-[10px] text-outline">{h.hint}</span>
              <span className="text-[10px] text-outline ml-auto">{inBand.length}</span>
            </div>
            {inBand.length === 0 ? (
              <p className="text-[12px] text-outline border border-dashed border-outline-variant/30 rounded-xl px-3 py-4">Nada neste horizonte.</p>
            ) : (
              <div className="space-y-3">
                {layout.rows.map((r) => {
                  const items = inBand.filter((n) => (n.lane ?? null) === r.id);
                  if (!items.length) return null;
                  return (
                    <div key={r.id || "none"}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                        <Caps className="text-outline text-[10px]">{r.label}</Caps>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {items.map((n) => (
                          <button key={n.id} onClick={() => onOpen(n.id)} className="text-left h-[96px] active:scale-[0.99] transition">
                            <NodeBody
                              node={n}
                              lane={r}
                              state={state}
                              focused={focusId === n.id}
                              degree={edges.filter((e) => e.from === n.id || e.to === n.id).length}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---------- inspetor ----------
function Inspector({ node, lanes, state, edges, nodes, focused, onPatch, onToggleFocus, onRemoveEdge, onDelete, onClose }) {
  const refOptions = useMemo(() => {
    const flat = [];
    for (const g of mapaRefOptions(state)) for (const it of g.items) flat.push({ value: it.value, label: `${g.group} · ${it.label}` });
    return flat;
  }, [state]);
  const mirror = node.kind === "mirror" ? resolveMirror(state, node.ref) : null;
  const myEdges = edges.filter((e) => e.from === node.id || e.to === node.id);
  const nodeLabel = (id) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return "?";
    if (n.kind === "meta") return n.title || "meta sem título";
    if (n.kind === "note") return n.text || "nota";
    return resolveMirror(state, n.ref).label;
  };
  const title = node.kind === "meta" ? "Meta" : node.kind === "mirror" ? "Espelho" : "Nota";

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label={title}>
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={(e) => e.stopPropagation()}>
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
                    const id = rest.join(":");
                    const label = refOptions.find((o) => o.value === v)?.label || "";
                    onPatch({ ref: { type, id }, fallbackLabel: label.split(" · ").slice(1).join(" · ") || label });
                  }}
                />
                {!refOptions.length && <p className="mt-1.5 text-[11px] text-outline">Nada pra espelhar ainda — crie um hábito, missão ou meta primeiro.</p>}
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

          {/* posição — único caminho sem arraste (e o caminho do mobile) */}
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

          {myEdges.length > 0 && (
            <div>
              <Caps className="text-outline text-[10px] mb-1.5 block">LIGAÇÕES</Caps>
              <div className="space-y-1.5">
                {myEdges.map((e) => {
                  const out = e.from === node.id;
                  const kind = MAPA_EDGE_KINDS.find((k) => k.id === e.kind)?.label || e.kind;
                  return (
                    <div key={e.id} className="flex items-center gap-2 rounded-lg bg-surface-container-high px-2.5 py-2">
                      <MI name={out ? "arrow_forward" : "arrow_back"} className="text-outline text-base shrink-0" />
                      <span className="text-[12px] text-on-surface-variant truncate flex-1">
                        {out ? `${kind} ${nodeLabel(e.to)}` : `${nodeLabel(e.from)} ${kind} isto`}
                      </span>
                      <button onClick={() => onRemoveEdge(e.id)} aria-label="Remover ligação" className="text-outline hover:text-error transition shrink-0">
                        <MI name="close" className="text-base" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-headline-md text-headline-md text-primary">Áreas da vida</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition p-1">
            <MI name="close" />
          </button>
        </div>
        <p className="text-[12px] text-outline mb-4">São as raias do eixo vertical. Reordenar não move nenhum item de área.</p>

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
