"use client";

// ============================================================================
// PRANCHETA — canvas de desenho livre das Missões.
//
// SVG, não <canvas>: cada traço fica sendo um nó que dá pra selecionar, mover e
// apagar depois (num canvas de bitmap, traço desenhado é pixel — não existe mais
// como objeto), e o mesmo SVG serve de arquivo de exportação sem redesenhar nada.
//
// Coordenadas: tudo é guardado em coordenada de MUNDO. A visão (`view`) é só
// translate+scale aplicado num <g> — então zoom e pan nunca tocam nos dados.
//
// Escrita no state global: só no fim do gesto (pointerup). O traço em andamento
// vive em `draft`, state local. Sem isso, cada pixel de movimento do dedo viraria
// um setState do app inteiro (e o save de 600ms do AppContext seria acordado
// centenas de vezes por traço).
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, inputCls } from "@/components/ui";
import { CANVAS_ELEMENTS_MAX, CANVAS_PAGES_MAX, CANVAS_PAGE_NAME_LEN, CANVAS_TEXT_LEN } from "@/lib/state";

const uid = () => crypto.randomUUID();
const r1 = (n) => Math.round(n * 10) / 10; // 1 decimal basta pra traço e corta o peso do jsonb pela metade

// ---- ferramentas ----
// `draws` = ferramenta que cria elemento arrastando; separa das que só navegam
// ou manipulam (seleção, mão, borracha), que compartilham o mesmo pointerdown.
const TOOLS = [
  { id: "select", label: "SELECIONAR", icon: "arrow_selector_tool", key: "V" },
  { id: "pan", label: "MÃO", icon: "back_hand", key: "H" },
  { id: "pen", label: "PINCEL", icon: "gesture", key: "P", draws: true },
  { id: "line", label: "LINHA", icon: "horizontal_rule", key: "L", draws: true },
  { id: "arrow", label: "SETA", icon: "arrow_outward", key: "A", draws: true },
  { id: "rect", label: "RETÂNGULO", icon: "crop_square", key: "R", draws: true },
  { id: "ellipse", label: "ELIPSE", icon: "circle", key: "O", draws: true },
  { id: "diamond", label: "LOSANGO", icon: "change_history", key: "D", draws: true },
  { id: "text", label: "TEXTO", icon: "title", key: "T" },
  { id: "eraser", label: "BORRACHA", icon: "ink_eraser", key: "E" },
];
const toolOf = (id) => TOOLS.find((t) => t.id === id) || TOOLS[0];

// "ink" é tinta que segue o tema (on-surface): o app tem modo claro e escuro, e
// um hex fixo aqui viraria traço invisível em um dos dois. Os outros são fixos de
// propósito — cor escolhida é dado do desenho, não decoração de tema.
// Só forma fechada tem preenchimento. Pincel/linha/seta/texto não: `fill` num
// traço aberto pinta o miolo do rabisco (vira borrão), e normalizeCanvasElement
// descarta o campo nesses tipos — então ele também não sobreviveria ao reload.
const FILLABLE = ["rect", "ellipse", "diamond"];
const INK = "ink";
const PALETTE = [INK, "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#94a3b8"];
const WIDTHS = [2, 4, 8, 16];
const TEXT_SIZES = [14, 18, 26, 40];
const OPACITIES = [1, 0.6, 0.3];
const FILL_ALPHA = 0.22; // preenchimento translúcido: mantém o traço e o que está por baixo legíveis
const ZOOM_MIN = 0.15;
const ZOOM_MAX = 6;

const inkVar = (c) => (c === INK ? "var(--color-on-surface)" : c);

// ---- geometria ----

// Retângulo positivo. Arrastar pra cima/esquerda gera w/h negativo durante o
// gesto; normalizar só no fim deixa o arrasto livre em qualquer direção.
const normRect = (el) => ({
  ...el,
  x: Math.min(el.x, el.x + el.w),
  y: Math.min(el.y, el.y + el.h),
  w: Math.abs(el.w),
  h: Math.abs(el.h),
});

// Caixa de um elemento. Texto é estimado (largura de glifo ≈ 0.55em): medir de
// verdade exigiria ler o DOM a cada quadro, e a caixa aqui só serve pra acerto
// de clique e moldura de seleção.
function bboxOf(el) {
  if (el.type === "pen") {
    // laço em vez de Math.min(...pontos): traço longo passa de mil pontos, e
    // spread desse tamanho é argumento de função demais pra pilha
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const [px, py] of el.points) {
      if (px < x1) x1 = px;
      if (py < y1) y1 = py;
      if (px > x2) x2 = px;
      if (py > y2) y2 = py;
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  if (el.type === "line" || el.type === "arrow") {
    return { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
  }
  if (el.type === "text") {
    const lines = String(el.text).split("\n");
    const cols = Math.max(...lines.map((l) => l.length), 1);
    return { x: el.x, y: el.y, w: cols * el.size * 0.55, h: lines.length * el.size * 1.25 };
  }
  const n = normRect(el);
  return { x: n.x, y: n.y, w: n.w, h: n.h };
}

function unionBox(boxes) {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

const grow = (b, m) => ({ x: b.x - m, y: b.y - m, w: b.w + m * 2, h: b.h + m * 2 });
const hitsBox = (b, p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
const boxesOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Acerto por caixa, com folga proporcional à espessura: linha fina de 2px é
// impossível de acertar no dedo se o alvo for o traço exato.
const hitEl = (el, p, tol) => hitsBox(grow(bboxOf(el), Math.max(tol, el.width || 0)), p);

function moveEl(el, dx, dy) {
  if (el.type === "pen") return { ...el, points: el.points.map((p) => [r1(p[0] + dx), r1(p[1] + dy)]) };
  if (el.type === "line" || el.type === "arrow")
    return { ...el, x1: r1(el.x1 + dx), y1: r1(el.y1 + dy), x2: r1(el.x2 + dx), y2: r1(el.y2 + dy) };
  return { ...el, x: r1(el.x + dx), y: r1(el.y + dy) };
}

// Escala em torno de (ox,oy). Texto escala pelo menor fator: esticar só a
// largura da fonte deformaria a letra, e SVG não tem isso de graça.
function scaleEl(el, sx, sy, ox, oy) {
  const fx = (v) => r1(ox + (v - ox) * sx);
  const fy = (v) => r1(oy + (v - oy) * sy);
  if (el.type === "pen") return { ...el, points: el.points.map((p) => [fx(p[0]), fy(p[1])]) };
  if (el.type === "line" || el.type === "arrow") return { ...el, x1: fx(el.x1), y1: fy(el.y1), x2: fx(el.x2), y2: fy(el.y2) };
  if (el.type === "text") return { ...el, x: fx(el.x), y: fy(el.y), size: Math.max(8, r1(el.size * Math.min(Math.abs(sx), Math.abs(sy)))) };
  return { ...el, x: fx(el.x), y: fy(el.y), w: r1(el.w * sx), h: r1(el.h * sy) };
}

// Traço do pincel suavizado por ponto médio quadrático: ligar os pontos com
// linha reta deixa o traço facetado, e curva por ponto médio custa nada.
function penPath(points) {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const mx = (x + points[i + 1][0]) / 2;
    const my = (y + points[i + 1][1]) / 2;
    d += ` Q ${x} ${y} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last[0]} ${last[1]}`;
}

// Ponta da seta desenhada como polígono: o <marker> do SVG não herda a cor do
// traço de forma confiável entre navegadores nem sobrevive à exportação.
function arrowHead(el) {
  const ang = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
  const len = Math.hypot(el.x2 - el.x1, el.y2 - el.y1);
  const size = Math.min(6 + el.width * 2.2, Math.max(len * 0.4, 4));
  const spread = 0.42;
  const p = (a) => `${el.x2 - size * Math.cos(ang - a)},${el.y2 - size * Math.sin(ang - a)}`;
  return `${el.x2},${el.y2} ${p(spread)} ${p(-spread)}`;
}

const diamondPoints = (b) => `${b.x + b.w / 2},${b.y} ${b.x + b.w},${b.y + b.h / 2} ${b.x + b.w / 2},${b.y + b.h} ${b.x},${b.y + b.h / 2}`;

// ---- desenho de um elemento ----
// Cor vai por `style` (não por atributo de apresentação) porque atributo não
// aceita var(), e a tinta adaptativa depende disso. Consequência: preenchimento
// TAMBÉM tem que ir no style — style ganha de atributo, então um fill="..." aqui
// seria engolido pelo fill:none do traço.
// Sem vectorEffect de propósito: o traço faz parte do desenho, logo engrossa com
// o zoom. Travar em pixel de tela deixaria a forma fina ao ampliar e quebraria a
// espessura no arquivo exportado.
function ElementNode({ el, faded }) {
  const stroke = inkVar(el.stroke);
  const alpha = faded ? el.opacity * 0.25 : el.opacity;
  const hasFill = el.fill && el.fill !== "none";
  const common = {
    style: {
      stroke,
      strokeWidth: el.width,
      opacity: alpha,
      fill: hasFill ? inkVar(el.fill) : "none",
      fillOpacity: hasFill ? FILL_ALPHA : undefined,
    },
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (el.type === "pen") return <path d={penPath(el.points)} {...common} />;
  if (el.type === "line") return <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} {...common} />;
  if (el.type === "arrow")
    return (
      <g style={{ opacity: alpha }}>
        <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} {...common} style={{ ...common.style, opacity: 1 }} />
        <polygon points={arrowHead(el)} style={{ fill: stroke, stroke }} />
      </g>
    );
  if (el.type === "text") {
    const lines = String(el.text).split("\n");
    return (
      <text
        x={el.x}
        y={el.y}
        style={{ fill: stroke, opacity: faded ? el.opacity * 0.25 : el.opacity, fontSize: el.size, fontFamily: "inherit", whiteSpace: "pre" }}
      >
        {lines.map((ln, i) => (
          <tspan key={i} x={el.x} y={el.y + el.size * 0.85 + i * el.size * 1.25}>
            {ln || " "}
          </tspan>
        ))}
      </text>
    );
  }
  const b = normRect(el);
  if (el.type === "rect") return <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={Math.min(8, b.w / 8, b.h / 8)} {...common} />;
  if (el.type === "ellipse") return <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} {...common} />;
  return <polygon points={diamondPoints(b)} {...common} />;
}

// ---- barras ----

function ToolButton({ on, icon, label, hint, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={hint ? `${label} (${hint})` : label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition active:scale-95 ${
        on
          ? danger
            ? "border-error/50 bg-error/15 text-error"
            : "border-primary/50 bg-primary/15 text-primary"
          : "border-transparent text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-high"
      }`}
    >
      <MI name={icon} className="text-xl" />
    </button>
  );
}

function IconAction({ icon, label, onClick, disabled, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-transparent transition active:scale-95 disabled:opacity-30 ${
        danger ? "text-on-surface-variant hover:border-error/40 hover:text-error" : "text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-high"
      }`}
    >
      <MI name={icon} className="text-xl" />
    </button>
  );
}

// Amostra de cor. A primeira é a tinta do tema — sem nome de cor na legenda, que
// ela troca junto com claro/escuro.
function Swatch({ color, on, onClick, none }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={none ? "Sem preenchimento" : color === INK ? "Tinta do tema" : `Cor ${color}`}
      title={none ? "Sem preenchimento" : color === INK ? "Tinta do tema" : color}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition active:scale-90 ${
        on ? "border-primary" : "border-transparent hover:border-outline-variant"
      }`}
    >
      {none ? (
        <span className="grid h-5 w-5 place-items-center rounded-full border border-outline-variant">
          <MI name="block" className="text-[13px] text-outline" />
        </span>
      ) : (
        <span className="h-5 w-5 rounded-full" style={{ background: inkVar(color) }} />
      )}
    </button>
  );
}

// Painel de páginas. Ordem é por botão (sobe/desce) e não por arrastar: a lista
// convive com um canvas que já captura todo gesto de ponteiro, e disputar o
// arrasto com ele custaria mais do que a comodidade vale.
function PagesPanel({ pages, activeId, onPick, onAdd, onRename, onDuplicate, onRemove, onMove, onClose }) {
  const [renaming, setRenaming] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const full = pages.length >= CANVAS_PAGES_MAX;

  const startRename = (p) => {
    setRenaming(p.id);
    setNameDraft(p.name);
  };
  const commitRename = () => {
    if (renaming) onRename(renaming, nameDraft.trim().slice(0, CANVAS_PAGE_NAME_LEN));
    setRenaming(null);
  };

  return (
    <div className="flex w-full shrink-0 flex-col rounded-xl border border-outline-variant bg-surface-container md:w-48">
      <div className="flex items-center gap-1 border-b border-outline-variant px-2 py-1.5">
        <Caps className="flex-1 text-[10px] text-outline">PÁGINAS ({pages.length})</Caps>
        <IconAction icon="add" label={full ? "Limite de páginas atingido" : "Nova página"} onClick={onAdd} disabled={full} />
        {onClose && <IconAction icon="close" label="Fechar painel" onClick={onClose} />}
      </div>
      <ul className="ff-scroll max-h-52 flex-1 overflow-y-auto p-1 md:max-h-none">
        {pages.map((p, i) => {
          const on = p.id === activeId;
          return (
            <li key={p.id} className="group">
              {renaming === p.id ? (
                <input
                  value={nameDraft}
                  autoFocus
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => (e.key === "Enter" ? commitRename() : e.key === "Escape" ? setRenaming(null) : null)}
                  maxLength={CANVAS_PAGE_NAME_LEN}
                  aria-label="Nome da página"
                  className={`${inputCls} w-full py-1 text-[12px]`}
                />
              ) : (
                <div
                  className={`flex items-center gap-1 rounded-lg px-2 py-1.5 transition ${
                    on ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  <button onClick={() => onPick(p.id)} onDoubleClick={() => startRename(p)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                    <MI name={on ? "description" : "insert_drive_file"} className="shrink-0 text-base" />
                    <span className="truncate text-[12px]">{p.name}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-[10px] text-outline">{p.elements.length || ""}</span>
                  </button>
                  {/* Ações aparecem na página ATIVA sempre, e nas outras no hover:
                      no toque não existe hover, e ficar sem renomear/excluir no
                      celular seria funcionalidade só de mouse. */}
                  <div className={`shrink-0 items-center ${on ? "flex" : "hidden group-hover:flex"}`}>
                    <button onClick={() => onMove(p.id, -1)} disabled={i === 0} aria-label="Subir" className="p-0.5 text-outline transition hover:text-on-surface disabled:opacity-25">
                      <MI name="arrow_upward" className="text-sm" />
                    </button>
                    <button onClick={() => onMove(p.id, 1)} disabled={i === pages.length - 1} aria-label="Descer" className="p-0.5 text-outline transition hover:text-on-surface disabled:opacity-25">
                      <MI name="arrow_downward" className="text-sm" />
                    </button>
                    <button onClick={() => startRename(p)} aria-label="Renomear" className="p-0.5 text-outline transition hover:text-primary">
                      <MI name="edit" className="text-sm" />
                    </button>
                    <button onClick={() => onDuplicate(p.id)} disabled={full} aria-label="Duplicar" className="p-0.5 text-outline transition hover:text-primary disabled:opacity-25">
                      <MI name="content_copy" className="text-sm" />
                    </button>
                    <button onClick={() => onRemove(p.id)} aria-label="Excluir página" className="p-0.5 text-outline transition hover:text-error">
                      <MI name="delete" className="text-sm" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================================
// EDITOR
// ============================================================================
export default function Prancheta() {
  const { state, setState, confirm, toast } = useApp();
  const pages = state.canvasPages || [];

  const [pageId, setPageId] = useState(null);
  const page = pages.find((p) => p.id === pageId) || pages[0] || null;
  const elements = page?.elements || [];

  const [tool, setTool] = useState("select");
  const [stroke, setStroke] = useState(INK);
  const [fill, setFill] = useState("none");
  const [width, setWidth] = useState(2);
  const [opacity, setOpacity] = useState(1);
  const [textSize, setTextSize] = useState(18);

  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [draft, setDraft] = useState(null); // elemento em construção (nunca vai pro state global)
  // Mover/escalar em andamento: { [id]: elemento transformado }. Mora aqui, não no
  // state global, pelo mesmo motivo do draft — arrastar dispara ~60 eventos/s, e
  // cada um viraria um setState do app inteiro.
  const [preview, setPreview] = useState(null);
  const [selection, setSelection] = useState([]); // ids
  const [marquee, setMarquee] = useState(null); // laço de seleção, em mundo
  const [erasing, setErasing] = useState([]); // ids marcados pela borracha no gesto atual
  const [editingText, setEditingText] = useState(null); // { id|null, x, y, size, value }
  const [hist, setHist] = useState({ past: [], future: [] });
  const [showPages, setShowPages] = useState(false);
  const [gridOn, setGridOn] = useState(true);
  const [full, setFull] = useState(false);

  const svgRef = useRef(null);
  const gestureRef = useRef(null); // gesto em andamento (não precisa re-renderizar)
  const pointersRef = useRef(new Map()); // pinça: id do ponteiro → posição de tela
  const pinchRef = useRef(null);
  const textareaRef = useRef(null);
  // Espelho síncrono de editingText. O blur da caixa de texto chega DEPOIS do
  // pointerdown que a fechou, os dois chamam commitText, e o segundo ainda vê o
  // state antigo — sem esta trava o mesmo texto entra duas vezes.
  const editRef = useRef(null);
  // Espelhos do traço/arrasto em curso. pointermove é evento contínuo: o React
  // pode não ter aplicado o último setState quando o pointerup chega, e aí o
  // commit leria um estado velho — perdendo o fim do traço. O ref é a verdade.
  const draftRef = useRef(null);
  const previewRef = useRef(null);

  const putDraft = useCallback((v) => {
    const next = typeof v === "function" ? v(draftRef.current) : v;
    draftRef.current = next;
    setDraft(next);
  }, []);
  const putPreview = useCallback((v) => {
    previewRef.current = v;
    setPreview(v);
  }, []);

  const activeTool = toolOf(tool);
  const hasSel = selection.length > 0;
  // O que está na tela = elementos + transformação em curso por cima.
  const shown = useMemo(() => (preview ? elements.map((el) => preview[el.id] || el) : elements), [elements, preview]);
  const selEls = useMemo(() => shown.filter((e) => selection.includes(e.id)), [shown, selection]);
  const selBox = useMemo(() => (selEls.length ? unionBox(selEls.map(bboxOf)) : null), [selEls]);

  // ---- páginas ----
  const setPages = useCallback((fn) => setState((prev) => ({ ...prev, canvasPages: fn(prev.canvasPages || []) })), [setState]);

  const addPage = () => {
    if (pages.length >= CANVAS_PAGES_MAX) return toast(`Limite de ${CANVAS_PAGES_MAX} páginas`, { type: "error" });
    const id = uid();
    setPages((ps) => [...ps, { id, name: `Página ${ps.length + 1}`, pos: ps.length, elements: [] }]);
    setPageId(id);
    setHist({ past: [], future: [] });
    setSelection([]);
  };
  const renamePage = (id, name) => setPages((ps) => ps.map((p) => (p.id === id ? { ...p, name: name || p.name } : p)));
  const duplicatePage = (id) => {
    if (pages.length >= CANVAS_PAGES_MAX) return toast(`Limite de ${CANVAS_PAGES_MAX} páginas`, { type: "error" });
    const src = pages.find((p) => p.id === id);
    if (!src) return;
    const copy = { id: uid(), name: `${src.name} (cópia)`.slice(0, CANVAS_PAGE_NAME_LEN), pos: pages.length, elements: src.elements.map((e) => ({ ...e, id: uid() })) };
    setPages((ps) => [...ps, copy]);
    setPageId(copy.id);
  };
  async function removePage(id) {
    const p = pages.find((x) => x.id === id);
    if (!p) return;
    if (p.elements.length) {
      const ok = await confirm({ title: "Excluir página?", body: `"${p.name}" tem ${p.elements.length} elemento(s). Isso não volta.`, confirmLabel: "EXCLUIR" });
      if (!ok) return;
    }
    setPages((ps) => ps.filter((x) => x.id !== id).map((x, i) => ({ ...x, pos: i })));
    if (id === page?.id) {
      setSelection([]);
      setHist({ past: [], future: [] });
      setPageId(null);
    }
  }
  const movePage = (id, dir) =>
    setPages((ps) => {
      const i = ps.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((p, k) => ({ ...p, pos: k }));
    });

  // ---- elementos + histórico ----
  const writeElements = useCallback(
    (next) => setPages((ps) => ps.map((p) => (p.id === (page?.id) ? { ...p, elements: next } : p))),
    [setPages, page?.id]
  );

  // Toda mutação passa por aqui: é o único ponto que empurra o desfazer, então
  // não existe alteração que o Ctrl+Z não alcance.
  const commit = useCallback(
    (fn) => {
      if (!page) return;
      const cur = page.elements || [];
      const next = typeof fn === "function" ? fn(cur) : fn;
      if (next === cur) return;
      if (next.length > CANVAS_ELEMENTS_MAX) {
        toast(`Página cheia (${CANVAS_ELEMENTS_MAX} elementos)`, { type: "error" });
        return;
      }
      setHist((h) => ({ past: [...h.past, cur].slice(-60), future: [] }));
      writeElements(next);
    },
    [page, writeElements, toast]
  );

  // Escrita fica FORA do updater do setHist: updater roda duas vezes em modo
  // estrito, e efeito colateral lá dentro executaria dobrado.
  const undo = useCallback(() => {
    if (!page || !hist.past.length) return;
    setHist({ past: hist.past.slice(0, -1), future: [page.elements || [], ...hist.future].slice(0, 60) });
    writeElements(hist.past[hist.past.length - 1]);
    setSelection([]);
  }, [page, hist, writeElements]);

  const redo = useCallback(() => {
    if (!page || !hist.future.length) return;
    setHist({ past: [...hist.past, page.elements || []].slice(-60), future: hist.future.slice(1) });
    writeElements(hist.future[0]);
    setSelection([]);
  }, [page, hist, writeElements]);

  // ---- conversão tela ↔ mundo ----
  const toWorld = useCallback(
    (cx, cy) => {
      const r = svgRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return { x: (cx - r.left - view.x) / view.zoom, y: (cy - r.top - view.y) / view.zoom };
    },
    [view]
  );
  const toScreen = useCallback((wx, wy) => ({ x: wx * view.zoom + view.x, y: wy * view.zoom + view.y }), [view]);

  const zoomAt = useCallback((factor, cx, cy) => {
    setView((v) => {
      const r = svgRef.current?.getBoundingClientRect();
      const px = cx - (r?.left || 0);
      const py = cy - (r?.top || 0);
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * factor));
      const k = zoom / v.zoom;
      // ponto sob o cursor fica parado: sem isso o zoom "foge" do que se está olhando
      return { zoom, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  }, []);

  const resetView = () => setView({ x: 0, y: 0, zoom: 1 });

  // Botão de zoom mira o centro da FOLHA (não o da janela): a folha não ocupa a
  // tela inteira, então mirar a janela desloca o desenho a cada clique.
  const zoomButton = (factor) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2);
  };

  // Enquadra tudo que existe na página — o resgate de quem se perdeu no infinito.
  const fitAll = useCallback(() => {
    const box = unionBox(elements.map(bboxOf));
    const r = svgRef.current?.getBoundingClientRect();
    if (!box || !r) return resetView();
    const pad = 48;
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min((r.width - pad * 2) / Math.max(box.w, 1), (r.height - pad * 2) / Math.max(box.h, 1)), ZOOM_MIN));
    setView({ zoom, x: r.width / 2 - (box.x + box.w / 2) * zoom, y: r.height / 2 - (box.y + box.h / 2) * zoom });
  }, [elements]);

  // ---- estilo aplicado à seleção ----
  // Mexer no estilo com algo selecionado repinta a seleção; sem seleção, define o
  // estilo do próximo traço. É o comportamento que todo editor tem.
  const applyStyle = (patch) => {
    if (!hasSel) return;
    commit((els) => els.map((e) => (selection.includes(e.id) ? { ...e, ...patch } : e)));
  };
  const pickStroke = (c) => {
    setStroke(c);
    applyStyle({ stroke: c });
  };
  const pickFill = (c) => {
    setFill(c);
    if (!hasSel) return;
    commit((els) => els.map((e) => (selection.includes(e.id) && FILLABLE.includes(e.type) ? { ...e, fill: c } : e)));
  };
  const pickWidth = (w) => {
    setWidth(w);
    applyStyle({ width: w });
  };
  const pickOpacity = (o) => {
    setOpacity(o);
    applyStyle({ opacity: o });
  };
  const pickTextSize = (s) => {
    setTextSize(s);
    if (hasSel) commit((els) => els.map((e) => (selection.includes(e.id) && e.type === "text" ? { ...e, size: s } : e)));
  };

  // ---- ações de seleção ----
  const deleteSelection = useCallback(() => {
    if (!selection.length) return;
    commit((els) => els.filter((e) => !selection.includes(e.id)));
    setSelection([]);
  }, [selection, commit]);

  const duplicateSelection = useCallback(() => {
    if (!selection.length) return;
    const copies = elements.filter((e) => selection.includes(e.id)).map((e) => ({ ...moveEl(e, 16, 16), id: uid() }));
    commit((els) => [...els, ...copies]);
    setSelection(copies.map((c) => c.id));
  }, [elements, selection, commit]);

  // Ordem de empilhamento = ordem do array. Trazer pra frente é mover pro fim.
  const reorderSelection = (toFront) => {
    if (!selection.length) return;
    commit((els) => {
      const picked = els.filter((e) => selection.includes(e.id));
      const rest = els.filter((e) => !selection.includes(e.id));
      return toFront ? [...rest, ...picked] : [...picked, ...rest];
    });
  };

  // ---- texto ----
  const openTextEditor = (el, world) => {
    const next = el
      ? { id: el.id, x: el.x, y: el.y, size: el.size, value: el.text, stroke: el.stroke, opacity: el.opacity }
      : { id: null, x: r1(world.x), y: r1(world.y), size: textSize, value: "", stroke, opacity };
    editRef.current = next;
    setEditingText(next);
    setSelection([]);
  };

  const closeTextEditor = () => {
    editRef.current = null;
    setEditingText(null);
  };

  // Digitar tem que atualizar o ref junto: é dele que o commit lê. Mexer só no
  // state deixaria o ref com o texto vazio da abertura — e nada seria salvo.
  const typeText = (value) => {
    const next = { ...editRef.current, value: value.slice(0, CANVAS_TEXT_LEN) };
    editRef.current = next;
    setEditingText(next);
  };

  const commitText = () => {
    const t = editRef.current;
    if (!t) return;
    editRef.current = null; // trava síncrona: o blur que vem depois não repete o commit
    const value = t.value.trim().slice(0, CANVAS_TEXT_LEN);
    if (t.id) {
      // texto apagado até ficar vazio = elemento removido; não guarda caixa fantasma
      commit((els) => (value ? els.map((e) => (e.id === t.id ? { ...e, text: value } : e)) : els.filter((e) => e.id !== t.id)));
    } else if (value) {
      // mesma ordem de chaves de normalizeCanvasElement — ver comentário no pointerdown
      commit((els) => [...els, { id: uid(), type: "text", stroke: t.stroke, width: 1, opacity: t.opacity, x: t.x, y: t.y, text: value, size: t.size }]);
    }
    setEditingText(null);
  };

  // o textarea sobrepõe o elemento; deixar o original desenhado embaixo mostraria
  // o mesmo texto duas vezes, deslocado
  const visible = useMemo(() => (editingText?.id ? shown.filter((el) => el.id !== editingText.id) : shown), [shown, editingText?.id]);

  // ---- gesto de ponteiro ----
  function onPointerDown(e) {
    if (e.button === 2) return; // botão direito: deixa o menu do navegador
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // segundo dedo: vira pinça (zoom+pan) e cancela o que estava sendo desenhado
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      gestureRef.current = null;
      putDraft(null);
      putPreview(null);
      setMarquee(null);
      return;
    }
    if (pointersRef.current.size > 2) return;

    if (editRef.current) commitText();

    const w = toWorld(e.clientX, e.clientY);
    const tol = 6 / view.zoom; // folga de acerto em unidades de mundo: some quando dá zoom

    // mão ou botão do meio = arrastar a folha
    if (tool === "pan" || e.button === 1) {
      gestureRef.current = { kind: "pan", start: { x: e.clientX, y: e.clientY }, view };
      return;
    }

    if (tool === "text") {
      const hit = [...elements].reverse().find((el) => el.type === "text" && hitEl(el, w, tol));
      openTextEditor(hit || null, w);
      return;
    }

    if (tool === "eraser") {
      const hit = [...elements].reverse().find((el) => hitEl(el, w, tol));
      gestureRef.current = { kind: "erase" };
      setErasing(hit ? [hit.id] : []);
      return;
    }

    if (activeTool.draws) {
      // A ordem das chaves segue normalizeCanvasElement de propósito: o diff-sync
      // compara por JSON.stringify, e todo load renormaliza. Ordem diferente aqui
      // faria o banco receber a prancheta inteira de volta em cada sessão, sem
      // nenhum traço ter mudado.
      const base = { id: uid(), type: tool, stroke, width, opacity };
      if (tool === "pen") putDraft({ ...base, points: [[r1(w.x), r1(w.y)]] });
      else if (tool === "line" || tool === "arrow") putDraft({ ...base, x1: r1(w.x), y1: r1(w.y), x2: r1(w.x), y2: r1(w.y) });
      else putDraft({ ...base, x: r1(w.x), y: r1(w.y), w: 0, h: 0, fill });
      gestureRef.current = { kind: "draw", start: w };
      setSelection([]);
      return;
    }

    // ---- seleção ----
    // alça de redimensionar tem prioridade: ela fica sobre a moldura, e quem
    // clica na alça quer escalar, não mover.
    if (selBox && selEls.length) {
      const handle = handleAt(w, selBox, selEls, 9 / view.zoom);
      if (handle) {
        gestureRef.current = {
          kind: "resize",
          handle,
          box: selBox,
          ids: selection,
          before: selEls.map((el) => ({ ...el })),
        };
        return;
      }
    }

    const hit = [...elements].reverse().find((el) => hitEl(el, w, tol));
    if (hit) {
      // duplo clique em texto abre a edição — mais rápido que achar a ferramenta
      if (e.detail >= 2 && hit.type === "text") return openTextEditor(hit, w);
      const next = e.shiftKey
        ? selection.includes(hit.id)
          ? selection.filter((id) => id !== hit.id)
          : [...selection, hit.id]
        : selection.includes(hit.id)
          ? selection
          : [hit.id];
      setSelection(next);
      gestureRef.current = { kind: "move", start: w, ids: next, before: elements.filter((el) => next.includes(el.id)).map((el) => ({ ...el })) };
      return;
    }

    if (!e.shiftKey) setSelection([]);
    gestureRef.current = { kind: "marquee", start: w };
    setMarquee({ x: w.x, y: w.y, w: 0, h: 0 });
  }

  function onPointerMove(e) {
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // pinça: distância entre dedos vira zoom, o meio vira pan
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const prev = pinchRef.current;
      if (prev.dist > 0) {
        const factor = dist / prev.dist;
        setView((v) => {
          const r = svgRef.current?.getBoundingClientRect();
          const px = mid.x - (r?.left || 0);
          const py = mid.y - (r?.top || 0);
          const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * factor));
          const k = zoom / v.zoom;
          return { zoom, x: px - (px - v.x) * k + (mid.x - prev.mid.x), y: py - (py - v.y) * k + (mid.y - prev.mid.y) };
        });
      }
      pinchRef.current = { dist, mid };
      return;
    }

    const g = gestureRef.current;
    if (!g) return;
    const w = toWorld(e.clientX, e.clientY);

    if (g.kind === "pan") {
      setView({ ...g.view, x: g.view.x + (e.clientX - g.start.x), y: g.view.y + (e.clientY - g.start.y) });
      return;
    }

    if (g.kind === "draw") {
      putDraft((d) => {
        if (!d) return d;
        if (d.type === "pen") {
          const last = d.points[d.points.length - 1];
          const min = 2 / view.zoom; // afina o traço: ponto a cada ~2px de tela, não a cada evento
          if (Math.hypot(w.x - last[0], w.y - last[1]) < min) return d;
          return { ...d, points: [...d.points, [r1(w.x), r1(w.y)]] };
        }
        if (d.type === "line" || d.type === "arrow") {
          // shift trava em 0/45/90°
          let { x, y } = w;
          if (e.shiftKey) {
            const dx = x - d.x1;
            const dy = y - d.y1;
            const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
            const len = Math.hypot(dx, dy);
            x = d.x1 + Math.cos(a) * len;
            y = d.y1 + Math.sin(a) * len;
          }
          return { ...d, x2: r1(x), y2: r1(y) };
        }
        let dw = w.x - g.start.x;
        let dh = w.y - g.start.y;
        if (e.shiftKey) {
          // shift = proporção 1:1 (quadrado / círculo)
          const s = Math.max(Math.abs(dw), Math.abs(dh));
          dw = Math.sign(dw || 1) * s;
          dh = Math.sign(dh || 1) * s;
        }
        return { ...d, w: r1(dw), h: r1(dh) };
      });
      return;
    }

    // mover e escalar só alimentam o `preview`; o state global recebe uma
    // escrita só, no pointerup
    if (g.kind === "move") {
      const dx = w.x - g.start.x;
      const dy = w.y - g.start.y;
      const next = {};
      for (const el of g.before) next[el.id] = moveEl(el, dx, dy);
      putPreview(next);
      return;
    }

    if (g.kind === "resize") {
      const { handle, box, before } = g;
      const next = {};
      if (handle.kind === "endpoint") {
        const src = before[0];
        next[src.id] = { ...src, [handle.point === 1 ? "x1" : "x2"]: r1(w.x), [handle.point === 1 ? "y1" : "y2"]: r1(w.y) };
        putPreview(next);
        return;
      }
      // âncora = canto oposto ao que está sendo arrastado
      const ax = handle.sx < 0 ? box.x + box.w : box.x;
      const ay = handle.sy < 0 ? box.y + box.h : box.y;
      // caixa achatada (linha reta, texto de uma letra) não escala nesse eixo:
      // dividir por ~0 mandaria a geometria pro infinito
      const sx = box.w < 0.5 ? 1 : Math.max(0.02, Math.abs(w.x - ax) / box.w);
      const sy = box.h < 0.5 ? 1 : Math.max(0.02, Math.abs(w.y - ay) / box.h);
      for (const el of before) next[el.id] = scaleEl(el, sx, sy, ax, ay);
      putPreview(next);
      return;
    }

    if (g.kind === "marquee") {
      setMarquee({ x: Math.min(g.start.x, w.x), y: Math.min(g.start.y, w.y), w: Math.abs(w.x - g.start.x), h: Math.abs(w.y - g.start.y) });
      return;
    }

    if (g.kind === "erase") {
      const tol = 6 / view.zoom;
      const hit = [...elements].reverse().find((el) => hitEl(el, w, tol));
      if (hit) setErasing((ids) => (ids.includes(hit.id) ? ids : [...ids, hit.id]));
    }
  }

  function onPointerUp(e) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    const g = gestureRef.current;
    gestureRef.current = null;

    if (g?.kind === "draw" && draftRef.current) {
      const d = draftRef.current;
      putDraft(null);
      // clique seco com ferramenta de forma não cria nada: forma de 0px é lixo invisível
      const box = bboxOf(d);
      const tiny = d.type === "pen" ? d.points.length < 2 : box.w < 2 / view.zoom && box.h < 2 / view.zoom;
      if (!tiny) commit((els) => [...els, d.type === "pen" || d.type === "line" || d.type === "arrow" ? d : normRect(d)]);
      return;
    }

    if (g?.kind === "marquee" && marquee) {
      const box = marquee;
      setMarquee(null);
      if (box.w > 2 || box.h > 2) {
        const inside = elements.filter((el) => boxesOverlap(bboxOf(el), box)).map((el) => el.id);
        setSelection((cur) => (e.shiftKey ? [...new Set([...cur, ...inside])] : inside));
      }
      return;
    }

    if (g?.kind === "erase") {
      // o gesto inteiro é UMA entrada de histórico: apagar 5 traços de uma
      // passada e ter que dar 5 Ctrl+Z seria castigo
      const ids = erasing;
      if (ids.length) commit((els) => els.filter((el) => !ids.includes(el.id)));
      setErasing([]);
      return;
    }

    // fim do arrasto: o preview vira o estado real, numa escrita só
    if (g?.kind === "move" || g?.kind === "resize") {
      const pv = previewRef.current;
      if (pv) {
        commit((els) => els.map((el) => pv[el.id] || el));
        putPreview(null);
      }
    }
  }

  function onPointerCancel(e) {
    pointersRef.current.delete(e.pointerId);
    pinchRef.current = null;
    gestureRef.current = null;
    putDraft(null);
    putPreview(null);
    setMarquee(null);
    setErasing([]);
  }

  // O onWheel do React é passivo, e listener passivo não pode chamar
  // preventDefault — sem isso a roda rolaria a página inteira em vez de mover a
  // folha. Daí o registro manual.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const h = (ev) => {
      ev.preventDefault();
      if (ev.ctrlKey || ev.metaKey) zoomAt(ev.deltaY < 0 ? 1.12 : 1 / 1.12, ev.clientX, ev.clientY);
      else setView((v) => ({ ...v, x: v.x - ev.deltaX, y: v.y - ev.deltaY }));
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, [zoomAt]);

  // ---- tela cheia ----
  // Duas camadas, porque uma só não basta: a API nativa tira a barra do navegador
  // mas não sabe nada do layout do app, e o overlay CSS cobre a sidebar/nav mas não
  // some com o cromo do navegador. Juntas dão tela cheia literal.
  //
  // O pedido nativo vai no documentElement, NÃO neste elemento: em fullscreen de
  // elemento só a subárvore dele desenha, e aí os avisos (z-100) e o timer (z-90),
  // que moram fora daqui, ficariam invisíveis justo quando a tela é toda nossa.
  const exitFull = useCallback(() => {
    setFull(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  const toggleFull = async () => {
    if (full) return exitFull();
    setFull(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // iPhone não tem fullscreen nativo — o overlay sozinho já entrega a folha inteira
    }
  };

  // Sair pelo Esc/F11 não passa pelo botão: sem ouvir o evento, o overlay ficaria
  // pendurado sem o fullscreen nativo por trás.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ---- teclado ----
  useEffect(() => {
    function onKey(e) {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        return e.shiftKey ? redo() : undo();
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        return redo();
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        return duplicateSelection();
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        return setSelection(elements.map((el) => el.id));
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        return deleteSelection();
      }
      if (e.key === "Escape") {
        // Escada: fecha primeiro o que está aberto e só sai da tela cheia se não
        // havia nada pra fechar. Sem a ordem, um Esc pra cancelar seleção jogaria
        // o usuário fora da tela cheia de brinde.
        if (editRef.current) return closeTextEditor();
        if (selection.length) return setSelection([]);
        if (full) exitFull();
        return;
      }
      const hit = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (hit && !mod) setTool(hit.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, duplicateSelection, deleteSelection, elements, selection, full, exitFull]);

  // foca a caixa de texto assim que ela abre
  useEffect(() => {
    if (editingText) textareaRef.current?.focus();
  }, [editingText]);

  // No desktop a lista de páginas nasce aberta; no celular ela roubaria metade da
  // folha, então lá nasce fechada. Decidido depois da montagem de propósito — ler
  // largura de tela na renderização do servidor não existe.
  useEffect(() => {
    setShowPages(window.matchMedia("(min-width: 768px)").matches);
  }, []);

  // ---- exportação ----
  // Serializa o <g> já renderizado em vez de reconstruir o SVG: um só desenhador,
  // então o arquivo exportado nunca divergir do que está na tela. O var() da tinta
  // adaptativa é resolvido aqui, senão o arquivo abre sem cor fora do app.
  const buildSvg = useCallback(() => {
    const layer = svgRef.current?.querySelector("[data-layer=elements]");
    if (!layer || !elements.length) return null;
    const box = grow(unionBox(elements.map(bboxOf)), 24);
    const cs = getComputedStyle(svgRef.current);
    const ink = cs.getPropertyValue("--color-on-surface").trim() || "#e6edf7";
    const bg = cs.getPropertyValue("--color-surface-container-lowest").trim() || "#070a11";
    const body = layer.innerHTML.replaceAll("var(--color-on-surface)", ink);
    return {
      box,
      markup:
        `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(box.w)}" height="${Math.ceil(box.h)}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">` +
        `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${bg}"/>${body}</svg>`,
    };
  }, [elements]);

  const download = (href, filename) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
  };
  const fileBase = () => (page?.name || "prancheta").replace(/[^\p{L}\p{N}_-]+/gu, "-").toLowerCase();

  const exportSvg = () => {
    const out = buildSvg();
    if (!out) return toast("Página vazia", { type: "error" });
    const url = URL.createObjectURL(new Blob([out.markup], { type: "image/svg+xml" }));
    download(url, `${fileBase()}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const exportPng = () => {
    const out = buildSvg();
    if (!out) return toast("Página vazia", { type: "error" });
    const scale = 2; // 2× pra não sair borrado em tela retina
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = Math.ceil(out.box.w * scale);
      cv.height = Math.ceil(out.box.h * scale);
      const ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((blob) => {
        if (!blob) return toast("Falha ao gerar PNG", { type: "error" });
        const url = URL.createObjectURL(blob);
        download(url, `${fileBase()}.png`);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }, "image/png");
    };
    img.onerror = () => toast("Falha ao gerar PNG", { type: "error" });
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(out.markup)}`;
  };

  async function clearPage() {
    if (!elements.length) return;
    const ok = await confirm({ title: "Limpar a página?", body: `${elements.length} elemento(s) saem da folha. Dá pra desfazer com Ctrl+Z.`, confirmLabel: "LIMPAR" });
    if (!ok) return;
    commit([]);
    setSelection([]);
  }

  // ---- sem páginas ainda ----
  if (!page) {
    return (
      <div className="glass-card flex flex-1 flex-col items-center justify-center gap-3 rounded-xl p-8 text-center">
        <MI name="draw" className="text-5xl text-primary-container" />
        <div>
          <h3 className="font-headline-md text-headline-md text-on-surface">Prancheta vazia</h3>
          <p className="mt-1 max-w-sm text-body-md text-on-surface-variant">
            Folha em branco pra rascunhar o plano antes de virar cartão: formas, setas, pincel e texto.
          </p>
        </div>
        <button
          onClick={addPage}
          className="flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2 font-label-caps text-[11px] text-on-primary-container transition active:scale-95"
        >
          <MI name="add" className="text-lg" /> NOVA PÁGINA
        </button>
      </div>
    );
  }

  const showFill = FILLABLE.includes(tool) || selEls.some((e) => FILLABLE.includes(e.type));
  const showTextSize = tool === "text" || selEls.some((e) => e.type === "text");
  const cursor = tool === "pan" ? "grab" : tool === "select" ? "default" : tool === "eraser" ? "cell" : "crosshair";
  const gridStep = 24;

  return (
    <div
      className={
        full
          ? // z-80: acima da sidebar e da nav de baixo (z-50), abaixo do timer (z-90) e
            // dos avisos (z-100) — a folha come o app, não as notificações dele
            "fixed inset-0 z-[80] flex min-h-0 flex-col gap-2 bg-surface p-2"
          : "flex min-h-0 flex-1 flex-col gap-2"
      }
    >
      {/* ---- barra de ferramentas ---- */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-outline-variant bg-surface-container px-2 py-1.5">
        <IconAction icon="menu_open" label="Páginas" onClick={() => setShowPages((v) => !v)} />
        <span className="mx-0.5 h-6 w-px bg-outline-variant" />
        {TOOLS.map((t) => (
          <ToolButton
            key={t.id}
            on={tool === t.id}
            icon={t.icon}
            label={t.label}
            hint={t.key}
            danger={t.id === "eraser"}
            onClick={() => setTool(t.id)}
          />
        ))}
        <span className="mx-0.5 h-6 w-px bg-outline-variant" />
        <IconAction icon="undo" label="Desfazer (Ctrl+Z)" onClick={undo} disabled={!hist.past.length} />
        <IconAction icon="redo" label="Refazer (Ctrl+Shift+Z)" onClick={redo} disabled={!hist.future.length} />
        <div className="ml-auto flex items-center gap-1">
          {hasSel && (
            <>
              <Caps className="px-1 text-[10px] text-outline">{selection.length} SEL.</Caps>
              <IconAction icon="flip_to_front" label="Trazer pra frente" onClick={() => reorderSelection(true)} />
              <IconAction icon="flip_to_back" label="Mandar pro fundo" onClick={() => reorderSelection(false)} />
              <IconAction icon="content_copy" label="Duplicar (Ctrl+D)" onClick={duplicateSelection} />
              <IconAction icon="delete" label="Excluir (Del)" onClick={deleteSelection} danger />
              <span className="mx-0.5 h-6 w-px bg-outline-variant" />
            </>
          )}
          <IconAction icon={gridOn ? "grid_on" : "grid_off"} label="Grade" onClick={() => setGridOn((v) => !v)} />
          <IconAction
            icon={full ? "fullscreen_exit" : "fullscreen"}
            label={full ? "Sair da tela cheia (Esc)" : "Tela cheia"}
            onClick={toggleFull}
          />
          <IconAction icon="image" label="Exportar PNG" onClick={exportPng} />
          <IconAction icon="shapes" label="Exportar SVG" onClick={exportSvg} />
          <IconAction icon="delete_sweep" label="Limpar página" onClick={clearPage} disabled={!elements.length} danger />
        </div>
      </div>

      {/* ---- estilo ---- */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-outline-variant bg-surface-container px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Caps className="mr-0.5 text-[10px] text-outline">TRAÇO</Caps>
          {PALETTE.map((c) => (
            <Swatch key={c} color={c} on={stroke === c} onClick={() => pickStroke(c)} />
          ))}
        </div>
        {showFill && (
          <div className="flex items-center gap-1">
            <Caps className="mr-0.5 text-[10px] text-outline">FUNDO</Caps>
            <Swatch none on={fill === "none"} onClick={() => pickFill("none")} />
            {PALETTE.map((c) => (
              <Swatch key={c} color={c} on={fill === c} onClick={() => pickFill(c)} />
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          <Caps className="mr-0.5 text-[10px] text-outline">ESPESSURA</Caps>
          {WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => pickWidth(w)}
              aria-pressed={width === w}
              aria-label={`Espessura ${w}`}
              title={`Espessura ${w}`}
              className={`grid h-7 w-7 place-items-center rounded-lg border transition ${
                width === w ? "border-primary bg-primary/10" : "border-transparent hover:border-outline-variant"
              }`}
            >
              <span className="w-4 rounded-full bg-on-surface-variant" style={{ height: Math.min(w, 10) }} />
            </button>
          ))}
        </div>
        {showTextSize && (
          <div className="flex items-center gap-1">
            <Caps className="mr-0.5 text-[10px] text-outline">TEXTO</Caps>
            {TEXT_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => pickTextSize(s)}
                aria-pressed={textSize === s}
                aria-label={`Tamanho ${s}`}
                className={`grid h-7 min-w-7 place-items-center rounded-lg border px-1 font-label-caps text-[10px] transition ${
                  textSize === s ? "border-primary bg-primary/10 text-primary" : "border-transparent text-on-surface-variant hover:border-outline-variant"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          <Caps className="mr-0.5 text-[10px] text-outline">OPACIDADE</Caps>
          {OPACITIES.map((o) => (
            <button
              key={o}
              onClick={() => pickOpacity(o)}
              aria-pressed={opacity === o}
              aria-label={`Opacidade ${Math.round(o * 100)}%`}
              className={`grid h-7 min-w-8 place-items-center rounded-lg border px-1 font-label-caps text-[10px] transition ${
                opacity === o ? "border-primary bg-primary/10 text-primary" : "border-transparent text-on-surface-variant hover:border-outline-variant"
              }`}
            >
              {Math.round(o * 100)}
            </button>
          ))}
        </div>
      </div>

      {/* ---- folha + páginas ---- */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row">
        <div className={showPages ? "block" : "hidden"}>
          <PagesPanel
            pages={pages}
            activeId={page.id}
            onPick={(id) => {
              setPageId(id);
              setSelection([]);
              setHist({ past: [], future: [] });
            }}
            onAdd={addPage}
            onRename={renamePage}
            onDuplicate={duplicatePage}
            onRemove={removePage}
            onMove={movePage}
            onClose={() => setShowPages(false)}
          />
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <svg
            ref={svgRef}
            role="application"
            aria-label={`Folha de desenho: ${page.name}`}
            className="h-full w-full"
            // touchAction none: sem isso o dedo rola a página em vez de desenhar
            style={{ touchAction: "none", cursor }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
          >
            <defs>
              {/* grade em espaço de TELA com patternTransform seguindo a visão:
                  assim o ponto acompanha o zoom sem eu redesenhar nada */}
              <pattern id="pr-grid" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse" patternTransform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
                <circle cx={0.5} cy={0.5} r={0.9} className="fill-outline-variant" />
              </pattern>
            </defs>
            {gridOn && <rect width="100%" height="100%" fill="url(#pr-grid)" opacity={0.5} />}

            <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
              <g data-layer="elements">
                {visible.map((el) => (
                  <ElementNode key={el.id} el={el} faded={erasing.includes(el.id)} />
                ))}
              </g>
              {draft && <ElementNode el={draft} />}

              {/* moldura + alças da seleção */}
              {selBox && !draft && (
                <SelectionOverlay box={selBox} els={selEls} zoom={view.zoom} />
              )}

              {marquee && (
                <rect
                  x={marquee.x}
                  y={marquee.y}
                  width={marquee.w}
                  height={marquee.h}
                  className="fill-primary/10 stroke-primary"
                  strokeWidth={1 / view.zoom}
                  strokeDasharray={`${4 / view.zoom} ${3 / view.zoom}`}
                />
              )}
            </g>
          </svg>

          {/* caixa de texto: sobreposta em coordenada de tela, com o mesmo
              tamanho aparente do texto final pra não "pular" ao confirmar */}
          {editingText && (
            <textarea
              ref={textareaRef}
              value={editingText.value}
              onChange={(e) => typeText(e.target.value)}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === "Escape") return closeTextEditor();
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) return commitText();
              }}
              placeholder="Digite…"
              aria-label="Texto do desenho"
              className="absolute resize-none overflow-hidden rounded border border-primary/60 bg-surface-container/95 p-1 text-on-surface outline-none"
              style={{
                left: toScreen(editingText.x, editingText.y).x,
                top: toScreen(editingText.x, editingText.y).y,
                fontSize: editingText.size * view.zoom,
                lineHeight: 1.25,
                minWidth: 120 * view.zoom,
                minHeight: editingText.size * 1.4 * view.zoom,
                color: inkVar(editingText.stroke),
              }}
            />
          )}

          {/* zoom */}
          <div className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded-lg border border-outline-variant bg-surface-container/90 p-0.5 backdrop-blur">
            <IconAction icon="remove" label="Diminuir zoom" onClick={() => zoomButton(1 / 1.2)} />
            <button onClick={resetView} title="Zoom 100%" className="min-w-12 px-1 font-label-caps text-[10px] tabular-nums text-on-surface-variant transition hover:text-primary">
              {Math.round(view.zoom * 100)}%
            </button>
            <IconAction icon="add" label="Aumentar zoom" onClick={() => zoomButton(1.2)} />
            <IconAction icon="fit_screen" label="Enquadrar tudo" onClick={fitAll} />
          </div>

          {/* dica só na folha vazia — some no primeiro traço, não fica atrapalhando */}
          {!elements.length && !draft && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <p className="max-w-xs text-center text-[12px] leading-relaxed text-outline">
                Escolha uma ferramenta e arraste pra desenhar.
                <br />
                Roda do mouse move a folha · Ctrl+roda dá zoom · dois dedos fazem os dois.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Alças: canto pra escalar; ponta pra linha/seta (escalar uma linha por caixa é
// confuso — o que se quer é arrastar a ponta).
const CORNERS = [
  { id: "nw", sx: -1, sy: -1 },
  { id: "ne", sx: 1, sy: -1 },
  { id: "sw", sx: -1, sy: 1 },
  { id: "se", sx: 1, sy: 1 },
];

function handlePositions(box, els) {
  const single = els.length === 1 ? els[0] : null;
  if (single && (single.type === "line" || single.type === "arrow")) {
    return [
      { kind: "endpoint", point: 1, x: single.x1, y: single.y1 },
      { kind: "endpoint", point: 2, x: single.x2, y: single.y2 },
    ];
  }
  return CORNERS.map((c) => ({
    kind: "corner",
    sx: c.sx,
    sy: c.sy,
    x: c.sx < 0 ? box.x : box.x + box.w,
    y: c.sy < 0 ? box.y : box.y + box.h,
  }));
}

function handleAt(p, box, els, tol) {
  return handlePositions(box, els).find((h) => Math.abs(p.x - h.x) <= tol && Math.abs(p.y - h.y) <= tol) || null;
}

function SelectionOverlay({ box, els, zoom }) {
  const s = 1 / zoom; // moldura com espessura constante na tela em qualquer zoom
  const pad = 4 * s;
  const hs = 7 * s;
  return (
    <g className="pointer-events-none">
      <rect
        x={box.x - pad}
        y={box.y - pad}
        width={box.w + pad * 2}
        height={box.h + pad * 2}
        className="fill-none stroke-primary"
        strokeWidth={s}
        strokeDasharray={`${4 * s} ${3 * s}`}
      />
      {handlePositions(box, els).map((h, i) => (
        <rect
          key={i}
          x={h.x - hs / 2}
          y={h.y - hs / 2}
          width={hs}
          height={hs}
          rx={h.kind === "endpoint" ? hs / 2 : s}
          className="fill-surface-container stroke-primary"
          strokeWidth={s * 1.5}
        />
      ))}
    </g>
  );
}
