"use client";

import { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, inputCls } from "@/components/ui";
import {
  getDateStr,
  habitStreak,
  habitWeekdays,
  habitIsScheduled,
  habitScheduleLabel,
  DOW_SHORT,
  HABIT_ICONS,
  HABIT_PRIORITIES,
  habitPriority,
  QUIT_MILESTONES,
  WEEKLY_BONUS,
  award,
  cleanDays,
  bestCleanRun,
  lastRelapse,
  relapsesInWindow,
  computeDueMilestones,
  computeDueWeeklyBonus,
  weekCount,
  shiftDate,
  toggleHabitState,
} from "@/lib/state";

// Limite do porquê. Curto de propósito: motivo que não cabe numa linha não é lido
// na hora da decisão, e é justamente aí que ele precisa funcionar. Notas longas
// vão pro campo de detalhes.
const WHY_MAX = 140;

// dias da semana do hábito (0=Seg..6=Dom). Nada marcado = todo dia.
function DowPicker({ value, onChange }) {
  const sel = new Set(value || []);
  const toggle = (d) => {
    const next = new Set(sel);
    next.has(d) ? next.delete(d) : next.add(d);
    onChange([...next].sort((a, b) => a - b));
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1">
        {DOW_SHORT.map((label, d) => {
          const on = sel.has(d);
          return (
            <button
              key={d}
              onClick={() => toggle(d)}
              aria-pressed={on}
              aria-label={label}
              className={`w-9 h-7 rounded font-label-caps text-[10px] border transition ${
                on ? "bg-primary-container text-on-primary-container border-primary-container" : "border-white/10 text-outline hover:border-white/25"
              }`}
            >
              {label.slice(0, 1)}
              {label.slice(1, 3).toLowerCase()}
            </button>
          );
        })}
      </div>
      {sel.size === 0 ? (
        <Caps className="text-outline text-[10px]">TODO DIA</Caps>
      ) : (
        <button onClick={() => onChange([])} className="font-label-caps text-[10px] text-outline hover:text-primary transition">
          TODO DIA
        </button>
      )}
    </div>
  );
}

// dias em letra única, pra barra compacta de criação. O card de edição continua
// com o DowPicker completo — lá o espaço existe e o rótulo legível vale mais.
function DowMini({ value, onChange }) {
  const sel = new Set(value || []);
  const toggle = (d) => {
    const next = new Set(sel);
    next.has(d) ? next.delete(d) : next.add(d);
    onChange([...next].sort((a, b) => a - b));
  };
  // Nenhum dia marcado = TODO DIA, que é o padrão. Como "vazio" e "todo dia" são o
  // mesmo estado, ele precisa se anunciar: o chip acende e os sete círculos ficam
  // com o contorno do accent — sem isso, padrão ativo parece campo não preenchido.
  const all = sel.size === 0;
  return (
    <div className="flex items-center gap-1">
      {DOW_SHORT.map((label, d) => {
        const on = sel.has(d);
        return (
          <button
            key={d}
            onClick={() => toggle(d)}
            aria-pressed={on}
            aria-label={label}
            title={all ? `${label} — incluído em todo dia` : label}
            className={`w-7 h-7 rounded-full font-label-caps text-[10px] border transition ${
              on
                ? "bg-primary-container text-on-primary-container border-primary-container"
                : all
                  ? "border-primary-container/40 text-primary-container/70 hover:border-primary-container"
                  : "border-white/10 text-outline hover:border-white/25"
            }`}
          >
            {label.slice(0, 1)}
          </button>
        );
      })}
      <button
        onClick={() => onChange([])}
        disabled={all}
        aria-pressed={all}
        title={all ? "Vale todo dia da semana" : "Voltar pra todo dia"}
        className={`ml-1.5 px-2 h-7 rounded-full font-label-caps text-[9px] flex items-center gap-1 border transition ${
          all
            ? "bg-primary-container/15 text-primary-container border-primary-container/40"
            : "border-white/10 text-on-surface-variant hover:border-white/25 hover:text-primary"
        }`}
      >
        <MI name={all ? "done_all" : "restart_alt"} className="text-[13px]" />
        TODO DIA
      </button>
    </div>
  );
}

// chips de prioridade (form e card)
function PriorityChips({ value, onChange, size = "text-[10px]" }) {
  return (
    <div className="flex gap-1">
      {HABIT_PRIORITIES.map((p) => (
        <button
          key={p.v}
          onClick={() => onChange(p.v)}
          aria-label={`Prioridade ${p.label}`}
          className={`px-2 py-1 rounded-full font-label-caps ${size} border transition ${
            value === p.v
              ? p.v === 3
                ? "bg-primary-container text-on-primary-container border-primary-container"
                : "bg-surface-variant text-on-surface border-surface-variant"
              : "border-white/10 text-outline hover:border-white/25"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// FORM DE CRIAÇÃO — barra de uma linha: nome, porquê, tipo, prioridade e
// dias/alvo, todos à vista. Sem menu escondendo opção.
// ============================================================================
const KINDS = [
  { id: "build", label: "DIÁRIO", icon: "trending_up" },
  { id: "weekly", label: "SEMANAL", icon: "event_repeat" },
  { id: "quit", label: "LARGAR", icon: "block" },
];

// nome + porquê: dois inputs só com linha inferior (o porquê acende no foco)
function NameFields({ f }) {
  return (
    <div className="flex-1 min-w-0">
      <input
        value={f.newHabit}
        onChange={(e) => f.setNewHabit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && f.addHabit()}
        placeholder={f.newKind === "quit" ? "Largar o quê? Ex: cigarro, açúcar..." : "Adicionar novo hábito..."}
        aria-label="Nome do hábito"
        className="w-full bg-transparent border-0 border-b border-white/10 focus:border-primary-container/70 px-0 py-2 font-body-md text-body-md text-on-surface placeholder:text-outline outline-none transition-colors"
      />
      <div className="flex items-center gap-1.5 mt-1">
        <MI name="format_quote" className="text-outline text-base shrink-0" />
        <input
          value={f.newWhy}
          onChange={(e) => f.setNewWhy(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && f.addHabit()}
          maxLength={WHY_MAX}
          placeholder={f.newKind === "quit" ? "Por que largar? (opcional)" : "Por que isso importa? (opcional)"}
          aria-label="Porquê do hábito"
          className="w-full bg-transparent border-0 border-b border-transparent hover:border-white/10 focus:border-primary-container/70 px-0 py-1 text-[12px] text-on-surface-variant placeholder:text-outline outline-none transition-colors"
        />
      </div>
    </div>
  );
}

function AddButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Adicionar hábito"
      className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 active:scale-95 transition"
    >
      <MI name="add" className="text-2xl" />
    </button>
  );
}

// tipo em 3 ícones, sem texto (tooltip carrega o nome)
function KindIcons({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {KINDS.map((k) => {
        const on = value === k.id;
        return (
          <button
            key={k.id}
            onClick={() => onChange(k.id)}
            aria-pressed={on}
            aria-label={k.label}
            title={k.label}
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition ${
              on
                ? k.id === "quit"
                  ? "bg-error/15 text-error border-error/40"
                  : "bg-primary-container/20 text-primary-container border-primary-container/40"
                : "border-transparent text-outline hover:text-on-surface-variant hover:border-white/10"
            }`}
          >
            <MI name={k.icon} className="text-lg" />
          </button>
        );
      })}
    </div>
  );
}

// alvo semanal compacto: direção (meta/limite) + N
function WeeklyCompact({ direction, onDirection, target, onTarget }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        onClick={() => onDirection(direction === "min" ? "max" : "min")}
        title={direction === "min" ? "Pelo menos N vezes na semana — clique pra virar limite" : "No máximo N vezes na semana — clique pra virar meta"}
        className={`h-7 px-2 rounded-full border font-label-caps text-[9px] flex items-center gap-1 transition ${
          direction === "max" ? "border-error/40 text-error" : "border-primary-container/40 text-primary-container"
        }`}
      >
        <MI name={direction === "min" ? "arrow_upward" : "arrow_downward"} className="text-[13px]" />
        {direction === "min" ? "MÍN" : "MÁX"}
      </button>
      <button onClick={() => onTarget(Math.max(1, target - 1))} aria-label="Diminuir alvo" className="w-6 h-6 rounded-full border border-white/10 text-outline hover:border-white/25 transition">−</button>
      <Caps className="text-primary text-[10px] w-12 text-center">{target}×/SEM</Caps>
      <button onClick={() => onTarget(Math.min(7, target + 1))} aria-label="Aumentar alvo" className="w-6 h-6 rounded-full border border-white/10 text-outline hover:border-white/25 transition">+</button>
    </div>
  );
}

// Prioridade em barras crescentes + rótulo do nível ativo. Três marcas iguais não
// dizem qual é qual: aqui a altura já é a escala, o preenchimento é cumulativo
// (alta = três barras acesas) e o texto ao lado tira qualquer dúvida do XP.
function PriorityBars({ value, onChange }) {
  const active = HABIT_PRIORITIES.find((p) => p.v === value) || HABIT_PRIORITIES[1];
  return (
    <div className="flex items-center gap-1.5 shrink-0" title={`Prioridade ${active.label} · +${active.xp} XP por check`}>
      <div className="flex items-end gap-0.5" role="group" aria-label="Prioridade">
        {HABIT_PRIORITIES.map((p) => {
          const on = value >= p.v;
          const h = p.v === 1 ? "h-2" : p.v === 2 ? "h-3.5" : "h-5";
          return (
            <button
              key={p.v}
              onClick={() => onChange(p.v)}
              aria-pressed={value === p.v}
              aria-label={`Prioridade ${p.label}, +${p.xp} XP`}
              title={`${p.label} · +${p.xp} XP`}
              className="w-3 h-7 flex items-end justify-center group"
            >
              <span className={`w-2 ${h} rounded-sm transition ${on ? "bg-primary-container" : "bg-outline/30 group-hover:bg-outline/60"}`} />
            </button>
          );
        })}
      </div>
      <div className="leading-none">
        <Caps className={`text-[10px] block ${value === 3 ? "text-primary" : "text-on-surface-variant"}`}>{active.label}</Caps>
        <span className="text-[9px] text-outline">+{active.xp} XP</span>
      </div>
    </div>
  );
}

// controle da direita que troca com o tipo escolhido
function ContextControl({ f }) {
  if (f.newKind === "build") return <DowMini value={f.newWeekdays} onChange={f.setNewWeekdays} />;
  if (f.newKind === "weekly")
    return <WeeklyCompact direction={f.newDirection} onDirection={f.setNewDirection} target={f.newTarget} onTarget={f.setNewTarget} />;
  return <Caps className="text-error text-[10px] shrink-0">SÓ RECAÍDAS</Caps>;
}

// Barra de criação: tipo em ícone à esquerda, nome e porquê no meio, contexto
// (dias ou alvo) + prioridade + adicionar à direita. Tudo a um clique, nada
// escondido atrás de menu.
function HabitForm({ f }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
      <KindIcons value={f.newKind} onChange={f.setNewKind} />
      <NameFields f={f} />
      <div className="flex items-center gap-3 md:gap-4 justify-between md:justify-end">
        <ContextControl f={f} />
        <PriorityBars value={f.newPriority} onChange={f.setNewPriority} />
        <AddButton onClick={f.addHabit} />
      </div>
    </div>
  );
}


// ---- header comum do card (ícone + editar/excluir + nome) ----
// Componentes em escopo de módulo (não aninhados na página): identidade estável
// entre renders, então os inputs de edição não remontam a cada tecla (evita o
// foco pular pro título ao digitar os detalhes).
function CardHeader({ h, i, ctx }) {
  const { edits, editDetails, editWhys, setEdits, setEditDetails, setEditWhys, pickingIcon, setPickingIcon, setIcon, saveEdit, cancelEdit, startEdit, removeHabit, setPriority } = ctx;
  const editing = edits[h.id] !== undefined;
  const picking = pickingIcon === h.id;
  return (
    <>
      <div className="flex items-start justify-between mb-3">
        <button
          onClick={() => setPickingIcon(picking ? null : h.id)}
          aria-label="Escolher ícone"
          title="Escolher ícone"
          className={`w-12 h-12 rounded flex items-center justify-center active:scale-95 transition ${
            (h.kind || "build") === "quit"
              ? "bg-error/10 text-error hover:bg-error/20"
              : "bg-primary-container/20 text-primary-container hover:bg-primary-container/30"
          }`}
        >
          <MI name={h.icon || HABIT_ICONS[i % HABIT_ICONS.length]} className="text-3xl" />
        </button>
        {picking && <div className="fixed inset-0 z-20" onClick={() => setPickingIcon(null)} />}
        {picking && (
          <div className="absolute left-4 top-20 z-30 bg-surface-container-highest rounded-xl border border-white/10 shadow-2xl shadow-black/60 p-3 grid grid-cols-6 gap-1 w-64 animate-[fadeIn_.1s_ease-out]">
            {HABIT_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(h.id, ic)}
                aria-label={ic}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
                  (h.icon || HABIT_ICONS[i % HABIT_ICONS.length]) === ic
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:bg-surface-variant/60"
                }`}
              >
                <MI name={ic} className="text-xl" />
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={() => saveEdit(h.id)} aria-label="Salvar" className="text-outline hover:text-primary-container transition">
                <MI name="check" className="text-xl" />
              </button>
              <button onClick={() => cancelEdit(h.id)} aria-label="Cancelar" className="text-outline hover:text-on-surface transition">
                <MI name="close" className="text-xl" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => startEdit(h)} aria-label="Editar" className="text-outline hover:text-primary-container transition">
                <MI name="edit" className="text-xl" />
              </button>
              <button onClick={() => removeHabit(h.id)} aria-label="Remover" className="text-outline hover:text-error transition">
                <MI name="delete" className="text-xl" />
              </button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <>
          <input
            value={edits[h.id]}
            onChange={(e) => setEdits((es) => ({ ...es, [h.id]: e.target.value }))}
            onKeyDown={(e) => (e.key === "Enter" ? saveEdit(h.id) : e.key === "Escape" ? cancelEdit(h.id) : null)}
            autoFocus
            aria-label="Nome do hábito"
            className={`${inputCls} w-full mb-2`}
          />
          <input
            value={editWhys[h.id] || ""}
            onChange={(e) => setEditWhys((es) => ({ ...es, [h.id]: e.target.value }))}
            onKeyDown={(e) => (e.key === "Enter" ? saveEdit(h.id) : e.key === "Escape" ? cancelEdit(h.id) : null)}
            maxLength={WHY_MAX}
            placeholder={(h.kind || "build") === "quit" ? "Por que largar isso?" : "Por que esse hábito importa?"}
            aria-label="Porquê do hábito"
            className={`${inputCls} w-full mb-2`}
          />
          <textarea
            value={editDetails[h.id] || ""}
            onChange={(e) => setEditDetails((es) => ({ ...es, [h.id]: e.target.value }))}
            onKeyDown={(e) => (e.key === "Escape" ? cancelEdit(h.id) : null)}
            rows={3}
            maxLength={500}
            placeholder="Detalhes: como executar, onde, com o quê..."
            aria-label="Detalhes do hábito"
            className={`${inputCls} w-full mb-2 resize-y`}
          />
        </>
      ) : (
        <h4 className="font-headline-md text-headline-md mb-2">{h.name}</h4>
      )}
      {/* o porquê fica ACIMA de tudo que é métrica: é o que você lê antes de decidir marcar */}
      {!editing &&
        (h.why ? (
          <div
            className={`mb-3 flex items-start gap-2 rounded-lg px-2.5 py-2 border-l-2 ${
              (h.kind || "build") === "quit" ? "bg-error/8 border-l-error/50" : "bg-primary-container/10 border-l-primary-container/50"
            }`}
          >
            <MI name="format_quote" className={`text-sm shrink-0 ${(h.kind || "build") === "quit" ? "text-error" : "text-primary-container"}`} />
            <p className="text-[12px] text-on-surface whitespace-pre-wrap">{h.why}</p>
          </div>
        ) : (
          <button
            onClick={() => startEdit(h)}
            className="mb-3 flex items-center gap-1.5 font-label-caps text-[10px] text-outline hover:text-primary-container transition"
          >
            <MI name="add_circle" className="text-sm" />
            {(h.kind || "build") === "quit" ? "POR QUE LARGAR ISSO?" : "POR QUE ESSE HÁBITO IMPORTA?"}
          </button>
        ))}
      {!editing && h.detail && (
        <p className="text-[12px] text-on-surface-variant whitespace-pre-wrap mb-2">{h.detail}</p>
      )}
      <div className="mb-3">
        <PriorityChips value={h.priority || 2} onChange={(v) => setPriority(h.id, v)} />
      </div>
    </>
  );
}

function BuildCard({ h, i, ctx }) {
  const { today, toggleHabit, setWeekdays } = ctx;
  const done = h.doneDates.includes(today);
  const streak = habitStreak(h);
  const prio = habitPriority(h);
  const sched = habitScheduleLabel(h); // null = todo dia
  const dueToday = habitIsScheduled(h, today);
  const editing = ctx.edits[h.id] !== undefined;
  return (
    <div className="glass-card p-6 rounded-xl relative">
      <CardHeader h={h} i={i} ctx={ctx} />

      {editing ? (
        <div className="mb-3">
          <Caps className="text-outline text-[10px] mb-1.5 block">DIAS DA SEMANA</Caps>
          <DowPicker value={habitWeekdays(h)} onChange={(wd) => setWeekdays(h.id, wd)} />
        </div>
      ) : (
        sched && (
          <Caps className="text-outline text-[10px] mb-2 flex items-center gap-1">
            <MI name="event_repeat" className="text-sm" /> {sched}
          </Caps>
        )
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 text-outline font-label-caps text-[10px]">
          <MI name="local_fire_department" className={`text-sm ${streak > 0 ? "text-primary-container" : ""}`} />
          {streak} {sched ? "EM SEQUÊNCIA" : "DIAS"}
        </div>
        <Caps className={`text-[10px] ${dueToday ? "text-outline" : "text-primary-container"}`}>
          {dueToday ? `+${prio.xp} XP/DIA` : "DESCANSO HOJE"}
        </Caps>
      </div>

      <button
        onClick={() => toggleHabit(h.id)}
        className={`w-full py-2 font-label-caps text-[10px] rounded transition-colors ${
          done
            ? "bg-primary-container text-on-primary-container"
            : dueToday
            ? "border border-primary text-primary hover:bg-primary/10"
            : "border border-white/10 text-outline hover:border-white/25"
        }`}
      >
        {done ? "CONCLUÍDO HOJE" : dueToday ? "MARCAR AGORA" : "MARCAR EXTRA"}
      </button>
    </div>
  );
}

function WeeklyCard({ h, i, ctx }) {
  const { today, toggleHabit } = ctx;
  const target = h.weeklyTarget || 3;
  const dir = h.direction || "min";
  const count = weekCount(h);
  const done = h.doneDates.includes(today);
  const prio = habitPriority(h);
  const bonus = Math.round(WEEKLY_BONUS[dir] * prio.mult);
  const pct = Math.min(100, Math.round((count / Math.max(1, target)) * 100));
  const over = dir === "max" && count > target;
  const hit = dir === "min" && count >= target;
  return (
    <div className="glass-card p-6 rounded-xl relative border-l-4 border-l-primary-container/40">
      <CardHeader h={h} i={i} ctx={ctx} />
      <div className="flex items-end justify-between mb-1">
        <Caps className="text-outline text-[10px]">
          {dir === "min" ? "PELO MENOS" : "NO MÁXIMO"} {target}×/SEMANA
        </Caps>
        <span className={`font-headline-md text-headline-md ${over ? "text-error" : hit ? "text-primary-container" : "text-on-surface"}`}>
          {count}/{target}
        </span>
      </div>
      <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full ${over ? "bg-error" : "bg-primary-container"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between items-center mb-4">
        <Caps className={`text-[10px] ${over ? "text-error" : hit ? "text-primary-container" : "text-outline"}`}>
          {dir === "min" ? (hit ? "META BATIDA ✓" : `FALTAM ${target - count}`) : over ? "LIMITE ESTOURADO" : `RESTAM ${target - count}`}
        </Caps>
        <Caps className="text-outline text-[10px]">+{bonus} XP/SEMANA NA META</Caps>
      </div>
      <button
        onClick={() => toggleHabit(h.id)}
        className={`w-full py-2 font-label-caps text-[10px] rounded transition-colors ${
          dir === "min"
            ? done
              ? "bg-primary-container text-on-primary-container"
              : "border border-primary text-primary hover:bg-primary/10"
            : done
              ? "bg-error/15 text-error border border-error/40"
              : "border border-error/40 text-error hover:bg-error/10"
        }`}
      >
        {dir === "min" ? (done ? "PRATICADO HOJE ✓" : "PRATIQUEI HOJE") : done ? "CONSUMIDO HOJE · DESFAZER" : "CONSUMI HOJE"}
      </button>
    </div>
  );
}

function QuitCard({ h, i, ctx }) {
  const { today, logRelapse, undoRelapse } = ctx;
  const clean = cleanDays(h);
  const best = bestCleanRun(h);
  const relapsedToday = h.doneDates.includes(today);
  const last30 = relapsesInWindow(h.doneDates, shiftDate(today, -29), today);
  const prev30 = relapsesInWindow(h.doneDates, shiftDate(today, -59), shiftDate(today, -30));
  const trend = prev30 > 0 ? last30 - prev30 : null;
  const next = QUIT_MILESTONES.find((m) => m.days > clean);
  const prio = habitPriority(h);
  return (
    <div className="glass-card p-6 rounded-xl relative border-l-4 border-l-error/40">
      <CardHeader h={h} i={i} ctx={ctx} />
      <div className="text-center my-3">
        <div className="font-display-timer text-[44px] leading-none text-primary tabular-nums">{clean}</div>
        <Caps className="text-outline">{clean === 1 ? "DIA LIMPO" : "DIAS LIMPO"}</Caps>
      </div>
      <div className="flex justify-between items-center mb-1 text-[11px]">
        <Caps className="text-outline text-[10px]">RECORDE: {best} {best === 1 ? "DIA" : "DIAS"}</Caps>
        {next && (
          <Caps className="text-outline text-[10px]">
            PRÓX. MARCO: {next.days}D (+{Math.round(next.xp * prio.mult)} XP)
          </Caps>
        )}
      </div>
      <div className="flex justify-between items-center mb-4 text-[11px]">
        <Caps className="text-outline text-[10px]">30D: {last30} RECAÍDA(S)</Caps>
        {trend !== null && (
          <Caps className={`text-[10px] ${trend <= 0 ? "text-primary-container" : "text-error"}`}>
            {trend <= 0 ? "▼" : "▲"} {Math.abs(trend)} VS 30D ANTERIORES
          </Caps>
        )}
      </div>
      {relapsedToday ? (
        <div className="flex gap-2">
          <div className="flex-1 py-2 text-center font-label-caps text-[10px] rounded bg-error/15 text-error">RECAÍDA HOJE</div>
          <button
            onClick={() => undoRelapse(h.id)}
            className="px-3 py-2 rounded font-label-caps text-[10px] border border-white/15 text-on-surface-variant hover:border-white/30 transition"
          >
            DESFAZER
          </button>
        </div>
      ) : (
        <button
          onClick={() => logRelapse(h)}
          className="w-full py-2 font-label-caps text-[10px] rounded border border-error/40 text-error hover:bg-error/10 transition-colors"
        >
          RECAÍ HOJE
        </button>
      )}
    </div>
  );
}

export default function HabitosPage() {
  const { state, setState, confirm, toast } = useApp();
  const [newHabit, setNewHabit] = useState("");
  const [newWhy, setNewWhy] = useState(""); // o porquê: pergunta feita na criação, quando a motivação ainda está fresca
  const [newKind, setNewKind] = useState("build"); // build | weekly | quit
  const [newPriority, setNewPriority] = useState(2);
  const [newDirection, setNewDirection] = useState("min"); // weekly: min | max
  const [newTarget, setNewTarget] = useState(3); // weekly: dias/semana
  const [newWeekdays, setNewWeekdays] = useState([]); // build: [] = todo dia
  const [edits, setEdits] = useState({}); // { [id]: nome em edição }
  const [editWhys, setEditWhys] = useState({}); // { [id]: porquê em edição }
  const [editDetails, setEditDetails] = useState({}); // { [id]: detalhe em edição }
  const [pickingIcon, setPickingIcon] = useState(null); // id do hábito com picker aberto
  const today = getDateStr(0);

  // ===== recompensas pendentes: marcos de dias limpos (quit) + bônus de semana na meta (weekly) =====
  useEffect(() => {
    const dues = (state.habits || [])
      .map((h) => {
        const quit = computeDueMilestones(h);
        const weekly = computeDueWeeklyBonus(h);
        return quit || weekly ? { name: h.name, quit, weekly } : null;
      })
      .filter(Boolean);
    if (!dues.length) return;
    setState((prev) => {
      // recomputa sobre prev: idempotente — se já concedido, retorna prev por identidade
      let gained = 0;
      const habits = (prev.habits || []).map((h) => {
        const quit = computeDueMilestones(h);
        const weekly = computeDueWeeklyBonus(h);
        if (!quit && !weekly) return h;
        const milestones = { ...(h.milestones || {}) };
        if (quit) {
          gained += quit.xp;
          milestones[quit.key] = [...(milestones[quit.key] || []), ...quit.newDays];
        }
        if (weekly) {
          gained += weekly.xp;
          for (const k of weekly.keys) milestones[k] = true;
        }
        return { ...h, milestones };
      });
      if (!gained) return prev;
      return { ...prev, habits, stats: { ...prev.stats, xp: (prev.stats.xp || 0) + gained } };
    });
    const totalXp = dues.reduce((s, x) => s + (x.quit?.xp || 0) + (x.weekly?.xp || 0), 0);
    const notes = dues.map((x) => {
      const parts = [];
      if (x.quit) parts.push(x.quit.newDays.map((d) => `${d}d limpo`).join(", "));
      if (x.weekly) parts.push(`${x.weekly.keys.length} semana(s) na meta`);
      return `${x.name}: ${parts.join(" · ")}`;
    });
    toast("Recompensa de hábitos!", { sub: `${notes.join(" · ")} · +${totalXp} XP`, icon: "military_tech", duration: 5000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.habits]);

  function addHabit() {
    const name = newHabit.trim();
    if (!name) return;
    setState((prev) => ({
      ...prev,
      habits: [
        ...prev.habits,
        {
          id: crypto.randomUUID(),
          name,
          icon: newKind === "quit" ? "block" : newKind === "weekly" ? "event_repeat" : HABIT_ICONS[prev.habits.length % HABIT_ICONS.length],
          kind: newKind,
          priority: newPriority,
          direction: newKind === "weekly" ? newDirection : null,
          weeklyTarget: newKind === "weekly" ? newTarget : null,
          weekdays: newKind === "build" ? newWeekdays : [], // só faz sentido no diário
          why: newWhy.trim().slice(0, WHY_MAX),
          detail: "",
          createdAt: new Date().toISOString(),
          doneDates: [],
          checkXp: {},
          milestones: {},
        },
      ],
    }));
    setNewHabit("");
    setNewWhy("");
    setNewWeekdays([]);
  }

  function setWeekdays(id, weekdays) {
    setState((prev) => ({ ...prev, habits: prev.habits.map((h) => (h.id === id ? { ...h, weekdays } : h)) }));
  }

  function setIcon(id, icon) {
    setState((prev) => ({ ...prev, habits: prev.habits.map((h) => (h.id === id ? { ...h, icon } : h)) }));
    setPickingIcon(null);
  }
  function setPriority(id, priority) {
    setState((prev) => ({ ...prev, habits: prev.habits.map((h) => (h.id === id ? { ...h, priority } : h)) }));
  }

  // ===== build/weekly: check concede XP por prioridade (weekly-max não premia — marcar = consumir) =====
  function toggleHabit(id) {
    setState((prev) => toggleHabitState(prev, id, today));
  }

  // ===== quit: registrar/desfazer recaída =====
  async function logRelapse(h) {
    if (h.doneDates.includes(today)) return;
    // o porquê entra aqui de propósito: é o momento exato em que ele tem função
    const ok = await confirm({
      title: `Registrar recaída em "${h.name}"?`,
      body: h.why
        ? `Você largou porque: “${h.why}”. Registrar zera a contagem de dias limpo — sem julgamento, recomeça agora.`
        : "Zera a contagem de dias limpo. Sem julgamento — recomeça agora.",
      confirmLabel: "RECAÍ HOJE",
    });
    if (!ok) return;
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((x) => (x.id === h.id ? { ...x, doneDates: [...x.doneDates, today] } : x)),
    }));
  }
  function undoRelapse(id) {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((x) => (x.id === id ? { ...x, doneDates: x.doneDates.filter((d) => d !== today) } : x)),
    }));
  }

  async function removeHabit(id) {
    const h = state.habits.find((x) => x.id === id);
    const ok = await confirm({ title: "Excluir hábito?", body: `"${h?.name || ""}" e todo o histórico dele serão apagados.`, confirmLabel: "EXCLUIR" });
    if (!ok) return;
    setState((prev) => ({ ...prev, habits: prev.habits.filter((h) => h.id !== id) }));
  }

  const startEdit = (h) => {
    setEdits((e) => ({ ...e, [h.id]: h.name }));
    setEditWhys((e) => ({ ...e, [h.id]: h.why || "" }));
    setEditDetails((e) => ({ ...e, [h.id]: h.detail || "" }));
  };
  const cancelEdit = (id) => {
    const drop = (o) => {
      const { [id]: _, ...rest } = o;
      return rest;
    };
    setEdits(drop);
    setEditWhys(drop);
    setEditDetails(drop);
  };
  function saveEdit(id) {
    const name = (edits[id] || "").trim();
    if (!name) return;
    const why = (editWhys[id] || "").trim().slice(0, WHY_MAX);
    const detail = (editDetails[id] || "").trim().slice(0, 500);
    setState((prev) => ({ ...prev, habits: prev.habits.map((h) => (h.id === id ? { ...h, name: name.slice(0, 80), why, detail } : h)) }));
    cancelEdit(id);
  }

  // handlers/estado compartilhados com os cards (identidade estável evita remount dos inputs)
  const ctx = {
    edits,
    editWhys,
    editDetails,
    setEdits,
    setEditWhys,
    setEditDetails,
    setWeekdays,
    pickingIcon,
    setPickingIcon,
    setIcon,
    saveEdit,
    cancelEdit,
    startEdit,
    removeHabit,
    setPriority,
    today,
    toggleHabit,
    logRelapse,
    undoRelapse,
  };

  // props do form de criação num objeto só
  const formProps = {
    newHabit,
    setNewHabit,
    newWhy,
    setNewWhy,
    newKind,
    setNewKind,
    newPriority,
    setNewPriority,
    newDirection,
    setNewDirection,
    newTarget,
    setNewTarget,
    newWeekdays,
    setNewWeekdays,
    addHabit,
  };
  const buildHabits = state.habits.filter((h) => (h.kind || "build") === "build");
  const weeklyHabits = state.habits.filter((h) => (h.kind || "build") === "weekly");
  const quitHabits = state.habits.filter((h) => (h.kind || "build") === "quit");
  const groupCount = [buildHabits, weeklyHabits, quitHabits].filter((g) => g.length > 0).length;

  return (
    <>
      <PageHeader title="HÁBITOS" subtitle="Construa os bons, largue os ruins. Prioridade alta vale mais XP. Hábito diário não feito tira metade." />

      {/* ---- form de criação ---- */}
      <div className="glass-card px-4 py-3 md:px-6 md:py-4 rounded-xl mb-gutter">
        <HabitForm f={formProps} />
      </div>


      {state.habits.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center text-on-surface-variant">Nenhum hábito cadastrado ainda.</div>
      ) : (
        <div className="space-y-8">
          {buildHabits.length > 0 && (
            <section>
              {groupCount > 1 && (
                <div className="flex items-center gap-2 mb-4">
                  <MI name="trending_up" className="text-primary-container" />
                  <h3 className="font-headline-md text-headline-md text-primary uppercase">Construindo</h3>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
                {buildHabits.map((h, i) => (
                  <BuildCard key={h.id} h={h} i={i} ctx={ctx} />
                ))}
              </div>
            </section>
          )}
          {weeklyHabits.length > 0 && (
            <section>
              {groupCount > 1 && (
                <div className="flex items-center gap-2 mb-4">
                  <MI name="event_repeat" className="text-primary-container" />
                  <h3 className="font-headline-md text-headline-md text-primary uppercase">Metas da Semana</h3>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
                {weeklyHabits.map((h, i) => (
                  <WeeklyCard key={h.id} h={h} i={i} ctx={ctx} />
                ))}
              </div>
            </section>
          )}
          {quitHabits.length > 0 && (
            <section>
              {groupCount > 1 && (
                <div className="flex items-center gap-2 mb-4">
                  <MI name="block" className="text-error" />
                  <h3 className="font-headline-md text-headline-md text-primary uppercase">Largando</h3>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
                {quitHabits.map((h, i) => (
                  <QuitCard key={h.id} h={h} i={i} ctx={ctx} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
