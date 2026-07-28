"use client";

// Calculadora de energia e macros. Tudo aqui é ESTIMATIVA estatística — o painel diz isso
// na cara, porque número redondo numa tela passa uma confiança que a fórmula não tem.
//
// Duas decisões deliberadas de honestidade:
//   1. dia da semana sem histórico não recebe número inventado, recebe "sem dados";
//   2. micronutriente é tabela de REFERÊNCIA por idade/sexo, não cálculo — e o painel
//      avisa que o app não rastreia consumo de micro (item de plano só tem macro).

import { useState } from "react";
import { MI, Caps, inputCls } from "@/components/ui";
import { LineChart } from "@/components/charts";
import {
  BODY_GOALS,
  ageFrom,
  bmrFor,
  currentWeight,
  weightSeries,
  tdeeForDate,
  weeklyEnergy,
  macroTargets,
  microReference,
  getDateStr,
  DOW_SHORT,
} from "@/lib/state";

const fmt = (n) => (n === null || n === undefined ? "—" : new Intl.NumberFormat("pt-BR").format(Math.round(n)));

function Field({ label, hint, children }) {
  return (
    <div>
      <Caps className="text-outline text-[10px] mb-1.5 block">{label}</Caps>
      {children}
      {hint && <p className="text-[11px] text-outline mt-1">{hint}</p>}
    </div>
  );
}

function Row({ label, value, unit, strong, tone }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-[13px] text-on-surface-variant">{label}</span>
      <span className={`tabular-nums shrink-0 ${strong ? "font-headline-md text-[17px]" : "text-[13px]"} ${tone || "text-on-surface"}`}>
        {value}
        {unit && <span className="text-[11px] text-outline ml-1">{unit}</span>}
      </span>
    </div>
  );
}

export default function NutriProfile({ state, setState, toast }) {
  const body = state.body || {};
  const [wInput, setWInput] = useState("");
  const [wDate, setWDate] = useState(getDateStr(0));
  const [showMicros, setShowMicros] = useState(false);

  const setBody = (patch) => setState((prev) => ({ ...prev, body: { ...(prev.body || {}), ...patch } }));

  const kg = currentWeight(state);
  const age = ageFrom(body.birth);
  const bmr = bmrFor(body, kg);
  const today = tdeeForDate(state, getDateStr(0), kg);
  const week = weeklyEnergy(state, kg);
  const target = macroTargets(state, kg);
  const series = weightSeries(state).slice(-30);

  function addWeight() {
    const n = parseFloat(String(wInput).replace(",", "."));
    if (!(n > 20 && n < 400)) return toast("Peso inválido", { type: "error" });
    setState((prev) => ({ ...prev, weights: { ...(prev.weights || {}), [wDate]: Math.round(n * 10) / 10 } }));
    setWInput("");
    toast("Pesagem registrada", { sub: `${n} kg em ${wDate.slice(8, 10)}/${wDate.slice(5, 7)}`, icon: "monitor_weight" });
  }
  function removeWeight(date) {
    setState((prev) => {
      const w = { ...(prev.weights || {}) };
      delete w[date];
      return { ...prev, weights: w };
    });
  }

  function applyGoals() {
    if (!target) return;
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        dietKcalGoal: target.kcal,
        dietProteinGoal: target.protein,
        dietCarbGoal: target.carbs,
        dietFatGoal: target.fat,
      },
    }));
    toast("Metas atualizadas", { sub: `${fmt(target.kcal)} kcal · P ${target.protein} · C ${target.carbs} · G ${target.fat}`, icon: "flag" });
  }

  const missing = [];
  if (!body.sex) missing.push("sexo");
  if (!body.birth) missing.push("nascimento");
  if (!body.heightCm) missing.push("altura");
  if (!kg) missing.push("uma pesagem");

  return (
    <div className="space-y-gutter">
      {/* ---------- perfil ---------- */}
      <section className="glass-card p-6 rounded-xl space-y-4">
        <div>
          <h3 className="font-headline-md text-headline-md text-primary">Perfil corporal</h3>
          <p className="text-[12px] text-on-surface-variant">Base do cálculo. A idade sai da data de nascimento, então nunca fica velha.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="SEXO BIOLÓGICO" hint="A fórmula de basal usa esse dado; não há opção neutra que produza número válido.">
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {[
                { id: "m", label: "MASCULINO" },
                { id: "f", label: "FEMININO" },
              ].map((o) => (
                <button
                  key={o.id}
                  onClick={() => setBody({ sex: o.id })}
                  className={`flex-1 px-3 py-2 font-label-caps text-[10px] transition ${
                    body.sex === o.id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="NASCIMENTO">
            <input type="date" value={body.birth || ""} onChange={(e) => setBody({ birth: e.target.value })} className={`${inputCls} w-full`} />
          </Field>

          <Field label="ALTURA (CM)">
            <input
              type="number"
              min={100}
              max={250}
              value={body.heightCm || ""}
              onChange={(e) => setBody({ heightCm: parseInt(e.target.value, 10) || 0 })}
              className={`${inputCls} w-full`}
            />
          </Field>

          <Field label="% DE GORDURA (OPCIONAL)" hint="Se você souber, o cálculo passa a usar massa magra e fica melhor.">
            <input
              type="number"
              min={3}
              max={70}
              step="0.5"
              placeholder="não sei"
              value={body.bodyFatPct ?? ""}
              onChange={(e) => setBody({ bodyFatPct: e.target.value === "" ? null : parseFloat(e.target.value) })}
              className={`${inputCls} w-full`}
            />
          </Field>
        </div>

        <Field label="OBJETIVO">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {BODY_GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setBody({ goal: g.id })}
                className={`flex-1 px-2 py-2 font-label-caps text-[10px] transition ${
                  (body.goal || "maintain") === g.id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
                }`}
              >
                {g.label.toUpperCase()}
              </button>
            ))}
          </div>
        </Field>

        {(body.goal || "maintain") !== "maintain" && (
          <Field label={`RITMO — ${(body.ratePct ?? 0.5).toFixed(2).replace(".", ",")}% DO PESO POR SEMANA`} hint="0,5% por semana é o ritmo que costuma preservar massa. Acima de 1% o corpo cobra em músculo.">
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={body.ratePct ?? 0.5}
              onChange={(e) => setBody({ ratePct: parseFloat(e.target.value) })}
              className="w-full accent-[var(--color-primary-container)]"
            />
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label={`PROTEÍNA — ${(body.proteinPerKg ?? 1.8).toFixed(1)} G/KG`}>
            <input type="range" min={0.8} max={3} step={0.1} value={body.proteinPerKg ?? 1.8} onChange={(e) => setBody({ proteinPerKg: parseFloat(e.target.value) })} className="w-full accent-[var(--color-primary-container)]" />
          </Field>
          <Field label={`GORDURA — ${(body.fatPerKg ?? 0.8).toFixed(1)} G/KG`}>
            <input type="range" min={0.4} max={1.5} step={0.1} value={body.fatPerKg ?? 0.8} onChange={(e) => setBody({ fatPerKg: parseFloat(e.target.value) })} className="w-full accent-[var(--color-primary-container)]" />
          </Field>
          <Field label={`VIDA FORA DO TREINO — ×${(body.neat ?? 1.2).toFixed(2)}`} hint="1,2 = trabalho sentado. Suba se você anda muito no dia.">
            <input type="range" min={1.1} max={1.6} step={0.05} value={body.neat ?? 1.2} onChange={(e) => setBody({ neat: parseFloat(e.target.value) })} className="w-full accent-[var(--color-primary-container)]" />
          </Field>
        </div>
      </section>

      {/* ---------- pesagens ---------- */}
      <section className="glass-card p-6 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-headline-md text-headline-md text-primary">Pesagens</h3>
            <p className="text-[12px] text-on-surface-variant">A linha clara é a média de 7 dias — é nela que se olha. O dia isolado oscila com água e intestino.</p>
          </div>
          {kg && <span className="font-headline-lg text-[24px] text-primary tabular-nums shrink-0">{kg} kg</span>}
        </div>

        <div className="flex items-end gap-2 mb-4 flex-wrap">
          <div className="flex-1 min-w-[110px]">
            <Caps className="text-outline text-[10px] mb-1.5 block">PESO (KG)</Caps>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={wInput}
              onChange={(e) => setWInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWeight()}
              placeholder="ex: 78,4"
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="min-w-[140px]">
            <Caps className="text-outline text-[10px] mb-1.5 block">DATA</Caps>
            <input type="date" value={wDate} max={getDateStr(0)} onChange={(e) => setWDate(e.target.value)} className={`${inputCls} w-full`} />
          </div>
          <button onClick={addWeight} className="px-4 py-2.5 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-[11px] active:scale-95 transition">
            REGISTRAR
          </button>
        </div>

        {series.length >= 2 ? (
          <>
            <LineChart
              days={series.map((s) => s.date)}
              values={series.map((s) => s.kg)}
              goal={null}
              format={(v) => `${v} kg`}
              ariaLabel="Evolução do peso"
              xLabel={(d) => d.slice(8, 10)}
              height={180}
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {series.slice(-8).reverse().map((s) => (
                <button
                  key={s.date}
                  onClick={() => removeWeight(s.date)}
                  title="Clique pra remover"
                  className="px-2 py-1 rounded-full border border-white/10 text-[10px] font-label-caps text-outline hover:border-error/40 hover:text-error transition tabular-nums"
                >
                  {s.date.slice(8, 10)}/{s.date.slice(5, 7)} · {s.kg}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-outline text-center py-6">
            {series.length === 1 ? "Uma pesagem registrada. Com duas o gráfico aparece." : "Nenhuma pesagem ainda."}
          </p>
        )}
      </section>

      {/* ---------- resultado ---------- */}
      <section className="glass-card p-6 rounded-xl">
        <h3 className="font-headline-md text-headline-md text-primary mb-1">Gasto e metas</h3>
        {missing.length > 0 ? (
          <p className="text-[13px] text-outline py-6 text-center">
            Falta informar: <span className="text-on-surface-variant">{missing.join(", ")}</span>.
          </p>
        ) : (
          <>
            <p className="text-[12px] text-on-surface-variant mb-4">
              Basal por <span className="text-on-surface">{bmr.formula}</span>
              {bmr.usesLean ? " (com massa magra)" : ""} · {age} anos · {kg} kg
            </p>

            <div className="rounded-lg border border-white/10 divide-y divide-white/5 mb-4">
              <Row label="Basal (corpo em repouso)" value={fmt(bmr.kcal)} unit="kcal" />
              <Row label="Manutenção (média da semana)" value={fmt(target.maintenance)} unit="kcal" />
              <Row label="Hoje até agora" value={fmt(today?.total)} unit="kcal" tone="text-on-surface-variant" />
              <Row
                label={`Alvo — ${(BODY_GOALS.find((g) => g.id === (body.goal || "maintain")) || {}).label.toLowerCase()}`}
                value={fmt(target.kcal)}
                unit="kcal"
                strong
                tone="text-primary"
              />
            </div>

            {today?.sessions > 0 && (
              <p className="text-[11px] text-outline mb-4">
                Hoje: basal ×{(body.neat ?? 1.2).toFixed(2)} = {fmt(today.base)} kcal + {today.sessions} treino(s) = {fmt(today.training)} kcal.
              </p>
            )}

            {target.clampedToBmr && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-error/40 bg-error/5 px-3 py-2">
                <MI name="warning" className="text-error text-lg shrink-0" />
                <p className="text-[12px] text-on-surface">
                  O ritmo escolhido levaria o alvo <strong className="font-semibold">abaixo do seu basal</strong>. O valor foi travado no basal — comer abaixo do
                  gasto mínimo do corpo não é déficit, é privação. Reduza o ritmo.
                </p>
              </div>
            )}
            {!target.clampedToBmr && target.aggressive && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary-container/40 bg-primary-container/5 px-3 py-2">
                <MI name="info" className="text-primary-container text-lg shrink-0" />
                <p className="text-[12px] text-on-surface-variant">
                  Déficit acima de 25% da manutenção. Funciona no papel, mas costuma custar massa magra e aderência. 0,5% do peso por semana é mais sustentável.
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: "PROTEÍNA", v: target.protein, sub: `${(body.proteinPerKg ?? 1.8).toFixed(1)} g/kg` },
                { label: "CARBOIDRATO", v: target.carbs, sub: "o que sobra" },
                { label: "GORDURA", v: target.fat, sub: `${(body.fatPerKg ?? 0.8).toFixed(1)} g/kg` },
              ].map((m) => (
                <div key={m.label} className="rounded-lg bg-surface-container-high p-3 text-center">
                  <Caps className="text-outline text-[9px] block">{m.label}</Caps>
                  <div className="font-headline-md text-[19px] text-primary tabular-nums">{m.v}</div>
                  <span className="text-[10px] text-outline">g · {m.sub}</span>
                </div>
              ))}
            </div>

            {target.carbsShort && (
              <p className="text-[12px] text-error mb-4">
                Proteína e gordura juntas já passam do alvo calórico. Baixe g/kg de uma das duas, ou o carboidrato fica em zero.
              </p>
            )}

            <button
              onClick={applyGoals}
              className="w-full py-2.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 font-label-caps text-[11px] active:scale-95 transition"
            >
              APLICAR COMO METAS DA DIETA
            </button>
            <p className="text-[11px] text-outline mt-2 text-center">
              Grava nas metas que a aba PLANO já usa. Nada é sobrescrito sozinho — se você ajustar à mão depois, fica valendo o seu.
            </p>
          </>
        )}
      </section>

      {/* ---------- semana ---------- */}
      {week && !missing.length && (
        <section className="glass-card p-6 rounded-xl">
          <h3 className="font-headline-md text-headline-md text-primary mb-1">Gasto por dia da semana</h3>
          <p className="text-[12px] text-on-surface-variant mb-4">Média real das últimas 8 semanas. Dia sem histórico não recebe estimativa inventada.</p>
          <div className="space-y-1.5">
            {week.map((r) => {
              const max = Math.max(...week.map((x) => x.total)) || 1;
              const noData = r.samples === 0;
              return (
                <div key={r.dow} className="flex items-center gap-3">
                  <Caps className="text-outline text-[10px] w-8 shrink-0">{r.label.toUpperCase()}</Caps>
                  <div className="flex-1 h-6 rounded bg-surface-variant/60 overflow-hidden relative">
                    <div className="h-full bg-primary-container/30" style={{ width: `${(r.base / max) * 100}%` }} />
                    {r.trainingAvg > 0 && (
                      <div
                        className="h-full bg-primary-container absolute top-0"
                        style={{ left: `${(r.base / max) * 100}%`, width: `${(r.trainingAvg / max) * 100}%` }}
                      />
                    )}
                  </div>
                  {r.scheduled && (
                    <MI
                      name="fitness_center"
                      className={`text-sm shrink-0 ${r.unproven ? "text-primary-container" : "text-outline"}`}
                      title={r.unproven ? "Treino agendado, mas nunca registrado neste dia" : "Treino agendado no plano"}
                    />
                  )}
                  <span className="text-[12px] tabular-nums w-20 text-right shrink-0">
                    {noData ? (
                      <span className="text-outline">sem dados</span>
                    ) : r.unproven ? (
                      <span className="text-outline">só basal *</span>
                    ) : (
                      <span className="text-on-surface">{fmt(r.total)}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-outline mt-3">
            Barra clara = basal e vida cotidiana. Barra cheia = treino. O halter marca dia com treino agendado no plano.
            {week.some((r) => r.unproven) && (
              <>
                {" "}
                <strong className="font-semibold">*</strong> dia agendado que você nunca registrou — o app mostra só o basal em vez de chutar quanto o treino
                gastaria.
              </>
            )}
            {week.every((r) => r.samples === 0) && " Nenhum treino registrado ainda: sem histórico, não há como estimar gasto de treino."}
          </p>
        </section>
      )}

      {/* ---------- micronutrientes ---------- */}
      <section className="glass-card p-6 rounded-xl">
        <button onClick={() => setShowMicros((v) => !v)} className="w-full flex items-center gap-2 text-left">
          <MI name="science" className="text-primary-container" />
          <div className="flex-1">
            <h3 className="font-headline-md text-headline-md text-primary">Micronutrientes — referência</h3>
            <p className="text-[12px] text-on-surface-variant">Valores de consulta por idade e sexo. Não é cálculo e o app não rastreia consumo.</p>
          </div>
          <MI name="expand_more" className={`text-outline transition-transform ${showMicros ? "rotate-180" : ""}`} />
        </button>

        {showMicros && (
          <div className="mt-4">
            {!body.sex || age === null ? (
              <p className="text-[13px] text-outline py-4 text-center">Informe sexo e nascimento pra ver a faixa certa.</p>
            ) : (
              <>
                <div className="rounded-lg border border-white/10 divide-y divide-white/5">
                  {microReference(body.sex, age).map((m) => (
                    <Row key={m.name} label={m.name} value={m.value.toLocaleString("pt-BR")} unit={m.unit} />
                  ))}
                </div>
                <p className="text-[11px] text-outline mt-3">
                  Recomendações gerais para pessoas adultas saudáveis, por dia. Ao contrário de caloria e macro, essas quantidades{" "}
                  <strong className="font-semibold">não derivam do seu peso ou altura</strong> — mudar de peso não muda quanto ferro você precisa. Gestação,
                  lactação, restrição alimentar e condições clínicas alteram tudo: nesses casos, valem orientação individual e exame, não tabela.
                </p>
              </>
            )}
          </div>
        )}
      </section>

      <p className="text-[11px] text-outline text-center px-4">
        Todos os números desta aba são <strong className="font-semibold">estimativa estatística</strong>, não medição. Fórmulas de basal erram para mais e para
        menos entre pessoas com o mesmo peso e altura. O uso correto é como ponto de partida: siga o alvo por 2 a 3 semanas, veja o que a média de peso fez, e
        ajuste. Não substitui nutricionista nem médico.
      </p>
    </div>
  );
}
