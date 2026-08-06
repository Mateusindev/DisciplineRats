"use client";

// ROTINA FIXA — o esqueleto do dia, separado de Hábitos de propósito.
//
// Hábito é o que você está construindo: tem prioridade, sequência e multa por dia
// perdido. Rotina é o que já deveria ser automático (remédio, alongar, arrumar a
// cama). Aqui não existe penalidade nem sequência própria — errar um dia é um dia,
// não uma recaída. O que existe é XP por item e um bônus por fechar o dia.
//
// A mesma lista aparece na Agenda, com hora, e pode ser marcada de lá: o reducer
// toggleRoutineCheck é o mesmo nos dois lugares.

import { useState } from "react";
import Link from "next/link";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, inputCls } from "@/components/ui";
import {
  DOW_SHORT,
  ROUTINE_BLOCKS,
  ROUTINE_BONUS_KEY,
  XP,
  getDateStr,
  shiftDate,
  routineBlockOf,
  routineItemsFor,
  routineDayStats,
  routineItemDone,
  routineHabit,
  habitPriority,
  toggleRoutineCheck,
  weekdayShort,
} from "@/lib/state";

const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// dias da semana em círculo (vazio = todo dia), igual ao form de hábitos
function DowMini({ value, onChange }) {
  const sel = new Set(value || []);
  const all = sel.size === 0;
  const toggle = (d) => {
    const next = new Set(sel);
    next.has(d) ? next.delete(d) : next.add(d);
    onChange([...next].sort((a, b) => a - b));
  };
  return (
    <div className="flex items-center gap-1">
      {DOW_SHORT.map((label, d) => {
        const on = sel.has(d);
        return (
          <button
            key={d}
            onClick={() => toggle(d)}
            aria-pressed={on}
            aria-label={label}
            title={all ? `${label} — incluído em todo dia` : label}
            className={`w-7 h-7 rounded-full font-label-caps text-[10px] border transition ${
              on
                ? "bg-primary-container text-on-primary-container border-primary-container"
                : all
                  ? "border-primary-container/40 text-primary-container/70 hover:border-primary-container"
                  : "border-white/10 text-outline hover:border-white/25"
            }`}
          >
            {label.slice(0, 1)}
          </button>
        );
      })}
      <button
        onClick={() => onChange([])}
        disabled={all}
        aria-pressed={all}
        title={all ? "Vale todo dia" : "Voltar pra todo dia"}
        className={`ml-1.5 px-2 h-7 rounded-full font-label-caps text-[9px] flex items-center gap-1 border transition ${
          all ? "bg-primary-container/15 text-primary-container border-primary-container/40" : "border-white/10 text-on-surface-variant hover:border-white/25"
        }`}
      >
        <MI name={all ? "done_all" : "restart_alt"} className="text-[13px]" />
        TODO DIA
      </button>
    </div>
  );
}

// Seleção do hábito vinculado. Vício fica de fora: lá se registra a recaída, não o
// acerto — "feito" não significa nada naquele fluxo.
function HabitSelect({ habits, value, onChange }) {
  return (
    <label className="flex items-center gap-1.5 min-w-[190px]">
      <MI name="link" className="text-outline text-base shrink-0" />
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label="Hábito vinculado"
        title="Marcar este item também marca o hábito escolhido"
        className={`${inputCls} flex-1 text-[12px] py-1.5`}
      >
        <option value="">sem vínculo com hábito</option>
        {habits.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function RotinaPage() {
  const { state, setState, toast, confirm } = useApp();
  const today = getDateStr(0);
  const [date, setDate] = useState(today); // dá pra fechar ontem sem inventar histórico
  const [form, setForm] = useState({ name: "", time: "", weekdays: [], habitId: null });
  const [edits, setEdits] = useState({}); // { [id]: {name,time,weekdays} }

  const linkable = (state.habits || []).filter((h) => (h.kind || "build") !== "quit");
  const items = routineItemsFor(state, date);
  const dayChecks = state.routineChecks?.[date] || {};
  const stats = routineDayStats(state, date);
  const bonus = dayChecks[ROUTINE_BONUS_KEY];
  const isToday = date === today;
  const minDate = shiftDate(today, -7);

  // últimos 7 dias: % de itens fechados por dia
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDate(today, -(6 - i));
    return { date: d, ...routineDayStats(state, d) };
  });

  function addItem() {
    const name = form.name.trim();
    if (!name) return toast("Informe o item", { type: "error" });
    const item = { id: crypto.randomUUID(), name: name.slice(0, 80), time: form.time || "", weekdays: form.weekdays, habitId: form.habitId || null };
    setState((prev) => ({ ...prev, routine: { ...(prev.routine || {}), items: [...(prev.routine?.items || []), item] } }));
    setForm({ name: "", time: "", weekdays: [], habitId: null });
  }

  async function removeItem(item) {
    const ok = await confirm({
      title: "Excluir da rotina?",
      body: `"${item.name}" sai da lista. As marcações passadas dele continuam no histórico, e o XP já ganho não é estornado.`,
      confirmLabel: "EXCLUIR",
    });
    if (!ok) return;
    setState((prev) => ({ ...prev, routine: { ...(prev.routine || {}), items: (prev.routine?.items || []).filter((i) => i.id !== item.id) } }));
  }

  const startEdit = (i) => setEdits((e) => ({ ...e, [i.id]: { name: i.name, time: i.time || "", weekdays: i.weekdays || [], habitId: i.habitId || null } }));
  const cancelEdit = (id) =>
    setEdits((e) => {
      const { [id]: _, ...rest } = e;
      return rest;
    });
  function saveEdit(id) {
    const f = edits[id];
    const name = (f?.name || "").trim();
    if (!name) return toast("Informe o item", { type: "error" });
    setState((prev) => ({
      ...prev,
      routine: {
        ...(prev.routine || {}),
        items: (prev.routine?.items || []).map((i) =>
          i.id === id ? { ...i, name: name.slice(0, 80), time: f.time || "", weekdays: f.weekdays || [], habitId: f.habitId || null } : i
        ),
      },
    }));
    cancelEdit(id);
  }

  const doneOf = (i) => routineItemDone(state, date, i);

  function toggle(item) {
    const wasDone = doneOf(item);
    setState((prev) => toggleRoutineCheck(prev, date, item.id));
    if (wasDone) return;
    // avisa quando este check fecha o dia (o reducer é quem decide de fato)
    const willComplete = items.length > 0 && items.every((i) => i.id === item.id || doneOf(i));
    if (willComplete) toast("Rotina do dia fechada!", { sub: `bônus +${XP.routineAll} XP`, icon: "task_alt" });
  }

  const blocks = ROUTINE_BLOCKS.map((b) => ({ ...b, list: items.filter((i) => routineBlockOf(i).id === b.id) })).filter((b) => b.list.length);

  return (
    <>
      <PageHeader
        title="ROTINA"
        subtitle="O esqueleto do dia: o que se repete sempre, com hora. Sem penalidade e sem sequência — errar um dia é um dia."
      />

      {/* ---- dia + progresso ---- */}
      <div className="glass-card px-4 py-3 md:px-6 md:py-4 rounded-xl mb-gutter flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setDate((d) => (d > minDate ? shiftDate(d, -1) : d))} aria-label="Dia anterior" className="w-8 h-8 rounded-full grid place-items-center text-on-surface-variant hover:bg-surface-variant/50 transition">
            <MI name="chevron_left" />
          </button>
          <div className="text-center min-w-[120px]">
            <Caps className={`text-[10px] block ${isToday ? "text-primary" : "text-outline"}`}>{isToday ? "HOJE" : weekdayShort(date).toUpperCase()}</Caps>
            <span className="text-[13px] text-on-surface tabular-nums">{ddmm(date)}</span>
          </div>
          <button onClick={() => setDate((d) => (d < today ? shiftDate(d, 1) : d))} aria-label="Próximo dia" className="w-8 h-8 rounded-full grid place-items-center text-on-surface-variant hover:bg-surface-variant/50 transition disabled:opacity-30" disabled={isToday}>
            <MI name="chevron_right" />
          </button>
        </div>

        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center justify-between mb-1">
            <Caps className="text-outline text-[10px]">
              {stats.done} DE {stats.total} FEITOS
            </Caps>
            {stats.complete && (
              <Caps className="text-primary text-[10px] flex items-center gap-1">
                <MI name="task_alt" className="text-[14px]" /> DIA FECHADO {bonus ? `· +${bonus} XP` : ""}
              </Caps>
            )}
          </div>
          <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${stats.complete ? "bg-primary" : "bg-primary-container"}`} style={{ width: `${stats.pct}%` }} />
          </div>
        </div>

        <Link href="/calendario" className="font-label-caps text-[10px] text-primary hover:underline flex items-center gap-1 shrink-0">
          VER NA AGENDA <MI name="arrow_forward" className="text-[14px]" />
        </Link>
      </div>

      {/* ---- itens do dia, por bloco ---- */}
      {items.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center text-on-surface-variant mb-gutter">
          {(state.routine?.items || []).length === 0
            ? "Rotina vazia. Cadastre o primeiro item aí embaixo — remédio, alongar, arrumar a cama."
            : "Nenhum item da rotina cai nesse dia da semana."}
        </div>
      ) : (
        <div className="space-y-4 mb-gutter">
          {blocks.map((b) => (
            <section key={b.id}>
              <div className="flex items-center gap-2 mb-2">
                <MI name={b.icon} className="text-outline text-lg" />
                <Caps className="text-on-surface-variant text-[10px]">{b.label.toUpperCase()}</Caps>
                <span className="h-px flex-1 bg-white/5" />
              </div>
              <div className="space-y-2">
                {b.list.map((i) => {
                  const done = doneOf(i);
                  const linked = routineHabit(state, i);
                  const ed = edits[i.id];
                  if (ed) {
                    return (
                      <div key={i.id} className="glass-card p-3 rounded-xl space-y-2 border border-primary-container/30">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={ed.name}
                            onChange={(e) => setEdits((es) => ({ ...es, [i.id]: { ...es[i.id], name: e.target.value } }))}
                            onKeyDown={(e) => (e.key === "Enter" ? saveEdit(i.id) : e.key === "Escape" ? cancelEdit(i.id) : null)}
                            autoFocus
                            className={`${inputCls} flex-1 min-w-[160px] text-[13px]`}
                          />
                          <input
                            type="time"
                            value={ed.time}
                            onChange={(e) => setEdits((es) => ({ ...es, [i.id]: { ...es[i.id], time: e.target.value } }))}
                            aria-label="Horário"
                            className={`${inputCls} w-28 text-[13px]`}
                          />
                          <button onClick={() => saveEdit(i.id)} aria-label="Salvar" className="px-3 py-2 rounded-lg bg-primary-container text-on-primary-container grid place-items-center active:scale-95 transition">
                            <MI name="check" className="text-lg" />
                          </button>
                          <button onClick={() => cancelEdit(i.id)} aria-label="Cancelar" className="px-3 py-2 rounded-lg bg-surface-variant text-on-surface-variant grid place-items-center active:scale-95 transition">
                            <MI name="close" className="text-lg" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <DowMini value={ed.weekdays} onChange={(wd) => setEdits((es) => ({ ...es, [i.id]: { ...es[i.id], weekdays: wd } }))} />
                          <HabitSelect habits={linkable} value={ed.habitId} onChange={(hid) => setEdits((es) => ({ ...es, [i.id]: { ...es[i.id], habitId: hid } }))} />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={i.id}
                      className={`glass-card px-3 py-2.5 rounded-xl flex items-center gap-3 transition ${done ? "border border-primary-container/30" : ""}`}
                    >
                      <button
                        onClick={() => toggle(i)}
                        aria-pressed={done}
                        aria-label={`${done ? "Desmarcar" : "Marcar"} ${i.name}`}
                        className={`w-9 h-9 rounded-full grid place-items-center shrink-0 border transition active:scale-95 ${
                          done ? "bg-primary-container text-on-primary-container border-primary-container" : "border-white/15 text-outline hover:border-primary-container/60"
                        }`}
                      >
                        <MI name={done ? "check" : "radio_button_unchecked"} className="text-lg" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[14px] truncate ${done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>{i.name}</p>
                        <span className="text-[10px] text-outline font-label-caps flex flex-wrap items-center gap-x-1.5">
                          <span>
                            {i.time || "SEM HORA"}
                            {i.weekdays?.length ? ` · ${i.weekdays.map((d) => DOW_SHORT[d]).join(" ")}` : ""}
                          </span>
                          {linked ? (
                            <span className="flex items-center gap-0.5 text-primary-container" title={`Marcar aqui marca o hábito "${linked.name}" — o XP é o dele`}>
                              <MI name="link" className="text-[12px]" /> {linked.name} · +{habitPriority(linked).xp} XP
                            </span>
                          ) : done ? (
                            <span>· +{dayChecks[i.id]} XP</span>
                          ) : null}
                        </span>
                      </div>
                      <button onClick={() => startEdit(i)} aria-label="Editar" className="text-outline hover:text-primary-container transition p-1 shrink-0">
                        <MI name="edit" className="text-lg" />
                      </button>
                      <button onClick={() => removeItem(i)} aria-label="Excluir" className="text-outline hover:text-error transition p-1 shrink-0">
                        <MI name="delete" className="text-lg" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ---- novo item ---- */}
      <div className="glass-card px-4 py-3 md:px-6 md:py-4 rounded-xl mb-gutter space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Novo item da rotina (ex.: tomar remédio, alongar 5 min)"
            className="flex-1 min-w-[200px] bg-transparent border-0 border-b border-white/10 focus:border-primary-container/70 px-0 py-2 text-body-md text-on-surface placeholder:text-outline outline-none transition-colors"
          />
          <input
            type="time"
            value={form.time}
            onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
            aria-label="Horário (opcional)"
            title="Com hora, o item aparece na Agenda no horário certo"
            className={`${inputCls} w-28 text-[13px]`}
          />
          <button onClick={addItem} aria-label="Adicionar item" className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container grid place-items-center shrink-0 active:scale-95 transition">
            <MI name="add" className="text-2xl" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DowMini value={form.weekdays} onChange={(wd) => setForm((f) => ({ ...f, weekdays: wd }))} />
          <HabitSelect habits={linkable} value={form.habitId} onChange={(hid) => setForm((f) => ({ ...f, habitId: hid }))} />
        </div>
        <p className="text-[11px] text-outline">
          Item com hora entra na <strong className="font-semibold">Agenda</strong> naquele horário e pode ser marcado por lá. Cada item vale {XP.routineItem} XP;
          fechar todos os do dia dá {XP.routineAll} de bônus. <strong className="font-semibold">Vinculado a um hábito</strong>, marcar aqui marca o hábito — e o
          XP que entra é o dele, não os dois.
        </p>
      </div>

      {/* ---- últimos 7 dias ---- */}
      <div className="glass-card p-4 md:p-6 rounded-xl">
        <Caps className="text-outline text-[10px] block mb-3">ÚLTIMOS 7 DIAS</Caps>
        <div className="grid grid-cols-7 gap-2">
          {week.map((d) => (
            <button
              key={d.date}
              onClick={() => setDate(d.date)}
              title={`${d.done} de ${d.total} em ${ddmm(d.date)}`}
              className={`rounded-lg p-2 text-center transition ${d.date === date ? "bg-surface-container-high" : "hover:bg-surface-container-high/60"}`}
            >
              <Caps className={`text-[9px] block ${d.date === today ? "text-primary" : "text-outline"}`}>{weekdayShort(d.date).toUpperCase()}</Caps>
              <div className="mx-auto my-1.5 w-full h-8 rounded bg-surface-variant/60 relative overflow-hidden">
                <div
                  className={`absolute bottom-0 left-0 right-0 ${d.complete ? "bg-primary" : "bg-primary-container/70"}`}
                  style={{ height: `${d.total ? d.pct : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-outline tabular-nums">{d.total ? `${d.done}/${d.total}` : "—"}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-outline mt-3">
          Barra cheia = dia fechado. Dia sem item agendado aparece como traço — não é falha, é dia sem rotina prevista.
        </p>
      </div>
    </>
  );
}
