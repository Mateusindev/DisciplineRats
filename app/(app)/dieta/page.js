"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, inputCls } from "@/components/ui";
import { dietTotals } from "@/lib/state";
import MetasEditor from "@/components/MetasEditor";
import NutriProfile from "@/components/NutriProfile";

const EMPTY_ITEM = { name: "", grams: "", kcal: "", protein: "", carbs: "", fat: "" };

const TABS_DIETA = [
  { id: "plano", label: "PLANO", short: "PLANO", icon: "restaurant_menu" },
  { id: "perfil", label: "CÁLCULO", short: "CÁLCULO", icon: "calculate" },
];

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) || n < 0 ? 0 : n;
}

function MacroBar({ label, value, goal, unit, color }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  const over = goal > 0 && value > goal;
  return (
    <div className="flex-1 min-w-[120px]">
      <div className="flex justify-between items-end mb-1">
        <Caps className="text-outline text-[10px]">{label}</Caps>
        <span className="text-body-md text-on-surface">
          <span className={over ? "text-error font-bold" : "text-primary font-bold"}>{Math.round(value)}</span>
          <span className="text-outline text-[11px]">/{goal}{unit}</span>
        </span>
      </div>
      <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${over ? "bg-error" : color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DietaPage() {
  const { state, setState, toast, confirm, setSetting } = useApp();
  const [tab, setTab] = useState("plano");
  const [forms, setForms] = useState({}); // { [mealId]: {name,grams,...} }
  const [edits, setEdits] = useState({}); // { [itemId]: {name,grams,...} } — item em edição
  const [newMeal, setNewMeal] = useState("");

  const plan = state.dietPlan || [];
  const allItems = plan.flatMap((m) => m.items || []);
  const totals = dietTotals(allItems);
  const goals = {
    kcal: state.settings.dietKcalGoal || 2000,
    protein: state.settings.dietProteinGoal || 150,
    carbs: state.settings.dietCarbGoal || 200,
    fat: state.settings.dietFatGoal || 65,
  };
  const kcalPct = goals.kcal > 0 ? Math.min(100, Math.round((totals.kcal / goals.kcal) * 100)) : 0;
  const kcalDiff = Math.round(goals.kcal - totals.kcal);

  // ---- refeições (blocos) ----
  function addMeal() {
    const name = newMeal.trim() || `Refeição ${plan.length + 1}`;
    setState((prev) => ({ ...prev, dietPlan: [...(prev.dietPlan || []), { id: Date.now(), name, items: [] }] }));
    setNewMeal("");
  }
  async function removeMeal(id) {
    const m = (state.dietPlan || []).find((x) => x.id === id);
    if ((m?.items || []).length) {
      const ok = await confirm({ title: "Excluir refeição?", body: `"${m.name}" tem ${m.items.length} item(ns) que serão removidos.`, confirmLabel: "EXCLUIR" });
      if (!ok) return;
    }
    setState((prev) => ({ ...prev, dietPlan: (prev.dietPlan || []).filter((m) => m.id !== id) }));
  }
  function renameMeal(id, name) {
    setState((prev) => ({ ...prev, dietPlan: (prev.dietPlan || []).map((m) => (m.id === id ? { ...m, name } : m)) }));
  }

  // ---- itens ----
  const getForm = (mealId) => forms[mealId] || EMPTY_ITEM;
  const setField = (mealId, key) => (e) =>
    setForms((f) => ({ ...f, [mealId]: { ...(f[mealId] || EMPTY_ITEM), [key]: e.target.value } }));

  function addItem(mealId) {
    const f = getForm(mealId);
    const name = (f.name || "").trim();
    if (!name) {
      toast("Informe o alimento", { type: "error" });
      return;
    }
    const item = {
      id: Date.now(),
      name: name.slice(0, 60),
      grams: Math.round(num(f.grams)),
      kcal: Math.round(num(f.kcal)),
      protein: Math.round(num(f.protein) * 10) / 10,
      carbs: Math.round(num(f.carbs) * 10) / 10,
      fat: Math.round(num(f.fat) * 10) / 10,
    };
    setState((prev) => ({
      ...prev,
      dietPlan: (prev.dietPlan || []).map((m) => (m.id === mealId ? { ...m, items: [...(m.items || []), item] } : m)),
    }));
    setForms((fs) => ({ ...fs, [mealId]: EMPTY_ITEM }));
  }
  function removeItem(mealId, itemId) {
    setState((prev) => ({
      ...prev,
      dietPlan: (prev.dietPlan || []).map((m) => (m.id === mealId ? { ...m, items: (m.items || []).filter((i) => i.id !== itemId) } : m)),
    }));
  }

  // ---- edição de item ----
  const startEdit = (item) =>
    setEdits((es) => ({ ...es, [item.id]: { name: item.name, grams: item.grams, kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat } }));
  const cancelEdit = (itemId) =>
    setEdits((es) => {
      const { [itemId]: _, ...rest } = es;
      return rest;
    });
  const editField = (itemId, key) => (e) =>
    setEdits((es) => ({ ...es, [itemId]: { ...es[itemId], [key]: e.target.value } }));

  function saveEdit(mealId, itemId) {
    const f = edits[itemId];
    const name = (f.name || "").trim();
    if (!name) {
      toast("Informe o alimento", { type: "error" });
      return;
    }
    const patch = {
      name: name.slice(0, 60),
      grams: Math.round(num(f.grams)),
      kcal: Math.round(num(f.kcal)),
      protein: Math.round(num(f.protein) * 10) / 10,
      carbs: Math.round(num(f.carbs) * 10) / 10,
      fat: Math.round(num(f.fat) * 10) / 10,
    };
    setState((prev) => ({
      ...prev,
      dietPlan: (prev.dietPlan || []).map((m) =>
        m.id === mealId ? { ...m, items: (m.items || []).map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } : m
      ),
    }));
    cancelEdit(itemId);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section>
        <h2 className="font-headline-lg text-headline-lg text-primary uppercase">Dieta</h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          {tab === "plano"
            ? "Monte sua dieta fixa. Adicione quantas refeições precisar — o índice geral soma kcal e macros do plano."
            : "Estimativa de gasto e macros a partir do seu corpo, e a evolução do peso que diz se a estimativa acertou."}
        </p>
      </section>

      {/* Abas */}
      <div role="tablist" aria-label="Seções da dieta" className="flex rounded-xl overflow-hidden border border-white/10">
        {TABS_DIETA.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 font-label-caps text-[11px] flex items-center justify-center gap-1.5 transition ${
              tab === t.id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
            }`}
          >
            <MI name={t.icon} className="text-base" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.short}</span>
          </button>
        ))}
      </div>

      {tab === "plano" && (
        <div className="glass-card p-6 rounded-xl">
          <Caps className="text-outline text-[10px] block mb-4">METAS DIÁRIAS</Caps>
          <MetasEditor
            fields={[
              { key: "dietKcalGoal", label: "Kcal/dia", type: "number", value: state.settings.dietKcalGoal, min: 1000, max: 5000, step: 50, unit: "kcal", onChange: (v) => setSetting("dietKcalGoal", v) },
              { key: "dietProteinGoal", label: "Proteína", type: "number", value: state.settings.dietProteinGoal, min: 20, max: 400, step: 5, unit: "g", onChange: (v) => setSetting("dietProteinGoal", v) },
              { key: "dietCarbGoal", label: "Carboidrato", type: "number", value: state.settings.dietCarbGoal, min: 20, max: 600, step: 5, unit: "g", onChange: (v) => setSetting("dietCarbGoal", v) },
              { key: "dietFatGoal", label: "Gordura", type: "number", value: state.settings.dietFatGoal, min: 10, max: 250, step: 5, unit: "g", onChange: (v) => setSetting("dietFatGoal", v) },
            ]}
          />
        </div>
      )}

      {tab === "plano" && (<>

      {/* Índice geral do plano */}
      <section className="glass-card p-6 md:p-8 rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-headline-md text-headline-md text-primary">ÍNDICE GERAL DO PLANO</h3>
          <Caps className="text-outline">{plan.length} REFEIÇÃO(ÕES) · {allItems.length} ITEM(NS)</Caps>
        </div>
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <div className="text-center shrink-0">
            <div className="font-display-timer text-[56px] leading-none text-primary tabular-nums">{Math.round(totals.kcal)}</div>
            <Caps className="text-outline">DE {goals.kcal} KCAL / DIA</Caps>
            <div className="w-40 h-2 bg-surface-variant rounded-full overflow-hidden mt-3 mx-auto">
              <div className={`h-full rounded-full ${totals.kcal > goals.kcal ? "bg-error" : "bg-primary-container"}`} style={{ width: `${kcalPct}%` }} />
            </div>
            <Caps className={`mt-2 block ${kcalDiff < 0 ? "text-error" : "text-on-surface-variant"}`}>
              {kcalDiff >= 0 ? `${kcalDiff} KCAL ABAIXO DA META` : `${Math.abs(kcalDiff)} KCAL ACIMA DA META`}
            </Caps>
          </div>
          <div className="flex flex-wrap gap-4 flex-1 w-full">
            <MacroBar label="PROTEÍNA" value={totals.protein} goal={goals.protein} unit="g" color="bg-primary-container" />
            <MacroBar label="CARBOIDRATO" value={totals.carbs} goal={goals.carbs} unit="g" color="bg-primary" />
            <MacroBar label="GORDURA" value={totals.fat} goal={goals.fat} unit="g" color="bg-surface-bright" />
          </div>
        </div>
      </section>

      {/* Blocos de refeição dinâmicos */}
      {plan.map((m) => {
        const mt = dietTotals(m.items || []);
        const f = getForm(m.id);
        return (
          <section key={m.id} className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <MI name="restaurant" className="text-primary-container shrink-0" />
              <input
                value={m.name}
                onChange={(e) => renameMeal(m.id, e.target.value)}
                aria-label="Nome da refeição"
                className="flex-1 min-w-0 bg-transparent font-headline-md text-headline-md text-primary outline-none border-b border-transparent focus:border-primary-container/40 transition-colors"
              />
              <Caps className="text-on-surface-variant whitespace-nowrap hidden sm:block">
                {Math.round(mt.kcal)} KCAL · P {Math.round(mt.protein)} · C {Math.round(mt.carbs)} · G {Math.round(mt.fat)}
              </Caps>
              <button onClick={() => removeMeal(m.id)} aria-label="Excluir refeição" className="text-outline hover:text-error transition p-1 shrink-0">
                <MI name="delete" />
              </button>
            </div>
            <Caps className="text-on-surface-variant sm:hidden block mb-3">
              {Math.round(mt.kcal)} KCAL · P {Math.round(mt.protein)} · C {Math.round(mt.carbs)} · G {Math.round(mt.fat)}
            </Caps>

            {(m.items || []).length > 0 && (
              <div className="space-y-2 mb-4">
                {m.items.map((e) => {
                  const ed = edits[e.id];
                  if (ed) {
                    return (
                      <div key={e.id} className="p-3 bg-surface-container-high rounded-lg border border-primary-container/30">
                        <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
                          <input value={ed.name} onChange={editField(e.id, "name")} onKeyDown={(k) => k.key === "Enter" && saveEdit(m.id, e.id)} placeholder="Alimento" className={`${inputCls} col-span-2 md:col-span-4 text-[13px]`} />
                          <input value={ed.grams} onChange={editField(e.id, "grams")} type="number" min="0" placeholder="g" className={`${inputCls} md:col-span-1 text-[13px]`} />
                          <input value={ed.kcal} onChange={editField(e.id, "kcal")} type="number" min="0" placeholder="kcal" className={`${inputCls} md:col-span-2 text-[13px]`} />
                          <input value={ed.protein} onChange={editField(e.id, "protein")} type="number" min="0" placeholder="P (g)" className={`${inputCls} md:col-span-1 text-[13px]`} />
                          <input value={ed.carbs} onChange={editField(e.id, "carbs")} type="number" min="0" placeholder="C (g)" className={`${inputCls} md:col-span-1 text-[13px]`} />
                          <input value={ed.fat} onChange={editField(e.id, "fat")} type="number" min="0" placeholder="G (g)" className={`${inputCls} md:col-span-1 text-[13px]`} />
                          <div className="md:col-span-2 flex gap-2">
                            <button onClick={() => saveEdit(m.id, e.id)} aria-label="Salvar item" className="flex-1 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center py-2 active:scale-95 transition">
                              <MI name="check" className="text-lg" />
                            </button>
                            <button onClick={() => cancelEdit(e.id)} aria-label="Cancelar edição" className="flex-1 rounded-lg bg-surface-variant text-on-surface-variant flex items-center justify-center py-2 active:scale-95 transition">
                              <MI name="close" className="text-lg" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={e.id} className="flex items-center gap-3 p-3 bg-surface-container-high rounded-lg border border-white/5">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-on-surface truncate">{e.name}{e.grams ? ` · ${e.grams}g` : ""}</div>
                        <div className="text-[10px] text-outline">{e.kcal} kcal · P {e.protein}g · C {e.carbs}g · G {e.fat}g</div>
                      </div>
                      <button onClick={() => startEdit(e)} aria-label="Editar item" className="text-outline hover:text-primary-container transition p-1">
                        <MI name="edit" className="text-lg" />
                      </button>
                      <button onClick={() => removeItem(m.id, e.id)} aria-label="Remover item" className="text-outline hover:text-error transition p-1">
                        <MI name="delete" className="text-lg" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* add item inline */}
            <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
              <input value={f.name} onChange={setField(m.id, "name")} onKeyDown={(e) => e.key === "Enter" && addItem(m.id)} placeholder="Alimento" className={`${inputCls} col-span-2 md:col-span-4 text-[13px]`} />
              <input value={f.grams} onChange={setField(m.id, "grams")} type="number" min="0" placeholder="g" className={`${inputCls} md:col-span-1 text-[13px]`} />
              <input value={f.kcal} onChange={setField(m.id, "kcal")} type="number" min="0" placeholder="kcal" className={`${inputCls} md:col-span-2 text-[13px]`} />
              <input value={f.protein} onChange={setField(m.id, "protein")} type="number" min="0" placeholder="P (g)" className={`${inputCls} md:col-span-1 text-[13px]`} />
              <input value={f.carbs} onChange={setField(m.id, "carbs")} type="number" min="0" placeholder="C (g)" className={`${inputCls} md:col-span-1 text-[13px]`} />
              <input value={f.fat} onChange={setField(m.id, "fat")} type="number" min="0" placeholder="G (g)" className={`${inputCls} md:col-span-1 text-[13px]`} />
              <button onClick={() => addItem(m.id)} aria-label="Adicionar item" className="md:col-span-2 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center gap-1 py-2 active:scale-95 transition font-label-caps text-[11px]">
                <MI name="add" className="text-lg" /> ADD
              </button>
            </div>
          </section>
        );
      })}

      {/* adicionar refeição */}
      <section className="glass-card p-6 rounded-xl flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          value={newMeal}
          onChange={(e) => setNewMeal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addMeal()}
          placeholder="Nome da nova refeição (ex.: Lanche da tarde)"
          className={`${inputCls} flex-1`}
        />
        <button onClick={addMeal} className="px-5 py-2.5 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-label-caps flex items-center justify-center gap-2 active:scale-95 transition">
          <MI name="add" /> ADICIONAR REFEIÇÃO
        </button>
      </section>

      </>)}

      {tab === "perfil" && <NutriProfile state={state} setState={setState} toast={toast} />}

    </div>
  );
}
