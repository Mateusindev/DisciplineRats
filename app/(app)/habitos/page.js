"use client";

import { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, inputCls } from "@/components/ui";
import {
  getDateStr,
  habitStreak,
  habitWeekdays,
  habitIsScheduled,
  habitScheduleLabel,
  DOW_SHORT,
  HABIT_ICONS,
  HABIT_PRIORITIES,
  habitPriority,
  QUIT_MILESTONES,
  WEEKLY_BONUS,
  award,
  cleanDays,
  bestCleanRun,
  lastRelapse,
  relapsesInWindow,
  computeDueMilestones,
  computeDueWeeklyBonus,
  weekCount,
  shiftDate,
  toggleHabitState,
} from "@/lib/state";

// dias da semana do hábito (0=Seg..6=Dom). Nada marcado = todo dia.
function DowPicker({ value, onChange }) {
  const sel = new Set(value || []);
  const toggle = (d) => {
    const next = new Set(sel);
    next.has(d) ? next.delete(d) : next.add(d);
    onChange([...next].sort((a, b) => a - b));
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1">
        {DOW_SHORT.map((label, d) => {
          const on = sel.has(d);
          return (
            <button
              key={d}
              onClick={() => toggle(d)}
              aria-pressed={on}
              aria-label={label}
              className={`w-9 h-7 rounded font-label-caps text-[10px] border transition ${
                on ? "bg-primary-container text-on-primary-container border-primary-container" : "border-white/10 text-outline hover:border-white/25"
              }`}
            >
              {label.slice(0, 1)}
              {label.slice(1, 3).toLowerCase()}
            </button>
          );
        })}
      </div>
      {sel.size === 0 ? (
        <Caps className="text-outline text-[10px]">TODO DIA</Caps>
      ) : (
        <button onClick={() => onChange([])} className="font-label-caps text-[10px] text-outline hover:text-primary transition">
          TODO DIA
        </button>
      )}
    </div>
  );
}

// chips de prioridade (form e card)
function PriorityChips({ value, onChange, size = "text-[10px]" }) {
  return (
    <div className="flex gap-1">
      {HABIT_PRIORITIES.map((p) => (
        <button
          key={p.v}
          onClick={() => onChange(p.v)}
          aria-label={`Prioridade ${p.label}`}
          className={`px-2 py-1 rounded-full font-label-caps ${size} border transition ${
            value === p.v
              ? p.v === 3
                ? "bg-primary-container text-on-primary-container border-primary-container"
                : "bg-surface-variant text-on-surface border-surface-variant"
              : "border-white/10 text-outline hover:border-white/25"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ---- header comum do card (ícone + editar/excluir + nome) ----
// Componentes em escopo de módulo (não aninhados na página): identidade estável
// entre renders, então os inputs de edição não remontam a cada tecla (evita o
// foco pular pro título ao digitar os detalhes).
function CardHeader({ h, i, ctx }) {
  const { edits, editDetails, setEdits, setEditDetails, pickingIcon, setPickingIcon, setIcon, saveEdit, cancelEdit, startEdit, removeHabit, setPriority } = ctx;
  const editing = edits[h.id] !== undefined;
  const picking = pickingIcon === h.id;
  return (
    <>
      <div className="flex items-start justify-between mb-3">
        <button
          onClick={() => setPickingIcon(picking ? null : h.id)}
          aria-label="Escolher ícone"
          title="Escolher ícone"
          className={`w-12 h-12 rounded flex items-center justify-center active:scale-95 transition ${
            (h.kind || "build") === "quit"
              ? "bg-error/10 text-error hover:bg-error/20"
              : "bg-primary-container/20 text-primary-container hover:bg-primary-container/30"
          }`}
        >
          <MI name={h.icon || HABIT_ICONS[i % HABIT_ICONS.length]} className="text-3xl" />
        </button>
        {picking && <div className="fixed inset-0 z-20" onClick={() => setPickingIcon(null)} />}
        {picking && (
          <div className="absolute left-4 top-20 z-30 bg-surface-container-highest rounded-xl border border-white/10 shadow-2xl shadow-black/60 p-3 grid grid-cols-6 gap-1 w-64 animate-[fadeIn_.1s_ease-out]">
            {HABIT_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(h.id, ic)}
                aria-label={ic}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
                  (h.icon || HABIT_ICONS[i % HABIT_ICONS.length]) === ic
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:bg-surface-variant/60"
                }`}
              >
                <MI name={ic} className="text-xl" />
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={() => saveEdit(h.id)} aria-label="Salvar" className="text-outline hover:text-primary-container transition">
                <MI name="check" className="text-xl" />
              </button>
              <button onClick={() => cancelEdit(h.id)} aria-label="Cancelar" className="text-outline hover:text-on-surface transition">
                <MI name="close" className="text-xl" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => startEdit(h)} aria-label="Editar" className="text-outline hover:text-primary-container transition">
                <MI name="edit" className="text-xl" />
              </button>
              <button onClick={() => removeHabit(h.id)} aria-label="Remover" className="text-outline hover:text-error transition">
                <MI name="delete" className="text-xl" />
              </button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <>
          <input
            value={edits[h.id]}
            onChange={(e) => setEdits((es) => ({ ...es, [h.id]: e.target.value }))}
            onKeyDown={(e) => (e.key === "Enter" ? saveEdit(h.id) : e.key === "Escape" ? cancelEdit(h.id) : null)}
            autoFocus
            aria-label="Nome do hábito"
            className={`${inputCls} w-full mb-2`}
          />
          <textarea
            value={editDetails[h.id] || ""}
            onChange={(e) => setEditDetails((es) => ({ ...es, [h.id]: e.target.value }))}
            onKeyDown={(e) => (e.key === "Escape" ? cancelEdit(h.id) : null)}
            rows={3}
            maxLength={500}
            placeholder="Detalhes, motivação, como executar..."
            aria-label="Detalhes do hábito"
            className={`${inputCls} w-full mb-2 resize-y`}
          />
        </>
      ) : (
        <h4 className="font-headline-md text-headline-md mb-2">{h.name}</h4>
      )}
      {!editing && h.detail && (
        <p className="text-[12px] text-on-surface-variant whitespace-pre-wrap mb-2">{h.detail}</p>
      )}
      <div className="mb-3">
        <PriorityChips value={h.priority || 2} onChange={(v) => setPriority(h.id, v)} />
      </div>
    </>
  );
}

function BuildCard({ h, i, ctx }) {
  const { today, toggleHabit, setWeekdays } = ctx;
  const done = h.doneDates.includes(today);
  const streak = habitStreak(h);
  const prio = habitPriority(h);
  const sched = habitScheduleLabel(h); // null = todo dia
  const dueToday = habitIsScheduled(h, today);
  const editing = ctx.edits[h.id] !== undefined;
  return (
    <div className="glass-card p-6 rounded-xl relative">
      <CardHeader h={h} i={i} ctx={ctx} />

      {editing ? (
        <div className="mb-3">
          <Caps className="text-outline text-[10px] mb-1.5 block">DIAS DA SEMANA</Caps>
          <DowPicker value={habitWeekdays(h)} onChange={(wd) => setWeekdays(h.id, wd)} />
        </div>
      ) : (
        sched && (
          <Caps className="text-outline-variant text-[10px] mb-2 flex items-center gap-1">
            <MI name="event_repeat" className="text-sm" /> {sched}
          </Caps>
        )
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 text-outline-variant font-label-caps text-[10px]">
          <MI name="local_fire_department" className={`text-sm ${streak > 0 ? "text-primary-container" : ""}`} />
          {streak} {sched ? "EM SEQUÊNCIA" : "DIAS"}
        </div>
        <Caps className={`text-[10px] ${dueToday ? "text-outline" : "text-primary-container"}`}>
          {dueToday ? `+${prio.xp} XP/DIA` : "DESCANSO HOJE"}
        </Caps>
      </div>

      <button
        onClick={() => toggleHabit(h.id)}
        className={`w-full py-2 font-label-caps text-[10px] rounded transition-colors ${
          done
            ? "bg-primary-container text-on-primary-container"
            : dueToday
            ? "border border-primary text-primary hover:bg-primary/10"
            : "border border-white/10 text-outline hover:border-white/25"
        }`}
      >
        {done ? "CONCLUÍDO HOJE" : dueToday ? "MARCAR AGORA" : "MARCAR EXTRA"}
      </button>
    </div>
  );
}

function WeeklyCard({ h, i, ctx }) {
  const { today, toggleHabit } = ctx;
  const target = h.weeklyTarget || 3;
  const dir = h.direction || "min";
  const count = weekCount(h);
  const done = h.doneDates.includes(today);
  const prio = habitPriority(h);
  const bonus = Math.round(WEEKLY_BONUS[dir] * prio.mult);
  const pct = Math.min(100, Math.round((count / Math.max(1, target)) * 100));
  const over = dir === "max" && count > target;
  const hit = dir === "min" && count >= target;
  return (
    <div className="glass-card p-6 rounded-xl relative border-l-4 border-l-primary-container/40">
      <CardHeader h={h} i={i} ctx={ctx} />
      <div className="flex items-end justify-between mb-1">
        <Caps className="text-outline text-[10px]">
          {dir === "min" ? "PELO MENOS" : "NO MÁXIMO"} {target}×/SEMANA
        </Caps>
        <span className={`font-headline-md text-headline-md ${over ? "text-error" : hit ? "text-primary-container" : "text-on-surface"}`}>
          {count}/{target}
        </span>
      </div>
      <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full ${over ? "bg-error" : "bg-primary-container"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between items-center mb-4">
        <Caps className={`text-[10px] ${over ? "text-error" : hit ? "text-primary-container" : "text-outline-variant"}`}>
          {dir === "min" ? (hit ? "META BATIDA ✓" : `FALTAM ${target - count}`) : over ? "LIMITE ESTOURADO" : `RESTAM ${target - count}`}
        </Caps>
        <Caps className="text-outline text-[10px]">+{bonus} XP/SEMANA NA META</Caps>
      </div>
      <button
        onClick={() => toggleHabit(h.id)}
        className={`w-full py-2 font-label-caps text-[10px] rounded transition-colors ${
          dir === "min"
            ? done
              ? "bg-primary-container text-on-primary-container"
              : "border border-primary text-primary hover:bg-primary/10"
            : done
              ? "bg-error/15 text-error border border-error/40"
              : "border border-error/40 text-error hover:bg-error/10"
        }`}
      >
        {dir === "min" ? (done ? "PRATICADO HOJE ✓" : "PRATIQUEI HOJE") : done ? "CONSUMIDO HOJE · DESFAZER" : "CONSUMI HOJE"}
      </button>
    </div>
  );
}

function QuitCard({ h, i, ctx }) {
  const { today, logRelapse, undoRelapse } = ctx;
  const clean = cleanDays(h);
  const best = bestCleanRun(h);
  const relapsedToday = h.doneDates.includes(today);
  const last30 = relapsesInWindow(h.doneDates, shiftDate(today, -29), today);
  const prev30 = relapsesInWindow(h.doneDates, shiftDate(today, -59), shiftDate(today, -30));
  const trend = prev30 > 0 ? last30 - prev30 : null;
  const next = QUIT_MILESTONES.find((m) => m.days > clean);
  const prio = habitPriority(h);
  return (
    <div className="glass-card p-6 rounded-xl relative border-l-4 border-l-error/40">
      <CardHeader h={h} i={i} ctx={ctx} />
      <div className="text-center my-3">
        <div className="font-display-timer text-[44px] leading-none text-primary tabular-nums">{clean}</div>
        <Caps className="text-outline">{clean === 1 ? "DIA LIMPO" : "DIAS LIMPO"}</Caps>
      </div>
      <div className="flex justify-between items-center mb-1 text-[11px]">
        <Caps className="text-outline-variant text-[10px]">RECORDE: {best} {best === 1 ? "DIA" : "DIAS"}</Caps>
        {next && (
          <Caps className="text-outline text-[10px]">
            PRÓX. MARCO: {next.days}D (+{Math.round(next.xp * prio.mult)} XP)
          </Caps>
        )}
      </div>
      <div className="flex justify-between items-center mb-4 text-[11px]">
        <Caps className="text-outline-variant text-[10px]">30D: {last30} RECAÍDA(S)</Caps>
        {trend !== null && (
          <Caps className={`text-[10px] ${trend <= 0 ? "text-primary-container" : "text-error"}`}>
            {trend <= 0 ? "▼" : "▲"} {Math.abs(trend)} VS 30D ANTERIORES
          </Caps>
        )}
      </div>
      {relapsedToday ? (
        <div className="flex gap-2">
          <div className="flex-1 py-2 text-center font-label-caps text-[10px] rounded bg-error/15 text-error">RECAÍDA HOJE</div>
          <button
            onClick={() => undoRelapse(h.id)}
            className="px-3 py-2 rounded font-label-caps text-[10px] border border-white/15 text-on-surface-variant hover:border-white/30 transition"
          >
            DESFAZER
          </button>
        </div>
      ) : (
        <button
          onClick={() => logRelapse(h)}
          className="w-full py-2 font-label-caps text-[10px] rounded border border-error/40 text-error hover:bg-error/10 transition-colors"
        >
          RECAÍ HOJE
        </button>
      )}
    </div>
  );
}

export default function HabitosPage() {
  const { state, setState, confirm, toast } = useApp();
  const [newHabit, setNewHabit] = useState("");
  const [newKind, setNewKind] = useState("build"); // build | weekly | quit
  const [newPriority, setNewPriority] = useState(2);
  const [newDirection, setNewDirection] = useState("min"); // weekly: min | max
  const [newTarget, setNewTarget] = useState(3); // weekly: dias/semana
  const [newWeekdays, setNewWeekdays] = useState([]); // build: [] = todo dia
  const [edits, setEdits] = useState({}); // { [id]: nome em edição }
  const [editDetails, setEditDetails] = useState({}); // { [id]: detalhe em edição }
  const [pickingIcon, setPickingIcon] = useState(null); // id do hábito com picker aberto
  const today = getDateStr(0);

  // ===== recompensas pendentes: marcos de dias limpos (quit) + bônus de semana na meta (weekly) =====
  useEffect(() => {
    const dues = (state.habits || [])
      .map((h) => {
        const quit = computeDueMilestones(h);
        const weekly = computeDueWeeklyBonus(h);
        return quit || weekly ? { name: h.name, quit, weekly } : null;
      })
      .filter(Boolean);
    if (!dues.length) return;
    setState((prev) => {
      // recomputa sobre prev: idempotente — se já concedido, retorna prev por identidade
      let gained = 0;
      const habits = (prev.habits || []).map((h) => {
        const quit = computeDueMilestones(h);
        const weekly = computeDueWeeklyBonus(h);
        if (!quit && !weekly) return h;
        const milestones = { ...(h.milestones || {}) };
        if (quit) {
          gained += quit.xp;
          milestones[quit.key] = [...(milestones[quit.key] || []), ...quit.newDays];
        }
        if (weekly) {
          gained += weekly.xp;
          for (const k of weekly.keys) milestones[k] = true;
        }
        return { ...h, milestones };
      });
      if (!gained) return prev;
      return { ...prev, habits, stats: { ...prev.stats, xp: (prev.stats.xp || 0) + gained } };
    });
    const totalXp = dues.reduce((s, x) => s + (x.quit?.xp || 0) + (x.weekly?.xp || 0), 0);
    const notes = dues.map((x) => {
      const parts = [];
      if (x.quit) parts.push(x.quit.newDays.map((d) => `${d}d limpo`).join(", "));
      if (x.weekly) parts.push(`${x.weekly.keys.length} semana(s) na meta`);
      return `${x.name}: ${parts.join(" · ")}`;
    });
    toast("Recompensa de hábitos!", { sub: `${notes.join(" · ")} · +${totalXp} XP`, icon: "military_tech", duration: 5000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.habits]);

  function addHabit() {
    const name = newHabit.trim();
    if (!name) return;
    setState((prev) => ({
      ...prev,
      habits: [
        ...prev.habits,
        {
          id: crypto.randomUUID(),
          name,
          icon: newKind === "quit" ? "block" : newKind === "weekly" ? "event_repeat" : HABIT_ICONS[prev.habits.length % HABIT_ICONS.length],
          kind: newKind,
          priority: newPriority,
          direction: newKind === "weekly" ? newDirection : null,
          weeklyTarget: newKind === "weekly" ? newTarget : null,
          weekdays: newKind === "build" ? newWeekdays : [], // só faz sentido no diário
          detail: "",
          createdAt: new Date().toISOString(),
          doneDates: [],
          checkXp: {},
          milestones: {},
        },
      ],
    }));
    setNewHabit("");
    setNewWeekdays([]);
  }

  function setWeekdays(id, weekdays) {
    setState((prev) => ({ ...prev, habits: prev.habits.map((h) => (h.id === id ? { ...h, weekdays } : h)) }));
  }

  function setIcon(id, icon) {
    setState((prev) => ({ ...prev, habits: prev.habits.map((h) => (h.id === id ? { ...h, icon } : h)) }));
    setPickingIcon(null);
  }
  function setPriority(id, priority) {
    setState((prev) => ({ ...prev, habits: prev.habits.map((h) => (h.id === id ? { ...h, priority } : h)) }));
  }

  // ===== build/weekly: check concede XP por prioridade (weekly-max não premia — marcar = consumir) =====
  function toggleHabit(id) {
    setState((prev) => toggleHabitState(prev, id, today));
  }

  // ===== quit: registrar/desfazer recaída =====
  async function logRelapse(h) {
    if (h.doneDates.includes(today)) return;
    const ok = await confirm({
      title: `Registrar recaída em "${h.name}"?`,
      body: "Zera a contagem de dias limpo. Sem julgamento — recomeça agora.",
      confirmLabel: "RECAÍ HOJE",
    });
    if (!ok) return;
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((x) => (x.id === h.id ? { ...x, doneDates: [...x.doneDates, today] } : x)),
    }));
  }
  function undoRelapse(id) {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((x) => (x.id === id ? { ...x, doneDates: x.doneDates.filter((d) => d !== today) } : x)),
    }));
  }

  async function removeHabit(id) {
    const h = state.habits.find((x) => x.id === id);
    const ok = await confirm({ title: "Excluir hábito?", body: `"${h?.name || ""}" e todo o histórico dele serão apagados.`, confirmLabel: "EXCLUIR" });
    if (!ok) return;
    setState((prev) => ({ ...prev, habits: prev.habits.filter((h) => h.id !== id) }));
  }

  const startEdit = (h) => {
    setEdits((e) => ({ ...e, [h.id]: h.name }));
    setEditDetails((e) => ({ ...e, [h.id]: h.detail || "" }));
  };
  const cancelEdit = (id) => {
    setEdits((e) => {
      const { [id]: _, ...rest } = e;
      return rest;
    });
    setEditDetails((e) => {
      const { [id]: _, ...rest } = e;
      return rest;
    });
  };
  function saveEdit(id) {
    const name = (edits[id] || "").trim();
    if (!name) return;
    const detail = (editDetails[id] || "").trim().slice(0, 500);
    setState((prev) => ({ ...prev, habits: prev.habits.map((h) => (h.id === id ? { ...h, name: name.slice(0, 80), detail } : h)) }));
    cancelEdit(id);
  }

  // handlers/estado compartilhados com os cards (identidade estável evita remount dos inputs)
  const ctx = {
    edits,
    editDetails,
    setEdits,
    setEditDetails,
    setWeekdays,
    pickingIcon,
    setPickingIcon,
    setIcon,
    saveEdit,
    cancelEdit,
    startEdit,
    removeHabit,
    setPriority,
    today,
    toggleHabit,
    logRelapse,
    undoRelapse,
  };

  const buildHabits = state.habits.filter((h) => (h.kind || "build") === "build");
  const weeklyHabits = state.habits.filter((h) => (h.kind || "build") === "weekly");
  const quitHabits = state.habits.filter((h) => (h.kind || "build") === "quit");
  const groupCount = [buildHabits, weeklyHabits, quitHabits].filter((g) => g.length > 0).length;

  return (
    <>
      <PageHeader title="HÁBITOS" subtitle="Construa os bons, largue os ruins. Prioridade alta vale mais XP. Hábito diário não feito tira metade." />

      {/* form de criação */}
      <div className="glass-card p-6 rounded-xl mb-gutter space-y-3">
        <div className="flex gap-2">
          <input
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHabit()}
            placeholder={newKind === "quit" ? "Ex: fumar, açúcar, redes sociais..." : "Ex: beber 2L de água, meditar, ler 10 páginas..."}
            className={`${inputCls} flex-1`}
          />
          <button onClick={addHabit} aria-label="Adicionar hábito" className="px-4 rounded-lg bg-primary-container text-on-primary-container flex items-center active:scale-95 transition">
            <MI name="add" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              onClick={() => setNewKind("build")}
              className={`px-3 py-1.5 font-label-caps text-[10px] flex items-center gap-1.5 transition ${
                newKind === "build" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
              }`}
            >
              <MI name="trending_up" className="text-sm" /> DIÁRIO
            </button>
            <button
              onClick={() => setNewKind("weekly")}
              className={`px-3 py-1.5 font-label-caps text-[10px] flex items-center gap-1.5 transition ${
                newKind === "weekly" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
              }`}
            >
              <MI name="event_repeat" className="text-sm" /> META SEMANAL
            </button>
            <button
              onClick={() => setNewKind("quit")}
              className={`px-3 py-1.5 font-label-caps text-[10px] flex items-center gap-1.5 transition ${
                newKind === "quit" ? "bg-error text-on-error" : "text-on-surface-variant hover:bg-surface-variant/40"
              }`}
            >
              <MI name="block" className="text-sm" /> LARGAR
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Caps className="text-outline text-[10px]">PRIORIDADE</Caps>
            <PriorityChips value={newPriority} onChange={setNewPriority} />
          </div>
        </div>
        {newKind === "build" && (
          <div>
            <Caps className="text-outline text-[10px] mb-1.5 block">EM QUAIS DIAS? (VAZIO = TODO DIA)</Caps>
            <DowPicker value={newWeekdays} onChange={setNewWeekdays} />
            <p className="text-[11px] text-outline mt-1.5">
              Dia fora da agenda não cobra XP nem quebra a sequência — treino de seg/qua/sex não paga por domingo.
            </p>
          </div>
        )}
        {newKind === "weekly" && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              <button
                onClick={() => setNewDirection("min")}
                className={`px-3 py-1.5 font-label-caps text-[10px] transition ${
                  newDirection === "min" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
                }`}
              >
                PELO MENOS
              </button>
              <button
                onClick={() => setNewDirection("max")}
                className={`px-3 py-1.5 font-label-caps text-[10px] transition ${
                  newDirection === "max" ? "bg-error text-on-error" : "text-on-surface-variant hover:bg-surface-variant/40"
                }`}
              >
                NO MÁXIMO
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setNewTarget((t) => Math.max(1, t - 1))} aria-label="Diminuir dias" className="w-7 h-7 rounded-full bg-surface-variant text-on-surface flex items-center justify-center hover:brightness-125 active:scale-95 transition">−</button>
              <Caps className="text-primary w-24 text-center">{newTarget}×/SEMANA</Caps>
              <button onClick={() => setNewTarget((t) => Math.min(7, t + 1))} aria-label="Aumentar dias" className="w-7 h-7 rounded-full bg-surface-variant text-on-surface flex items-center justify-center hover:brightness-125 active:scale-95 transition">+</button>
            </div>
          </div>
        )}
        <p className="text-[11px] text-outline">
          {newKind === "quit"
            ? "Vício: registre só as recaídas. Dias limpo rendem XP em marcos (3, 7, 14, 30, 60, 90 dias)."
            : newKind === "weekly"
              ? newDirection === "min"
                ? `Praticar ${newTarget}×/semana: cada dia marcado rende XP pela prioridade + bônus ao fechar a semana na meta.`
                : `Moderar: no máx ${newTarget} dia(s) de consumo por semana. Marcar não dá XP — fechar a semana dentro do limite dá bônus.`
              : `Hábito diário: marcar rende XP pela prioridade (${HABIT_PRIORITIES.map((p) => `${p.label.toLowerCase()} +${p.xp}`).join(" · ")}).`}
        </p>
      </div>

      {state.habits.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center text-on-surface-variant">Nenhum hábito cadastrado ainda.</div>
      ) : (
        <div className="space-y-8">
          {buildHabits.length > 0 && (
            <section>
              {groupCount > 1 && (
                <div className="flex items-center gap-2 mb-4">
                  <MI name="trending_up" className="text-primary-container" />
                  <h3 className="font-headline-md text-headline-md text-primary uppercase">Construindo</h3>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
                {buildHabits.map((h, i) => (
                  <BuildCard key={h.id} h={h} i={i} ctx={ctx} />
                ))}
              </div>
            </section>
          )}
          {weeklyHabits.length > 0 && (
            <section>
              {groupCount > 1 && (
                <div className="flex items-center gap-2 mb-4">
                  <MI name="event_repeat" className="text-primary-container" />
                  <h3 className="font-headline-md text-headline-md text-primary uppercase">Metas da Semana</h3>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
                {weeklyHabits.map((h, i) => (
                  <WeeklyCard key={h.id} h={h} i={i} ctx={ctx} />
                ))}
              </div>
            </section>
          )}
          {quitHabits.length > 0 && (
            <section>
              {groupCount > 1 && (
                <div className="flex items-center gap-2 mb-4">
                  <MI name="block" className="text-error" />
                  <h3 className="font-headline-md text-headline-md text-primary uppercase">Largando</h3>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
                {quitHabits.map((h, i) => (
                  <QuitCard key={h.id} h={h} i={i} ctx={ctx} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
