"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { format, addDays, addMonths, startOfMonth, startOfWeek, isSameDay, isSameMonth, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, inputCls } from "@/components/ui";
import { CALENDAR_CATS, calCat, sortEvents, eventTimeLabel } from "@/lib/state";

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

  // ---- CRUD ----
  const openNew = (d) => setForm({ date: ds(d), title: "", cat: "pessoal", allDay: false, start: "09:00", end: "10:00", note: "" });
  const openEdit = (dateStr, ev) => setForm({ ...ev, date: dateStr, start: ev.start || "09:00", end: ev.end || "10:00", note: ev.note || "" });
  const openSlot = (d, hour) => setForm({ date: ds(d), title: "", cat: "pessoal", allDay: false, start: `${String(hour).padStart(2, "0")}:00`, end: `${String((hour + 1) % 24).padStart(2, "0")}:00`, note: "" });

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
        <MonthView
          month={month}
          setMonth={setMonth}
          selected={selected}
          setSelected={setSelected}
          calendar={calendar}
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
        <EventModal form={form} setForm={setForm} onSave={saveForm} onDelete={deleteForm} onClose={() => setForm(null)} />
      )}
    </>
  );
}

// ===== visão mensal: dot-map grid =====
function MonthView({ month, setMonth, selected, setSelected, calendar, eventsOn, onAdd, onEdit }) {
  // matriz de 42 dias (6 semanas), começando no domingo
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  // stats do mês
  const monthEvents = [];
  for (const [dateStr, evs] of Object.entries(calendar || {})) {
    const d = new Date(dateStr + "T00:00:00");
    if (isSameMonth(d, month)) for (const e of evs) monthEvents.push(e);
  }
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
          <Upcoming calendar={calendar} onEdit={onEdit} />
        </div>
      </div>
    </div>
  );
}

// próximos eventos a partir de hoje
function Upcoming({ calendar, onEdit }) {
  const todayStr = ds(new Date());
  const items = [];
  for (const [dateStr, evs] of Object.entries(calendar || {})) {
    if (dateStr < todayStr) continue;
    for (const e of evs) items.push({ dateStr, ev: e });
  }
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
