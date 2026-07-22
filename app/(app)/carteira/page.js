"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, Select, StatTile, inputCls } from "@/components/ui";
import { fmtMoney, monthKey, getDateStr, EXPENSE_CATS, INCOME_CATS } from "@/lib/state";

const TABS_W = [
  { id: "resumo", label: "RESUMO", icon: "pie_chart" },
  { id: "fixas", label: "FIXAS", icon: "event_repeat" },
  { id: "metas", label: "METAS", icon: "savings" },
];

const parseAmt = (v) => Math.round((parseFloat(String(v).replace(",", ".")) || 0) * 100) / 100;
const pad2 = (n) => String(n).padStart(2, "0");
const shiftMonth = (mk, delta) => {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
const monthLabel = (mk) => {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export default function CarteiraPage() {
  const { state, setState, toast, confirm, setSetting } = useApp();
  const [tab, setTab] = useState("resumo");
  const [selMonth, setSelMonth] = useState(monthKey(getDateStr(0)));

  const txs = state.transactions || [];
  const wallet = state.wallet || { fixed: [], goals: [] };
  const budget = state.settings.walletBudget || 0;
  const customCats = state.settings.walletCats || [];

  const monthTxs = txs
    .filter((t) => monthKey(t.date) === selMonth)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const income = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const budgetPct = budget > 0 ? Math.min(100, Math.round((expense / budget) * 100)) : 0;
  const overBudget = budget > 0 && expense > budget;
  // fixas ainda não pagas neste mês = dinheiro comprometido → descontar do livre
  const pendingFixed = (wallet.fixed || []).filter((f) => !f.paid?.[selMonth]).reduce((s, f) => s + (f.amount || 0), 0);
  const free = balance - pendingFixed;

  // ---- lançamento ----
  const [form, setForm] = useState({ type: "expense", amount: "", date: getDateStr(0), category: "", note: "" });
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const baseCats = form.type === "income" ? INCOME_CATS : EXPENSE_CATS;
  const catOptions = [...new Set([...baseCats, ...customCats])];
  const [newCat, setNewCat] = useState("");

  function addTx() {
    const amount = parseAmt(form.amount);
    if (amount <= 0) return toast("Informe o valor", { type: "error" });
    const tx = {
      id: crypto.randomUUID(),
      date: form.date || getDateStr(0),
      type: form.type,
      amount,
      category: form.category || "Outros",
      note: form.note.slice(0, 120),
    };
    setState((prev) => ({ ...prev, transactions: [tx, ...(prev.transactions || [])] }));
    setForm((f) => ({ ...f, amount: "", note: "" }));
    toast("Lançamento salvo", { icon: form.type === "income" ? "trending_up" : "trending_down" });
  }
  async function removeTx(id) {
    const ok = await confirm({ title: "Excluir lançamento?", body: "Some do resumo do mês.", confirmLabel: "EXCLUIR" });
    if (!ok) return;
    setState((prev) => ({ ...prev, transactions: (prev.transactions || []).filter((t) => t.id !== id) }));
  }
  function addCategory() {
    const c = newCat.trim();
    if (!c || catOptions.includes(c)) return setNewCat("");
    setSetting("walletCats", [...customCats, c]);
    setF("category", c);
    setNewCat("");
  }

  // ---- despesas fixas ----
  const [fx, setFx] = useState({ name: "", amount: "", category: "Contas", day: "" });
  const fixedTotal = (wallet.fixed || []).reduce((s, f) => s + (f.amount || 0), 0);
  function addFixed() {
    const amount = parseAmt(fx.amount);
    if (!fx.name.trim() || amount <= 0) return toast("Nome e valor obrigatórios", { type: "error" });
    const item = { id: crypto.randomUUID(), name: fx.name.trim().slice(0, 60), amount, category: fx.category || "Contas", day: Math.min(31, Math.max(1, parseInt(fx.day) || 1)) };
    setState((prev) => ({ ...prev, wallet: { ...prev.wallet, fixed: [...(prev.wallet?.fixed || []), item] } }));
    setFx({ name: "", amount: "", category: "Contas", day: "" });
  }
  function removeFixed(id) {
    setState((prev) => ({ ...prev, wallet: { ...prev.wallet, fixed: (prev.wallet?.fixed || []).filter((f) => f.id !== id) } }));
  }
  const isPaid = (f) => !!f.paid?.[selMonth];
  function togglePaid(f) {
    const paidId = f.paid?.[selMonth];
    setState((prev) => {
      let transactions = prev.transactions || [];
      let newId = null;
      if (paidId) {
        transactions = transactions.filter((t) => t.id !== paidId); // desmarca → remove a transação
      } else {
        const tx = { id: crypto.randomUUID(), date: `${selMonth}-${pad2(Math.min(28, f.day || 1))}`, type: "expense", amount: f.amount, category: f.category || "Contas", note: `Fixa: ${f.name}` };
        transactions = [tx, ...transactions];
        newId = tx.id;
      }
      const fixed = (prev.wallet?.fixed || []).map((x) => {
        if (x.id !== f.id) return x;
        const paid = { ...(x.paid || {}) };
        if (paidId) delete paid[selMonth];
        else paid[selMonth] = newId;
        return { ...x, paid };
      });
      return { ...prev, transactions, wallet: { ...prev.wallet, fixed } };
    });
    toast(paidId ? `"${f.name}" desmarcada` : `"${f.name}" paga`, { sub: monthLabel(selMonth), icon: paidId ? "undo" : "check_circle" });
  }

  // ---- metas ----
  const [goalForm, setGoalForm] = useState({ name: "", target: "" });
  const [aporte, setAporte] = useState({});
  function addGoal() {
    const target = parseAmt(goalForm.target);
    if (!goalForm.name.trim() || target <= 0) return toast("Nome e alvo obrigatórios", { type: "error" });
    const g = { id: crypto.randomUUID(), name: goalForm.name.trim().slice(0, 60), target, saved: 0 };
    setState((prev) => ({ ...prev, wallet: { ...prev.wallet, goals: [...(prev.wallet?.goals || []), g] } }));
    setGoalForm({ name: "", target: "" });
  }
  function removeGoal(id) {
    setState((prev) => ({ ...prev, wallet: { ...prev.wallet, goals: (prev.wallet?.goals || []).filter((g) => g.id !== id) } }));
  }
  function moveGoal(id, sign) {
    const delta = parseAmt(aporte[id]) * sign;
    if (!delta) return;
    setState((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        goals: (prev.wallet?.goals || []).map((g) => (g.id === id ? { ...g, saved: Math.max(0, Math.round((g.saved + delta) * 100) / 100) } : g)),
      },
    }));
    setAporte((a) => ({ ...a, [id]: "" }));
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-headline-lg text-headline-lg text-primary uppercase">Carteira</h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">Controle suas finanças: lançamentos, orçamento, despesas fixas e metas.</p>
      </section>

      {/* Abas */}
      <div role="tablist" className="flex rounded-xl overflow-hidden border border-white/10">
        {TABS_W.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 font-label-caps text-[11px] flex items-center justify-center gap-1.5 transition ${
              tab === t.id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
            }`}
          >
            <MI name={t.icon} className="text-base" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "resumo" && (
        <>
          {/* switcher de mês */}
          <div className="flex items-center justify-between">
            <button onClick={() => setSelMonth((m) => shiftMonth(m, -1))} aria-label="Mês anterior" className="w-9 h-9 rounded-full bg-surface-container-high grid place-items-center active:scale-95 transition">
              <MI name="chevron_left" />
            </button>
            <Caps className="text-primary text-[13px] capitalize">{monthLabel(selMonth)}</Caps>
            <button onClick={() => setSelMonth((m) => shiftMonth(m, 1))} aria-label="Próximo mês" className="w-9 h-9 rounded-full bg-surface-container-high grid place-items-center active:scale-95 transition">
              <MI name="chevron_right" />
            </button>
          </div>

          <section className="grid grid-cols-3 gap-card-gap">
            <StatTile label="RECEITAS" value={fmtMoney(income)} />
            <StatTile label="DESPESAS" value={fmtMoney(expense)} />
            <StatTile label="SALDO" value={fmtMoney(balance)}>
              <MI name={balance >= 0 ? "trending_up" : "trending_down"} className={balance >= 0 ? "text-primary-container" : "text-error"} />
            </StatTile>
          </section>

          {/* livre após descontar fixas pendentes */}
          <section className="glass-card p-5 rounded-xl flex items-center justify-between gap-3">
            <div>
              <Caps className="text-outline text-[10px]">LIVRE (após fixas pendentes)</Caps>
              <div className={`font-headline-lg text-headline-lg ${free >= 0 ? "text-primary" : "text-error"}`}>{fmtMoney(free)}</div>
            </div>
            <div className="text-right">
              <Caps className="text-outline text-[9px]">FIXAS PENDENTES</Caps>
              <div className="font-label-caps text-[13px] text-error">−{fmtMoney(pendingFixed)}</div>
            </div>
          </section>

          {/* orçamento */}
          <section className="glass-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-3 gap-3">
              <Caps className="text-outline text-[10px]">ORÇAMENTO MENSAL</Caps>
              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant text-[12px]">R$</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={budget || ""}
                  onChange={(e) => setSetting("walletBudget", Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-28 bg-surface-container-highest px-3 py-1.5 rounded-lg border border-white/10 focus:border-primary/50 outline-none text-on-surface font-headline-md text-headline-md text-right"
                />
              </div>
            </div>
            {budget > 0 ? (
              <>
                <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${overBudget ? "bg-error" : "bg-primary-container"}`} style={{ width: `${budgetPct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] font-label-caps mt-1.5">
                  <span className={overBudget ? "text-error" : "text-on-surface-variant"}>{fmtMoney(expense)} gasto</span>
                  <span className="text-outline">{overBudget ? `${fmtMoney(expense - budget)} acima` : `${fmtMoney(budget - expense)} restante`}</span>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-outline">Defina um teto pra acompanhar seus gastos.</p>
            )}
          </section>

          {/* lançamento */}
          <section className="glass-card p-6 rounded-xl flex flex-col gap-3">
            <Caps className="text-outline text-[10px]">NOVO LANÇAMENTO</Caps>
            <div className="flex gap-1.5 bg-surface-container-highest p-1 rounded-lg w-fit">
              {["expense", "income"].map((tp) => (
                <button
                  key={tp}
                  onClick={() => setF("type", tp)}
                  className={`px-4 py-1.5 rounded-md font-label-caps text-[11px] transition ${
                    form.type === tp ? (tp === "income" ? "bg-primary-container text-on-primary-container" : "bg-error text-on-error") : "text-on-surface-variant"
                  }`}
                >
                  {tp === "income" ? "RECEITA" : "DESPESA"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input inputMode="decimal" value={form.amount} onChange={(e) => setF("amount", e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTx()} placeholder="Valor (R$)" className={`${inputCls} w-full`} />
              <input type="date" value={form.date} max={getDateStr(0)} onChange={(e) => setF("date", e.target.value || getDateStr(0))} className={`${inputCls} w-full`} />
            </div>
            <Select value={form.category} options={catOptions} onChange={(v) => setF("category", v)} placeholder="Categoria" />
            <div className="flex gap-2">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} placeholder="Nova categoria" className={`${inputCls} flex-1 text-[13px]`} />
              <button onClick={addCategory} className="px-3 rounded-lg border border-primary/40 text-primary font-label-caps text-[11px] active:scale-95 transition shrink-0">+ CAT</button>
            </div>
            <input value={form.note} onChange={(e) => setF("note", e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTx()} placeholder="Nota (opcional)" className={`${inputCls} w-full`} />
            <button onClick={addTx} className="w-full py-3 rounded-lg bg-primary text-on-primary font-label-caps text-[12px] tracking-widest active:scale-95 transition">
              LANÇAR
            </button>
          </section>

          {/* lista do mês */}
          <section>
            <Caps className="text-outline text-[10px] mb-2 block">LANÇAMENTOS · {monthTxs.length}</Caps>
            {monthTxs.length === 0 ? (
              <p className="text-[13px] text-outline glass-card rounded-xl p-6 text-center">Nenhum lançamento neste mês.</p>
            ) : (
              <ul className="space-y-1.5">
                {monthTxs.map((t) => (
                  <li key={t.id} className="glass-card rounded-lg p-3 flex items-center gap-3">
                    <MI name={t.type === "income" ? "arrow_upward" : "arrow_downward"} className={t.type === "income" ? "text-primary-container" : "text-error"} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-on-surface truncate">{t.category}{t.note ? ` · ${t.note}` : ""}</div>
                      <Caps className="text-outline text-[9px]">{t.date.slice(8, 10)}/{t.date.slice(5, 7)}</Caps>
                    </div>
                    <span className={`font-label-caps text-[13px] shrink-0 ${t.type === "income" ? "text-primary-container" : "text-error"}`}>
                      {t.type === "income" ? "+" : "−"}{fmtMoney(t.amount)}
                    </span>
                    <button onClick={() => removeTx(t.id)} aria-label="Excluir" className="text-outline hover:text-error transition shrink-0">
                      <MI name="delete" className="text-lg" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === "fixas" && (
        <>
          {/* switcher de mês (define o mês que você está marcando como pago) */}
          <div className="flex items-center justify-between">
            <button onClick={() => setSelMonth((m) => shiftMonth(m, -1))} aria-label="Mês anterior" className="w-9 h-9 rounded-full bg-surface-container-high grid place-items-center active:scale-95 transition">
              <MI name="chevron_left" />
            </button>
            <Caps className="text-primary text-[13px] capitalize">{monthLabel(selMonth)}</Caps>
            <button onClick={() => setSelMonth((m) => shiftMonth(m, 1))} aria-label="Próximo mês" className="w-9 h-9 rounded-full bg-surface-container-high grid place-items-center active:scale-95 transition">
              <MI name="chevron_right" />
            </button>
          </div>

          <section className="glass-card p-6 rounded-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Caps className="text-outline text-[10px]">DESPESAS FIXAS</Caps>
              <Caps className="text-primary text-[11px]">TOTAL {fmtMoney(fixedTotal)}/MÊS</Caps>
            </div>
            {(wallet.fixed || []).length === 0 ? (
              <p className="text-[12px] text-outline">Cadastre gastos que se repetem todo mês (aluguel, assinaturas...).</p>
            ) : (
              <>
                <Caps className="text-outline text-[9px]">{wallet.fixed.filter(isPaid).length}/{wallet.fixed.length} pagas em {monthLabel(selMonth)}</Caps>
                <ul className="space-y-1.5">
                  {wallet.fixed.map((f) => {
                    const paid = isPaid(f);
                    return (
                      <li key={f.id} className={`rounded-lg p-3 flex items-center gap-3 transition ${paid ? "bg-primary-container/10 border border-primary-container/30" : "bg-surface-container-high"}`}>
                        <button onClick={() => togglePaid(f)} aria-label={paid ? "Desmarcar" : "Marcar como paga"} className="shrink-0">
                          <MI name={paid ? "check_circle" : "radio_button_unchecked"} fill={paid} className={paid ? "text-primary-container" : "text-outline"} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[13px] truncate ${paid ? "text-on-surface-variant line-through" : "text-on-surface"}`}>{f.name}</div>
                          <Caps className="text-outline text-[9px]">{f.category} · dia {f.day} · {paid ? "PAGA" : "PENDENTE"}</Caps>
                        </div>
                        <span className="font-label-caps text-[13px] text-error shrink-0">{fmtMoney(f.amount)}</span>
                        <button onClick={() => removeFixed(f.id)} aria-label="Excluir" className="text-outline hover:text-error transition shrink-0">
                          <MI name="delete" className="text-lg" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <section className="glass-card p-6 rounded-xl flex flex-col gap-3">
            <Caps className="text-outline text-[10px]">NOVA DESPESA FIXA</Caps>
            <input value={fx.name} onChange={(e) => setFx((s) => ({ ...s, name: e.target.value }))} placeholder="Nome (ex.: Aluguel)" className={`${inputCls} w-full`} />
            <div className="grid grid-cols-2 gap-3">
              <input inputMode="decimal" value={fx.amount} onChange={(e) => setFx((s) => ({ ...s, amount: e.target.value }))} placeholder="Valor (R$)" className={`${inputCls} w-full`} />
              <input type="number" min="1" max="31" value={fx.day} onChange={(e) => setFx((s) => ({ ...s, day: e.target.value }))} placeholder="Dia (1-31)" className={`${inputCls} w-full`} />
            </div>
            <Select value={fx.category} options={[...new Set([...EXPENSE_CATS, ...customCats])]} onChange={(v) => setFx((s) => ({ ...s, category: v }))} placeholder="Categoria" />
            <button onClick={addFixed} className="w-full py-3 rounded-lg bg-primary text-on-primary font-label-caps text-[12px] tracking-widest active:scale-95 transition">ADICIONAR</button>
          </section>
        </>
      )}

      {tab === "metas" && (
        <>
          <section className="space-y-3">
            {(wallet.goals || []).length === 0 ? (
              <p className="text-[13px] text-outline glass-card rounded-xl p-6 text-center">Nenhuma meta ainda. Crie um objetivo de economia abaixo.</p>
            ) : (
              wallet.goals.map((g) => {
                const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
                return (
                  <div key={g.id} className="glass-card p-5 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-headline-md text-[16px] text-primary">{g.name}</div>
                        <Caps className="text-outline text-[10px]">{fmtMoney(g.saved)} de {fmtMoney(g.target)} · {pct}%</Caps>
                      </div>
                      <button onClick={() => removeGoal(g.id)} aria-label="Excluir meta" className="text-outline hover:text-error transition">
                        <MI name="delete" className="text-lg" />
                      </button>
                    </div>
                    <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full bg-primary-container transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex gap-2">
                      <input inputMode="decimal" value={aporte[g.id] || ""} onChange={(e) => setAporte((a) => ({ ...a, [g.id]: e.target.value }))} placeholder="Valor (R$)" className={`${inputCls} flex-1 text-[13px]`} />
                      <button onClick={() => moveGoal(g.id, 1)} className="px-3 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-[10px] active:scale-95 transition">GUARDAR</button>
                      <button onClick={() => moveGoal(g.id, -1)} className="px-3 rounded-lg border border-white/15 text-on-surface-variant font-label-caps text-[10px] active:scale-95 transition">TIRAR</button>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <section className="glass-card p-6 rounded-xl flex flex-col gap-3">
            <Caps className="text-outline text-[10px]">NOVA META</Caps>
            <input value={goalForm.name} onChange={(e) => setGoalForm((s) => ({ ...s, name: e.target.value }))} placeholder="Nome (ex.: Reserva, Viagem)" className={`${inputCls} w-full`} />
            <input inputMode="decimal" value={goalForm.target} onChange={(e) => setGoalForm((s) => ({ ...s, target: e.target.value }))} placeholder="Alvo (R$)" className={`${inputCls} w-full`} />
            <button onClick={addGoal} className="w-full py-3 rounded-lg bg-primary text-on-primary font-label-caps text-[12px] tracking-widest active:scale-95 transition">CRIAR META</button>
          </section>
        </>
      )}
    </div>
  );
}
