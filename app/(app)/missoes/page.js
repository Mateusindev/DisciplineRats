"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, inputCls } from "@/components/ui";
import { XP, award, getDateStr, shiftDate, weekdayShort } from "@/lib/state";

const PRI = {
  1: { label: "BAIXA", chip: "bg-surface-variant text-on-surface-variant", dot: "text-outline" },
  2: { label: "MÉDIA", chip: "bg-primary-container/20 text-primary-container border border-primary-container/40", dot: "text-primary-container" },
  3: { label: "ALTA", chip: "bg-error-container/40 text-error border border-error/40", dot: "text-error" },
};

export default function MissoesPage() {
  const { state, setState, toast } = useApp();
  const [view, setView] = useState("kanban");
  const [newTask, setNewTask] = useState("");
  const [newDate, setNewDate] = useState(getDateStr(0));
  const [newPriority, setNewPriority] = useState(2);

  const today = getDateStr(0);
  const tomorrow = shiftDate(today, 1);
  const maxDate = shiftDate(today, 7);
  const taskDue = (t) => t.date || today;
  const taskPri = (t) => PRI[t.priority] || PRI[2];
  const byPriority = (a, b) => (b.priority || 2) - (a.priority || 2);

  // ---- handlers (mesma lógica/XP do foco) ----
  function addTask() {
    const text = newTask.trim();
    if (!text) return;
    const date = newDate >= today && newDate <= maxDate ? newDate : today;
    setState((prev) => ({ ...prev, tasks: [...prev.tasks, { id: Date.now(), text, done: false, date, priority: newPriority }] }));
    setNewTask("");
    if (date > today) toast("Missão agendada", { sub: dayLabel(date), icon: "event_upcoming" });
  }
  function removeTask(id) {
    setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));
  }
  function pullToToday(id) {
    setState((prev) => ({ ...prev, tasks: prev.tasks.map((t) => (t.id === id ? { ...t, date: getDateStr(0) } : t)) }));
  }
  function pushToTomorrow(id) {
    setState((prev) => ({ ...prev, tasks: prev.tasks.map((t) => (t.id === id ? { ...t, date: shiftDate(getDateStr(0), 1), done: false } : t)) }));
    toast("Missão adiada", { sub: "AMANHÃ", icon: "update" });
  }
  function cyclePriority(id) {
    setState((prev) => ({ ...prev, tasks: prev.tasks.map((t) => (t.id === id ? { ...t, priority: ((t.priority || 2) % 3) + 1 } : t)) }));
  }
  function toggleTask(id) {
    setState((prev) => {
      const tasks = prev.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      const td = getDateStr(0);
      const due = tasks.filter((t) => (t.date || td) <= td);
      const allDone = due.length > 0 && due.every((t) => t.done);
      if (allDone && prev.tasksBonusDate !== td) {
        return { ...prev, tasks, tasksBonusDate: td, stats: { ...prev.stats, xp: (prev.stats.xp || 0) + award(XP.tasksAllDone, prev.stats.streak) } };
      }
      return { ...prev, tasks };
    });
  }

  const dayLabel = (d) => (d === today ? "HOJE" : d === tomorrow ? "AMANHÃ" : `${weekdayShort(d).toUpperCase()} ${d.slice(8, 10)}/${d.slice(5, 7)}`);

  // ---- buckets por tempo ----
  const tasks = state.tasks || [];
  const bucketOf = (t) => {
    if (t.done) return "done";
    const d = taskDue(t);
    if (d < today) return "overdue";
    if (d === today) return "today";
    if (d === tomorrow) return "tomorrow";
    return "next";
  };
  const COLS = [
    { id: "overdue", label: "Atrasadas", icon: "warning", accent: "text-error" },
    { id: "today", label: "Hoje", icon: "today", accent: "text-primary" },
    { id: "tomorrow", label: "Amanhã", icon: "event", accent: "text-primary-container" },
    { id: "next", label: "Próximas", icon: "event_upcoming", accent: "text-on-surface-variant" },
    { id: "done", label: "Concluídas", icon: "check_circle", accent: "text-outline" },
  ];
  const grouped = Object.fromEntries(COLS.map((c) => [c.id, []]));
  for (const t of tasks) grouped[bucketOf(t)].push(t);
  for (const c of COLS) grouped[c.id].sort((a, b) => (c.id === "next" ? (a.date !== b.date ? (a.date < b.date ? -1 : 1) : byPriority(a, b)) : byPriority(a, b)));

  const dueCount = tasks.filter((t) => taskDue(t) <= today && !t.done).length;

  // ---- card de missão ----
  const Card = ({ t }) => {
    const p = taskPri(t);
    const due = taskDue(t);
    return (
      <div className={`bg-surface-container-high rounded-lg p-3 flex flex-col gap-2 ${t.done ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-2">
          <button onClick={() => toggleTask(t.id)} aria-label={t.done ? "Reabrir" : "Concluir"} className="shrink-0 mt-0.5">
            <MI name={t.done ? "check_circle" : "radio_button_unchecked"} fill={t.done} className={t.done ? "text-primary-container" : "text-outline"} />
          </button>
          <span className={`flex-1 text-[13px] leading-snug ${t.done ? "line-through text-on-surface-variant" : "text-on-surface"}`}>{t.text}</span>
          <button onClick={() => removeTask(t.id)} aria-label="Excluir" className="text-outline hover:text-error transition shrink-0">
            <MI name="delete" className="text-base" />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap pl-7">
          <button onClick={() => cyclePriority(t.id)} className={`font-label-caps text-[8px] px-1.5 py-0.5 rounded-full ${p.chip}`} title="Trocar prioridade">
            {p.label}
          </button>
          <Caps className="text-outline text-[8px]">{dayLabel(due)}</Caps>
          <div className="flex-1" />
          {!t.done && due > today && (
            <button onClick={() => pullToToday(t.id)} title="Antecipar p/ hoje" className="text-outline hover:text-primary transition">
              <MI name="keyboard_double_arrow_left" className="text-base" />
            </button>
          )}
          {!t.done && due <= today && (
            <button onClick={() => pushToTomorrow(t.id)} title="Jogar p/ amanhã" className="text-outline hover:text-primary transition">
              <MI name="keyboard_double_arrow_right" className="text-base" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary uppercase">Missões</h2>
          <p className="font-body-md text-on-surface-variant">{dueCount} pendente(s) pra hoje · todas feitas = +{XP.tasksAllDone} XP</p>
        </div>
        <div className="flex gap-1.5 bg-surface-container-highest p-1 rounded-lg">
          {[["kanban", "view_kanban"], ["lista", "view_list"]].map(([v, ic]) => (
            <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-label-caps text-[11px] transition ${view === v ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant"}`}>
              <MI name={ic} className="text-[16px]" /> {v === "kanban" ? "KANBAN" : "LISTA"}
            </button>
          ))}
        </div>
      </section>

      {/* nova missão */}
      <section className="glass-card p-5 rounded-xl flex flex-col gap-3">
        <div className="flex gap-2">
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="Nova missão..." className={`${inputCls} flex-1`} />
          <button onClick={addTask} className="px-4 rounded-lg bg-primary text-on-primary font-label-caps text-[11px] active:scale-95 transition shrink-0">ADD</button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[1, 2, 3].map((pv) => (
            <button key={pv} onClick={() => setNewPriority(pv)} className={`font-label-caps text-[9px] px-2 py-1 rounded-full transition ${newPriority === pv ? PRI[pv].chip : "bg-surface-container-high text-outline"}`}>
              {PRI[pv].label}
            </button>
          ))}
          <div className="w-px h-4 bg-outline-variant/40 mx-1" />
          {[["HOJE", today], ["AMANHÃ", tomorrow]].map(([lbl, d]) => (
            <button key={lbl} onClick={() => setNewDate(d)} className={`font-label-caps text-[9px] px-2 py-1 rounded-full transition ${newDate === d ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high text-outline"}`}>
              {lbl}
            </button>
          ))}
          <input type="date" value={newDate} min={today} max={maxDate} onChange={(e) => setNewDate(e.target.value || today)} className="bg-surface-container-high px-2 py-1 rounded-lg border border-white/10 text-[12px] text-on-surface outline-none" />
        </div>
      </section>

      {tasks.length === 0 ? (
        <p className="text-[13px] text-outline glass-card rounded-xl p-8 text-center">Nenhuma missão. Adicione a primeira acima.</p>
      ) : view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto ff-scroll pb-2">
          {COLS.map((c) => (
            <div key={c.id} className="w-64 shrink-0 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 px-1">
                <MI name={c.icon} className={`text-base ${c.accent}`} />
                <Caps className={`text-[10px] ${c.accent}`}>{c.label}</Caps>
                <Caps className="text-outline text-[10px]">{grouped[c.id].length}</Caps>
              </div>
              <div className="flex flex-col gap-2 min-h-[40px]">
                {grouped[c.id].length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 p-3 text-center text-[11px] text-outline">—</div>
                ) : (
                  grouped[c.id].map((t) => <Card key={t.id} t={t} />)
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {COLS.map((c) => grouped[c.id].length > 0 && (
            <section key={c.id}>
              <div className="flex items-center gap-1.5 mb-2">
                <MI name={c.icon} className={`text-base ${c.accent}`} />
                <Caps className={`text-[10px] ${c.accent}`}>{c.label}</Caps>
                <Caps className="text-outline text-[10px]">{grouped[c.id].length}</Caps>
              </div>
              <div className="space-y-2">
                {grouped[c.id].map((t) => <Card key={t.id} t={t} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
