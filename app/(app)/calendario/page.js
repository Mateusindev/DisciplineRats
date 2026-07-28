"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { format, addDays, addMonths, startOfMonth, endOfMonth, startOfWeek, isSameDay, isSameMonth, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, inputCls } from "@/components/ui";
import { CALENDAR_CATS, calCat, sortEvents, eventTimeLabel, eventsForDate, eventsInRange, dowIndex, DOW_SHORT } from "@/lib/state";

const ds = (d) => format(d, "yyyy-MM-dd");
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOUR_H = 56; // altura de 1 hora na timeline (px)
const toMin = (t) => {
  const [h, m] = (t || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const VIEWS = [
  { id: "month", label: "Mês", icon: "calendar_month" },
  { id: "week", label: "Semana", icon: "calendar_view_week" },
  { id: "day", label: "Dia", icon: "calendar_view_day" },
];

// chip/linha de um evento
function EventRow({ ev, onClick, compact }) {
  const cat = calCat(ev.cat);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg flex items-center gap-2 transition hover:brightness-110 active:scale-[.98] ${
        compact ? "px-1.5 py-1" : "px-3 py-2"
      }`}
      style={{ background: `${cat.color}22`, borderLeft: `3px solid ${cat.color}` }}
    >
      <div className="flex-1 min-w-0">
        <p className={`truncate text-on-surface ${compact ? "text-[11px] leading-tight" : "text-body-md"}`}>{ev.title}</p>
        {!compact && <Caps className="text-outline text-[9px]">{eventTimeLabel(ev)}</Caps>}
        {compact && ev.start && !ev.allDay && <span className="text-[9px] text-outline">{ev.start}</span>}
      </div>
      {/* marca o que não é evento avulso: repetição, ou treino puxado do plano */}
      {ev.source === "workout" ? (
        <MI name="fitness_center" className={`text-outline shrink-0 ${compact ? "text-[11px]" : "text-sm"}`} title="Do plano de treino" />
      ) : ev.ruleId ? (
        <MI name="repeat" className={`text-outline shrink-0 ${compact ? "text-[11px]" : "text-sm"}`} title="Repete toda semana" />
      ) : null}
    </button>
  );
}

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

export default function CalendarioPage() {
  const { state, setState } = useApp();

  const [view, setView] = useState("month");
  const [selected, setSelected] = useState(new Date());
  const [month, setMonth] = useState(new Date());
  const [form, setForm] = useState(null); // { id?, ruleId?, date, title, cat, allDay, start, end, note, repeat, weekdays }
  const [showRules, setShowRules] = useState(false);

  // Única leitura da agenda: junta eventos gravados + ocorrências de regra + treino do plano.
  const eventsOn = (d) => eventsForDate(state, ds(d));

  // ---- CRUD ----
  const blank = (date, start, end) => ({ date, title: "", cat: "pessoal", allDay: false, start, end, note: "", repeat: false, weekdays: [dowIndex(date)] });
  const openNew = (d) => setForm(blank(ds(d), "09:00", "10:00"));
  const openSlot = (d, hour) => setForm(blank(ds(d), `${String(hour).padStart(2, "0")}:00`, `${String((hour + 1) % 24).padStart(2, "0")}:00`));

  function openEdit(dateStr, ev) {
    // treino vem do plano de exercício: a agenda não edita, só aponta pra lá
    if (ev.source === "workout") return;
    if (ev.ruleId) {
      const r = (state.agendaRules || []).find((x) => x.id === ev.ruleId);
      if (!r) return;
      return setForm({
        ruleId: r.id,
        occurrence: dateStr, // qual ocorrência foi aberta (p/ "pular esta")
        date: dateStr,
        title: r.title,
        cat: r.cat,
        allDay: !!r.allDay,
        start: r.start || "09:00",
        end: r.end || "10:00",
        note: r.note || "",
        repeat: true,
        weekdays: r.weekdays || [],
      });
    }
    setForm({ ...ev, date: dateStr, start: ev.start || "09:00", end: ev.end || "10:00", note: ev.note || "", repeat: false, weekdays: [dowIndex(dateStr)] });
  }

  function saveForm() {
    if (!form.title.trim()) return;
    const base = {
      title: form.title.trim().slice(0, 120),
      cat: form.cat,
      allDay: !!form.allDay,
      start: form.allDay ? null : form.start || null,
      end: form.allDay ? null : form.end || null,
      note: (form.note || "").slice(0, 500),
    };

    // repetição ligada → vira (ou atualiza) uma REGRA; nenhuma data é gravada
    if (form.repeat) {
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
  const clearSkips = (id) =>
    setState((prev) => ({ ...prev, agendaRules: (prev.agendaRules || []).map((r) => (r.id === id ? { ...r, skips: [] } : r)) }));

  const weekStart = startOfWeek(selected, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <>
      <PageHeader title="AGENDA" subtitle="Organize seus dias, semanas e meses. Sem XP, sem cobrança — só planejamento." />

      {/* barra: alternador de view + novo evento */}
      <div className="glass-card p-3 rounded-xl mb-gutter flex items-center justify-between gap-3">
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-3 py-1.5 font-label-caps text-[10px] flex items-center gap-1.5 transition ${
                view === v.id ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:bg-surface-variant/40"
              }`}
            >
              <MI name={v.icon} className="text-sm" /> {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRules(true)}
            className="px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high flex items-center gap-1.5 transition font-label-caps text-[11px]"
          >
            <MI name="repeat" className="text-base" />
            REPETIÇÕES
            {(state.agendaRules || []).length > 0 && <span className="text-primary">({state.agendaRules.length})</span>}
          </button>
          <button
            onClick={() => openNew(selected)}
            className="px-3 py-2 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-1.5 active:scale-95 transition font-label-caps text-[11px]"
          >
            <MI name="add" className="text-lg" /> NOVO
          </button>
        </div>
      </div>

      {/* ===== MÊS ===== */}
      {view === "month" && (
        <MonthView
          month={month}
          setMonth={setMonth}
          selected={selected}
          setSelected={setSelected}
          state={state}
          eventsOn={eventsOn}
          onAdd={openNew}
          onEdit={openEdit}
        />
      )}

      {/* ===== SEMANA ===== */}
      {view === "week" && (
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline-md text-headline-md text-primary capitalize">
              {format(weekStart, "d MMM", { locale: ptBR })} – {format(addDays(weekStart, 6), "d MMM", { locale: ptBR })}
            </h3>
            <div className="flex items-center gap-1">
              <button onClick={() => setSelected(addDays(selected, -7))} aria-label="Semana anterior" className="w-8 h-8 rounded-lg grid place-items-center text-on-surface-variant hover:bg-surface-variant/60 transition"><MI name="chevron_left" /></button>
              <button onClick={() => setSelected(new Date())} className="px-2 h-8 rounded-lg text-on-surface-variant hover:bg-surface-variant/60 transition font-label-caps text-[10px]">HOJE</button>
              <button onClick={() => setSelected(addDays(selected, 7))} aria-label="Próxima semana" className="w-8 h-8 rounded-lg grid place-items-center text-on-surface-variant hover:bg-surface-variant/60 transition"><MI name="chevron_right" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((d) => {
              const evs = eventsOn(d);
              const today = isToday(d);
              const sel = isSameDay(d, selected);
              return (
                <div key={ds(d)} className={`rounded-lg border min-h-[180px] flex flex-col ${sel ? "border-primary/40" : "border-white/5"}`}>
                  <button
                    onClick={() => setSelected(d)}
                    className={`px-2 py-1.5 flex flex-col items-center border-b transition ${today ? "text-primary" : "text-on-surface-variant"} ${sel ? "bg-primary/10 border-primary/30" : "border-white/5 hover:bg-surface-variant/30"}`}
                  >
                    <Caps className="text-[9px]">{format(d, "EEE", { locale: ptBR })}</Caps>
                    <span className={`text-body-md ${today ? "font-bold" : ""}`}>{format(d, "d")}</span>
                  </button>
                  <div className="flex-1 p-1 space-y-1 overflow-y-auto">
                    {evs.map((ev) => (
                      <EventRow key={ev.id} ev={ev} compact onClick={() => openEdit(ds(d), ev)} />
                    ))}
                    <button onClick={() => openNew(d)} className="w-full py-1 rounded text-outline hover:text-primary hover:bg-surface-variant/30 transition grid place-items-center">
                      <MI name="add" className="text-sm" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== DIA ===== */}
      {view === "day" && (
        <div>
          <div className="glass-card p-4 rounded-xl mb-gutter flex items-center justify-between">
            <div>
              <h3 className="font-headline-md text-headline-md text-primary capitalize">{format(selected, "EEEE", { locale: ptBR })}</h3>
              <Caps className="text-outline">{format(selected, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</Caps>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setSelected(addDays(selected, -1))} aria-label="Dia anterior" className="w-8 h-8 rounded-lg grid place-items-center text-on-surface-variant hover:bg-surface-variant/60 transition"><MI name="chevron_left" /></button>
              <button onClick={() => setSelected(new Date())} className="px-2 h-8 rounded-lg text-on-surface-variant hover:bg-surface-variant/60 transition font-label-caps text-[10px]">HOJE</button>
              <button onClick={() => setSelected(addDays(selected, 1))} aria-label="Próximo dia" className="w-8 h-8 rounded-lg grid place-items-center text-on-surface-variant hover:bg-surface-variant/60 transition"><MI name="chevron_right" /></button>
            </div>
          </div>
          <DayTimeline date={selected} events={eventsOn(selected)} onSlot={(h) => openSlot(selected, h)} onAdd={() => openNew(selected)} onEdit={(ev) => openEdit(ds(selected), ev)} />
        </div>
      )}

      {form && (
        <EventModal form={form} setForm={setForm} onSave={saveForm} onDelete={deleteForm} onSkip={skipOccurrence} onClose={() => setForm(null)} />
      )}

      {showRules && (
        <RulesModal
          rules={state.agendaRules || []}
          onEdit={(r) => {
            setShowRules(false);
            setForm({ ruleId: r.id, date: ds(new Date()), title: r.title, cat: r.cat, allDay: !!r.allDay, start: r.start || "09:00", end: r.end || "10:00", note: r.note || "", repeat: true, weekdays: r.weekdays || [] });
          }}
          onRemove={removeRule}
          onClearSkips={clearSkips}
          onClose={() => setShowRules(false)}
        />
      )}
    </>
  );
}

// ===== visão mensal: dot-map grid =====
function MonthView({ month, setMonth, selected, setSelected, state, eventsOn, onAdd, onEdit }) {
  // matriz de 42 dias (6 semanas), começando no domingo
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  // stats do mês — por range, não varrendo o mapa: ocorrência de regra não está gravada
  const monthEvents = eventsInRange(state, ds(startOfMonth(month)), ds(endOfMonth(month)));
  const byCat = {};
  for (const e of monthEvents) byCat[e.cat] = (byCat[e.cat] || 0) + 1;
  const topCatId = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topCat = topCatId ? calCat(topCatId) : null;

  const pick = (d) => {
    setSelected(d);
    if (!isSameMonth(d, month)) setMonth(startOfMonth(d));
  };

  return (
    <div className="flex flex-col gap-gutter">
      {/* overview + navegação */}
      <section className="flex flex-col md:flex-row justify-between md:items-end gap-6">
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[10px] text-primary tracking-[0.2em] uppercase">Visão do mês</span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface capitalize leading-none">{format(month, "LLLL yyyy", { locale: ptBR })}</h1>
          <p className="text-on-surface-variant mt-2 text-body-md">
            {monthEvents.length > 0 ? (
              <>
                <span className="text-primary font-bold">{monthEvents.length} evento{monthEvents.length > 1 ? "s" : ""}</span> neste mês
                {topCat && <> · mais em <span style={{ color: topCat.color }}>{topCat.label}</span></>}
              </>
            ) : (
              "Nenhum evento neste mês ainda."
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior" className="w-9 h-9 rounded-full grid place-items-center text-on-surface-variant hover:bg-surface-container-high transition"><MI name="chevron_left" /></button>
            <button onClick={() => { setMonth(new Date()); setSelected(new Date()); }} className="px-3 h-9 rounded-full text-on-surface-variant hover:bg-surface-container-high transition font-label-caps text-[10px]">HOJE</button>
            <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês" className="w-9 h-9 rounded-full grid place-items-center text-on-surface-variant hover:bg-surface-container-high transition"><MI name="chevron_right" /></button>
          </div>
        </div>
      </section>

      {/* dot-map grid */}
      <div className="grid grid-cols-7 gap-px bg-outline-variant/20 rounded-3xl overflow-hidden border border-white/10 shadow-xl">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-surface-container-low py-3 text-center font-label-caps text-[10px] text-outline uppercase tracking-widest">{w}</div>
        ))}
        {cells.map((d) => {
          const evs = eventsOn(d);
          const outside = !isSameMonth(d, month);
          const today = isToday(d);
          const sel = isSameDay(d, selected);
          return (
            <button
              key={ds(d)}
              onClick={() => pick(d)}
              onDoubleClick={() => onAdd(d)}
              className={`relative aspect-square p-2 sm:p-3 flex flex-col justify-between text-left transition group ${
                outside ? "bg-surface/30" : "bg-surface-container-lowest hover:bg-surface-container-high"
              } ${sel ? "ring-2 ring-primary ring-inset z-10" : ""}`}
            >
              <div className="flex justify-between items-start">
                <span className={`font-headline-md text-body-lg ${outside ? "text-outline/40" : today ? "text-primary font-bold" : "text-on-surface-variant"}`}>{format(d, "d")}</span>
                {today && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
              </div>
              {evs.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-auto">
                  {evs.slice(0, 4).map((e) => (
                    <span key={e.id} className="w-1.5 h-1.5 rounded-full transition-transform group-hover:scale-125" style={{ background: calCat(e.cat).color }} />
                  ))}
                  {evs.length > 4 && <span className="text-[8px] text-outline leading-none self-center">+{evs.length - 4}</span>}
                </div>
              )}

              {/* popover (desktop hover) */}
              {evs.length > 0 && (
                <div className="hidden md:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-inverse-surface text-inverse-on-surface p-3 rounded-xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all z-50 shadow-xl">
                  <p className="font-label-caps text-[9px] uppercase opacity-70 mb-2">{format(d, "d 'de' MMM", { locale: ptBR })}</p>
                  <div className="space-y-1.5">
                    {evs.slice(0, 4).map((e) => (
                      <div key={e.id} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: calCat(e.cat).color }} />
                        <p className="text-[11px] truncate">{e.title}</p>
                      </div>
                    ))}
                    {evs.length > 4 && <p className="text-[10px] opacity-50">+{evs.length - 4} mais</p>}
                  </div>
                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent" style={{ borderTopColor: "var(--color-inverse-surface)" }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* legenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {CALENDAR_CATS.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5 text-[10px] font-label-caps text-outline">
            <span className="w-2 h-2 rounded-full" style={{ background: c.color }} /> {c.label}
          </span>
        ))}
      </div>

      {/* agenda do dia + próximos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-6">
          <DayAgenda date={selected} events={eventsOn(selected)} onAdd={() => onAdd(selected)} onEdit={(ev) => onEdit(ds(selected), ev)} />
        </div>
        <div className="lg:col-span-6">
          <Upcoming state={state} onEdit={onEdit} />
        </div>
      </div>
    </div>
  );
}

// próximos eventos a partir de hoje
function Upcoming({ state, onEdit }) {
  // janela de 60 dias à frente: recorrência é infinita, então varrer "tudo" não existe mais
  const today = new Date();
  const items = eventsInRange(state, ds(today), ds(addDays(today, 60))).map((ev) => ({ dateStr: ev.date, ev }));
  items.sort((a, b) => a.dateStr.localeCompare(b.dateStr) || (a.ev.allDay ? "" : a.ev.start || "").localeCompare(b.ev.allDay ? "" : b.ev.start || ""));
  const next = items.slice(0, 6);

  return (
    <div className="glass-card p-5 rounded-xl h-full">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-outline-variant/40" />
        <Caps className="text-outline text-[10px]">PRÓXIMOS</Caps>
      </div>
      {next.length === 0 ? (
        <p className="text-[13px] text-outline text-center py-8">Nada agendado à frente.</p>
      ) : (
        <div className="space-y-2">
          {next.map(({ dateStr, ev }) => {
            const d = new Date(dateStr + "T00:00:00");
            const cat = calCat(ev.cat);
            return (
              <button key={ev.id} onClick={() => onEdit(dateStr, ev)} className="w-full flex items-center gap-4 p-2.5 rounded-xl hover:bg-surface-container transition group text-left">
                <div className="text-center min-w-[42px]">
                  <p className="font-headline-md text-body-lg text-on-surface leading-none">{format(d, "d")}</p>
                  <p className="text-[9px] font-label-caps text-outline uppercase">{format(d, "MMM", { locale: ptBR })}</p>
                </div>
                <div className="w-1 h-10 rounded-full shrink-0" style={{ background: cat.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-body-md text-on-surface truncate">{ev.title}</p>
                  <p className="text-[11px] text-on-surface-variant">{cat.label} · {eventTimeLabel(ev)}</p>
                </div>
                <MI name="chevron_right" className="text-outline opacity-0 group-hover:opacity-100 transition" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== visão de dia: timeline por hora (tipo Google Agenda) =====
function DayTimeline({ date, events, onSlot, onAdd, onEdit }) {
  const allDay = events.filter((e) => e.allDay || !e.start);
  const timed = events.filter((e) => !e.allDay && e.start);

  // atribui "lanes" p/ eventos sobrepostos ficarem lado a lado
  const items = timed
    .map((e) => {
      const s = toMin(e.start);
      const en = Math.max(e.end ? toMin(e.end) : s + 60, s + 30);
      return { e, s, en };
    })
    .sort((a, b) => a.s - b.s || a.en - b.en);
  const laneEnds = [];
  for (const it of items) {
    let idx = laneEnds.findIndex((end) => end <= it.s);
    if (idx === -1) {
      idx = laneEnds.length;
      laneEnds.push(it.en);
    } else laneEnds[idx] = it.en;
    it.lane = idx;
  }
  const laneCount = Math.max(1, laneEnds.length);

  const today = isToday(date);
  const now = new Date();
  const nowMin = today ? now.getHours() * 60 + now.getMinutes() : null;

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {allDay.length > 0 && (
        <div className="p-3 border-b border-white/5 space-y-1">
          <Caps className="text-outline text-[9px] mb-1 block">DIA INTEIRO</Caps>
          {allDay.map((ev) => (
            <EventRow key={ev.id} ev={ev} onClick={() => onEdit(ev)} />
          ))}
        </div>
      )}
      <div className="relative overflow-y-auto max-h-[68vh]">
        <div className="relative" style={{ height: 24 * HOUR_H }}>
          {Array.from({ length: 24 }, (_, h) => (
            <button
              key={h}
              onClick={() => onSlot(h)}
              className="absolute left-0 right-0 border-t border-white/5 flex text-left hover:bg-surface-variant/20 transition group"
              style={{ top: h * HOUR_H, height: HOUR_H }}
            >
              <span className="w-14 shrink-0 -mt-2 pl-2 text-[10px] text-outline font-label-caps">{String(h).padStart(2, "0")}:00</span>
              <span className="flex-1 grid place-items-center opacity-0 group-hover:opacity-100"><MI name="add" className="text-sm text-outline" /></span>
            </button>
          ))}

          {items.map(({ e, s, en, lane }) => {
            const cat = calCat(e.cat);
            const top = (s / 60) * HOUR_H;
            const height = Math.max(20, ((en - s) / 60) * HOUR_H);
            const width = `calc((100% - 3.5rem) / ${laneCount})`;
            const left = `calc(3.5rem + ${lane} * (100% - 3.5rem) / ${laneCount})`;
            return (
              <button
                key={e.id}
                onClick={() => onEdit(e)}
                className="absolute rounded-lg px-2 py-1 text-left overflow-hidden hover:brightness-110 transition z-10"
                style={{ top, height, left, width, background: `${cat.color}26`, borderLeft: `3px solid ${cat.color}` }}
              >
                <p className="text-[11px] text-on-surface truncate font-medium leading-tight">{e.title}</p>
                {height > 32 && <p className="text-[9px] text-outline">{eventTimeLabel(e)}</p>}
              </button>
            );
          })}

          {nowMin !== null && (
            <div className="absolute left-14 right-0 flex items-center z-20 pointer-events-none" style={{ top: (nowMin / 60) * HOUR_H }}>
              <span className="w-2 h-2 rounded-full bg-error -ml-1" />
              <span className="flex-1 h-px bg-error" />
            </div>
          )}
        </div>
      </div>
      <button onClick={onAdd} className="w-full py-2.5 border-t border-white/5 text-outline hover:text-primary hover:bg-surface-variant/20 transition font-label-caps text-[11px] flex items-center justify-center gap-1">
        <MI name="add" className="text-base" /> NOVO EVENTO
      </button>
    </div>
  );
}

// painel de agenda de um dia
function DayAgenda({ date, events, onAdd, onEdit, hideHeader }) {
  return (
    <div className="glass-card p-5 rounded-xl h-full flex flex-col">
      {!hideHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-headline-md text-headline-md capitalize">{format(date, "EEEE", { locale: ptBR })}</h3>
            <Caps className="text-outline">{format(date, "d 'de' MMMM", { locale: ptBR })}</Caps>
          </div>
          <button onClick={onAdd} aria-label="Adicionar evento" className="w-9 h-9 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 grid place-items-center active:scale-95 transition">
            <MI name="add" />
          </button>
        </div>
      )}
      {events.length === 0 ? (
        <div className="flex-1 grid place-items-center text-center py-10">
          <div className="space-y-2">
            <MI name="event_available" className="text-4xl text-outline/50" />
            <p className="text-[13px] text-outline">Nada marcado nesse dia.</p>
            <button onClick={onAdd} className="text-primary text-[11px] font-label-caps hover:underline">+ ADICIONAR EVENTO</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <EventRow key={ev.id} ev={ev} onClick={() => onEdit(ev)} />
          ))}
          {hideHeader && (
            <button onClick={onAdd} className="w-full py-2 rounded-lg border border-dashed border-white/10 text-outline hover:text-primary hover:border-primary/30 transition font-label-caps text-[11px] flex items-center justify-center gap-1">
              <MI name="add" className="text-base" /> ADICIONAR
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// modal de criar/editar evento
function EventModal({ form, setForm, onSave, onDelete, onSkip, onClose }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isRule = !!form.ruleId;
  const title = isRule ? "Editar repetição" : form.id ? "Editar evento" : "Novo evento";
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label="Evento">
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-md text-headline-md text-primary">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition p-1"><MI name="close" /></button>
        </div>

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
            placeholder="Título do evento"
            maxLength={120}
            className={`${inputCls} w-full`}
          />

          {/* categoria */}
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

          {/* data: regra não tem data única, tem dias da semana */}
          {!form.repeat && (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Caps className="text-outline text-[10px] mb-1.5 block">DATA</Caps>
                <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className={`${inputCls} w-full`} />
              </div>
            </div>
          )}

          {/* repetição semanal */}
          <div className="rounded-lg border border-white/10 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.repeat}
                onChange={(e) => set({ repeat: e.target.checked, weekdays: e.target.checked && !(form.weekdays || []).length ? [dowIndex(form.date)] : form.weekdays })}
                className="accent-[var(--color-primary-container)] w-4 h-4"
              />
              <MI name="repeat" className="text-base text-on-surface-variant" />
              <span className="text-body-md text-on-surface">Repetir toda semana</span>
            </label>
            {form.repeat && (
              <div className="mt-3">
                <Caps className="text-outline text-[10px] mb-1.5 block">EM QUAIS DIAS</Caps>
                <WeekdayPicker value={form.weekdays || []} onChange={(weekdays) => set({ weekdays })} />
                <p className="text-[11px] text-outline mt-2">
                  Vale pra sempre, sem precisar preencher semana por semana. Desmarcar a repetição encerra a série e deixa só este dia.
                </p>
              </div>
            )}
          </div>

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

          <div>
            <Caps className="text-outline text-[10px] mb-1.5 block">NOTA</Caps>
            <textarea value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder="Detalhes (opcional)" maxLength={500} rows={3} className={`${inputCls} w-full resize-none`} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-6">
          {(form.id || isRule) && (
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
            disabled={!form.title.trim() || (form.repeat && !(form.weekdays || []).length)}
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
