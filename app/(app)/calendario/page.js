"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { format, addDays, addMonths, startOfWeek, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, inputCls } from "@/components/ui";
import { Calendar } from "@/components/ui/calendar";
import { CALENDAR_CATS, calCat, sortEvents, eventTimeLabel } from "@/lib/state";

const ds = (d) => format(d, "yyyy-MM-dd");
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
    </button>
  );
}

export default function CalendarioPage() {
  const { state, setState } = useApp();
  const calendar = state.calendar || {};

  const [view, setView] = useState("month");
  const [selected, setSelected] = useState(new Date());
  const [month, setMonth] = useState(new Date());
  const [form, setForm] = useState(null); // { id?, date, title, cat, allDay, start, end, note }

  const eventsOn = (d) => sortEvents(calendar[ds(d)]);
  const getDayColors = (date) => {
    const out = [];
    for (const e of calendar[ds(date)] || []) {
      const c = calCat(e.cat).color;
      if (!out.includes(c)) out.push(c);
    }
    return out;
  };

  // ---- CRUD ----
  const openNew = (d) => setForm({ date: ds(d), title: "", cat: "pessoal", allDay: false, start: "09:00", end: "10:00", note: "" });
  const openEdit = (dateStr, ev) => setForm({ ...ev, date: dateStr, start: ev.start || "09:00", end: ev.end || "10:00", note: ev.note || "" });

  function saveForm() {
    if (!form.title.trim()) return;
    const ev = {
      id: form.id || crypto.randomUUID(),
      title: form.title.trim().slice(0, 120),
      cat: form.cat,
      allDay: !!form.allDay,
      start: form.allDay ? null : form.start || null,
      end: form.allDay ? null : form.end || null,
      note: (form.note || "").slice(0, 500),
    };
    setState((prev) => {
      const cal = { ...(prev.calendar || {}) };
      if (form.id) for (const d of Object.keys(cal)) cal[d] = (cal[d] || []).filter((e) => e.id !== form.id);
      cal[form.date] = [...(cal[form.date] || []), ev];
      for (const d of Object.keys(cal)) if (!cal[d].length) delete cal[d];
      return { ...prev, calendar: cal };
    });
    setForm(null);
  }
  function deleteForm() {
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
                view === v.id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
              }`}
            >
              <MI name={v.icon} className="text-sm" /> {v.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => openNew(selected)}
          className="px-3 py-2 rounded-lg bg-primary-container text-on-primary-container flex items-center gap-1.5 active:scale-95 transition font-label-caps text-[11px]"
        >
          <MI name="add" className="text-lg" /> NOVO
        </button>
      </div>

      {/* ===== MÊS ===== */}
      {view === "month" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <div className="lg:col-span-7">
            <div className="glass-card p-5 rounded-xl">
              <Calendar
                mode="single"
                selected={selected}
                onSelect={(d) => d && setSelected(d)}
                month={month}
                onMonthChange={setMonth}
                getDayColors={getDayColors}
              />
              {/* legenda */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4 pt-4 border-t border-white/5">
                {CALENDAR_CATS.map((c) => (
                  <span key={c.id} className="flex items-center gap-1.5 text-[10px] font-label-caps text-outline">
                    <span className="w-2 h-2 rounded-full" style={{ background: c.color }} /> {c.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* agenda do dia selecionado */}
          <div className="lg:col-span-5">
            <DayAgenda date={selected} events={eventsOn(selected)} onAdd={() => openNew(selected)} onEdit={(ev) => openEdit(ds(selected), ev)} />
          </div>
        </div>
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
        <div className="max-w-2xl">
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
          <DayAgenda date={selected} events={eventsOn(selected)} onAdd={() => openNew(selected)} onEdit={(ev) => openEdit(ds(selected), ev)} hideHeader />
        </div>
      )}

      {form && (
        <EventModal form={form} setForm={setForm} onSave={saveForm} onDelete={deleteForm} onClose={() => setForm(null)} />
      )}
    </>
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
          <button onClick={onAdd} aria-label="Adicionar evento" className="w-9 h-9 rounded-lg bg-primary-container text-on-primary-container grid place-items-center active:scale-95 transition">
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
function EventModal({ form, setForm, onSave, onDelete, onClose }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label="Evento">
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-md text-headline-md text-primary">{form.id ? "Editar evento" : "Novo evento"}</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition p-1"><MI name="close" /></button>
        </div>

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

          {/* data + horário */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Caps className="text-outline text-[10px] mb-1.5 block">DATA</Caps>
              <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className={`${inputCls} w-full`} />
            </div>
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

        <div className="flex items-center gap-2 mt-6">
          {form.id && (
            <button onClick={onDelete} className="px-4 py-2.5 rounded-lg border border-error/40 text-error hover:bg-error/10 transition font-label-caps text-[11px]">
              EXCLUIR
            </button>
          )}
          <button onClick={onSave} disabled={!form.title.trim()} className="flex-1 py-2.5 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-[11px] active:scale-95 transition disabled:opacity-40">
            SALVAR
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
