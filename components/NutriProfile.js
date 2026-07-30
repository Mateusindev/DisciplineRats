"use client";

// Calculadora de energia e macros. Tudo aqui é ESTIMATIVA estatística — o painel diz isso
// na cara, porque número redondo numa tela passa uma confiança que a fórmula não tem.
//
// Layout em três blocos, nessa ordem: RESULTADO (alvo e macros), o que alimenta ele
// (perfil) e o veredito (evolução do peso). O que é regulagem fina ou consulta —
// g/kg, NEAT, gasto por dia da semana, micronutriente — fica atrás de um toggle:
// aparece quando é procurado, não empilhado na frente de quem só quer o número.
//
// Duas decisões deliberadas de honestidade, mantidas do painel antigo:
//   1. dia da semana sem histórico não recebe número inventado, recebe "sem dados";
//   2. micronutriente é tabela de REFERÊNCIA por idade/sexo, não cálculo.

import { useState } from "react";
import { MI, Caps, inputCls } from "@/components/ui";
import { WeightChart } from "@/components/charts";
import {
  BODY_GOALS,
  ageFrom,
  bmrFor,
  currentWeight,
  weightSeries,
  weightStats,
  tdeeForDate,
  weeklyEnergy,
  macroTargets,
  microReference,
  getDateStr,
} from "@/lib/state";

const fmt = (n) => (n === null || n === undefined ? "—" : new Intl.NumberFormat("pt-BR").format(Math.round(n)));
const kg1 = (n) => (n === null || n === undefined ? "—" : (Math.round(n * 10) / 10).toString().replace(".", ","));
const signed = (n) => (n === null || n === undefined ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${kg1(Math.abs(n))}`);
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

const WEIGHT_RANGES = [
  { id: 30, label: "30D" },
  { id: 90, label: "90D" },
  { id: 365, label: "1 ANO" },
  { id: 0, label: "TUDO" },
];

// Um número de peso só é "bom" ou "ruim" em relação ao objetivo: −1 kg é vitória
// pra quem corta e derrota pra quem ganha massa. `tol` é a zona morta de quem mantém.
function goalTone(v, goal, tol) {
  if (v === null || v === undefined) return "text-on-surface-variant";
  const sign = goal === "cut" ? -1 : goal === "bulk" ? 1 : 0;
  if (!sign) return Math.abs(v) <= tol ? "text-primary" : "text-error";
  if (Math.abs(v) <= tol / 2) return "text-on-surface";
  return v * sign > 0 ? "text-primary" : "text-error";
}

function Tile({ label, value, unit, sub, tone }) {
  return (
    <div className="rounded-lg bg-surface-container-high p-3">
      <Caps className="text-outline text-[9px] block">{label}</Caps>
      <div className={`font-headline-md text-[20px] tabular-nums leading-tight ${tone || "text-on-surface"}`}>
        {value}
        {unit && <span className="text-[10px] text-outline ml-1">{unit}</span>}
      </div>
      {sub && <span className="text-[10px] text-outline leading-tight block">{sub}</span>}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <Caps className="text-outline text-[10px] mb-1.5 block">{label}</Caps>
      {children}
      {hint && <p className="text-[11px] text-outline mt-1">{hint}</p>}
    </div>
  );
}

function Chips({ options, value, onChange }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/10">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 px-2 py-2 font-label-caps text-[10px] transition ${
            value === o.id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, hint, value, min, max, step, onChange }) {
  return (
    <Field label={label} hint={hint}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-[var(--color-primary-container)]" />
    </Field>
  );
}

// Bloco recolhido: título + resumo numa linha, conteúdo sob demanda.
function More({ label, summary, open, onToggle, children }) {
  return (
    <div className="rounded-lg border border-white/10">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2.5 text-left" aria-expanded={open}>
        <Caps className="text-on-surface-variant text-[10px] flex-1">{label}</Caps>
        {summary && <span className="text-[11px] text-outline truncate shrink-0">{summary}</span>}
        <MI name="expand_more" className={`text-outline text-lg shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export default function NutriProfile({ state, setState, toast }) {
  const body = state.body || {};
  const [wInput, setWInput] = useState("");
  const [wDate, setWDate] = useState(getDateStr(0));
  const [wRange, setWRange] = useState(90);
  const [openPanel, setOpenPanel] = useState(null); // "fine" | "week" | "micro"
  const toggle = (id) => setOpenPanel((p) => (p === id ? null : id));

  const setBody = (patch) => setState((prev) => ({ ...prev, body: { ...(prev.body || {}), ...patch } }));

  const kg = currentWeight(state);
  const age = ageFrom(body.birth);
  const bmr = bmrFor(body, kg);
  const today = tdeeForDate(state, getDateStr(0), kg);
  const week = weeklyEnergy(state, kg);
  const target = macroTargets(state, kg);
  const allWeights = weightSeries(state);
  const w = weightStats(state, wRange);
  const rangeLabel = (WEIGHT_RANGES.find((r) => r.id === wRange) || {}).label;
  const goal = BODY_GOALS.find((g) => g.id === (body.goal || "maintain")) || BODY_GOALS[1];

  const missing = [];
  if (!body.sex) missing.push("sexo");
  if (!body.birth) missing.push("nascimento");
  if (!body.heightCm) missing.push("altura");
  if (!kg) missing.push("uma pesagem");

  function addWeight() {
    const n = parseFloat(String(wInput).replace(",", "."));
    if (!(n > 20 && n < 400)) return toast("Peso inválido", { type: "error" });
    setState((prev) => ({ ...prev, weights: { ...(prev.weights || {}), [wDate]: Math.round(n * 10) / 10 } }));
    setWInput("");
    toast("Pesagem registrada", { sub: `${n} kg em ${dm(wDate)}`, icon: "monitor_weight" });
  }
  function removeWeight(date) {
    setState((prev) => {
      const next = { ...(prev.weights || {}) };
      delete next[date];
      return { ...prev, weights: next };
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

  return (
    <div className="space-y-gutter">
      {/* ---------- 1. resultado ---------- */}
      <section className="glass-card p-6 rounded-xl">
        {missing.length > 0 ? (
          <>
            <h3 className="font-headline-md text-headline-md text-primary mb-1">Alvo do dia</h3>
            <p className="text-[13px] text-on-surface-variant">
              Falta informar <span className="text-on-surface">{missing.join(", ")}</span> — sem isso não há número honesto pra mostrar.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-6">
              <div className="shrink-0">
                <Caps className="text-outline text-[10px] block">ALVO · {goal.label.toUpperCase()}</Caps>
                <div className="font-display-timer text-[52px] leading-none text-primary tabular-nums">{fmt(target.kcal)}</div>
                <Caps className="text-outline text-[10px]">KCAL POR DIA</Caps>
              </div>
              <div className="grid grid-cols-3 gap-2 flex-1 min-w-[240px]">
                {[
                  { label: "PROTEÍNA", v: target.protein, sub: `${(body.proteinPerKg ?? 1.8).toFixed(1)} g/kg` },
                  { label: "CARBOIDRATO", v: target.carbs, sub: "o que sobra" },
                  { label: "GORDURA", v: target.fat, sub: `${(body.fatPerKg ?? 0.8).toFixed(1)} g/kg` },
                ].map((m) => (
                  <Tile key={m.label} label={m.label} value={m.v} unit="g" sub={m.sub} tone="text-primary" />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <Tile label="BASAL" value={fmt(bmr.kcal)} unit="kcal" sub={`${bmr.formula}${bmr.usesLean ? " · massa magra" : ""}`} />
              <Tile label="MANUTENÇÃO" value={fmt(target.maintenance)} unit="kcal" sub="média da semana" />
              <Tile
                label="HOJE ATÉ AGORA"
                value={fmt(today?.total)}
                unit="kcal"
                sub={today?.sessions > 0 ? `${today.sessions} treino(s) · +${fmt(today.training)}` : "sem treino hoje"}
              />
            </div>

            {target.clampedToBmr && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-error/40 bg-error/5 px-3 py-2">
                <MI name="warning" className="text-error text-lg shrink-0" />
                <p className="text-[12px] text-on-surface">
                  O ritmo escolhido jogaria o alvo <strong className="font-semibold">abaixo do basal</strong>. Travei no basal — reduza o ritmo.
                </p>
              </div>
            )}
            {!target.clampedToBmr && target.aggressive && (
              <p className="mt-4 text-[12px] text-on-surface-variant">
                Déficit acima de 25% da manutenção: funciona no papel, mas costuma custar massa magra e aderência.
              </p>
            )}
            {target.carbsShort && (
              <p className="mt-4 text-[12px] text-error">Proteína e gordura já passam do alvo calórico — baixe g/kg de uma das duas, ou o carboidrato fica em zero.</p>
            )}

            <button
              onClick={applyGoals}
              className="mt-4 w-full py-2.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 font-label-caps text-[11px] active:scale-95 transition"
            >
              APLICAR COMO METAS DA DIETA
            </button>
            <p className="text-[11px] text-outline mt-2 text-center">Grava nas metas da aba PLANO. Nada é sobrescrito depois sem você pedir.</p>
          </>
        )}
      </section>

      {/* ---------- 2. perfil ---------- */}
      <section className="glass-card p-6 rounded-xl space-y-4">
        <div>
          <h3 className="font-headline-md text-headline-md text-primary">Perfil corporal</h3>
          <p className="text-[12px] text-on-surface-variant">
            De onde saem os números acima{age !== null ? ` · ${age} anos` : ""}
            {kg ? ` · ${kg1(kg)} kg` : ""}. A idade vem do nascimento, então nunca fica velha.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="SEXO BIOLÓGICO">
            <Chips
              options={[
                { id: "m", label: "MASCULINO" },
                { id: "f", label: "FEMININO" },
              ]}
              value={body.sex}
              onChange={(sex) => setBody({ sex })}
            />
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

          <Field label="% DE GORDURA (OPCIONAL)" hint="Se souber, o basal passa a usar massa magra e erra menos.">
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
          <Chips options={BODY_GOALS.map((g) => ({ id: g.id, label: g.label.toUpperCase() }))} value={body.goal || "maintain"} onChange={(id) => setBody({ goal: id })} />
        </Field>

        {goal.id !== "maintain" && (
          <Slider
            label={`RITMO — ${(body.ratePct ?? 0.5).toFixed(2).replace(".", ",")}% DO PESO POR SEMANA`}
            hint="0,5% costuma preservar massa. Acima de 1% o corpo cobra em músculo."
            value={body.ratePct ?? 0.5}
            min={0}
            max={1.5}
            step={0.05}
            onChange={(ratePct) => setBody({ ratePct })}
          />
        )}

        <More
          label="AJUSTES FINOS"
          summary={`P ${(body.proteinPerKg ?? 1.8).toFixed(1)} · G ${(body.fatPerKg ?? 0.8).toFixed(1)} g/kg · NEAT ×${(body.neat ?? 1.2).toFixed(2)}`}
          open={openPanel === "fine"}
          onToggle={() => toggle("fine")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <Slider label={`PROTEÍNA — ${(body.proteinPerKg ?? 1.8).toFixed(1)} G/KG`} value={body.proteinPerKg ?? 1.8} min={0.8} max={3} step={0.1} onChange={(v) => setBody({ proteinPerKg: v })} />
            <Slider label={`GORDURA — ${(body.fatPerKg ?? 0.8).toFixed(1)} G/KG`} value={body.fatPerKg ?? 0.8} min={0.4} max={1.5} step={0.1} onChange={(v) => setBody({ fatPerKg: v })} />
            <Slider
              label={`VIDA FORA DO TREINO — ×${(body.neat ?? 1.2).toFixed(2)}`}
              hint="1,2 = trabalho sentado."
              value={body.neat ?? 1.2}
              min={1.1}
              max={1.6}
              step={0.05}
              onChange={(v) => setBody({ neat: v })}
            />
          </div>
          <div className="mt-4 sm:max-w-xs">
            <Field label="PESO ALVO (KG)" hint="Só desenha a linha no gráfico e estima a data. Fora do cálculo de caloria.">
              <input
                type="number"
                min={20}
                max={400}
                step="0.1"
                inputMode="decimal"
                placeholder="sem alvo"
                value={body.targetKg ?? ""}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  setBody({ targetKg: Number.isFinite(n) ? n : null });
                }}
                className={`${inputCls} w-full`}
              />
            </Field>
          </div>
        </More>

        {week && !missing.length && (
          <More
            label="GASTO POR DIA DA SEMANA"
            summary="média real das últimas 8 semanas"
            open={openPanel === "week"}
            onToggle={() => toggle("week")}
          >
            <div className="space-y-1.5 pt-1">
              {week.map((r) => {
                const max = Math.max(...week.map((x) => x.total)) || 1;
                const noData = r.samples === 0;
                return (
                  <div key={r.dow} className="flex items-center gap-3">
                    <Caps className="text-outline text-[10px] w-8 shrink-0">{r.label.toUpperCase()}</Caps>
                    <div className="flex-1 h-5 rounded bg-surface-variant/60 overflow-hidden relative">
                      <div className="h-full bg-primary-container/30" style={{ width: `${(r.base / max) * 100}%` }} />
                      {r.trainingAvg > 0 && (
                        <div className="h-full bg-primary-container absolute top-0" style={{ left: `${(r.base / max) * 100}%`, width: `${(r.trainingAvg / max) * 100}%` }} />
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
                      {noData ? <span className="text-outline">sem dados</span> : r.unproven ? <span className="text-outline">só basal</span> : <span className="text-on-surface">{fmt(r.total)}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-outline mt-3">
              Barra clara = basal e vida cotidiana; barra cheia = treino; halter = dia agendado. Dia agendado que você nunca registrou mostra{" "}
              <span className="text-on-surface-variant">só basal</span> em vez de chutar o gasto do treino.
            </p>
          </More>
        )}

        <More label="MICRONUTRIENTES — REFERÊNCIA" summary="consulta por idade e sexo" open={openPanel === "micro"} onToggle={() => toggle("micro")}>
          {!body.sex || age === null ? (
            <p className="text-[13px] text-outline py-2">Informe sexo e nascimento pra ver a faixa certa.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 pt-1">
                {microReference(body.sex, age).map((m) => (
                  <div key={m.name} className="flex items-baseline justify-between gap-2 border-b border-white/5 py-1">
                    <span className="text-[12px] text-on-surface-variant truncate">{m.name}</span>
                    <span className="text-[12px] tabular-nums text-on-surface shrink-0">
                      {m.value.toLocaleString("pt-BR")}
                      <span className="text-[10px] text-outline ml-0.5">{m.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-outline mt-3">
                Valores por dia pra pessoa adulta saudável. Não derivam de peso nem altura, e o app <strong className="font-semibold">não rastreia</strong> consumo de
                micro — é consulta, não cálculo.
              </p>
            </>
          )}
        </More>
      </section>

      {/* ---------- 3. evolução do peso ---------- */}
      <section className="glass-card p-6 rounded-xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-headline-md text-headline-md text-primary">Evolução do peso</h3>
            <p className="text-[12px] text-on-surface-variant">
              O veredito da estimativa: a linha grossa é a média de 7 dias — o dia isolado oscila com água, sal e intestino.
            </p>
          </div>
          {kg && <span className="font-headline-lg text-[24px] text-primary tabular-nums shrink-0">{kg1(kg)} kg</span>}
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

        {allWeights.length >= 2 && (
          <div className="flex rounded-lg overflow-hidden border border-white/10 mb-4 w-fit">
            {WEIGHT_RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setWRange(r.id)}
                className={`px-3 py-1.5 font-label-caps text-[10px] transition ${
                  wRange === r.id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {w && w.count >= 2 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <Tile label="ÚLTIMA PESAGEM" value={kg1(w.current)} unit="kg" sub={dm(w.last.date)} tone="text-primary" />
              <Tile label="MÉDIA 7 DIAS" value={kg1(w.avg)} unit="kg" sub={w.avgSamples >= 2 ? `${w.avgSamples} pesagens na janela` : "só 1 pesagem na janela"} />
              <Tile label={`VARIAÇÃO · ${rangeLabel}`} value={signed(w.deltaAvg)} unit="kg" sub={`da média · ${w.spanDays} dia(s)`} tone={goalTone(w.deltaAvg, w.goal, 1)} />
              <Tile
                label="RITMO MEDIDO"
                value={w.perWeek === null ? "—" : signed(w.perWeek)}
                unit={w.perWeek === null ? "" : "kg/sem"}
                sub={
                  w.perWeek === null
                    ? "precisa de 3 pesagens em 7+ dias"
                    : w.goal === "maintain"
                      ? "alvo: manter"
                      : `alvo ${signed(w.targetPerWeek)} kg/sem`
                }
                tone={goalTone(w.perWeek, w.goal, 0.25)}
              />
            </div>

            <WeightChart series={w.series} targetKg={w.targetKg} height={240} />

            <div className="mt-3 space-y-1">
              {w.perWeek !== null && w.goal !== "maintain" && (
                <p className="text-[12px] text-on-surface-variant">
                  {Math.abs(w.perWeek - w.targetPerWeek) <= 0.15
                    ? "Ritmo medido bate com o alvo — não mexa em nada."
                    : Math.sign(w.perWeek) !== Math.sign(w.targetPerWeek) || w.perWeek === 0
                      ? `O peso não vai pro lado do objetivo (${signed(w.perWeek)} contra alvo de ${signed(w.targetPerWeek)} kg/sem). Ajuste a caloria alvo.`
                      : Math.abs(w.perWeek) > Math.abs(w.targetPerWeek)
                        ? `Mais rápido que o planejado (${signed(w.perWeek)} contra ${signed(w.targetPerWeek)} kg/sem) — rápido demais cobra em massa magra.`
                        : `Mais lento que o planejado (${signed(w.perWeek)} contra ${signed(w.targetPerWeek)} kg/sem). Ajuste com 2 a 3 semanas de dado, não com 3 dias.`}
                </p>
              )}
              {w.targetKg && (
                <p className="text-[12px] text-on-surface-variant">
                  Faltam <strong className="font-semibold text-on-surface tabular-nums">{kg1(Math.abs(w.toTarget))} kg</strong> pro alvo de {kg1(w.targetKg)} kg
                  {w.eta ? (
                    <>
                      {" "}— no ritmo atual, por volta de <span className="tabular-nums">{dm(w.eta.date)}</span>.
                    </>
                  ) : (
                    "; sem ritmo na direção do alvo não há previsão honesta de data."
                  )}
                </p>
              )}
              <p className="text-[11px] text-outline">
                {w.count} pesagens em {w.spanDays} dia(s) · faixa {kg1(w.min)}–{kg1(w.max)} kg · ritmo por regressão sobre a média.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5">
              <Caps className="text-outline text-[9px] block mb-1.5">ÚLTIMAS PESAGENS — CLIQUE PRA REMOVER</Caps>
              <div className="flex flex-wrap gap-1.5">
                {allWeights
                  .slice(-10)
                  .reverse()
                  .map((s, i, arr) => {
                    const prev = arr[i + 1];
                    const d = prev ? Math.round((s.kg - prev.kg) * 10) / 10 : null;
                    return (
                      <button
                        key={s.date}
                        onClick={() => removeWeight(s.date)}
                        title={`Remover pesagem de ${dm(s.date)}`}
                        className="px-2 py-1 rounded-full border border-white/10 text-[10px] font-label-caps text-on-surface-variant hover:border-error/40 hover:text-error transition tabular-nums"
                      >
                        {dm(s.date)} · {kg1(s.kg)}
                        {d !== null && d !== 0 && <span className="text-outline ml-1">{signed(d)}</span>}
                      </button>
                    );
                  })}
              </div>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-outline text-center py-6">
            {allWeights.length === 0
              ? "Nenhuma pesagem ainda. Registre a primeira aí em cima."
              : allWeights.length === 1
                ? "Uma pesagem registrada. Com duas o gráfico aparece."
                : `Menos de duas pesagens no período ${rangeLabel} — registre outra, ou olhe em TUDO.`}
          </p>
        )}
      </section>

      <p className="text-[11px] text-outline text-center px-4">
        Tudo aqui é <strong className="font-semibold">estimativa</strong>, não medição: siga o alvo por 2 a 3 semanas, veja o que a média de peso fez e ajuste. Não
        substitui nutricionista.
      </p>
    </div>
  );
}
