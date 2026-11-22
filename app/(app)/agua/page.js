"use client";

// ============================================================================
// WATER TRACKER — portado do DevwiseWater (HTML/CSS/JS solto) pro app.
//
// O que veio de lá: o copo em SVG que enche com onda, splash e bolhas; a linha
// tracejada do "ritmo ideal" (onde o nível deveria estar a essa hora, na janela
// 7h–22h); os atalhos +200/+300/+500 com teclas 1/2/3, P (personalizado) e Z
// (desfazer); a semana com a bolinha que enche; a linha do tempo de hoje; meta e
// lembretes num diálogo.
//
// O que mudou: estado e persistência são os do app (state.water + water_logs, ver
// lib/state.js), cores são os tokens do tema (a água vai no acento, que é DADO), e
// o lembrete mora no AppContext, pra avisar em qualquer aba — não só nesta.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../AppContext";
import { MI, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ensureNotifyPermission } from "@/lib/notify";
import {
  getDateStr,
  shiftDate,
  weekStartOf,
  waterGoal,
  waterEntries,
  waterTotal,
  waterRatio,
  waterStreak,
  waterPaceRatio,
  makeWaterEntry,
  addWaterEntry,
  removeWaterEntry,
  setWaterGoal,
  WATER_QUICK,
  WATER_GOAL_PRESETS,
  WATER_GOAL_MIN,
  WATER_GOAL_MAX,
  WATER_ENTRY_MAX,
  WATER_REMINDERS,
} from "@/lib/state";

// Geometria do copo (unidades do viewBox 300×400)
const GLASS_BOTTOM = 364; // fundo interno
const GLASS_RANGE = 320; // altura útil até 100%
const GLASS_EMPTY = 384; // superfície escondida abaixo do fundo

const card = "rounded-xl border border-outline-variant bg-surface-container";
const fmt = (n) => Math.round(n).toLocaleString("pt-BR");
const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const DAY_LETTERS = ["S", "T", "Q", "Q", "S", "S", "D"];
const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const REMINDER_LABEL = { 0: "Desligado", 60: "A cada 1 h", 120: "A cada 2 h" };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// reinicia uma animação CSS de classe (remove, força reflow, recoloca)
function restart(node, cls) {
  if (!node) return;
  node.classList.remove(cls);
  void node.getBoundingClientRect();
  node.classList.add(cls);
}

// Contagem suave do número principal (easeOutQuart, 900ms).
function useCountUp(target) {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (reducedMotion()) {
      fromRef.current = target;
      setShown(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(Math.max((now - start) / 900, 0), 1);
      const v = from + (target - from) * (1 - Math.pow(1 - t, 4));
      fromRef.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

// Relógio de minuto: vira o dia e move a linha do ritmo sem recarregar a página.
function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    const onVis = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return now;
}

function Glass({ ratio, total, goal, pace, splashKey, reached, celebrateKey }) {
  const surfaceRef = useRef(null);
  const bubblesRef = useRef(null);
  const shimmerRef = useRef(null);
  const [level, setLevel] = useState(GLASS_EMPTY); // 1º paint vazio, depois enche até o nível salvo

  const fill = Math.min(Math.max(ratio, 0), 1);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setLevel(fill === 0 ? GLASS_EMPTY : GLASS_BOTTOM - fill * GLASS_RANGE)));
    return () => cancelAnimationFrame(id);
  }, [fill]);

  const spawnBubbles = useCallback(
    (count, baseDelay) => {
      const g = bubblesRef.current;
      const depth = fill * GLASS_RANGE;
      if (!g || depth < 24 || reducedMotion()) return;
      for (let i = 0; i < count; i++) {
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const drift = (Math.random() - 0.5) * 18;
        c.setAttribute("cx", 85 + Math.random() * 130);
        c.setAttribute("cy", 0);
        c.setAttribute("r", 1.5 + Math.random() * 3);
        g.appendChild(c);
        const anim = c.animate(
          [{ transform: `translate(0, ${depth}px)`, opacity: 0 }, { opacity: 0.8, offset: 0.25 }, { transform: `translate(${drift}px, 10px)`, opacity: 0 }],
          { duration: 1300 + Math.random() * 900, delay: baseDelay + Math.random() * (count * 70), easing: "cubic-bezier(.4, 0, .6, 1)", fill: "both" }
        );
        anim.onfinish = anim.oncancel = () => c.remove();
      }
    },
    [fill]
  );

  // registro novo: a superfície pula e sobem bolhas
  useEffect(() => {
    if (!splashKey || reducedMotion()) return;
    restart(surfaceRef.current, "is-splashing");
    spawnBubbles(7, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splashKey]);

  // meta batida agora (não no load): brilho atravessando + bolhas
  useEffect(() => {
    if (!celebrateKey) return;
    restart(shimmerRef.current, "is-running");
    spawnBubbles(16, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrateKey]);

  // linha do ritmo acompanhando as paredes inclinadas do copo
  const paceY = GLASS_BOTTOM - pace * GLASS_RANGE;
  const inset = ((paceY - 24) * 26) / 326;
  const showPace = pace > 0.03 && total < goal;

  return (
    <figure className="relative mx-auto aspect-[3/4] w-[min(56vw,230px)]" role="img" aria-label={fill === 0 ? "Copo vazio" : `Copo ${Math.round(fill * 100)}% cheio`}>
      <svg viewBox="0 0 300 400" className="relative z-[1] size-full overflow-visible" aria-hidden="true">
        <defs>
          <clipPath id="glassInner">
            <path d="M40 24 L66 350 Q67 364 84 364 L216 364 Q233 364 234 350 L260 24 Z" />
          </clipPath>
          <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="water-stop-top" />
            <stop offset="1" className="water-stop-bottom" />
          </linearGradient>
          <linearGradient id="shimmerFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path className="glass-body" d="M30 20 L58 356 Q60 380 84 380 L216 380 Q240 380 242 356 L270 20 Z" />

        <g clipPath="url(#glassInner)">
          <g className="water-level" style={{ "--level": `${level}px` }}>
            <g ref={surfaceRef} className="water-surface">
              <path className="water-wave water-wave-back" d="M0 0 Q75 -9 150 0 T300 0 T450 0 T600 0 T750 0 T900 0 V440 H0 Z" />
              <path className="water-wave water-wave-front" d="M0 2 Q75 9 150 2 T300 2 T450 2 T600 2 T750 2 T900 2 V440 H0 Z" />
            </g>
            <g ref={bubblesRef} className="water-bubbles" />
          </g>
          <rect ref={shimmerRef} className="water-shimmer" x="-160" y="0" width="120" height="400" fill="url(#shimmerFill)" />
        </g>

        {showPace && (
          <g className="water-pace">
            <line x1={40 + inset + 6} x2={260 - inset - 6} y1={paceY} y2={paceY} />
            <text x={270 - ((paceY - 20) * 28) / 336 + 10} y={paceY}>
              agora
            </text>
          </g>
        )}

        <g className="glass-ticks">
          <line x1="233" y1="124" x2="245" y2="124" />
          <line x1="227" y1="204" x2="239" y2="204" />
          <line x1="220" y1="284" x2="232" y2="284" />
        </g>

        <path className="glass-outline" d="M30 20 L58 356 Q60 380 84 380 L216 380 Q240 380 242 356 L270 20" />
        <path className="glass-hl" d="M58 52 L79 326" />
        <path className="glass-hl glass-hl-thin" d="M74 60 L90 300" />
      </svg>
      <div className="absolute inset-x-[14%] -bottom-[1%] h-[7%] rounded-[50%] bg-on-surface/10 blur-md" aria-hidden="true" />
      <figcaption
        aria-hidden={!reached}
        className={`pointer-events-none absolute left-1/2 top-[46%] z-[2] whitespace-nowrap rounded-full border border-outline-variant bg-popover px-3.5 py-2 text-[13px] font-semibold text-on-surface shadow-sm transition-all duration-700 ${
          reached ? "-translate-x-1/2 translate-y-0 opacity-100 delay-700" : "-translate-x-1/2 translate-y-2 opacity-0"
        }`}
      >
        Meta atingida
      </figcaption>
    </figure>
  );
}

function GoalDialog({ open, onOpenChange, goal, reminder, onSave }) {
  const [value, setValue] = useState(String(goal));
  const [rem, setRem] = useState(reminder);
  const [warning, setWarning] = useState("");
  useEffect(() => {
    if (open) {
      setValue(String(goal));
      setRem(reminder);
      setWarning("");
    }
  }, [open, goal, reminder]);

  const n = Math.round(Number(value));
  const valid = n >= WATER_GOAL_MIN && n <= WATER_GOAL_MAX;

  async function pickReminder(m) {
    setWarning("");
    if (m > 0) {
      if (typeof Notification === "undefined") {
        setWarning("Este navegador não suporta notificações.");
        return setRem(0);
      }
      if (!(await ensureNotifyPermission())) {
        setWarning("Notificações bloqueadas. Libere nas permissões do navegador.");
        return setRem(0);
      }
    }
    setRem(m);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-popover border-outline-variant gap-5">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSave(n, rem);
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-base">Meta diária</DialogTitle>
            <DialogDescription>Quanto você quer beber por dia?</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={WATER_GOAL_MIN}
                max={WATER_GOAL_MAX}
                step={50}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label="Meta em ml"
                aria-invalid={!valid || undefined}
                autoFocus
                className="h-11 text-lg font-semibold tabular-nums"
              />
              <span className="text-sm text-on-surface-variant">ml</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Sugestões">
              {WATER_GOAL_PRESETS.map((g) => (
                <Button key={g} type="button" variant={n === g ? "secondary" : "outline"} size="sm" onClick={() => setValue(String(g))} className="tabular-nums">
                  {fmt(g)}
                </Button>
              ))}
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-on-surface">Lembretes</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-container-high p-1">
              {WATER_REMINDERS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={rem === m}
                  onClick={() => pickReminder(m)}
                  className={`h-8 rounded-md text-xs font-medium transition-colors ${
                    rem === m ? "bg-popover text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {REMINDER_LABEL[m]}
                </button>
              ))}
            </div>
            <p className={`text-xs ${warning ? "text-error" : "text-outline"}`}>
              {warning || "Avisa se você ficar sem registrar água, entre 7h e 22h. Funciona com o app aberto."}
            </p>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AguaPage() {
  const { state, setState } = useApp();
  const now = useMinute();
  const today = getDateStr(0);
  const goal = waterGoal(state);
  const entries = waterEntries(state, today);
  const total = waterTotal(state, today);
  const ratio = total / goal;
  const percent = Math.round(ratio * 100);
  const left = goal - total;
  const reached = total >= goal;
  const shown = useCountUp(total);

  const [splashKey, setSplashKey] = useState(0);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [newId, setNewId] = useState(null);
  const [undo, setUndo] = useState(null); // { id, ml } do último registro, por 5s
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [customBad, setCustomBad] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const amountRef = useRef(null);
  const customRef = useRef(null);
  const quickRefs = useRef({});

  // Meta batida AGORA (transição falso → verdadeiro), não no load nem na virada do dia.
  const wasReached = useRef(reached);
  useEffect(() => {
    if (reached && !wasReached.current) setCelebrateKey((k) => k + 1);
    wasReached.current = reached;
  }, [reached]);

  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(id);
  }, [undo]);

  const add = useCallback(
    (ml) => {
      const entry = makeWaterEntry(ml);
      if (!entry) return false;
      const d = getDateStr(0);
      setState((prev) => addWaterEntry(prev, d, entry));
      setNewId(entry.id);
      setUndo({ id: entry.id, ml: entry.ml });
      setSplashKey((k) => k + 1);
      restart(amountRef.current, "water-bump");
      return true;
    },
    [setState]
  );

  const remove = useCallback(
    (id) => {
      setState((prev) => removeWaterEntry(prev, getDateStr(0), id));
      setUndo((u) => (u?.id === id ? null : u));
    },
    [setState]
  );

  function closeCustom() {
    setCustomOpen(false);
    setCustom("");
    setCustomBad(false);
  }
  function submitCustom(e) {
    e.preventDefault();
    if (add(custom)) closeCustom();
    else {
      setCustomBad(true);
      customRef.current?.focus();
    }
  }

  // atalhos: 1/2/3 = rápidos, P = personalizado, Z (ou Ctrl/Cmd+Z) = desfazer o último
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.defaultPrevented || ev.altKey || goalOpen) return;
      if (ev.target instanceof HTMLElement && ev.target.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      const key = ev.key.toLowerCase();
      if (key === "z" && !ev.shiftKey) {
        const last = waterEntries(state, getDateStr(0)).at(-1);
        if (last) {
          ev.preventDefault();
          remove(last.id);
        }
        return;
      }
      if (ev.ctrlKey || ev.metaKey) return;
      const idx = ["1", "2", "3"].indexOf(key);
      if (idx >= 0 && WATER_QUICK[idx]) {
        ev.preventDefault();
        add(WATER_QUICK[idx]);
        restart(quickRefs.current[idx], "water-press");
      } else if (key === "p") {
        ev.preventDefault();
        setCustomOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [add, remove, goalOpen, state]);

  useEffect(() => {
    if (customOpen) customRef.current?.focus();
  }, [customOpen]);

  // ritmo ideal
  const pace = waterPaceRatio(now);
  const paceTarget = Math.round((goal * pace) / 10) * 10;
  const behind = paceTarget - total;
  const paceNote = pace > 0.03 && !reached ? (behind > 0 ? `Ritmo ideal agora: ${fmt(paceTarget)} ml · faltam ${fmt(behind)}` : `No ritmo · ideal agora: ${fmt(paceTarget)} ml`) : "";

  // semana (segunda → domingo)
  const monday = weekStartOf(today);
  const week = DAY_LETTERS.map((letter, i) => {
    const date = shiftDate(monday, i);
    const r = waterRatio(state, date);
    return { letter, name: DAY_NAMES[i], date, ratio: r, met: r >= 1, future: date > today, isToday: date === today };
  });
  const streak = waterStreak(state, today);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(now);

  return (
    <div>
      <PageHeader
        title="Água"
        subtitle="Registre cada copo e acompanhe a meta do dia."
        actions={
          <Button variant="outline" size="sm" onClick={() => setGoalOpen(true)} aria-haspopup="dialog">
            <MI name="water_drop" className="text-[16px]" />
            Meta <span className="tabular-nums font-semibold">{fmt(goal)} ml</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* hero: número, copo e registro */}
        <section className={`${card} p-5 sm:p-6 lg:col-span-7`} aria-labelledby="agua-total">
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-outline first-letter:uppercase">{dateLabel}</p>
              <h2 id="agua-total" className="flex items-baseline gap-1 tracking-tight text-on-surface">
                <span ref={amountRef} className="text-5xl font-semibold tabular-nums sm:text-6xl">
                  {fmt(shown)}
                </span>
                <span className="text-xl font-medium text-on-surface-variant">ml</span>
              </h2>
              <p className="text-sm text-on-surface-variant tabular-nums">de {fmt(goal)} ml</p>

              <div className="flex flex-wrap items-center gap-2 pt-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums transition-colors ${
                    reached ? "bg-primary-container text-on-primary-container" : "bg-surface-variant text-on-surface"
                  }`}
                >
                  {percent}%
                </span>
                <span className="text-sm text-on-surface-variant tabular-nums">
                  {left > 0 ? `${fmt(left)} ml restantes` : left === 0 ? "Meta atingida" : `${fmt(-left)} ml além da meta`}
                </span>
              </div>
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-variant" aria-hidden="true">
                <div className="h-full rounded-full bg-primary-container transition-all duration-700" style={{ width: `${Math.min(100, percent)}%` }} />
              </div>
              <p className="min-h-[18px] pt-1 text-xs text-outline tabular-nums">{paceNote}</p>
            </div>

            <Glass ratio={ratio} total={total} goal={goal} pace={pace} splashKey={splashKey} reached={reached} celebrateKey={celebrateKey} />
          </div>

          <div className="mt-6 space-y-3 border-t border-outline-variant pt-5" aria-label="Registrar água">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-on-surface">Registrar</h3>
              {undo && (
                <Button variant="ghost" size="sm" onClick={() => remove(undo.id)} className="h-7 text-xs text-on-surface-variant">
                  <MI name="undo" className="text-[16px]" /> Desfazer +{fmt(undo.ml)} ml
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {WATER_QUICK.map((ml, i) => (
                <button
                  key={ml}
                  ref={(n) => (quickRefs.current[i] = n)}
                  type="button"
                  onClick={() => add(ml)}
                  aria-keyshortcuts={String(i + 1)}
                  className="group relative flex h-16 flex-col items-center justify-center rounded-lg border border-outline-variant bg-surface-container-high transition hover:border-outline active:scale-[.97] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="text-lg font-semibold tabular-nums text-on-surface">+{ml}</span>
                  <span className="text-[11px] text-outline">ml</span>
                  <kbd className="absolute right-1.5 top-1.5 hidden rounded border border-outline-variant px-1 text-[10px] font-medium text-outline sm:block" aria-hidden="true">
                    {i + 1}
                  </kbd>
                </button>
              ))}
            </div>

            {customOpen ? (
              <form
                onSubmit={submitCustom}
                onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && !custom && closeCustom()}
                className="flex gap-2"
                noValidate
              >
                <Input
                  ref={customRef}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={WATER_ENTRY_MAX}
                  placeholder="Ex.: 250"
                  value={custom}
                  onChange={(e) => {
                    setCustom(e.target.value);
                    setCustomBad(false);
                  }}
                  onKeyDown={(e) => e.key === "Escape" && closeCustom()}
                  aria-label="Quantidade em ml"
                  aria-invalid={customBad || undefined}
                  className="tabular-nums"
                />
                <Button type="submit">Adicionar</Button>
              </form>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setCustomOpen(true)} aria-keyshortcuts="p">
                Personalizado
              </Button>
            )}
            <p className="hidden text-xs text-outline sm:block">Atalhos: 1, 2 e 3 registram · P abre o personalizado · Z desfaz o último</p>
          </div>
        </section>

        <div className="flex flex-col gap-6 lg:col-span-5">
          {/* semana */}
          <section className={`${card} p-5`} aria-labelledby="agua-semana">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 id="agua-semana" className="text-base font-semibold text-on-surface">
                Semana
              </h2>
              <span className="text-xs text-outline tabular-nums">
                {streak === 0 ? "Sem sequência ainda" : streak === 1 ? "1 dia de sequência" : `${streak} dias de sequência`}
              </span>
            </div>
            <ol className="grid grid-cols-7 gap-1">
              {week.map((d) => (
                <li
                  key={d.date}
                  className="flex flex-col items-center gap-1.5"
                  aria-label={`${d.name}: ${d.future ? "ainda não chegou" : d.met ? "meta cumprida" : `${Math.round(d.ratio * 100)}% da meta`}`}
                >
                  <span
                    className={`relative grid size-8 place-items-center overflow-hidden rounded-full border ${
                      d.met ? "border-primary-container bg-primary-container text-on-primary-container" : d.isToday ? "border-on-surface/40" : "border-outline-variant"
                    } ${d.future ? "opacity-40" : ""}`}
                    aria-hidden="true"
                  >
                    {/* a bolinha enche de baixo pra cima com o % do dia */}
                    {!d.met && d.ratio > 0 && (
                      <span className="absolute inset-x-0 bottom-0 bg-primary-container/45" style={{ height: `${Math.min(1, d.ratio) * 100}%` }} />
                    )}
                    {d.met && <MI name="check" className="relative text-[16px]" />}
                  </span>
                  <span className={`text-[11px] ${d.isToday ? "font-semibold text-on-surface" : "text-outline"}`} aria-hidden="true">
                    {d.letter}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* hoje */}
          <section className={`${card} p-5`} aria-labelledby="agua-hoje">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="agua-hoje" className="text-base font-semibold text-on-surface">
                Hoje
              </h2>
              {entries.length > 0 && (
                <span className="text-xs text-outline tabular-nums">
                  {entries.length} {entries.length === 1 ? "registro" : "registros"}
                </span>
              )}
            </div>
            {entries.length ? (
              <ol className="max-h-80 divide-y divide-outline-variant overflow-y-auto ff-scroll">
                {/* mais recente primeiro: o último registro fica sempre à vista */}
                {entries
                  .slice()
                  .reverse()
                  .map((e) => {
                    const t = timeFmt.format(new Date(e.time));
                    return (
                      <li key={e.id} className={`flex items-center gap-3 py-2.5 ${e.id === newId ? "toast-in" : ""}`}>
                        <span className="size-2 shrink-0 rounded-full bg-primary-container" aria-hidden="true" />
                        <time dateTime={new Date(e.time).toISOString()} className="w-12 text-sm text-outline tabular-nums">
                          {t}
                        </time>
                        <span className="flex-1 text-sm font-medium text-on-surface tabular-nums">{fmt(e.ml)} ml</span>
                        <Button variant="ghost" size="icon-sm" onClick={() => remove(e.id)} aria-label={`Apagar registro de ${fmt(e.ml)} ml às ${t}`} className="text-outline hover:text-error">
                          <MI name="delete" className="text-[18px]" />
                        </Button>
                      </li>
                    );
                  })}
              </ol>
            ) : (
              <p className="py-6 text-center text-sm text-on-surface-variant">Nada registrado ainda. O primeiro copo é o mais fácil.</p>
            )}
          </section>
        </div>
      </div>

      <GoalDialog
        open={goalOpen}
        onOpenChange={setGoalOpen}
        goal={goal}
        reminder={state.settings.waterReminder || 0}
        onSave={(ml, rem) => {
          setState((prev) => {
            const next = setWaterGoal(prev, ml);
            return { ...next, settings: { ...next.settings, waterReminder: rem } };
          });
          setGoalOpen(false);
        }}
      />
    </div>
  );
}
