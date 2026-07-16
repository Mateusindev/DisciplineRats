"use client";

import { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, inputCls } from "@/components/ui";
import { XP, award, getDateStr, computeRoutinePenalty } from "@/lib/state";

// dias da semana, ordem seg→dom (valor = getDay() do JS: 0 = domingo)
const DOWS = [
  { v: 1, l: "SEG" },
  { v: 2, l: "TER" },
  { v: 3, l: "QUA" },
  { v: 4, l: "QUI" },
  { v: 5, l: "SEX" },
  { v: 6, l: "SÁB" },
  { v: 0, l: "DOM" },
];
const ALL_DAYS = DOWS.map((d) => d.v);
// item antigo sem days = vale todo dia
const itemDays = (it) => (Array.isArray(it.days) && it.days.length ? it.days : ALL_DAYS);

// ordena por horário; sem horário vai pro fim (ordem de criação)
function sortItems(items) {
  return [...items].sort((a, b) => {
    const ta = a.time || "99:99";
    const tb = b.time || "99:99";
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

// chips S/T/Q... multi-select de dias
function DayChips({ value, onChange, size = "w-8 h-8" }) {
  const toggle = (v) => {
    const has = value.includes(v);
    const next = has ? value.filter((x) => x !== v) : [...value, v];
    if (next.length === 0) return; // pelo menos 1 dia
    onChange(next);
  };
  return (
    <div className="flex gap-1">
      {DOWS.map((d) => {
        const on = value.includes(d.v);
        return (
          <button
            key={d.v}
            onClick={() => toggle(d.v)}
            aria-pressed={on}
            aria-label={d.l}
            className={`${size} rounded-full font-label-caps text-[9px] flex items-center justify-center border transition ${
              on ? "bg-primary-container text-on-primary-container border-primary-container" : "border-white/15 text-outline hover:border-white/30"
            }`}
          >
            {d.l[0]}
          </button>
        );
      })}
    </div>
  );
}

export default function RotinaPage() {
  const { state, setState, toast, confirm } = useApp();
  const today = getDateStr(0);
  const todayDow = new Date(today + "T00:00:00").getDay();
  const [activeDow, setActiveDow] = useState(todayDow);
  const isToday = activeDow === todayDow;

  const routine = state.routine || { items: [], bonusDate: null };
  const items = routine.items || [];
  const dayChecks = (state.routineChecks || {})[today] || {};

  const itemsFor = (dow) => items.filter((it) => itemDays(it).includes(dow));
  const todayItems = itemsFor(todayDow);
  const viewItems = sortItems(itemsFor(activeDow));

  const doneCount = todayItems.filter((it) => dayChecks[it.id] !== undefined).length;
  const allDone = todayItems.length > 0 && doneCount === todayItems.length;
  const pct = todayItems.length ? Math.round((doneCount / todayItems.length) * 100) : 0;

  const [newName, setNewName] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newDays, setNewDays] = useState(ALL_DAYS);
  const [newCritical, setNewCritical] = useState(false);
  const [edits, setEdits] = useState({}); // { [id]: {name, time, days, critical} }

  // ===== penalidade: inegociável não feito em dia fechado custa XP =====
  useEffect(() => {
    const due = computeRoutinePenalty(state.routine, state.routineChecks);
    if (!due) return;
    setState((prev) => {
      // recomputa sobre prev: idempotente — penaltyDate avança e re-run vira null
      const d2 = computeRoutinePenalty(prev.routine, prev.routineChecks);
      if (!d2) return prev;
      const r = prev.routine || {};
      return {
        ...prev,
        routine: { ...r, penaltyDate: d2.lastEvaluated },
        stats: d2.xp ? { ...prev.stats, xp: Math.max(0, (prev.stats.xp || 0) - d2.xp) } : prev.stats,
      };
    });
    if (due.xp > 0) {
      const names = [...new Set(due.missed.map((m) => m.name))].join(", ").slice(0, 90);
      toast("Inegociável perdido!", { sub: `${names} · −${due.xp} XP`, type: "error", icon: "local_fire_department", duration: 6000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.routine, state.routineChecks]);

  function addItem() {
    const name = newName.trim();
    if (!name) return;
    setState((prev) => {
      const r = prev.routine || { items: [], bonusDate: null };
      return {
        ...prev,
        routine: {
          ...r,
          items: [...(r.items || []), { id: Date.now(), name: name.slice(0, 80), time: newTime || "", days: [...newDays].sort(), critical: newCritical }],
        },
      };
    });
    setNewName("");
    setNewTime("");
  }

  async function removeItem(id) {
    const it = items.find((x) => x.id === id);
    const ok = await confirm({ title: "Excluir da rotina?", body: `"${it?.name || ""}" sai da rotina (histórico de dias anteriores permanece).`, confirmLabel: "EXCLUIR" });
    if (!ok) return;
    setState((prev) => {
      const r = prev.routine || { items: [] };
      return { ...prev, routine: { ...r, items: (r.items || []).filter((x) => x.id !== id) } };
    });
  }

  const startEdit = (it) => setEdits((e) => ({ ...e, [it.id]: { name: it.name, time: it.time || "", days: itemDays(it), critical: !!it.critical } }));
  const cancelEdit = (id) =>
    setEdits((e) => {
      const { [id]: _, ...rest } = e;
      return rest;
    });
  function saveEdit(id) {
    const f = edits[id];
    const name = (f?.name || "").trim();
    if (!name) return;
    setState((prev) => {
      const r = prev.routine || { items: [] };
      return {
        ...prev,
        routine: {
          ...r,
          items: (r.items || []).map((x) => (x.id === id ? { ...x, name: name.slice(0, 80), time: f.time || "", days: [...f.days].sort(), critical: !!f.critical } : x)),
        },
      };
    });
    cancelEdit(id);
  }

  function toggleItem(id) {
    if (!isToday) return; // check só no dia atual
    // bônus previsto fora do updater (updater puro; toast depois)
    const willComplete =
      dayChecks[id] === undefined &&
      todayItems.length > 0 &&
      todayItems.every((it) => it.id === id || dayChecks[it.id] !== undefined) &&
      routine.bonusDate !== today;
    setState((prev) => {
      const r = prev.routine || { items: [], bonusDate: null };
      const checks = { ...(prev.routineChecks || {}) };
      const day = { ...(checks[today] || {}) };
      let stats = prev.stats;
      let nextRoutine = r;
      if (day[id] !== undefined) {
        // desmarca: estorna o valor gravado (bônus do dia completo não estorna — igual missões)
        stats = { ...stats, xp: Math.max(0, (stats.xp || 0) - (day[id] || 0)) };
        delete day[id];
      } else {
        const gain = award(XP.routineItem, stats.streak);
        day[id] = gain;
        stats = { ...stats, xp: (stats.xp || 0) + gain };
        const dueToday = (r.items || []).filter((it) => itemDays(it).includes(todayDow));
        const complete = dueToday.length > 0 && dueToday.every((it) => day[it.id] !== undefined);
        if (complete && r.bonusDate !== today) {
          stats = { ...stats, xp: stats.xp + award(XP.routineAllDone, prev.stats.streak) };
          nextRoutine = { ...r, bonusDate: today };
        }
      }
      checks[today] = day;
      return { ...prev, stats, routine: nextRoutine, routineChecks: checks };
    });
    if (willComplete) {
      toast("Rotina completa!", { sub: `DIA FECHADO · +${XP.routineAllDone} XP DE BÔNUS`, icon: "military_tech" });
    }
  }

  return (
    <>
      <PageHeader title="ROTINA" subtitle="Seu roteiro fixo por dia da semana. Monte uma vez, execute todo dia — cada check vale XP." />

      {/* progresso de HOJE (independente da aba) */}
      <div className="glass-card p-6 rounded-xl mb-gutter">
        <div className="flex items-center justify-between mb-2">
          <Caps className="text-primary">HOJE · {DOWS.find((d) => d.v === todayDow)?.l}</Caps>
          <Caps className={allDone ? "text-primary-container" : "text-on-surface-variant"}>
            {doneCount}/{todayItems.length} {allDone ? "· ROTINA COMPLETA ✓" : ""}
          </Caps>
        </div>
        <div className="w-full h-2.5 bg-surface-variant rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary-container transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-outline mt-2">
          +{XP.routineItem} XP por item · rotina do dia completa +{XP.routineAllDone} XP de bônus (1×/dia). Reseta todo dia.
        </p>
      </div>

      {/* abas seg→dom */}
      <div role="tablist" aria-label="Dias da semana" className="flex rounded-xl overflow-hidden border border-white/10 mb-gutter">
        {DOWS.map((d) => {
          const active = activeDow === d.v;
          const isTodayTab = d.v === todayDow;
          const count = itemsFor(d.v).length;
          return (
            <button
              key={d.v}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveDow(d.v)}
              className={`flex-1 py-2.5 font-label-caps text-[10px] flex flex-col items-center gap-0.5 transition ${
                active ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
              }`}
            >
              <span className="flex items-center gap-1">
                {d.l}
                {isTodayTab && <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-on-primary-container" : "bg-primary-container"}`} />}
              </span>
              <span className={`text-[9px] ${active ? "opacity-80" : "text-outline"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* adicionar item */}
      <div className="glass-card p-6 rounded-xl mb-gutter space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            aria-label="Horário (opcional)"
            className={`${inputCls} sm:w-32`}
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Ex: Acordar, banho gelado, ler 10 páginas, planejar o dia..."
            className={`${inputCls} flex-1`}
          />
          <button onClick={addItem} aria-label="Adicionar à rotina" className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center gap-1 active:scale-95 transition font-label-caps text-[11px]">
            <MI name="add" /> ADD
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Caps className="text-outline text-[10px]">DIAS</Caps>
          <DayChips value={newDays} onChange={setNewDays} />
          <button
            onClick={() => setNewDays(newDays.length === 7 ? [activeDow] : ALL_DAYS)}
            className="font-label-caps text-[9px] text-outline hover:text-primary transition"
          >
            {newDays.length === 7 ? "SÓ ESTE DIA" : "TODOS"}
          </button>
          <button
            onClick={() => setNewCritical((v) => !v)}
            aria-pressed={newCritical}
            className={`px-2.5 py-1 rounded-full font-label-caps text-[9px] border flex items-center gap-1 transition ${
              newCritical ? "bg-error text-on-error border-error" : "border-error/40 text-error hover:bg-error/10"
            }`}
          >
            <MI name="local_fire_department" className="text-xs" fill={newCritical} /> INEGOCIÁVEL
          </button>
        </div>
        {newCritical && (
          <p className="text-[11px] text-error/80">
            Inegociável: dia fechar sem esse check custa −{XP.routineCriticalPenalty} XP.
          </p>
        )}
      </div>

      {/* lista do dia ativo */}
      {!isToday && viewItems.length > 0 && (
        <p className="text-[11px] text-outline mb-2 flex items-center gap-1">
          <MI name="visibility" className="text-sm" /> Planejamento de {DOWS.find((d) => d.v === activeDow)?.l} — checks só no dia.
        </p>
      )}
      {viewItems.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center text-on-surface-variant">
          Nada em {DOWS.find((d) => d.v === activeDow)?.l}. Adicione acima e marque os dias.
        </div>
      ) : (
        <div className="space-y-2">
          {viewItems.map((it) => {
            const done = isToday && dayChecks[it.id] !== undefined;
            const editing = edits[it.id] !== undefined;
            if (editing) {
              const f = edits[it.id];
              return (
                <div key={it.id} className="glass-card rounded-xl p-3 space-y-2 border border-primary-container/30">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="time"
                      value={f.time}
                      onChange={(e) => setEdits((es) => ({ ...es, [it.id]: { ...f, time: e.target.value } }))}
                      aria-label="Horário"
                      className={`${inputCls} sm:w-32`}
                    />
                    <input
                      value={f.name}
                      onChange={(e) => setEdits((es) => ({ ...es, [it.id]: { ...f, name: e.target.value } }))}
                      onKeyDown={(e) => (e.key === "Enter" ? saveEdit(it.id) : e.key === "Escape" ? cancelEdit(it.id) : null)}
                      autoFocus
                      aria-label="Nome do item"
                      className={`${inputCls} flex-1`}
                    />
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => saveEdit(it.id)} aria-label="Salvar" className="px-3 rounded-lg bg-primary-container text-on-primary-container flex items-center active:scale-95 transition">
                        <MI name="check" />
                      </button>
                      <button onClick={() => cancelEdit(it.id)} aria-label="Cancelar" className="px-3 rounded-lg bg-surface-variant text-on-surface-variant flex items-center active:scale-95 transition">
                        <MI name="close" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Caps className="text-outline text-[10px]">DIAS</Caps>
                    <DayChips value={f.days} onChange={(days) => setEdits((es) => ({ ...es, [it.id]: { ...f, days } }))} size="w-7 h-7" />
                    <button
                      onClick={() => setEdits((es) => ({ ...es, [it.id]: { ...f, critical: !f.critical } }))}
                      aria-pressed={f.critical}
                      className={`px-2.5 py-1 rounded-full font-label-caps text-[9px] border flex items-center gap-1 transition ${
                        f.critical ? "bg-error text-on-error border-error" : "border-error/40 text-error hover:bg-error/10"
                      }`}
                    >
                      <MI name="local_fire_department" className="text-xs" fill={f.critical} /> INEGOCIÁVEL
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={it.id}
                className={`glass-card rounded-xl p-3 flex items-center gap-3 border transition-colors ${
                  done ? "border-primary-container/30 bg-primary/5" : it.critical ? "border-error/25" : "border-white/5"
                }`}
              >
                {isToday ? (
                  <button onClick={() => toggleItem(it.id)} aria-label={done ? "Desmarcar" : "Marcar feito"} className="shrink-0">
                    <MI
                      name={done ? "task_alt" : "radio_button_unchecked"}
                      fill={done}
                      className={`text-2xl ${done ? "text-primary-container" : "text-outline"}`}
                    />
                  </button>
                ) : (
                  <MI name="event" className="text-2xl text-outline-variant shrink-0" />
                )}
                <Caps className={`w-14 text-center shrink-0 ${it.time ? "text-primary" : "text-outline-variant"}`}>
                  {it.time || "—"}
                </Caps>
                <div className="flex-1 min-w-0">
                  <span className={`text-[14px] truncate flex items-center gap-1.5 ${done ? "line-through text-outline" : "text-on-surface font-bold"}`}>
                    {it.critical && <MI name="local_fire_department" fill className="text-error text-sm shrink-0" title="Inegociável" />}
                    {it.name}
                  </span>
                  {itemDays(it).length < 7 && (
                    <Caps className="text-outline-variant text-[8px]">
                      {DOWS.filter((d) => itemDays(it).includes(d.v)).map((d) => d.l).join(" · ")}
                    </Caps>
                  )}
                </div>
                {done && <Caps className="text-primary-container text-[9px] shrink-0">+{dayChecks[it.id]} XP</Caps>}
                <button onClick={() => startEdit(it)} aria-label="Editar item" className="text-outline hover:text-primary-container transition p-1 shrink-0">
                  <MI name="edit" className="text-lg" />
                </button>
                <button onClick={() => removeItem(it.id)} aria-label="Excluir item" className="text-outline hover:text-error transition p-1 shrink-0">
                  <MI name="delete" className="text-lg" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
