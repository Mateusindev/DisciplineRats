"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, inputCls } from "@/components/ui";
import {
  dietTotals,
  dietItemTotals,
  dietItemQty,
  dietItemPortionGrams,
  dietItemBaseGrams,
  dietQtyFromGrams,
  isMassUnit,
  DIET_UNITS,
  foodList,
  searchFoods,
  findFoodByName,
  foodFromItem,
  upsertFood,
  removeFood,
  applyFoodToPlan,
  planItemsUsingFood,
  FOODS_MAX,
  FOOD_NAME_LEN,
} from "@/lib/state";
import MetasEditor from "@/components/MetasEditor";
import NutriProfile from "@/components/NutriProfile";

// Formulário de item: os macros são de UMA porção. `qty` multiplica na hora de somar,
// então corrigir "1 ovo" pra 2 é mexer num número, não redigitar a tabela nutricional.
const EMPTY_ITEM = { name: "", qty: "1", unit: "un", grams: "", portionGrams: "", kcal: "", protein: "", carbs: "", fat: "", foodId: null };
const EMPTY_FOOD = { name: "", unit: "un", portionGrams: "", kcal: "", protein: "", carbs: "", fat: "" };

const qtyFmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
const gFmt = (n) => `${Math.round(n)} g`;

const G_STEPS = [10, 50, 100];

// Total em gramas com −/+ no passo escolhido. Passo é alternável porque 10 g serve pra
// ajustar e 100 g pra montar — obrigar um dos dois deixa o outro caso insuportável.
function MassStepper({ grams, step, onStep, onChange, size = "sm" }) {
  const g = Number(grams) > 0 ? Number(grams) : 0;
  const big = size === "lg";
  const btn = `${big ? "w-8 h-8" : "w-7 h-7"} rounded-lg border border-white/10 text-on-surface-variant hover:border-white/25 active:scale-95 transition grid place-items-center shrink-0`;
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={() => onChange(Math.max(0, g - step))} aria-label={`Menos ${step} gramas`} className={btn}>
        −
      </button>
      <input
        value={g || ""}
        onChange={(e) => {
          const n = parseFloat(String(e.target.value).replace(",", "."));
          onChange(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
        inputMode="numeric"
        placeholder="0"
        aria-label="Total em gramas"
        className={`${big ? "w-16 text-[15px]" : "w-14 text-[13px]"} bg-transparent text-center font-bold text-on-surface tabular-nums outline-none border-b border-white/10 focus:border-primary-container/60 transition`}
      />
      <button onClick={() => onChange(g + step)} aria-label={`Mais ${step} gramas`} className={btn}>
        +
      </button>
      <button
        onClick={() => onStep(G_STEPS[(G_STEPS.indexOf(step) + 1) % G_STEPS.length])}
        title="Passo do ajuste"
        className="px-1.5 h-7 rounded-lg border border-white/10 font-label-caps text-[9px] text-outline hover:border-white/25 transition tabular-nums shrink-0"
      >
        ±{step}g
      </button>
    </div>
  );
}

// quantidade com −/+ e digitação livre (aceita 0,5 e 1,5)
function QtyStepper({ value, unit, onChange, size = "sm" }) {
  const q = Number(value) > 0 ? Number(value) : 1;
  const step = q <= 1 ? 0.5 : 1;
  const big = size === "lg";
  const btn = `${big ? "w-8 h-8" : "w-7 h-7"} rounded-lg border border-white/10 text-on-surface-variant hover:border-white/25 active:scale-95 transition grid place-items-center shrink-0`;
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={() => onChange(Math.max(0.25, Math.round((q - step) * 100) / 100))} aria-label="Diminuir quantidade" className={btn}>
        −
      </button>
      <input
        value={qtyFmt(q)}
        onChange={(e) => {
          const n = parseFloat(String(e.target.value).replace(",", "."));
          onChange(Number.isFinite(n) && n > 0 ? n : 1);
        }}
        inputMode="decimal"
        aria-label="Quantidade"
        className={`${big ? "w-14 text-[15px]" : "w-11 text-[13px]"} bg-transparent text-center font-bold text-on-surface tabular-nums outline-none border-b border-white/10 focus:border-primary-container/60 transition`}
      />
      <button onClick={() => onChange(Math.round((q + step) * 100) / 100)} aria-label="Aumentar quantidade" className={btn}>
        +
      </button>
      {unit && <Caps className="text-outline text-[9px] w-8">{unit}</Caps>}
    </div>
  );
}

const TABS_DIETA = [
  { id: "plano", label: "PLANO", short: "PLANO", icon: "restaurant_menu" },
  { id: "despensa", label: "DESPENSA", short: "DESPENSA", icon: "kitchen" },
  { id: "perfil", label: "CÁLCULO", short: "CÁLCULO", icon: "calculate" },
];

// Campo de alimento com busca na despensa. É o ponto da feature: escolher da lista
// preenche a tabela nutricional inteira, então o mesmo alimento nunca é redigitado.
// Enter escolhe o item em foco quando a lista está aberta e só adiciona o item da
// refeição quando não está — senão a lista roubaria o Enter de quem digita algo novo.
function FoodPicker({ value, onChange, onPick, onEnter, state, placeholder }) {
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(0);
  const hits = searchFoods(state, value);
  const show = open && hits.length > 0;
  return (
    <div className="relative flex-1 min-w-[170px]">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setAct(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (show && e.key === "ArrowDown") { e.preventDefault(); setAct((i) => (i + 1) % hits.length); }
          else if (show && e.key === "ArrowUp") { e.preventDefault(); setAct((i) => (i - 1 + hits.length) % hits.length); }
          else if (e.key === "Escape") setOpen(false);
          else if (e.key === "Enter") {
            if (show) { e.preventDefault(); onPick(hits[act]); setOpen(false); }
            else onEnter?.();
          }
        }}
        role="combobox"
        aria-expanded={show}
        aria-autocomplete="list"
        placeholder={placeholder}
        className={`${inputCls} w-full text-[13px]`}
      />
      {show && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-40 max-h-56 overflow-y-auto ff-scroll rounded-lg border border-outline-variant bg-surface-container-highest shadow-2xl shadow-black/50">
          {hits.map((f, i) => (
            <li key={f.id}>
              <button
                onMouseDown={(e) => { e.preventDefault(); onPick(f); setOpen(false); }}
                className={`w-full px-3 py-2 text-left transition ${i === act ? "bg-primary/15" : "hover:bg-surface-variant/50"}`}
              >
                <span className="block text-[13px] text-on-surface">{f.name}</span>
                <span className="block text-[11px] text-on-surface-variant tabular-nums">
                  {f.kcal} kcal · P {f.protein} · C {f.carbs} · G {f.fat} · {isMassUnit(f.unit) ? `por ${f.portionGrams || 100} g` : `por ${f.unit}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Campos da tabela nutricional. Um componente porque a mesma linha aparece em três
// lugares (criar item, editar item, despensa) e três cópias divergem.
// Em escopo de módulo, não aninhado: componente redefinido a cada render tem
// identidade nova, e o React remonta o input — o foco pularia a cada tecla digitada.
const MacroField = ({ v, on, k, ph }) => (
  <input value={v[k]} onChange={on(k)} type="number" min="0" placeholder={ph} aria-label={ph} className={`${inputCls} w-20 text-[13px]`} />
);

function MacroInputs({ v, on, label }) {
  return (
    <>
      <Caps className="text-outline text-[9px]">{label}</Caps>
      <MacroField v={v} on={on} k="kcal" ph="kcal" />
      <MacroField v={v} on={on} k="protein" ph="P (g)" />
      <MacroField v={v} on={on} k="carbs" ph="C (g)" />
      <MacroField v={v} on={on} k="fat" ph="G (g)" />
    </>
  );
}

// Formulário da despensa. A tabela é sempre de UMA porção: em grama/ml a referência é
// "por N g" (100 por padrão, como vem no rótulo); nas outras é a porção inteira.
function FoodForm({ v, set, onSubmit, onCancel, submitLabel }) {
  const on = (k) => (e) => set({ ...v, [k]: e.target.value });
  const mass = isMassUnit(v.unit);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={v.name}
          onChange={on("name")}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          maxLength={FOOD_NAME_LEN}
          placeholder="Alimento (ex.: Ovo cozido)"
          aria-label="Nome do alimento"
          className={`${inputCls} flex-1 min-w-[170px] text-[13px]`}
        />
        <select value={v.unit} onChange={on("unit")} aria-label="Unidade da porção" className={`${inputCls} w-24 text-[13px]`}>
          {DIET_UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5">
          <Caps className="text-outline text-[9px]">{mass ? "TABELA POR" : "G/PORÇÃO"}</Caps>
          <input value={v.portionGrams} onChange={on("portionGrams")} type="number" min="0" placeholder={mass ? "100" : "opcional"} aria-label="Gramas da porção" className={`${inputCls} w-20 text-[13px]`} />
          <Caps className="text-outline text-[9px]">G</Caps>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MacroInputs v={v} on={on} label={mass ? `POR ${Math.round(num(v.portionGrams)) || 100} G` : "POR PORÇÃO"} />
        <span className="flex-1" />
        <button onClick={onSubmit} className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-[11px] flex items-center gap-1 active:scale-95 transition">
          <MI name="check" className="text-lg" /> {submitLabel}
        </button>
        {onCancel && (
          <button onClick={onCancel} aria-label="Cancelar" className="px-3 py-2 rounded-lg bg-surface-variant text-on-surface-variant active:scale-95 transition">
            <MI name="close" className="text-lg" />
          </button>
        )}
      </div>
    </div>
  );
}

// Aba DESPENSA: cadastro, correção e exclusão. Corrigir um alimento oferece empurrar a
// correção pros itens do plano que vieram dele — é o único jeito de consertar uma
// tabela errada sem revisitar refeição por refeição.
function Despensa({ state, setState, toast, confirm }) {
  const foods = foodList(state);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY_FOOD);
  const [edit, setEdit] = useState(null); // { id, ...campos }

  const fields = (v) => ({
    name: (v.name || "").trim().slice(0, FOOD_NAME_LEN),
    unit: DIET_UNITS.includes(v.unit) ? v.unit : "un",
    portionGrams: isMassUnit(v.unit) ? Math.round(num(v.portionGrams)) || 100 : Math.round(num(v.portionGrams)),
    kcal: Math.round(num(v.kcal)),
    protein: Math.round(num(v.protein) * 10) / 10,
    carbs: Math.round(num(v.carbs) * 10) / 10,
    fat: Math.round(num(v.fat) * 10) / 10,
  });

  function create() {
    const f = fields(form);
    if (!f.name) return toast("Informe o alimento", { type: "error" });
    if (foods.length >= FOODS_MAX) return toast(`Limite de ${FOODS_MAX} alimentos`, { type: "error" });
    const existing = findFoodByName(state, f.name);
    setState((prev) => upsertFood(prev, { id: existing?.id || crypto.randomUUID(), ...f }));
    toast(existing ? `"${f.name}" atualizado` : `"${f.name}" na despensa`);
    setForm(EMPTY_FOOD);
  }

  async function save() {
    const f = fields(edit);
    if (!f.name) return toast("Informe o alimento", { type: "error" });
    const used = planItemsUsingFood(state, edit.id);
    let spread = false;
    if (used > 0) {
      spread = await confirm({
        title: `Atualizar ${used} item(ns) do plano?`,
        body: `Os itens que saíram de "${f.name}" recebem a tabela nova. A quantidade de cada um é preservada. Recusando, só o cadastro muda.`,
        confirmLabel: "ATUALIZAR TAMBÉM",
        cancelLabel: "SÓ O CADASTRO",
      });
    }
    setState((prev) => {
      const next = upsertFood(prev, { id: edit.id, ...f });
      return spread ? applyFoodToPlan(next, { id: edit.id, ...f }) : next;
    });
    setEdit(null);
  }

  async function drop(food) {
    const used = planItemsUsingFood(state, food.id);
    const ok = await confirm({
      title: "Excluir da despensa?",
      body: used > 0
        ? `"${food.name}" sai da despensa. Os ${used} item(ns) já no plano continuam lá, com os valores que têm hoje.`
        : `"${food.name}" sai da despensa.`,
      confirmLabel: "EXCLUIR",
    });
    if (!ok) return;
    setState((prev) => removeFood(prev, food.id));
  }

  const shown = q.trim() ? searchFoods(state, q, FOODS_MAX) : foods;

  return (
    <div className="space-y-8">
      <section className="glass-card p-6 rounded-xl">
        <Caps className="text-outline text-[10px] block mb-3">CADASTRAR ALIMENTO</Caps>
        <FoodForm v={form} set={setForm} onSubmit={create} submitLabel="SALVAR NA DESPENSA" />
      </section>

      <section className="glass-card p-6 rounded-xl">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h3 className="font-headline-md text-headline-md text-primary">DESPENSA</h3>
          <Caps className="text-outline">{foods.length} DE {FOODS_MAX}</Caps>
          <span className="flex-1" />
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 focus-within:border-primary-container/60 transition">
            <MI name="search" className="text-outline text-base" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar alimento"
              aria-label="Buscar alimento"
              className="w-40 bg-transparent text-[13px] text-on-surface placeholder:text-outline outline-none"
            />
          </div>
        </div>

        {foods.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant">
            Vazia. Cadastre acima, ou monte um item numa refeição — ele entra aqui sozinho e fica disponível pra sempre.
          </p>
        ) : shown.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant">Nenhum alimento com esse nome.</p>
        ) : (
          <ul className="space-y-2">
            {shown.map((f) => {
              if (edit?.id === f.id)
                return (
                  <li key={f.id} className="p-3 bg-surface-container-high rounded-lg border border-primary-container/30">
                    <FoodForm v={edit} set={setEdit} onSubmit={save} onCancel={() => setEdit(null)} submitLabel="SALVAR" />
                  </li>
                );
              const used = planItemsUsingFood(state, f.id);
              return (
                <li key={f.id} className="flex items-center gap-3 p-3 bg-surface-container-high rounded-lg border border-white/5">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-on-surface truncate">
                      {f.name}
                      <span className="text-outline font-normal"> · {isMassUnit(f.unit) ? `por ${f.portionGrams || 100} g` : `por ${f.unit}${f.portionGrams ? ` (${f.portionGrams} g)` : ""}`}</span>
                    </div>
                    <div className="text-[11px] text-on-surface-variant tabular-nums">
                      {f.kcal} kcal · P {f.protein}g · C {f.carbs}g · G {f.fat}g
                    </div>
                    {used > 0 && <div className="text-[10px] text-outline">em {used} item(ns) do plano</div>}
                  </div>
                  <button onClick={() => setEdit({ id: f.id, ...f, portionGrams: f.portionGrams || "" })} aria-label={`Editar ${f.name}`} className="p-1 text-outline hover:text-primary-container transition">
                    <MI name="edit" className="text-lg" />
                  </button>
                  <button onClick={() => drop(f)} aria-label={`Excluir ${f.name}`} className="p-1 text-outline hover:text-error transition">
                    <MI name="delete" className="text-lg" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

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
  const [gStep, setGStep] = useState(10); // passo do ajuste em gramas (10 / 50 / 100)

  const plan = state.dietPlan || [];
  const saveNewFoods = state.settings?.dietSaveNewFoods !== false;
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

  // Normaliza unidade/porção/quantidade do formulário. Em massa o campo digitado é o
  // TOTAL em gramas e a tabela é "por N g" (100 se não informado, como no rótulo);
  // qty vira o fator derivado. Por unidade, qty é o que a pessoa digitou.
  function itemQtyFields(f) {
    const unit = DIET_UNITS.includes(f.unit) ? f.unit : "un";
    if (isMassUnit(unit)) {
      const base = Math.round(num(f.portionGrams)) || 100;
      const total = String(f.grams).trim() === "" ? base : num(f.grams); // vazio = uma tabela
      return { unit, portionGrams: base, qty: dietQtyFromGrams(total, base) };
    }
    return {
      unit,
      portionGrams: Math.round(num(f.portionGrams)),
      qty: num(f.qty) > 0 ? Math.round(num(f.qty) * 100) / 100 : 1,
    };
  }

  // ---- itens ----
  const getForm = (mealId) => forms[mealId] || EMPTY_ITEM;
  const setField = (mealId, key) => (e) =>
    setForms((f) => ({ ...f, [mealId]: { ...(f[mealId] || EMPTY_ITEM), [key]: e.target.value } }));

  // Escolher da despensa preenche a tabela inteira; só a quantidade fica pro usuário.
  // Em grama/ml o total começa numa tabela cheia (100 g, ou o que o alimento definir),
  // que é o palpite honesto — zero exigiria digitar antes de ver qualquer número.
  const pickFood = (mealId, f) =>
    setForms((fs) => ({
      ...fs,
      [mealId]: {
        ...EMPTY_ITEM,
        foodId: f.id,
        name: f.name,
        unit: f.unit,
        portionGrams: f.portionGrams || "",
        grams: isMassUnit(f.unit) ? f.portionGrams || 100 : "",
        kcal: f.kcal,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
      },
    }));

  // Guarda um item do plano na despensa (ou atualiza o cadastro de mesmo nome) e deixa
  // o item vinculado, pra uma correção futura no cadastro poder descer até ele.
  function bankItem(item) {
    const existing = findFoodByName(state, item.name);
    const id = existing?.id || crypto.randomUUID();
    setState((prev) => {
      const next = upsertFood(prev, { id, ...foodFromItem(item) });
      return {
        ...next,
        dietPlan: (next.dietPlan || []).map((m) => ({
          ...m,
          items: (m.items || []).map((i) => (i.id === item.id ? { ...i, foodId: id } : i)),
        })),
      };
    });
    toast(existing ? `"${item.name}" atualizado na despensa` : `"${item.name}" salvo na despensa`);
  }

  function addItem(mealId) {
    const f = getForm(mealId);
    const name = (f.name || "").trim();
    if (!name) {
      toast("Informe o alimento", { type: "error" });
      return;
    }
    // Nome que já existe na despensa reaproveita o cadastro em vez de criar um gêmeo.
    const existing = f.foodId ? null : findFoodByName(state, name);
    const autoSave = state.settings?.dietSaveNewFoods !== false;
    const bank = !f.foodId && !existing && autoSave && foodList(state).length < FOODS_MAX;
    const foodId = f.foodId || existing?.id || (bank ? crypto.randomUUID() : null);
    const item = {
      id: Date.now(),
      name: name.slice(0, 60),
      foodId,
      ...itemQtyFields(f),
      kcal: Math.round(num(f.kcal)),
      protein: Math.round(num(f.protein) * 10) / 10,
      carbs: Math.round(num(f.carbs) * 10) / 10,
      fat: Math.round(num(f.fat) * 10) / 10,
    };
    setState((prev) => {
      const next = {
        ...prev,
        dietPlan: (prev.dietPlan || []).map((m) => (m.id === mealId ? { ...m, items: [...(m.items || []), item] } : m)),
      };
      return bank ? upsertFood(next, { id: foodId, ...foodFromItem(item) }) : next;
    });
    setForms((fs) => ({ ...fs, [mealId]: EMPTY_ITEM }));
  }
  // patch direto no item — usado pela quantidade, que é ajuste de um clique
  function patchItem(mealId, itemId, patch) {
    setState((prev) => ({
      ...prev,
      dietPlan: (prev.dietPlan || []).map((m) =>
        m.id === mealId ? { ...m, items: (m.items || []).map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } : m
      ),
    }));
  }

  function removeItem(mealId, itemId) {
    setState((prev) => ({
      ...prev,
      dietPlan: (prev.dietPlan || []).map((m) => (m.id === mealId ? { ...m, items: (m.items || []).filter((i) => i.id !== itemId) } : m)),
    }));
  }

  // ---- edição de item ----
  const startEdit = (item) =>
    setEdits((es) => ({
      ...es,
      [item.id]: {
        name: item.name,
        qty: dietItemQty(item),
        unit: item.unit || "un",
        portionGrams: dietItemPortionGrams(item) || "",
        grams: dietItemTotals(item).grams || "",
        kcal: item.kcal,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      },
    }));
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
      ...itemQtyFields(f),
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
            : tab === "despensa"
              ? "Alimento cadastrado uma vez, reusado em qualquer refeição. Escolher da despensa preenche a tabela nutricional inteira."
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
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <FoodPicker
                              state={state}
                              value={ed.name}
                              onChange={(v) => setEdits((es) => ({ ...es, [e.id]: { ...es[e.id], name: v } }))}
                              onPick={(food) =>
                                setEdits((es) => ({
                                  ...es,
                                  [e.id]: {
                                    ...es[e.id],
                                    name: food.name,
                                    unit: food.unit,
                                    portionGrams: food.portionGrams || "",
                                    grams: isMassUnit(food.unit) ? food.portionGrams || 100 : es[e.id].grams,
                                    kcal: food.kcal,
                                    protein: food.protein,
                                    carbs: food.carbs,
                                    fat: food.fat,
                                  },
                                }))
                              }
                              onEnter={() => saveEdit(m.id, e.id)}
                              placeholder="Alimento (busca na despensa)"
                            />
                            <select value={ed.unit} onChange={editField(e.id, "unit")} aria-label="Unidade da porção" className={`${inputCls} w-24 text-[13px]`}>
                              {DIET_UNITS.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                            {isMassUnit(ed.unit) ? (
                              <>
                                <MassStepper
                                  grams={ed.grams}
                                  step={gStep}
                                  onStep={setGStep}
                                  onChange={(g) => setEdits((es) => ({ ...es, [e.id]: { ...es[e.id], grams: g } }))}
                                />
                                <label className="flex items-center gap-1.5">
                                  <Caps className="text-outline text-[9px]">TABELA POR</Caps>
                                  <input value={ed.portionGrams} onChange={editField(e.id, "portionGrams")} type="number" min="0" placeholder="100" aria-label="Gramas da tabela" className={`${inputCls} w-16 text-[13px]`} />
                                  <Caps className="text-outline text-[9px]">G</Caps>
                                </label>
                              </>
                            ) : (
                              <>
                                <QtyStepper value={ed.qty} onChange={(q) => setEdits((es) => ({ ...es, [e.id]: { ...es[e.id], qty: q } }))} />
                                <input value={ed.portionGrams} onChange={editField(e.id, "portionGrams")} type="number" min="0" placeholder="g/porção" aria-label="Gramas por porção" className={`${inputCls} w-24 text-[13px]`} />
                              </>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Caps className="text-outline text-[9px]">{isMassUnit(ed.unit) ? `POR ${Math.round(num(ed.portionGrams)) || 100} G` : "POR PORÇÃO"}</Caps>
                            <input value={ed.kcal} onChange={editField(e.id, "kcal")} type="number" min="0" placeholder="kcal" className={`${inputCls} w-20 text-[13px]`} />
                            <input value={ed.protein} onChange={editField(e.id, "protein")} type="number" min="0" placeholder="P (g)" className={`${inputCls} w-20 text-[13px]`} />
                            <input value={ed.carbs} onChange={editField(e.id, "carbs")} type="number" min="0" placeholder="C (g)" className={`${inputCls} w-20 text-[13px]`} />
                            <input value={ed.fat} onChange={editField(e.id, "fat")} type="number" min="0" placeholder="G (g)" className={`${inputCls} w-20 text-[13px]`} />
                            <span className="flex-1" />
                            <button onClick={() => saveEdit(m.id, e.id)} aria-label="Salvar item" className="px-3 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center py-2 active:scale-95 transition">
                              <MI name="check" className="text-lg" />
                            </button>
                            <button onClick={() => cancelEdit(e.id)} aria-label="Cancelar edição" className="px-3 rounded-lg bg-surface-variant text-on-surface-variant flex items-center justify-center py-2 active:scale-95 transition">
                              <MI name="close" className="text-lg" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const t = dietItemTotals(e);
                  const pg = dietItemPortionGrams(e);
                  const mass = isMassUnit(e.unit);
                  const base = dietItemBaseGrams(e);
                  const scaled = t.qty !== 1;
                  return (
                    <div key={e.id} className="flex items-center gap-3 p-3 bg-surface-container-high rounded-lg border border-white/5">
                      {/* ajuste recalcula na hora: em massa o controle é o total em gramas,
                          por unidade é a quantidade de porções */}
                      {mass ? (
                        <MassStepper
                          grams={t.grams}
                          step={gStep}
                          onStep={setGStep}
                          onChange={(g) => patchItem(m.id, e.id, { qty: dietQtyFromGrams(g, base) })}
                        />
                      ) : (
                        <QtyStepper value={t.qty} unit={e.unit || "un"} onChange={(q) => patchItem(m.id, e.id, { qty: q })} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-on-surface truncate">
                          {e.name}
                          {!mass && t.grams ? <span className="text-outline font-normal"> · {gFmt(t.grams)}</span> : null}
                        </div>
                        <div className="text-[11px] text-on-surface-variant tabular-nums">
                          {t.kcal} kcal · P {t.protein}g · C {t.carbs}g · G {t.fat}g
                        </div>
                        {(scaled || mass) && (
                          <div className="text-[10px] text-outline tabular-nums">
                            {mass ? `por ${gFmt(base)}` : "porção"}: {e.kcal || 0} kcal · P {e.protein || 0} · C {e.carbs || 0} · G {e.fat || 0}
                            {!mass && pg ? ` · ${gFmt(pg)}` : ""}
                          </div>
                        )}
                      </div>
                      {(() => {
                        const known = findFoodByName(state, e.name);
                        return (
                          <button
                            onClick={() => bankItem(e)}
                            aria-label={known ? `Atualizar ${e.name} na despensa` : `Salvar ${e.name} na despensa`}
                            title={known ? "Já está na despensa · atualizar com estes valores" : "Salvar na despensa pra reusar"}
                            className={`p-1 transition ${known ? "text-primary-container/60 hover:text-primary-container" : "text-outline hover:text-primary-container"}`}
                          >
                            <MI name={known ? "bookmark_added" : "bookmark_add"} className="text-lg" />
                          </button>
                        );
                      })()}
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
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <FoodPicker
                  state={state}
                  value={f.name}
                  onChange={(v) => setForms((fs) => ({ ...fs, [m.id]: { ...getForm(m.id), name: v, foodId: null } }))}
                  onPick={(food) => pickFood(m.id, food)}
                  onEnter={() => addItem(m.id)}
                  placeholder="Alimento (busca na despensa)"
                />
                <select value={f.unit} onChange={setField(m.id, "unit")} aria-label="Unidade da porção" className={`${inputCls} w-24 text-[13px]`}>
                  {DIET_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                {isMassUnit(f.unit) ? (
                  <>
                    <MassStepper
                      grams={f.grams}
                      step={gStep}
                      onStep={setGStep}
                      onChange={(g) => setForms((fs) => ({ ...fs, [m.id]: { ...getForm(m.id), grams: g } }))}
                    />
                    <label className="flex items-center gap-1.5">
                      <Caps className="text-outline text-[9px]">TABELA POR</Caps>
                      <input value={f.portionGrams} onChange={setField(m.id, "portionGrams")} type="number" min="0" placeholder="100" aria-label="Gramas da tabela" className={`${inputCls} w-16 text-[13px]`} />
                      <Caps className="text-outline text-[9px]">G</Caps>
                    </label>
                  </>
                ) : (
                  <>
                    <QtyStepper value={f.qty} onChange={(q) => setForms((fs) => ({ ...fs, [m.id]: { ...getForm(m.id), qty: q } }))} />
                    <input value={f.portionGrams} onChange={setField(m.id, "portionGrams")} type="number" min="0" placeholder="g/porção" aria-label="Gramas por porção" className={`${inputCls} w-24 text-[13px]`} />
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Caps className="text-outline text-[9px]">{isMassUnit(f.unit) ? `POR ${Math.round(num(f.portionGrams)) || 100} G` : "POR PORÇÃO"}</Caps>
                <input value={f.kcal} onChange={setField(m.id, "kcal")} onKeyDown={(e) => e.key === "Enter" && addItem(m.id)} type="number" min="0" placeholder="kcal" className={`${inputCls} w-20 text-[13px]`} />
                <input value={f.protein} onChange={setField(m.id, "protein")} onKeyDown={(e) => e.key === "Enter" && addItem(m.id)} type="number" min="0" placeholder="P (g)" className={`${inputCls} w-20 text-[13px]`} />
                <input value={f.carbs} onChange={setField(m.id, "carbs")} onKeyDown={(e) => e.key === "Enter" && addItem(m.id)} type="number" min="0" placeholder="C (g)" className={`${inputCls} w-20 text-[13px]`} />
                <input value={f.fat} onChange={setField(m.id, "fat")} onKeyDown={(e) => e.key === "Enter" && addItem(m.id)} type="number" min="0" placeholder="G (g)" className={`${inputCls} w-20 text-[13px]`} />
                {(() => {
                  const factor = isMassUnit(f.unit)
                    ? dietQtyFromGrams(num(f.grams), Math.round(num(f.portionGrams)) || 100)
                    : num(f.qty);
                  return factor > 0 && factor !== 1 && num(f.kcal) > 0 ? (
                    <Caps className="text-primary-container text-[9px] tabular-nums">= {Math.round(num(f.kcal) * factor)} KCAL</Caps>
                  ) : null;
                })()}
                <span className="flex-1" />
                {f.foodId ? (
                  <Caps className="text-primary-container text-[9px] flex items-center gap-1">
                    <MI name="kitchen" className="text-sm" /> DA DESPENSA
                  </Caps>
                ) : (
                  <button
                    onClick={() => setSetting("dietSaveNewFoods", !saveNewFoods)}
                    role="switch"
                    aria-checked={saveNewFoods}
                    title="Alimento novo também é cadastrado na despensa"
                    className={`flex items-center gap-1 font-label-caps text-[9px] transition ${saveNewFoods ? "text-primary-container" : "text-outline hover:text-on-surface-variant"}`}
                  >
                    <MI name={saveNewFoods ? "check_box" : "check_box_outline_blank"} className="text-base" /> SALVAR NA DESPENSA
                  </button>
                )}
                <button onClick={() => addItem(m.id)} aria-label="Adicionar item" className="px-4 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center gap-1 py-2 active:scale-95 transition font-label-caps text-[11px]">
                  <MI name="add" className="text-lg" /> ADD
                </button>
              </div>
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

      {tab === "despensa" && <Despensa state={state} setState={setState} toast={toast} confirm={confirm} />}

      {tab === "perfil" && <NutriProfile state={state} setState={setState} toast={toast} />}

    </div>
  );
}
