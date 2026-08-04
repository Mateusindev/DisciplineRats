"use client";

// ============================================================================
// REGISTRAR TREINO — um exercício por vez.
//
// A ficha inteira na tela empilhava 6 a 10 blocos de input pra uma tarefa que é
// sequencial: você faz um exercício, grava as séries dele, passa pro próximo. Aqui
// só o exercício atual fica grande; os outros ficam nas pílulas de navegação, cada
// uma com o número de séries já gravadas — o progresso do treino é a própria régua.
//
// Entrada por stepper porque o contexto é academia: mão suada, celular na bancada,
// teclado numérico é fricção. Carga e reps em −/+ com passo ajustável, mais um botão
// que repete a última série (o caso mais comum entre séries do mesmo exercício).
//
// Regras não mudam: série grava na hora, sessão só grava no botão, retroativo
// continua limitado a 7 dias.
// ============================================================================

import { useState } from "react";
import { MI, Caps, StarRating, Select, inputCls } from "@/components/ui";
import { REST_REASONS, restReason } from "@/lib/state";

const KG_STEPS = [1, 2.5, 5];
const kgFmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

// séries já gravadas do exercício, removíveis
function SetChips({ sets, onRemove, size = "text-[11px]" }) {
  if (!sets.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {sets.map((s) => (
        <span
          key={s.id}
          className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-surface-container-lowest border border-white/10 ${size} text-on-surface tabular-nums`}
        >
          {s.weight}kg×{s.reps ?? "F"}
          {s.failure && s.reps != null && <span className="text-error text-[9px] font-bold">F</span>}
          <button onClick={() => onRemove(s.id)} aria-label="Remover série" className="text-outline hover:text-error transition flex items-center">
            <MI name="close" className="text-[13px]" />
          </button>
        </span>
      ))}
    </div>
  );
}

// Recorde pessoal: pílula com troféu. O número solto em caps se perdia no meio dos
// rótulos — a marca é o que dá a ele peso de conquista, e é o alvo a bater na série.
function PrBadge({ pr, size = "text-[11px]" }) {
  if (!pr) return null;
  return (
    <span
      title={`Recorde pessoal: ${pr.weight}kg${pr.reps ? ` × ${pr.reps} reps` : ""}`}
      className={`inline-flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full bg-primary-container/15 border border-primary-container/30 text-primary-container ${size} font-bold tabular-nums shrink-0`}
    >
      <MI name="emoji_events" fill className="text-[13px]" />
      {pr.weight}kg
      {pr.reps ? <span className="text-primary-container/70">×{pr.reps}</span> : null}
    </span>
  );
}

// entrada digitada (kg · reps · falha · +)
function TypedInputs({ row, onRow, onAdd, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={row.weight}
        onChange={(e) => onRow({ weight: e.target.value })}
        inputMode="decimal"
        placeholder="kg"
        aria-label={`Carga${label ? ` de ${label}` : ""}`}
        className={`${inputCls} w-16 text-[12px] py-1.5 text-center`}
      />
      <span className="text-outline text-[11px]">×</span>
      <input
        value={row.reps}
        onChange={(e) => onRow({ reps: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && onAdd()}
        inputMode="numeric"
        placeholder="reps"
        aria-label={`Repetições${label ? ` de ${label}` : ""}`}
        className={`${inputCls} w-16 text-[12px] py-1.5 text-center`}
      />
      <button
        onClick={() => onRow({ failure: !row.failure })}
        aria-pressed={row.failure}
        title="Série até a falha"
        className={`w-8 h-8 rounded-lg font-label-caps text-[10px] border transition shrink-0 ${
          row.failure ? "bg-error text-on-error border-error" : "border-error/40 text-error hover:bg-error/10"
        }`}
      >
        F
      </button>
      <button
        onClick={onAdd}
        aria-label={`Adicionar série${label ? ` de ${label}` : ""}`}
        className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container grid place-items-center active:scale-95 transition shrink-0"
      >
        <MI name="add" className="text-lg" />
      </button>
    </div>
  );
}

// entrada por stepper: nada de teclado. `last` alimenta o "repetir".
function StepperInputs({ row, onRow, onAdd, last, kgStep, onKgStep }) {
  const w = parseFloat(String(row.weight).replace(",", ".")) || 0;
  const reps = parseInt(row.reps, 10) || 0;
  const bump = (d) => onRow({ weight: kgFmt(Math.max(0, w + d)) });
  const bumpReps = (d) => onRow({ reps: String(Math.max(0, reps + d)) });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button onClick={() => bump(-kgStep)} aria-label="Menos carga" className="w-8 h-8 rounded-lg border border-white/10 text-on-surface-variant hover:border-white/25 transition">−</button>
        <span className="w-16 text-center font-headline-md text-[17px] text-on-surface tabular-nums">{w ? kgFmt(w) : "—"}<span className="text-[10px] text-outline ml-0.5">kg</span></span>
        <button onClick={() => bump(kgStep)} aria-label="Mais carga" className="w-8 h-8 rounded-lg border border-white/10 text-on-surface-variant hover:border-white/25 transition">+</button>
        <button
          onClick={() => onKgStep(KG_STEPS[(KG_STEPS.indexOf(kgStep) + 1) % KG_STEPS.length])}
          title="Passo da carga"
          className="ml-0.5 px-1.5 h-8 rounded-lg border border-white/10 font-label-caps text-[9px] text-outline hover:border-white/25 transition tabular-nums"
        >
          ±{kgFmt(kgStep)}
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => bumpReps(-1)} aria-label="Menos repetições" className="w-8 h-8 rounded-lg border border-white/10 text-on-surface-variant hover:border-white/25 transition">−</button>
        <span className="w-12 text-center font-headline-md text-[17px] text-on-surface tabular-nums">{reps || "—"}<span className="text-[10px] text-outline ml-0.5">rp</span></span>
        <button onClick={() => bumpReps(1)} aria-label="Mais repetições" className="w-8 h-8 rounded-lg border border-white/10 text-on-surface-variant hover:border-white/25 transition">+</button>
      </div>
      <button
        onClick={() => onRow({ failure: !row.failure })}
        aria-pressed={row.failure}
        className={`h-8 px-2 rounded-lg font-label-caps text-[10px] border transition ${
          row.failure ? "bg-error text-on-error border-error" : "border-error/40 text-error hover:bg-error/10"
        }`}
      >
        FALHA
      </button>
      {last && (
        <button
          onClick={() => onRow({ weight: String(last.weight), reps: last.reps != null ? String(last.reps) : "", failure: !!last.failure })}
          title={`Repetir ${last.weight}kg×${last.reps ?? "F"}`}
          className="h-8 px-2 rounded-lg border border-white/10 font-label-caps text-[10px] text-on-surface-variant hover:border-white/25 transition flex items-center gap-1"
        >
          <MI name="replay" className="text-[14px]" /> {last.weight}×{last.reps ?? "F"}
        </button>
      )}
      <button
        onClick={onAdd}
        className="h-8 px-3 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-[10px] flex items-center gap-1 active:scale-95 transition"
      >
        <MI name="check" className="text-base" /> GRAVAR
      </button>
    </div>
  );
}

// exercício avulso (fora da ficha)
function LooseSets({ r, open: initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
  const loose = Object.entries(r.looseByEx);
  return (
    <div className="mt-3">
      <button onClick={() => setOpen((v) => !v)} className="font-label-caps text-[10px] text-outline hover:text-primary transition flex items-center gap-1">
        <MI name="chevron_right" className={`text-sm transition-transform ${open ? "rotate-90" : ""}`} /> EXERCÍCIO AVULSO
        {loose.length > 0 && <span className="text-primary-container">· {loose.length}</span>}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <input
            value={r.setForm.exercise}
            onChange={(e) => r.setSetForm((f) => ({ ...f, exercise: e.target.value }))}
            list="gym-exercises"
            placeholder="Exercício fora da ficha"
            className={`${inputCls} w-full text-[13px]`}
          />
          <datalist id="gym-exercises">
            {r.knownExercises.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <TypedInputs
            row={{ weight: r.setForm.weight, reps: r.setForm.reps, failure: r.setFailure }}
            onRow={(patch) => {
              if ("failure" in patch) r.setSetFailure(patch.failure);
              const rest = { ...patch };
              delete rest.failure;
              if (Object.keys(rest).length) r.setSetForm((f) => ({ ...f, ...rest }));
            }}
            onAdd={r.addSet}
            label="avulso"
          />
        </div>
      )}
      {loose.length > 0 && (
        <div className="space-y-2 mt-3">
          {loose.map(([ex, sets]) => (
            <div key={ex}>
              <Caps className="text-primary-container text-[10px] block mb-1">{ex}</Caps>
              <SetChips sets={sets} onRemove={r.removeSet} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// cabeçalho da sessão em chips inline (data · tipo · divisão)
function SessionChips({ r }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={r.sessionDate}
        min={r.minDate}
        max={r.today}
        onChange={(e) => r.setSessionDate(e.target.value || r.today)}
        aria-label="Data da sessão"
        className={`bg-surface-container-high border rounded-full px-3 py-1.5 text-[12px] text-on-surface outline-none transition ${
          r.isRetro ? "border-primary-container/50 text-primary" : "border-white/10"
        }`}
      />
      <div className="min-w-[150px]">
        <Select value={r.type} options={r.modalityNames} onChange={r.changeType} disabled={r.modalityNames.length === 0} placeholder="Cadastre uma modalidade" />
      </div>
      {r.divisionNames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {r.divisionNames.map((d) => (
            <button
              key={d}
              onClick={() => r.setDivision(d)}
              className={`px-2.5 py-1.5 rounded-full font-label-caps text-[10px] border transition ${
                r.effectiveDivision === d ? "bg-primary-container text-on-primary-container border-primary-container" : "border-white/10 text-on-surface-variant hover:border-white/25"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      {r.isRetro && <Caps className="text-primary-container text-[9px]">RETROATIVO · {r.ddmm(r.sessionDate)}</Caps>}
    </div>
  );
}

// fecho da sessão: duração, intensidade, nota e o botão, numa faixa só
function CloseSession({ r }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/5">
      <label className="flex items-center gap-1.5">
        <Caps className="text-outline text-[9px]">MIN</Caps>
        <input
          value={r.duration}
          onChange={(e) => r.setDuration(e.target.value)}
          inputMode="numeric"
          placeholder="60"
          aria-label="Duração em minutos"
          className={`${inputCls} w-16 py-1.5 text-center text-[13px]`}
        />
      </label>
      <div className="flex items-center gap-1.5">
        <Caps className="text-outline text-[9px]">INTENS.</Caps>
        <StarRating value={r.intensity} onChange={r.setIntensity} size="text-lg" />
      </div>
      <input
        value={r.note}
        onChange={(e) => r.setNote(e.target.value)}
        maxLength={200}
        placeholder="Nota da sessão (opcional)"
        className={`${inputCls} flex-1 min-w-[140px] py-1.5 text-[12px]`}
      />
      <button
        onClick={r.logWorkout}
        className="px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label-caps text-[11px] flex items-center gap-1.5 hover:bg-primary-container active:scale-95 transition shrink-0"
      >
        FECHAR SESSÃO <MI name="chevron_right" className="text-base" />
      </button>
    </div>
  );
}

// Folga justificada do dia: doença, lesão, descanso planejado, imprevisto.
// Marcar abate a meta semanal e mantém a sequência geral — não vale XP e não conta
// como treino, porque o que se remove é a punição, não o esforço que não houve.
function RestDayControl({ r }) {
  const [open, setOpen] = useState(false);
  const rest = r.restDay;
  if (rest) {
    const rr = restReason(rest.reason);
    return (
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/5">
        <span className="flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-primary-container/15 border border-primary-container/40 text-primary-container font-label-caps text-[10px]">
          <MI name={rr.icon} className="text-[15px]" />
          {rr.label.toUpperCase()} · {r.ddmm(r.sessionDate)}
        </span>
        <span className="text-[11px] text-outline flex-1 min-w-[180px]">
          {rest.note ? `“${rest.note}” · ` : ""}A meta da semana cai em 1 treino e a sequência não quebra.
        </span>
        <button
          onClick={() => r.toggleRest(r.sessionDate)}
          className="h-8 px-2.5 rounded-full border border-white/10 text-on-surface-variant hover:border-white/25 font-label-caps text-[10px] transition"
        >
          DESMARCAR
        </button>
      </div>
    );
  }
  return (
    <div className="pt-3 border-t border-white/5">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 font-label-caps text-[10px] text-outline hover:text-primary transition"
        >
          <MI name="sick" className="text-base" /> NÃO TREINEI — MARCAR FOLGA JUSTIFICADA
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Caps className="text-outline text-[9px] mr-1">MOTIVO EM {r.ddmm(r.sessionDate)}</Caps>
            {REST_REASONS.map((x) => (
              <button
                key={x.id}
                onClick={() => {
                  r.toggleRest(r.sessionDate, x.id);
                  setOpen(false);
                }}
                className="h-8 px-2.5 rounded-full border border-white/10 text-on-surface-variant hover:border-primary-container/50 hover:text-primary-container font-label-caps text-[10px] flex items-center gap-1 transition"
              >
                <MI name={x.icon} className="text-[15px]" /> {x.label.toUpperCase()}
              </button>
            ))}
            <button onClick={() => setOpen(false)} aria-label="Cancelar" className="w-8 h-8 rounded-full text-outline hover:text-on-surface grid place-items-center transition">
              <MI name="close" className="text-base" />
            </button>
          </div>
          <p className="text-[11px] text-outline">
            Abate 1 treino da meta da semana e conta como dia ativo pra sequência. Não dá XP e não entra como treino.
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyDivision({ r }) {
  return (
    <div className="text-[12px] text-outline bg-surface-container-high rounded-lg border border-white/5 p-3 flex items-center justify-between gap-2">
      <span>Divisão sem exercícios.</span>
      <button onClick={() => r.setTab("treinos")} className="font-label-caps text-[10px] text-primary hover:underline shrink-0">
        CADASTRAR →
      </button>
    </div>
  );
}

// progresso da ficha: quantos exercícios já têm série hoje
function FichaProgress({ r }) {
  const total = r.trainItems.length;
  const done = r.trainItems.filter((it) => (r.sessionByEx[it.name] || []).length > 0).length;
  const sets = r.trainItems.reduce((n, it) => n + (r.sessionByEx[it.name] || []).length, 0);
  if (!total) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {r.trainItems.map((it) => (
          <span
            key={it.id}
            title={it.name}
            className={`w-2 h-2 rounded-full ${(r.sessionByEx[it.name] || []).length ? "bg-primary-container" : "bg-surface-variant"}`}
          />
        ))}
      </div>
      <Caps className="text-outline text-[9px] tabular-nums">
        {done}/{total} · {sets} série(s)
      </Caps>
    </div>
  );
}

export default function ExerciseRegister({ r }) {
  const [i, setI] = useState(0);
  const [kgStep, setKgStep] = useState(2.5);
  const items = r.trainItems;
  const idx = Math.min(i, Math.max(0, items.length - 1));
  const it = items[idx];
  const sets = it ? r.sessionByEx[it.name] || [] : [];
  const last = sets[sets.length - 1] || (it ? r.lastSetOf(it.name) : null);

  return (
    <section className="col-span-12 glass-card p-5 md:p-6 rounded-xl space-y-4">
      <SessionChips r={r} />

      {r.isGymSession && items.length > 0 ? (
        <>
          <div className="flex gap-1.5 overflow-x-auto ff-scroll pb-1">
            {items.map((x, k) => {
              const n = (r.sessionByEx[x.name] || []).length;
              return (
                <button
                  key={x.id}
                  onClick={() => setI(k)}
                  title={x.name}
                  className={`px-2.5 py-1.5 rounded-full font-label-caps text-[10px] border shrink-0 transition flex items-center gap-1 ${
                    k === idx
                      ? "bg-primary-container text-on-primary-container border-primary-container"
                      : n > 0
                        ? "border-primary-container/40 text-primary-container"
                        : "border-white/10 text-outline hover:border-white/25"
                  }`}
                >
                  {x.name.length > 14 ? `${x.name.slice(0, 13)}…` : x.name}
                  {n > 0 && <span className="tabular-nums">{n}</span>}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-primary-container/25 bg-primary-container/[0.04] p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <h3 className="font-headline-md text-headline-md text-primary truncate">{it.name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <PrBadge pr={r.gymPR(it.name)} />
                  {it.detail && <Caps className="text-outline text-[9px]">{it.detail}</Caps>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setI(Math.max(0, idx - 1))} disabled={idx === 0} aria-label="Anterior" className="w-8 h-8 rounded-full border border-white/10 text-on-surface-variant disabled:opacity-30 hover:border-white/25 transition grid place-items-center">
                  <MI name="chevron_left" />
                </button>
                <button onClick={() => setI(Math.min(items.length - 1, idx + 1))} disabled={idx === items.length - 1} aria-label="Próximo" className="w-8 h-8 rounded-full border border-white/10 text-on-surface-variant disabled:opacity-30 hover:border-white/25 transition grid place-items-center">
                  <MI name="chevron_right" />
                </button>
                <button onClick={() => r.openInfo(it.name)} aria-label="Info do exercício" className="w-8 h-8 rounded-full border border-white/10 text-outline hover:text-primary hover:border-white/25 transition grid place-items-center">
                  <MI name="info" />
                </button>
              </div>
            </div>

            <div className="mb-3">
              {sets.length ? (
                <ol className="space-y-1">
                  {sets.map((s, k) => (
                    <li key={s.id} className="flex items-center gap-2 text-[13px] text-on-surface tabular-nums">
                      <Caps className="text-outline text-[9px] w-8">#{k + 1}</Caps>
                      <span className="flex-1">
                        {s.weight} kg × {s.reps ?? "falha"}
                      </span>
                      <button onClick={() => r.removeSet(s.id)} aria-label="Remover série" className="text-outline hover:text-error transition">
                        <MI name="close" className="text-base" />
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[12px] text-outline">Nenhuma série hoje.</p>
              )}
            </div>

            <StepperInputs
              row={r.getRow(it.name)}
              onRow={(p) => r.setRow(it.name, p)}
              onAdd={() => r.addRowSet(it.name)}
              last={last}
              kgStep={kgStep}
              onKgStep={setKgStep}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <FichaProgress r={r} />
            <LooseSets r={r} />
          </div>
        </>
      ) : r.isGymSession ? (
        <EmptyDivision r={r} />
      ) : (
        <p className="text-[12px] text-outline">Modalidade sem ficha de séries — registre a sessão abaixo.</p>
      )}

      <RestDayControl r={r} />
      <CloseSession r={r} />
    </section>
  );
}
