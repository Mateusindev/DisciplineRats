"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, inputCls } from "@/components/ui";
import { getDateStr, computeHabitStreak, HABIT_ICONS } from "@/lib/state";

export default function HabitosPage() {
  const { state, setState, confirm } = useApp();
  const [newHabit, setNewHabit] = useState("");
  const [edits, setEdits] = useState({}); // { [id]: nome em edição }
  const today = getDateStr(0);

  function addHabit() {
    const name = newHabit.trim();
    if (!name) return;
    setState((prev) => ({ ...prev, habits: [...prev.habits, { id: crypto.randomUUID(), name, doneDates: [] }] }));
    setNewHabit("");
  }
  function toggleHabit(id) {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => {
        if (h.id !== id) return h;
        const has = h.doneDates.includes(today);
        return { ...h, doneDates: has ? h.doneDates.filter((d) => d !== today) : [...h.doneDates, today] };
      }),
    }));
  }
  async function removeHabit(id) {
    const h = state.habits.find((x) => x.id === id);
    const ok = await confirm({ title: "Excluir hábito?", body: `"${h?.name || ""}" e todo o histórico dele serão apagados.`, confirmLabel: "EXCLUIR" });
    if (!ok) return;
    setState((prev) => ({ ...prev, habits: prev.habits.filter((h) => h.id !== id) }));
  }

  const startEdit = (h) => setEdits((e) => ({ ...e, [h.id]: h.name }));
  const cancelEdit = (id) =>
    setEdits((e) => {
      const { [id]: _, ...rest } = e;
      return rest;
    });
  function saveEdit(id) {
    const name = (edits[id] || "").trim();
    if (!name) return;
    setState((prev) => ({ ...prev, habits: prev.habits.map((h) => (h.id === id ? { ...h, name: name.slice(0, 80) } : h)) }));
    cancelEdit(id);
  }

  return (
    <>
      <PageHeader title="HÁBITOS" subtitle="Coisas que você repete todo dia. Marque e acompanhe a sequência." />
      <div className="glass-card p-6 rounded-xl mb-gutter">
        <div className="flex gap-2">
          <input
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHabit()}
            placeholder="Ex: beber 2L de água, meditar, ler 10 páginas..."
            className={`${inputCls} flex-1`}
          />
          <button onClick={addHabit} className="px-4 rounded-lg bg-primary-container text-on-primary-container flex items-center active:scale-95 transition">
            <MI name="add" />
          </button>
        </div>
      </div>

      {state.habits.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center text-on-surface-variant">Nenhum hábito cadastrado ainda.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {state.habits.map((h, i) => {
            const done = h.doneDates.includes(today);
            const streak = computeHabitStreak(h.doneDates);
            const editing = edits[h.id] !== undefined;
            return (
              <div key={h.id} className="glass-card p-6 rounded-xl">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded bg-primary-container/20 flex items-center justify-center text-primary-container">
                    <MI name={HABIT_ICONS[i % HABIT_ICONS.length]} className="text-3xl" />
                  </div>
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
                  <input
                    value={edits[h.id]}
                    onChange={(e) => setEdits((es) => ({ ...es, [h.id]: e.target.value }))}
                    onKeyDown={(e) => (e.key === "Enter" ? saveEdit(h.id) : e.key === "Escape" ? cancelEdit(h.id) : null)}
                    autoFocus
                    aria-label="Nome do hábito"
                    className={`${inputCls} w-full mb-2`}
                  />
                ) : (
                  <h4 className="font-headline-md text-headline-md mb-2">{h.name}</h4>
                )}
                <div className="flex items-center gap-1 text-outline-variant font-label-caps text-[10px] mb-4">
                  <MI name="local_fire_department" className={`text-sm ${streak > 0 ? "text-primary-container" : ""}`} /> {streak} DIAS
                </div>
                <button
                  onClick={() => toggleHabit(h.id)}
                  className={`w-full py-2 font-label-caps text-[10px] rounded transition-colors ${
                    done ? "bg-primary-container text-on-primary-container" : "border border-primary text-primary hover:bg-primary/10"
                  }`}
                >
                  {done ? "CONCLUÍDO HOJE" : "MARCAR AGORA"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
