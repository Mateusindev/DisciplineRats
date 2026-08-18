"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { format, addDays, startOfWeek } from "date-fns";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, inputCls } from "@/components/ui";
import WeekGrid from "@/components/WeekGrid";
import NotifySettings from "@/components/NotifySettings";
import {
  CALENDAR_CATS,
  calCat,
  eventTimeLabel,
  eventsForDate,
  dowIndex,
  DOW_SHORT,
  routineOccurrences,
  routineDayStats,
  toggleRoutineCheck,
  routineHabit,
  habitStepsBlock,
  habitStepProgress,
  getDateStr,
  XP,
} from "@/lib/state";

const ds = (d) => format(d, "yyyy-MM-dd");
// picker de dias da semana da recorrência (0=Seg..6=Dom)
function WeekdayPicker({ value, onChange }) {
  const sel = new Set(value || []);
  return (
    <div className="flex gap-1 flex-wrap">
      {DOW_SHORT.map((label, d) => {
        const on = sel.has(d);
        return (
          <button
            key={d}
            onClick={() => {
              const next = new Set(sel);
              next.has(d) ? next.delete(d) : next.add(d);
              onChange([...next].sort((a, b) => a - b));
            }}
            aria-pressed={on}
            aria-label={label}
            className={`w-9 h-8 rounded font-label-caps text-[10px] border transition ${
              on ? "bg-primary-container text-on-primary-container border-primary-container" : "border-white/10 text-outline hover:border-white/25"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// treino derivado do plano: a agenda não edita. Explica de onde vem e leva ao lugar certo —
// clique que não faz nada é pior que não ser clicável.
function WorkoutInfoModal({ ev, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label="Treino do plano">
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary-container/20 text-primary-container grid place-items-center shrink-0">
            <MI name="fitness_center" fill />
          </div>
          <div className="min-w-0">
            <p className="font-headline-md text-headline-md text-on-surface">{ev.title}</p>
            <Caps className="text-outline text-[10px]">{ev.allDay ? "SEM HORÁRIO DEFINIDO" : eventTimeLabel(ev)}</Caps>
          </div>
        </div>

        <p className="text-body-md text-on-surface-variant">
          Isto vem do seu <strong className="font-semibold text-on-surface">plano de treino</strong>, não da agenda — por isso não se edita aqui. Assim você não
          mantém o mesmo horário em dois lugares.
        </p>
        {ev.allDay && (
          <p className="text-[12px] text-on-surface-variant mt-2">
            Aparece o dia inteiro porque essa divisão não tem <strong className="font-semibold">hora</strong>. Defina a hora ao lado dos dias da semana, em
            Exercício, e ele passa a ocupar só o horário certo.
          </p>
        )}

        <div className="flex items-center gap-2 mt-6">
          <Link
            href="/exercicio"
            className="flex-1 py-2.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 font-label-caps text-[11px] text-center transition"
          >
            AJUSTAR NO PLANO
          </Link>
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-variant/40 font-label-caps text-[11px] transition">
            FECHAR
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// painel das regras: uma linha por repetição, com exceções e exclusão
function RulesModal({ rules, onEdit, onRemove, onClearSkips, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label="Repetições">
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-headline-md text-headline-md text-primary">Repetições</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition p-1"><MI name="close" /></button>
        </div>
        <p className="text-[12px] text-outline mb-4">Uma regra vale pra sempre. Editar aqui muda todas as semanas de uma vez.</p>

        {rules.length === 0 ? (
          <p className="text-[13px] text-outline text-center py-8">Nenhuma repetição ainda. Crie um evento e marque “repetir toda semana”.</p>
        ) : (
          <div className="space-y-2">
            {rules.map((r) => {
              const cat = calCat(r.cat);
              const dias = r.weekdays.map((d) => DOW_SHORT[d]).join(" · ");
              return (
                <div key={r.id} className="rounded-lg bg-surface-container-high p-3" style={{ borderLeft: `3px solid ${cat.color}` }}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-on-surface truncate">{r.title}</p>
                      <Caps className="text-outline text-[10px]">
                        {dias} · {r.allDay ? "dia inteiro" : eventTimeLabel(r)}
                      </Caps>
                    </div>
                    <button onClick={() => onEdit(r)} aria-label="Editar" className="text-outline hover:text-primary transition shrink-0"><MI name="edit" className="text-base" /></button>
                    <button onClick={() => onRemove(r.id)} aria-label="Excluir repetição" className="text-outline hover:text-error transition shrink-0"><MI name="delete" className="text-base" /></button>
                  </div>
                  {(r.skips || []).length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <Caps className="text-outline text-[10px] flex-1">{r.skips.length} ocorrência(s) pulada(s)</Caps>
                      <button onClick={() => onClearSkips(r.id)} className="font-label-caps text-[10px] text-primary hover:underline">RESTAURAR</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// painel dos itens de rotina: mesma ideia do de repetições — a lista completa,
// pra editar e excluir. O clique na grade marca; gerenciar é aqui.
function RoutineModal({ items, habits, onEdit, onRemove, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label="Rotina">
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-headline-md text-headline-md text-primary">Rotina</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition p-1"><MI name="close" /></button>
        </div>
        <p className="text-[12px] text-outline mb-4">
          O esqueleto do dia. Cada item marcado vale {XP.routineItem} XP e fechar todos os do dia dá {XP.routineAll} de bônus — sem multa por errar um dia.
        </p>

        {items.length === 0 ? (
          <p className="text-[13px] text-outline text-center py-8">Nada na rotina ainda. Crie em NOVO e escolha o tipo Rotina.</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const dias = it.weekdays?.length ? it.weekdays.map((d) => DOW_SHORT[d]).join(" · ") : "todo dia";
              const hab = it.habitId ? habits.find((h) => h.id === it.habitId) : null;
              return (
                <div key={it.id} className="rounded-lg bg-surface-container-high p-3 border-l-[3px] border-l-outline/40">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-on-surface truncate">{it.name}</p>
                      <Caps className="text-outline text-[10px]">
                        {it.time || "sem hora"} · {dias}
                      </Caps>
                      {hab && (
                        <Caps className="text-primary/70 text-[10px] flex items-center gap-1 mt-0.5">
                          <MI name="link" className="text-[12px]" /> {hab.name}
                        </Caps>
                      )}
                    </div>
                    <button onClick={() => onEdit(it)} aria-label="Editar" className="text-outline hover:text-primary transition shrink-0"><MI name="edit" className="text-base" /></button>
                    <button onClick={() => onRemove(it)} aria-label="Excluir item" className="text-outline hover:text-error transition shrink-0"><MI name="delete" className="text-base" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function CalendarioPage() {
  const { state, setState, toast, setSetting, savePush } = useApp();

  // Uma visão só: a semana. É ela que responde "quando eu tenho espaço?", com a
  // hora à vista, e passar de semana em semana cobre o resto.
  const [anchor, setAnchor] = useState(new Date()); // qualquer dia da semana mostrada
  // form unificado: `kind` diz o que está sendo criado — evento único, repetição
  // semanal ou item de rotina. As três coisas se descrevem quase igual (título,
  // quando, hora), então um formulário só, com um seletor, em vez de três telas.
  const [form, setForm] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);
  const [workoutInfo, setWorkoutInfo] = useState(null); // ocorrência de treino clicada

  // Única leitura da agenda: junta eventos gravados + ocorrências de regra + treino do plano.
  const eventsOn = (d) => eventsForDate(state, ds(d));
  // Rotina entra por fora: é ritmo, não compromisso. Misturada em eventsForDate ela
  // inflaria a contagem do mês e afogaria a grade em chips repetidos todo dia.
  const routineOn = (d) => routineOccurrences(state, ds(d));
  const routineStats = (d) => routineDayStats(state, ds(d));
  // vício fica de fora do vínculo: lá se registra a recaída, não o acerto
  const linkableHabits = (state.habits || []).filter((h) => (h.kind || "build") !== "quit");
  // marcar direto da agenda: mesmo reducer da página de Rotina, sem futuro
  const toggleRoutine = (dateStr, itemId) => {
    if (dateStr > getDateStr(0)) return toast("Item de rotina não se marca no futuro", { type: "error" });
    // Item vinculado a hábito com microatividades: quem manda é o hábito, e ele trava
    // enquanto sobrar passo. O reducer já recusa — isto só evita o clique mudo.
    const item = (state.routine?.items || []).find((i) => i.id === itemId);
    const habit = item ? routineHabit(state, item) : null;
    if (habit && !(habit.doneDates || []).includes(dateStr) && habitStepsBlock(habit, dateStr)) {
      const p = habitStepProgress(habit, dateStr);
      return toast(`Faltam ${p.pending} microatividade(s) em "${habit.name}"`, { type: "error", sub: "Marque em Hábitos" });
    }
    setState((prev) => toggleRoutineCheck(prev, dateStr, itemId));
  };

  // Sem dia selecionado, NOVO precisa de um padrão honesto: hoje quando hoje está
  // na semana à vista, senão a segunda daquela semana — criar evento numa data que
  // não está na tela seria criar às cegas.
  const newDayForWeek = () => {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const today = new Date();
    return today >= start && today <= addDays(start, 6) ? today : start;
  };

  // ---- CRUD ----
  const blank = (date, start, end) => ({
    kind: "once",
    date,
    title: "",
    cat: "pessoal",
    allDay: false,
    start,
    end,
    note: "",
    weekdays: [dowIndex(date)],
    habitId: null,
  });
  // clicar num vazio da grade já traz a hora daquele slot preenchida
  const openNew = (d, start = "09:00") => {
    const end = `${String(Math.min(23, Number(start.slice(0, 2)) + 1)).padStart(2, "0")}:${start.slice(3)}`;
    setForm(blank(ds(d), start, end));
  };

  const openEditRoutine = (it) => {
    setShowRoutine(false);
    setForm({
      ...blank(ds(new Date()), it.time || "", ""),
      kind: "routine",
      itemId: it.id,
      title: it.name,
      allDay: !it.time,
      weekdays: it.weekdays || [],
      habitId: it.habitId || null,
    });
  };

  function openEdit(dateStr, ev) {
    // treino vem do plano de exercício: a agenda não edita, só explica e aponta pra lá
    if (ev.source === "workout") return setWorkoutInfo({ ...ev, date: dateStr });
    if (ev.ruleId) {
      const r = (state.agendaRules || []).find((x) => x.id === ev.ruleId);
      if (!r) return;
      return setForm({
        kind: "weekly",
        ruleId: r.id,
        occurrence: dateStr, // qual ocorrência foi aberta (p/ "pular esta")
        date: dateStr,
        title: r.title,
        cat: r.cat,
        allDay: !!r.allDay,
        start: r.start || "09:00",
        end: r.end || "10:00",
        note: r.note || "",
        weekdays: r.weekdays || [],
        habitId: null,
      });
    }
    setForm({ ...ev, kind: "once", date: dateStr, start: ev.start || "09:00", end: ev.end || "10:00", note: ev.note || "", weekdays: [dowIndex(dateStr)], habitId: null });
  }

  function saveForm() {
    if (!form.title.trim()) return;

    // ROTINA: outra lista, outras regras (marcável, dá XP, sem categoria e sem
    // nota). O formulário é o mesmo porque, pra quem usa, é tudo "o que eu faço".
    if (form.kind === "routine") {
      const weekdays = [...new Set(form.weekdays || [])].sort((a, b) => a - b);
      const patch = {
        name: form.title.trim().slice(0, 80),
        time: form.allDay ? "" : form.start || "",
        weekdays,
        habitId: form.habitId || null,
      };
      setState((prev) => {
        const items = prev.routine?.items || [];
        if (form.itemId) {
          return { ...prev, routine: { ...(prev.routine || {}), items: items.map((i) => (i.id === form.itemId ? { ...i, ...patch } : i)) } };
        }
        if (items.length >= 60) return prev; // teto do normalizeRoutine
        return { ...prev, routine: { ...(prev.routine || {}), items: [...items, { id: crypto.randomUUID(), ...patch }] } };
      });
      return setForm(null);
    }

    const base = {
      title: form.title.trim().slice(0, 120),
      cat: form.cat,
      allDay: !!form.allDay,
      start: form.allDay ? null : form.start || null,
      end: form.allDay ? null : form.end || null,
      note: (form.note || "").slice(0, 500),
    };

    // repetição → vira (ou atualiza) uma REGRA; nenhuma data é gravada
    if (form.kind === "weekly") {
      const weekdays = [...new Set(form.weekdays || [])].sort((a, b) => a - b);
      if (!weekdays.length) return;
      setState((prev) => {
        const rules = prev.agendaRules || [];
        if (form.ruleId) {
          return { ...prev, agendaRules: rules.map((r) => (r.id === form.ruleId ? { ...r, ...base, weekdays } : r)) };
        }
        const rule = { id: crypto.randomUUID(), ...base, weekdays, from: form.date, until: null, skips: [] };
        // evento avulso que virou recorrente: remove a cópia solta
        const cal = { ...(prev.calendar || {}) };
        if (form.id) {
          for (const d of Object.keys(cal)) cal[d] = (cal[d] || []).filter((e) => e.id !== form.id);
          for (const d of Object.keys(cal)) if (!cal[d].length) delete cal[d];
        }
        return { ...prev, calendar: cal, agendaRules: [...rules, rule] };
      });
      return setForm(null);
    }

    // regra que perdeu a repetição → encerra a regra e grava um evento avulso na data
    setState((prev) => {
      const cal = { ...(prev.calendar || {}) };
      const ev = { id: form.id || crypto.randomUUID(), ...base };
      if (form.id) for (const d of Object.keys(cal)) cal[d] = (cal[d] || []).filter((e) => e.id !== form.id);
      cal[form.date] = [...(cal[form.date] || []), ev];
      for (const d of Object.keys(cal)) if (!cal[d].length) delete cal[d];
      const rules = form.ruleId ? (prev.agendaRules || []).filter((r) => r.id !== form.ruleId) : prev.agendaRules;
      return { ...prev, calendar: cal, agendaRules: rules };
    });
    setForm(null);
  }

  function deleteForm() {
    if (form.kind === "routine") {
      if (form.itemId) removeRoutineItem({ id: form.itemId, name: form.title });
      return setForm(null);
    }
    if (form.ruleId) {
      setState((prev) => ({ ...prev, agendaRules: (prev.agendaRules || []).filter((r) => r.id !== form.ruleId) }));
      return setForm(null);
    }
    if (!form.id) return setForm(null);
    setState((prev) => {
      const cal = { ...(prev.calendar || {}) };
      for (const d of Object.keys(cal)) {
        cal[d] = (cal[d] || []).filter((e) => e.id !== form.id);
        if (!cal[d].length) delete cal[d];
      }
      return { ...prev, calendar: cal };
    });
    setForm(null);
  }

  // pular só esta ocorrência: entra na lista de exceções da regra, o resto segue
  function skipOccurrence() {
    if (!form?.ruleId || !form?.occurrence) return;
    setState((prev) => ({
      ...prev,
      agendaRules: (prev.agendaRules || []).map((r) =>
        r.id === form.ruleId ? { ...r, skips: [...new Set([...(r.skips || []), form.occurrence])] } : r
      ),
    }));
    setForm(null);
  }

  const removeRule = (id) => setState((prev) => ({ ...prev, agendaRules: (prev.agendaRules || []).filter((r) => r.id !== id) }));
  const removeRoutineItem = (it) =>
    setState((prev) => ({ ...prev, routine: { ...(prev.routine || {}), items: (prev.routine?.items || []).filter((i) => i.id !== it.id) } }));
  const clearSkips = (id) =>
    setState((prev) => ({ ...prev, agendaRules: (prev.agendaRules || []).map((r) => (r.id === id ? { ...r, skips: [] } : r)) }));


  return (
    <>
      <PageHeader title="AGENDA" subtitle="A semana com hora à vista, e abaixo o dia que você escolher. Sem XP, sem cobrança — só planejamento." />

      <div className="glass-card p-3 rounded-xl mb-gutter flex items-center justify-end gap-2 flex-wrap">
        {/* lembrete entra aqui, na ponta esquerda: um botão a mais numa barra que já
            existe custa nada, e o card que ele era comia uma faixa da tela */}
        <div className="mr-auto flex items-center gap-2">
          <NotifySettings state={state} setSetting={setSetting} toast={toast} onSaveSubscription={savePush} />
        </div>
        <button
          onClick={() => setShowRoutine(true)}
          className="px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high flex items-center gap-1.5 transition font-label-caps text-[11px]"
        >
          <MI name="checklist" className="text-base" />
          ROTINA
          {(state.routine?.items || []).length > 0 && <span className="text-primary">({state.routine.items.length})</span>}
        </button>
        <button
          onClick={() => setShowRules(true)}
          className="px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high flex items-center gap-1.5 transition font-label-caps text-[11px]"
        >
          <MI name="repeat" className="text-base" />
          REPETIÇÕES
          {(state.agendaRules || []).length > 0 && <span className="text-primary">({state.agendaRules.length})</span>}
        </button>
        <button
          onClick={() => openNew(newDayForWeek())}
          className="px-3 py-2 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-1.5 active:scale-95 transition font-label-caps text-[11px]"
        >
          <MI name="add" className="text-lg" /> NOVO
        </button>
      </div>

      <div className="flex flex-col gap-gutter mt-gutter">
        <WeekGrid
          anchor={anchor}
          setAnchor={setAnchor}
          eventsOn={eventsOn}
          routineOn={routineOn}
          routineStats={routineStats}
          onToggleRoutine={toggleRoutine}
          onAdd={openNew}
          onEdit={openEdit}
        />
        <CatLegend />
      </div>

      {form && (
        <EventModal form={form} setForm={setForm} habits={linkableHabits} onSave={saveForm} onDelete={deleteForm} onSkip={skipOccurrence} onClose={() => setForm(null)} />
      )}

      {workoutInfo && <WorkoutInfoModal ev={workoutInfo} onClose={() => setWorkoutInfo(null)} />}

      {showRoutine && (
        <RoutineModal
          items={state.routine?.items || []}
          habits={state.habits || []}
          onEdit={openEditRoutine}
          onRemove={(it) => removeRoutineItem(it)}
          onClose={() => setShowRoutine(false)}
        />
      )}

      {showRules && (
        <RulesModal
          rules={state.agendaRules || []}
          onEdit={(r) => {
            setShowRules(false);
            setForm({ kind: "weekly", ruleId: r.id, date: ds(new Date()), title: r.title, cat: r.cat, allDay: !!r.allDay, start: r.start || "09:00", end: r.end || "10:00", note: r.note || "", weekdays: r.weekdays || [], habitId: null });
          }}
          onRemove={removeRule}
          onClearSkips={clearSkips}
          onClose={() => setShowRules(false)}
        />
      )}
    </>
  );
}

function CatLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {CALENDAR_CATS.map((c) => (
        <span key={c.id} className="flex items-center gap-1.5 text-[10px] font-label-caps text-outline">
          <span className="w-2 h-2 rounded-full" style={{ background: c.color }} /> {c.label}
        </span>
      ))}
    </div>
  );
}

// modal de criar/editar evento
const FORM_KINDS = [
  { id: "once", label: "UMA VEZ", icon: "event", hint: "Acontece numa data só." },
  { id: "weekly", label: "TODA SEMANA", icon: "repeat", hint: "Vale pra sempre nos dias escolhidos. Editar muda todas as semanas." },
  { id: "routine", label: "ROTINA", icon: "checklist", hint: "O esqueleto do dia: marcável, dá XP e não tem multa por errar um dia." },
];

function EventModal({ form, setForm, habits, onSave, onDelete, onSkip, onClose }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isRule = form.kind === "weekly" && !!form.ruleId;
  const isRoutine = form.kind === "routine";
  const existing = form.id || form.ruleId || form.itemId;
  const title = existing ? (isRoutine ? "Editar item da rotina" : isRule ? "Editar repetição" : "Editar evento") : "Novo";
  const kindInfo = FORM_KINDS.find((k) => k.id === form.kind) || FORM_KINDS[0];
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label="Evento">
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-md text-headline-md text-primary">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition p-1"><MI name="close" /></button>
        </div>

        {/* o tipo só se escolhe na criação: trocar depois teria que migrar o
            registro de uma lista pra outra e decidir o que fazer com o histórico
            de marcações. Editar mantém o que a coisa é. */}
        {!existing && (
          <div className="mb-4">
            <div className="flex items-center gap-1 bg-surface-container-high rounded-lg p-1">
              {FORM_KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() =>
                    set({
                      kind: k.id,
                      // rotina não tem fim nem "dia inteiro": sem hora é "sem hora"
                      allDay: k.id === "routine" ? !form.start : form.allDay,
                      weekdays: (form.weekdays || []).length ? form.weekdays : [dowIndex(form.date)],
                    })
                  }
                  aria-pressed={form.kind === k.id}
                  className={`flex-1 px-2 py-1.5 rounded-md font-label-caps text-[10px] flex items-center justify-center gap-1.5 transition ${
                    form.kind === k.id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <MI name={k.icon} className="text-[15px]" /> {k.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-outline mt-1.5">{kindInfo.hint}</p>
          </div>
        )}

        {isRule && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <MI name="repeat" className="text-primary text-lg shrink-0" />
            <p className="text-[12px] text-on-surface">
              Você está editando a <strong className="font-semibold">série toda</strong>. Pra mexer só nesta semana, use{" "}
              <strong className="font-semibold">PULAR ESTA</strong> lá embaixo.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <input
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && onSave()}
            autoFocus
            placeholder={isRoutine ? "O que se repete (ex.: tomar remédio, alongar)" : "Título do evento"}
            maxLength={isRoutine ? 80 : 120}
            className={`${inputCls} w-full`}
          />

          {/* categoria: rotina não tem — ela não é compromisso, é ritmo */}
          {!isRoutine && (
          <div>
            <Caps className="text-outline text-[10px] mb-1.5 block">CATEGORIA</Caps>
            <div className="flex flex-wrap gap-1.5">
              {CALENDAR_CATS.map((c) => {
                const on = form.cat === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => set({ cat: c.id })}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-label-caps flex items-center gap-1.5 border transition ${on ? "text-on-surface" : "text-outline border-white/10 hover:border-white/25"}`}
                    style={on ? { background: `${c.color}33`, borderColor: c.color } : undefined}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: c.color }} /> {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* data: só o evento único tem data. Repetição e rotina têm dias da semana. */}
          {form.kind === "once" && (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Caps className="text-outline text-[10px] mb-1.5 block">DATA</Caps>
                <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className={`${inputCls} w-full`} />
              </div>
            </div>
          )}

          {/* dias da semana: repetição e rotina se descrevem igual aqui */}
          {form.kind !== "once" && (
            <div className="rounded-lg border border-white/10 p-3">
              <Caps className="text-outline text-[10px] mb-1.5 block">{isRoutine ? "EM QUAIS DIAS (NENHUM = TODO DIA)" : "EM QUAIS DIAS"}</Caps>
              <WeekdayPicker value={form.weekdays || []} onChange={(weekdays) => set({ weekdays })} />
              <p className="text-[11px] text-outline mt-2">
                {isRoutine
                  ? "Sem nenhum dia marcado, o item vale todo dia."
                  : "Vale pra sempre, sem precisar preencher semana por semana."}
              </p>
            </div>
          )}

          {/* rotina não tem fim nem "dia inteiro": ou tem hora, ou é sem hora */}
          {isRoutine ? (
            <div>
              <Caps className="text-outline text-[10px] mb-1.5 block">HORA (OPCIONAL)</Caps>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={form.allDay ? "" : form.start || ""}
                  onChange={(e) => set({ start: e.target.value, allDay: !e.target.value })}
                  className={`${inputCls} w-32`}
                />
                {!form.allDay && form.start && (
                  <button onClick={() => set({ start: "", allDay: true })} className="font-label-caps text-[10px] text-outline hover:text-primary transition">
                    TIRAR HORA
                  </button>
                )}
              </div>
              <p className="text-[11px] text-outline mt-1.5">Com hora, ele aparece no bloco certo do dia. Sem hora, fica na faixa de cima.</p>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.allDay} onChange={(e) => set({ allDay: e.target.checked })} className="accent-[var(--color-primary-container)] w-4 h-4" />
                <span className="text-body-md text-on-surface">Dia inteiro</span>
              </label>

              {!form.allDay && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Caps className="text-outline text-[10px] mb-1.5 block">INÍCIO</Caps>
                    <input type="time" value={form.start} onChange={(e) => set({ start: e.target.value })} className={`${inputCls} w-full`} />
                  </div>
                  <div className="flex-1">
                    <Caps className="text-outline text-[10px] mb-1.5 block">FIM</Caps>
                    <input type="time" value={form.end} onChange={(e) => set({ end: e.target.value })} className={`${inputCls} w-full`} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* vínculo com hábito: só rotina tem. Marcar o item marca o hábito, e o
              XP que entra é o dele — nunca os dois pelo mesmo ato. */}
          {isRoutine && (
            <div>
              <Caps className="text-outline text-[10px] mb-1.5 block">VINCULAR A UM HÁBITO (OPCIONAL)</Caps>
              <select
                value={form.habitId || ""}
                onChange={(e) => set({ habitId: e.target.value || null })}
                aria-label="Hábito vinculado"
                className={`${inputCls} w-full text-[13px]`}
              >
                <option value="">sem vínculo</option>
                {habits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-outline mt-1.5">Marcar aqui marca o hábito, e o XP que entra é o dele — não os dois.</p>
            </div>
          )}

          {!isRoutine && (
            <div>
              <Caps className="text-outline text-[10px] mb-1.5 block">NOTA</Caps>
              <textarea value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder="Detalhes (opcional)" maxLength={500} rows={3} className={`${inputCls} w-full resize-none`} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-6">
          {existing && (
            <button onClick={onDelete} className="px-4 py-2.5 rounded-lg border border-error/40 text-error hover:bg-error/10 transition font-label-caps text-[11px]">
              {isRule ? "EXCLUIR SÉRIE" : "EXCLUIR"}
            </button>
          )}
          {isRule && form.occurrence && (
            <button onClick={onSkip} className="px-4 py-2.5 rounded-lg border border-white/15 text-on-surface-variant hover:border-white/30 transition font-label-caps text-[11px]">
              PULAR ESTA
            </button>
          )}
          <button
            onClick={onSave}
            disabled={!form.title.trim() || (form.kind === "weekly" && !(form.weekdays || []).length)}
            className="flex-1 min-w-[120px] py-2.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 font-label-caps text-[11px] active:scale-95 transition disabled:opacity-40"
          >
            SALVAR
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
