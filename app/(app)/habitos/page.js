"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, PageHeader, inputCls } from "@/components/ui";
import {
  getDateStr,
  habitStreak,
  bestHabitStreak,
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
  toggleHabitStep,
  habitSteps,
  habitStepDone,
  habitStepProgress,
  habitStepsBlock,
  HABIT_STEPS_MAX,
  HABIT_STEP_LEN,
  habitMinimum,
  habitMinAllowed,
  habitHasMinimum,
  habitMinDone,
  habitMinXp,
  markHabitMinimum,
  completeHabitFull,
  HABIT_MIN_LEN,
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
    <div className="flex items-center gap-1 flex-wrap">
      {DOW_SHORT.map((label, d) => {
        const on = sel.has(d);
        return (
          <button
            key={d}
            onClick={() => toggle(d)}
            aria-pressed={on}
            aria-label={label}
            title={all ? `${label} — incluído em todo dia` : label}
            className={`w-8 h-8 md:w-7 md:h-7 rounded-full font-label-caps text-[10px] border transition ${
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
        className={`ml-1.5 px-2 h-8 md:h-7 rounded-full font-label-caps text-[9px] flex items-center gap-1 border transition ${
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
      {/* No celular os sete dias já comem a linha inteira, então o contexto ganha
          uma linha própria (`w-full`) e prioridade + adicionar dividem a seguinte.
          Antes tudo ia numa linha só e vazava pra fora da tela. */}
      <div className="flex flex-wrap items-center gap-3 md:gap-4 md:flex-nowrap md:justify-end">
        <div className="w-full md:w-auto">
          <ContextControl f={f} />
        </div>
        <PriorityBars value={f.newPriority} onChange={f.setNewPriority} />
        <div className="ml-auto md:ml-0">
          <AddButton onClick={f.addHabit} />
        </div>
      </div>
    </div>
  );
}


// ---- header comum do card (ícone + editar/excluir + nome) ----
// Componentes em escopo de módulo (não aninhados na página): identidade estável
// entre renders, então os inputs de edição não remontam a cada tecla (evita o
// foco pular pro título ao digitar os detalhes).
function CardHeader({ h, i, ctx }) {
  const { edits, editDetails, editWhys, editMins, setEdits, setEditDetails, setEditWhys, setEditMins, pickingIcon, setPickingIcon, setIcon, saveEdit, cancelEdit, startEdit, removeHabit, setPriority } = ctx;
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
        {picking && <div className="fixed inset-0 z-[160]" onClick={() => setPickingIcon(null)} />}
        {picking && (
          <div className="absolute left-4 top-20 z-[170] bg-surface-container-highest rounded-xl border border-white/10 shadow-2xl shadow-black/60 p-3 grid grid-cols-6 gap-1 w-64 animate-[fadeIn_.1s_ease-out]">
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
          {/* O mínimo é config de hábito, mas é TEXTO — então mora aqui com os
              outros campos de texto e é gravado pelo mesmo salvar. Fora do diário
              e da meta semanal ele nem aparece: em vício e em limite semanal a
              ideia de "mínimo" não significa nada (ver habitHasMinimum). */}
          {habitMinAllowed(h) && (
            <div className="mb-2">
              <Caps className="text-outline text-[10px] mb-1 flex items-center gap-1">
                <MI name="flag" className="text-sm" /> MÍNIMO EXECUTÁVEL
              </Caps>
              <input
                value={editMins[h.id] || ""}
                onChange={(e) => setEditMins((es) => ({ ...es, [h.id]: e.target.value }))}
                onKeyDown={(e) => (e.key === "Enter" ? saveEdit(h.id) : e.key === "Escape" ? cancelEdit(h.id) : null)}
                maxLength={HABIT_MIN_LEN}
                placeholder="A menor versão que ainda conta. Ex: 10 flexões"
                aria-label="Mínimo executável do hábito"
                className={`${inputCls} w-full`}
              />
              <p className="text-[10px] text-outline mt-1">
                Feito o mínimo, o dia é marcado mesmo com microatividade em aberto — e paga metade do XP.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-baseline gap-2 flex-wrap mb-2">
          <h4 className="font-headline-md text-headline-md">{h.name}</h4>
          <PriorityLabel h={h} />
        </div>
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
      {/* prioridade só é editável no modo edição: fora dele é rótulo. Três botões
          sempre clicáveis no card viviam trocando o XP do hábito sem querer. */}
      {editing && (
        <div className="mb-3">
          <Caps className="text-outline text-[10px] mb-1.5 block">PRIORIDADE</Caps>
          <PriorityChips value={h.priority || 2} onChange={(v) => setPriority(h.id, v)} />
        </div>
      )}
    </>
  );
}

// Rótulo de prioridade ao lado do título: leitura, não controle. Três degraus
// preenchidos até o nível, mesma linguagem do seletor do formulário de criação.
// O tooltip diz o que a prioridade faz NAQUELE tipo de hábito: paga XP por
// marcação (diário e semanal de mínimo), multiplica o XP dos marcos (vício) ou
// multiplica o bônus semanal. Prometer "+25 XP" nos três seria mentira em dois.
function PriorityLabel({ h }) {
  const p = habitPriority(h);
  const kind = h.kind || "build";
  const paysPerCheck = kind === "build" || (kind === "weekly" && (h.direction || "min") === "min");
  const tip = paysPerCheck
    ? `Prioridade ${p.label} · +${p.xp} XP por marcação`
    : kind === "quit"
      ? `Prioridade ${p.label} · multiplica o XP dos marcos`
      : `Prioridade ${p.label} · multiplica o bônus semanal`;
  // cor por nível: alta acende, normal é neutra, baixa recua
  const text = p.v === 3 ? "text-primary-container" : p.v === 2 ? "text-on-surface-variant" : "text-outline";
  return (
    <span title={tip} className="shrink-0 inline-flex items-end gap-1.5">
      <span className="flex items-end gap-0.5">
        {[6, 10, 15].map((px, idx) => (
          <span
            key={px}
            className={`w-1 rounded-sm ${idx < p.v ? (p.v === 3 ? "bg-primary-container" : "bg-on-surface-variant") : "bg-outline/25"}`}
            style={{ height: `${px}px` }}
          />
        ))}
      </span>
      <Caps className={`text-[9px] ${text}`}>{p.label}</Caps>
    </span>
  );
}

// ============================================================
// Faixa de sequência do hábito diário: o número é o que motiva, então ele é o
// maior elemento do card. Ao lado, o que o número não diz sozinho — se a
// sequência está em risco hoje, qual o próximo marco e qual o seu recorde.
const STREAK_MARKS = [3, 7, 14, 21, 30, 60, 100, 180, 365];
const streakNext = (n) => STREAK_MARKS.find((m) => m > n) || null;

function StreakBanner({ streak, sched, best, dueToday, done }) {
  const on = streak > 0;
  const next = streakNext(streak);
  return (
    <div
      className={`mb-4 rounded-xl px-4 py-3 flex items-center gap-4 ${
        on ? "bg-gradient-to-r from-primary-container/25 to-transparent border border-primary-container/30" : "bg-surface-container-high/50"
      }`}
    >
      <div className="flex flex-col items-center shrink-0">
        <span className={`font-display-timer text-[52px] leading-none tabular-nums ${on ? "text-primary" : "text-outline"}`}>{streak}</span>
        <Caps className="text-on-surface-variant text-[9px] -mt-1">{sched ? "EM SEQUÊNCIA" : streak === 1 ? "DIA" : "DIAS"}</Caps>
      </div>
      <div className="w-px self-stretch bg-white/10" />
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <MI name="local_fire_department" fill className={`text-lg ${on ? "flame-active" : "text-outline"}`} />
          <Caps className={`text-[11px] ${on ? "text-on-surface" : "text-outline"}`}>
            {!on ? "COMECE HOJE" : done ? "MANTIDA HOJE" : dueToday ? "EM RISCO — FALTA HOJE" : "DESCANSO HOJE"}
          </Caps>
        </div>
        {next && <Caps className="text-outline text-[10px] block">PRÓXIMO MARCO: {next} DIAS</Caps>}
        {best > streak && <Caps className="text-outline text-[10px] block">RECORDE: {best} DIAS</Caps>}
      </div>
    </div>
  );
}

// ---- microatividades ----
// Editor (modo edição do card). Aplica na hora, igual a dias da semana, ícone e
// prioridade: o botão de salvar do card é só pros campos de texto.
function StepEditor({ h, ctx }) {
  const { stepDrafts, setStepDrafts, addStep, removeStep, moveStep } = ctx;
  const steps = habitSteps(h);
  const draft = stepDrafts[h.id] || "";
  const full = steps.length >= HABIT_STEPS_MAX;
  return (
    <div className="mb-3">
      <Caps className="text-outline text-[10px] mb-1.5 block">
        MICROATIVIDADES ({steps.length}/{HABIT_STEPS_MAX})
      </Caps>
      {steps.length > 0 && (
        <ul className="space-y-1 mb-2">
          {steps.map((st, idx) => (
            <li key={st.id} className="flex items-center gap-1">
              <span className="w-4 shrink-0 text-center font-label-caps text-[10px] text-outline tabular-nums">{idx + 1}</span>
              <span className="flex-1 min-w-0 truncate text-[12px] text-on-surface">{st.text}</span>
              <button
                onClick={() => moveStep(h.id, st.id, -1)}
                disabled={idx === 0}
                aria-label="Subir"
                className="p-0.5 text-outline hover:text-on-surface disabled:opacity-25 disabled:hover:text-outline transition"
              >
                <MI name="arrow_upward" className="text-sm" />
              </button>
              <button
                onClick={() => moveStep(h.id, st.id, 1)}
                disabled={idx === steps.length - 1}
                aria-label="Descer"
                className="p-0.5 text-outline hover:text-on-surface disabled:opacity-25 disabled:hover:text-outline transition"
              >
                <MI name="arrow_downward" className="text-sm" />
              </button>
              <button onClick={() => removeStep(h.id, st.id)} aria-label="Remover passo" className="p-0.5 text-outline hover:text-error transition">
                <MI name="close" className="text-sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-1">
        <input
          value={draft}
          onChange={(e) => setStepDrafts((d) => ({ ...d, [h.id]: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && addStep(h.id)}
          disabled={full}
          maxLength={HABIT_STEP_LEN}
          placeholder={full ? "Limite de passos atingido" : "Novo passo"}
          aria-label="Nova microatividade"
          className={`${inputCls} flex-1 min-w-0 text-[12px] py-1.5 disabled:opacity-50`}
        />
        <button
          onClick={() => addStep(h.id)}
          disabled={full}
          aria-label="Adicionar passo"
          className="h-8 w-8 grid place-items-center rounded-md text-primary hover:bg-primary/10 active:scale-95 disabled:opacity-30 transition shrink-0"
        >
          <MI name="add" className="text-lg" />
        </button>
      </div>
      <p className="text-[10px] text-outline mt-1">
        {steps.length > 0 ? "Com passos, o hábito só é marcado depois que todos estiverem feitos." : "Sem passos, o hábito é marcado direto."}
      </p>
    </div>
  );
}

// Checklist do dia (modo leitura). Fechar o último passo conclui o hábito sozinho.
function StepChecklist({ h, ctx }) {
  const { today, toggleStep } = ctx;
  const steps = habitSteps(h);
  if (!steps.length) return null;
  const p = habitStepProgress(h, today);
  return (
    <div className={`mb-4 rounded-xl border p-3 ${p.complete ? "border-primary-container/40 bg-primary-container/5" : "border-white/10"}`}>
      <div className="flex items-center justify-between mb-2">
        <Caps className="text-outline text-[10px] flex items-center gap-1">
          <MI name="checklist" className="text-sm" /> MICROATIVIDADES
        </Caps>
        <Caps className={`text-[10px] tabular-nums ${p.complete ? "text-primary-container" : "text-outline"}`}>
          {p.done}/{p.total}
        </Caps>
      </div>
      <div className="w-full h-1 bg-surface-variant rounded-full overflow-hidden mb-2">
        <div className="h-full bg-primary-container rounded-full transition-all" style={{ width: `${Math.round((p.done / p.total) * 100)}%` }} />
      </div>
      <ul>
        {steps.map((st) => {
          const on = habitStepDone(h, today, st.id);
          return (
            <li key={st.id}>
              <button
                onClick={() => toggleStep(h.id, st.id)}
                role="checkbox"
                aria-checked={on}
                className="w-full flex items-center gap-2 py-1 text-left group"
              >
                <MI
                  name={on ? "check_circle" : "radio_button_unchecked"}
                  fill={on}
                  className={`text-lg shrink-0 ${on ? "text-primary-container" : "text-outline group-hover:text-on-surface-variant"}`}
                />
                <span className={`text-[12px] leading-snug ${on ? "line-through text-on-surface-variant" : "text-on-surface"}`}>{st.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================
// O MÍNIMO NO CARD — três estados, um bloco só.
//
//   não marcado  → o texto do mínimo + o botão que marca o dia por ele
//   feito no mín → diz que foi no mínimo (e não deixa parecer dia cheio) e oferece
//                  subir pro dia cheio, pagando a diferença
//   dia cheio    → o mínimo recua pra lembrete apagado; hoje ele já não importa
//
// O XP mostrado é o base (sem multiplicador de sequência), igual ao resto da tela:
// prometer o número final aqui e outro no crédito seria pior que não prometer.
function MinimumBar({ h, ctx, className = "" }) {
  if (!habitMinAllowed(h)) return null;
  const today = ctx.today;
  const text = habitMinimum(h);
  // Sem mínimo definido, um convite — mesmo padrão do porquê. Feature que não se
  // anuncia não existe: o campo mora no modo edição, e ninguém abre o modo edição
  // pra procurar campo que não sabe que tem.
  if (!text)
    return (
      <button
        onClick={() => ctx.openEdit(h)}
        className={`flex items-center gap-1.5 font-label-caps text-[10px] text-outline hover:text-primary-container transition ${className}`}
      >
        <MI name="flag" className="text-sm" />
        DEFINIR MÍNIMO EXECUTÁVEL
      </button>
    );
  const done = (h.doneDates || []).includes(today);
  const isMin = habitMinDone(h, today);
  const blocked = habitStepsBlock(h, today);
  const prog = habitStepProgress(h, today);
  const rest = Math.max(0, habitPriority(h).xp - habitMinXp(h));

  if (done && !isMin)
    return (
      <div className={`flex items-start gap-1.5 text-[11px] text-outline ${className}`}>
        <MI name="flag" className="text-sm shrink-0" />
        <span className="min-w-0">Mínimo: {text}</span>
      </div>
    );

  if (isMin)
    return (
      <div className={`rounded-lg border border-primary-container/40 bg-primary-container/10 p-2.5 ${className}`}>
        <Caps className="text-primary-container text-[10px] flex items-center gap-1 mb-1">
          <MI name="flag" fill className="text-sm" /> FEITO NO MÍNIMO
        </Caps>
        <p className="text-[12px] text-on-surface mb-2 whitespace-pre-wrap">{text}</p>
        {blocked ? (
          <Caps className="text-outline text-[9px] block">
            FECHE {prog.pending} MICROATIVIDADE{prog.pending > 1 ? "S" : ""} PRO DIA VIRAR CHEIO
          </Caps>
        ) : (
          <button
            onClick={() => ctx.completeFull(h.id)}
            className="w-full py-2 rounded-lg border border-primary-container/50 text-primary-container font-label-caps text-[10px] hover:bg-primary-container/10 active:scale-[.98] transition"
          >
            FIZ MAIS QUE O MÍNIMO{rest ? ` · +${rest} XP` : ""}
          </button>
        )}
      </div>
    );

  return (
    <div className={`rounded-lg border border-dashed border-outline/40 p-2.5 ${className}`}>
      <Caps className="text-outline text-[10px] flex items-center gap-1 mb-1">
        <MI name="flag" className="text-sm" /> MÍNIMO EXECUTÁVEL
      </Caps>
      <p className="text-[12px] text-on-surface mb-2 whitespace-pre-wrap">{text}</p>
      <button
        onClick={() => ctx.markMinimum(h.id)}
        title="Marca o dia mesmo com microatividade em aberto"
        className="w-full py-2 rounded-lg border border-primary-container/40 text-primary-container font-label-caps text-[10px] hover:bg-primary-container/10 active:scale-[.98] transition"
      >
        FIZ SÓ O MÍNIMO · +{habitMinXp(h)} XP
      </button>
    </div>
  );
}

// Marcar/desmarcar o hábito do dia. Interruptor em vez de botão: o estado fica
// escrito em palavras, então nunca resta a dúvida de "cliquei ou não?".
// Marcar credita XP, desmarcar estorna o valor exato pago no dia.
// Travado (passo em aberto) segue CLICÁVEL de propósito: o clique é o que dispara o
// aviso dizendo quantos passos faltam. Botão morto não explica nada.
function DoneSwitch({ done, dueToday, xp, blocked = false, pending = 0, minDay = false, onToggle }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={done}
      aria-disabled={blocked}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition ${
        done ? "border-primary-container/50 bg-primary-container/10" : blocked ? "border-white/10 opacity-60" : "border-white/10 hover:border-white/25"
      }`}
    >
      <span className="text-left min-w-0">
        <Caps className={`text-[11px] block ${done ? "text-primary-container" : "text-on-surface"}`}>
          {done ? (minDay ? "FEITO NO MÍNIMO" : "FEITO HOJE") : dueToday ? "AINDA NÃO FEITO" : "NÃO AGENDADO HOJE"}
        </Caps>
        <Caps className="text-outline text-[9px] block">
          {blocked ? `FALTAM ${pending} MICROATIVIDADE${pending > 1 ? "S" : ""}` : done ? `+${xp} XP CREDITADOS` : `VALE +${xp} XP`}
        </Caps>
      </span>
      {blocked ? (
        <MI name="lock" className="text-outline text-xl shrink-0" />
      ) : (
        <span className={`w-12 h-7 rounded-full p-1 shrink-0 transition-colors ${done ? "bg-primary-container" : "bg-surface-variant"}`}>
          <span className={`block w-5 h-5 rounded-full bg-on-primary-container transition-transform ${done ? "translate-x-5" : ""}`} />
        </span>
      )}
    </button>
  );
}

function BuildCard({ h, i, ctx, bare = false }) {
  const { today, toggleHabit, setWeekdays } = ctx;
  const prio = habitPriority(h);
  const done = h.doneDates.includes(today);
  const streak = habitStreak(h);
  const best = bestHabitStreak(h);
  const sched = habitScheduleLabel(h); // null = todo dia
  const dueToday = habitIsScheduled(h, today);
  const editing = ctx.edits[h.id] !== undefined;
  const prog = habitStepProgress(h, today);
  const blocked = habitStepsBlock(h, today);
  return (
    <div className={bare ? "p-4" : "glass-card p-6 rounded-xl relative"}>
      <CardHeader h={h} i={i} ctx={ctx} />

      {editing ? (
        <div className="mb-3">
          <Caps className="text-outline text-[10px] mb-1.5 block">DIAS DA SEMANA</Caps>
          <DowPicker value={habitWeekdays(h)} onChange={(wd) => setWeekdays(h.id, wd)} />
          <div className="mt-3">
            <StepEditor h={h} ctx={ctx} />
          </div>
        </div>
      ) : (
        sched && (
          <Caps className="text-outline text-[10px] mb-2 flex items-center gap-1">
            <MI name="event_repeat" className="text-sm" /> {sched}
          </Caps>
        )
      )}

      {/* a faixa já diz o estado do dia e o rótulo do título já diz o XP —
          a linha "+XP/DIA · DESCANSO HOJE" que morava aqui era repetição */}
      <StreakBanner streak={streak} sched={sched} best={best} dueToday={dueToday} done={done} />

      {!editing && <StepChecklist h={h} ctx={ctx} />}

      {!editing && <MinimumBar h={h} ctx={ctx} className="mb-3" />}

      <DoneSwitch
        done={done}
        dueToday={dueToday}
        xp={prio.xp}
        blocked={blocked}
        pending={prog?.pending || 0}
        minDay={habitMinDone(h, today)}
        onToggle={() => toggleHabit(h.id)}
      />
    </div>
  );
}

function WeeklyCard({ h, i, ctx, bare = false }) {
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
  const editing = ctx.edits[h.id] !== undefined;
  const prog = habitStepProgress(h, today);
  const blocked = habitStepsBlock(h, today);
  return (
    <div className={bare ? "p-4 border-l-4 border-l-primary-container/40" : "glass-card p-6 rounded-xl relative border-l-4 border-l-primary-container/40"}>
      <CardHeader h={h} i={i} ctx={ctx} />
      {editing && <StepEditor h={h} ctx={ctx} />}
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
      {!editing && <StepChecklist h={h} ctx={ctx} />}
      {!editing && <MinimumBar h={h} ctx={ctx} className="mb-3" />}
      <button
        onClick={() => toggleHabit(h.id)}
        aria-disabled={blocked}
        className={`w-full py-2 font-label-caps text-[10px] rounded transition-colors ${
          blocked
            ? "border border-white/10 text-outline"
            : dir === "min"
            ? done
              ? "bg-primary-container text-on-primary-container"
              : "border border-primary text-primary hover:bg-primary/10"
            : done
              ? "bg-error/15 text-error border border-error/40"
              : "border border-error/40 text-error hover:bg-error/10"
        }`}
      >
        {blocked
          ? `FALTAM ${prog.pending} MICROATIVIDADE${prog.pending > 1 ? "S" : ""}`
          : dir === "min"
            ? done
              ? habitMinDone(h, today)
                ? "PRATICADO NO MÍNIMO ✓"
                : "PRATICADO HOJE ✓"
              : "PRATIQUEI HOJE"
            : done
              ? "CONSUMIDO HOJE · DESFAZER"
              : "CONSUMI HOJE"}
      </button>
    </div>
  );
}

function QuitCard({ h, i, ctx, bare = false }) {
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
    <div className={bare ? "p-4 border-l-4 border-l-error/40" : "glass-card p-6 rounded-xl relative border-l-4 border-l-error/40"}>
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

// ============================================================================
// CALENDÁRIO MENSAL — a visão de hábitos. Matriz hábito × dia do mês.
//
// Duas cores, e só duas: AZUL cumpriu, VERMELHO falhou ou recaiu. Vêm dos tokens
// (`primary-container` / `error`), que já carregam o ajuste de contraste de cada
// tema — azul e vermelho não trocam de lado entre claro e escuro.
//
// O que NÃO ganha cor é tão importante quanto: dia de folga, dia de hábito sem
// meta diária e o dia de hoje ainda em aberto ficam neutros. Pintar de vermelho
// um dia que ainda dá tempo de cumprir seria acusar falha que não aconteceu.
//
// Clicar no nome do hábito abre o card cheio embaixo da matriz, com tudo que ele
// sempre teve: editar, ícone, microatividades, dias da semana, prioridade, recaída.
// ============================================================================

// Card cheio do tipo certo — o detalhe que abre embaixo da matriz.
function FullCard({ h, i, ctx, bare = false }) {
  const kind = h.kind || "build";
  if (kind === "weekly") return <WeeklyCard h={h} i={i} ctx={ctx} bare={bare} />;
  if (kind === "quit") return <QuitCard h={h} i={i} ctx={ctx} bare={bare} />;
  return <BuildCard h={h} i={i} ctx={ctx} bare={bare} />;
}

const pad2 = (n) => String(n).padStart(2, "0");

// Dia em que o hábito passou a existir, em data LOCAL. `createdAt` é ISO em UTC:
// cortar o prefixo com slice erraria o dia de quem cria hábito de madrugada.
const createdOn = (h) => {
  if (!h.createdAt) return null; // hábito legado sem data: não restringe nada
  const d = new Date(h.createdAt);
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// Veredito de um dia. Devolve a classe de fundo ou null pra neutro.
//
// Cada tipo cobra de um jeito diferente, e é isso que decide a cor:
//   diário  — só falha em dia AGENDADO que já passou (folga não é falha)
//   semanal — a meta é da semana, então nenhum dia isolado é falha; só marcação
//             pinta de azul
//   largar  — todo dia sem recaída é dia cumprido; recaída pinta de vermelho
//
// Devolve token ("done" | "min" | "fail" | null), não classe: quem pinta escolhe
// como (a matriz usa bolinha, o celular usa bolinha com número dentro), e quem lê
// o veredito pra montar o texto do title não precisa comparar nome de classe.
function dayVerdict(h, date, today) {
  const kind = h.kind || "build";
  const marked = h.doneDates.includes(date);
  if (date > today) return null; // futuro não tem veredito
  // Antes de existir, o hábito não cobra nada. Sem isto, criar um hábito hoje
  // pintaria todo o mês passado de vermelho — falha que nunca houve.
  const born = createdOn(h);
  if (born && date < born) return null;
  if (kind === "quit") return marked ? "fail" : "done";
  if (marked) return habitMinDone(h, date) ? "min" : "done";
  if (kind === "weekly") return null;
  if (!habitIsScheduled(h, date)) return null; // folga
  return date === today ? null : "fail"; // hoje ainda dá tempo
}

// Continuam sendo DUAS cores. O dia de mínimo é o mesmo azul, vazado: "cumpriu no
// mínimo" é cumprir, e um terceiro tom aqui viraria um terceiro significado. Borda
// em vez de ring porque o ring já é do "hoje" — dois rings no mesmo elemento
// brigam pela mesma propriedade.
const DAY_CLS = {
  done: "bg-primary-container",
  min: "bg-primary-container/15 border-2 border-primary-container",
  fail: "bg-error",
};
const DAY_TEXT = { done: "text-on-primary-container", min: "text-primary-container", fail: "text-on-error" };
const dayWord = (verdict, kind, future) =>
  verdict === "fail" ? (kind === "quit" ? "recaída" : "falhou") : verdict === "min" ? "cumpriu no mínimo" : verdict === "done" ? "cumpriu" : future ? "" : "sem cobrança";

// ============================================================================
// MICROATIVIDADES NA LINHA — barra segmentada, um segmento por passo.
//
// Marcar custa UM clique e nenhuma navegação: antes a checklist só existia
// dentro do card cheio, alcançável clicando no nome do hábito — e nome não
// parece botão. Aqui a barra fica na própria linha do calendário, do lado do
// nome, e cada segmento é o alvo do seu passo.
//
// Age sobre HOJE, porque passo é registro diário (stepChecks[data]) — mesma
// regra da única célula clicável do calendário. Hábito sem microatividade não
// mostra barra nenhuma. A lista com o texto de cada passo continua no card
// cheio (StepChecklist); aqui o texto vive no title/aria de cada segmento.
// ============================================================================
function StepSegments({ h, ctx, wide = false }) {
  const steps = habitSteps(h);
  return (
    // `wide` é o modo celular: a barra ocupa a largura do cartão e engorda, porque
    // 2.5px de altura é alvo de mouse, não de dedo.
    <div className={`flex items-center gap-0.5 ${wide ? "w-full" : "shrink-0 w-28"}`}>
      {steps.map((st, idx) => {
        const on = habitStepDone(h, ctx.today, st.id);
        return (
          <button
            key={st.id}
            onClick={() => ctx.toggleStep(h.id, st.id)}
            role="checkbox"
            aria-checked={on}
            aria-label={st.text}
            title={`${idx + 1}. ${st.text}`}
            className={`${wide ? "h-4" : "h-2.5"} flex-1 first:rounded-l-full last:rounded-r-full transition ${
              on ? "bg-primary-container" : "bg-surface-variant hover:bg-outline/60"
            }`}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// O MÍNIMO NA LINHA DA MATRIZ — bandeira de um clique.
//
// O card cheio (com o botão FIZ SÓ O MÍNIMO) só existe dentro do modal, e o modal
// abre clicando no nome. Só que o dia é marcado NA MATRIZ, clicando na bolinha de
// hoje: quem marca ali nunca passa pelo modal, então o mínimo simplesmente não era
// encontrado. A ação precisa morar onde o dia é marcado.
//
// Um ícone só, quatro estados, tudo no title:
//   sem mínimo definido → bandeira apagada, abre o card em edição pra definir
//   definido, hoje em aberto → contornada, clique marca o dia no mínimo
//   hoje marcado no mínimo → preenchida, clique sobe pro dia cheio
//   hoje já é dia cheio → apagada e inerte, o mínimo não tem mais o que fazer hoje
// ============================================================================
function MinFlag({ h, ctx }) {
  if (!habitMinAllowed(h)) return null;
  const today = ctx.today;
  const text = habitMinimum(h);
  const done = (h.doneDates || []).includes(today);
  const isMin = habitMinDone(h, today);

  if (!text)
    return (
      <button
        onClick={() => ctx.openEdit(h)}
        aria-label={`Definir mínimo executável de ${h.name}`}
        title="Definir mínimo executável — a menor versão do hábito que ainda conta"
        className="w-7 h-7 shrink-0 grid place-items-center rounded-md text-outline/50 hover:text-primary-container hover:bg-primary-container/10 transition"
      >
        <MI name="flag" className="text-base" />
      </button>
    );

  if (done && !isMin)
    return (
      <span
        title={`Dia cheio hoje · mínimo: ${text}`}
        className="w-7 h-7 shrink-0 grid place-items-center text-outline/40"
      >
        <MI name="flag" className="text-base" />
      </span>
    );

  const rest = Math.max(0, habitPriority(h).xp - habitMinXp(h));
  return (
    <button
      onClick={() => (isMin ? ctx.completeFull(h.id) : ctx.markMinimum(h.id))}
      aria-label={isMin ? `Subir ${h.name} pra dia cheio` : `Marcar ${h.name} no mínimo`}
      title={
        isMin
          ? `Feito no mínimo hoje (${text}) — clique se fez mais que isso${rest ? ` (+${rest} XP)` : ""}`
          : `Fiz só o mínimo: ${text} — marca o dia mesmo com microatividade em aberto (+${habitMinXp(h)} XP)`
      }
      className={`w-7 h-7 shrink-0 grid place-items-center rounded-md transition active:scale-95 ${
        isMin ? "text-primary-container bg-primary-container/15" : "text-outline hover:text-primary-container hover:bg-primary-container/10"
      }`}
    >
      <MI name="flag" fill={isMin} className="text-base" />
    </button>
  );
}

// Nome do hábito dentro de uma moldura tracejada de input. É o que anuncia o
// clique: nome solto não parece botão, e o tracejado empresta a linguagem que
// todo mundo já reconhece de campo editável. Não depende de hover — no celular
// hover não existe, então a moldura está sempre lá; o hover só reforça.
//
// Aberto, a moldura fecha em linha sólida com a cor do accent: vários cards podem
// estar abertos abaixo da matriz ao mesmo tempo, e isso diz qual linha é qual.
function HabitName({ h, i, ctx }) {
  const kind = h.kind || "build";
  const open = ctx.openId === h.id;
  return (
    <button
      onClick={() => ctx.toggleOpen(h.id)}
      // haspopup=dialog, não aria-expanded: o card não abre mais embutido na
      // linha, abre em janela — e anunciar "expandido" mandaria o leitor de tela
      // procurar conteúdo aqui dentro, que não existe
      aria-haspopup="dialog"
      aria-label={`Abrir e editar ${h.name}`}
      className={`flex items-center gap-1.5 min-w-0 text-left rounded-md border px-2 py-1 transition ${
        open
          ? "border-solid border-primary-container/60 bg-primary-container/5"
          : "border-dashed border-outline/50 hover:border-primary-container hover:bg-primary-container/5"
      }`}
    >
      <MI
        name={h.icon || HABIT_ICONS[i % HABIT_ICONS.length]}
        className={`text-xl shrink-0 ${kind === "quit" ? "text-error" : "text-primary-container"}`}
      />
      <span className="truncate text-[14px] text-on-surface">{h.name}</span>
    </button>
  );
}

// Card do hábito numa janela central. Antes ele abria empilhado ABAIXO da matriz:
// empurrava a legenda pra fora da tela, e com vários abertos ao mesmo tempo não
// dava pra saber qual card era de qual linha. Modal resolve os dois — um por vez,
// no meio da tela.
//
// Fechar no meio de uma edição NÃO descarta o texto: o rascunho vive em `edits`,
// que sobrevive ao fechamento, então reabrir retoma de onde parou. Perder o que
// foi digitado por um clique fora seria pior do que a janela ficar por perto.
function HabitModal({ h, i, ctx, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[150] overflow-y-auto ff-scroll bg-black/60 animate-[fadeIn_.1s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Hábito ${h.name}`}
    >
      {/* min-h-full + items-center: centraliza quando cabe e deixa rolar (sem
          cortar o topo) quando o card é mais alto que a tela */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="w-9 h-9 grid place-items-center rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface active:scale-95 transition"
            >
              <MI name="close" />
            </button>
          </div>
          {/* Fundo opaco por baixo do card. No tema escuro .glass-card já é sólido,
              mas no claro o override troca o fundo por 2% de preto — vidro — e a
              matriz aparecia atrás da janela. O card mantém seu próprio véu por
              cima disto, então no escuro nada muda. */}
          <div className="rounded-xl bg-surface-container-lowest shadow-2xl shadow-black/40">
            <FullCard h={h} i={i} ctx={ctx} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ORDEM — a ordem do array de hábitos É a ordem em todo lugar (calendário, home,
// agenda), então reordenar aqui reordena o app inteiro. Persiste na coluna `pos`.
//
// Painel dedicado em vez de alças espalhadas pela matriz: a coluna fixa do nome
// não tem largura pra abrigar alça + duas setas sem esmagar o nome, e um modo
// separado deixa o alvo grande nos dois tamanhos de tela.
//
// Arrastar usa pointer events, não HTML5 drag-and-drop — é o único caminho que
// funciona igual no mouse e no toque. Linha de altura FIXA: com isso o índice de
// destino é uma divisão, sem medir nada do DOM.
// ============================================================================
const ORDER_ROW = 44; // px — altura fixa de cada linha do painel de ordem
const ORDER_STEP = ORDER_ROW + 4; // + o space-y-1 entre linhas: é ESTE o passo do arraste

const moveInArray = (arr, from, to) => {
  const out = [...arr];
  out.splice(to, 0, out.splice(from, 1)[0]);
  return out;
};

function OrderList({ habits, ctx }) {
  const [drag, setDrag] = useState(null); // { ids, from, to, startY }
  const dragRef = useRef(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx; // ctx nasce novo a cada render; o efeito abaixo não pode depender dele
  const active = !!drag;
  const set = (d) => {
    dragRef.current = d;
    setDrag(d);
  };
  const ids = habits.map((h) => h.id);
  // durante o arraste a lista mostrada é a hipótese; o estado global só muda no soltar
  const view = drag ? moveInArray(drag.ids, drag.from, drag.to).map((id) => habits.find((h) => h.id === id)).filter(Boolean) : habits;

  // Os listeners moram no window, não na alça: a linha arrastada troca de posição
  // no DOM a cada passo, e reinserir o nó solta o pointer capture — o arraste
  // morria no meio. No window nada disso alcança.
  useEffect(() => {
    if (!active) return;
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const to = Math.max(0, Math.min(d.ids.length - 1, d.from + Math.round((e.clientY - d.startY) / ORDER_STEP)));
      if (to !== d.to) set({ ...d, to });
    };
    const onUp = () => {
      const d = dragRef.current;
      set(null);
      if (d && d.to !== d.from) ctxRef.current.reorderHabits(moveInArray(d.ids, d.from, d.to));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [active]);

  return (
    <ul className="space-y-1 select-none">
      {view.map((h, idx) => {
        const dragging = drag && drag.ids[drag.from] === h.id;
        const kind = h.kind || "build";
        return (
          <li
            key={h.id}
            style={{ height: ORDER_ROW }}
            className={`flex items-center gap-1.5 rounded-lg border px-2 transition ${
              dragging ? "border-primary-container bg-primary-container/10" : "border-white/10 bg-surface-container-high/40"
            }`}
          >
            <button
              onPointerDown={(e) => set({ ids, from: idx, to: idx, startY: e.clientY })}
              aria-label={`Arrastar ${h.name}`}
              title="Arraste pra mover"
              // touch-none: sem isso o navegador entende o gesto como rolagem da página
              className="w-9 h-9 grid place-items-center shrink-0 text-outline hover:text-on-surface cursor-grab active:cursor-grabbing touch-none"
            >
              <MI name="drag_indicator" className="text-xl" />
            </button>
            <Caps className="text-outline text-[10px] w-4 text-center tabular-nums shrink-0">{idx + 1}</Caps>
            <MI
              name={h.icon || HABIT_ICONS[idx % HABIT_ICONS.length]}
              className={`text-lg shrink-0 ${kind === "quit" ? "text-error" : "text-primary-container"}`}
            />
            <span className="flex-1 min-w-0 truncate text-[13px] text-on-surface">{h.name}</span>
            <button
              onClick={() => ctx.moveHabit(h.id, -1)}
              disabled={idx === 0 || active}
              aria-label={`Mover ${h.name} pra cima`}
              className="w-9 h-9 grid place-items-center shrink-0 rounded-md text-outline hover:text-primary-container hover:bg-primary-container/10 disabled:opacity-25 disabled:hover:bg-transparent transition"
            >
              <MI name="arrow_upward" className="text-lg" />
            </button>
            <button
              onClick={() => ctx.moveHabit(h.id, 1)}
              disabled={idx === view.length - 1 || active}
              aria-label={`Mover ${h.name} pra baixo`}
              className="w-9 h-9 grid place-items-center shrink-0 rounded-md text-outline hover:text-primary-container hover:bg-primary-container/10 disabled:opacity-25 disabled:hover:bg-transparent transition"
            >
              <MI name="arrow_downward" className="text-lg" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ============================================================================
// CELULAR — o mesmo mês, empilhado. A matriz de 31 colunas só se justifica em
// tela larga, onde o mês inteiro cabe numa linha; no celular ela virava rolagem
// horizontal com metade da largura tomada pela coluna fixa do nome, e marcar o
// dia de hoje exigia rolar até achá-lo.
//
// Aqui cada hábito é um cartão e o mês vira grade de 7 colunas — o formato de
// calendário que todo mundo já lê. Veredito, cores e a regra de "só hoje é
// clicável" saem das MESMAS funções do desktop (dayVerdict), então não existem
// duas versões da verdade. O que muda é só o arranjo e o tamanho do alvo.
// ============================================================================
function MiniMonth({ h, ctx, y, m, dim }) {
  const today = ctx.today;
  const kind = h.kind || "build";
  const dstr = (d) => `${y}-${pad2(m)}-${pad2(d)}`;
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 0=Seg, igual DOW_SHORT
  return (
    <div className="grid grid-cols-7 gap-1">
      {DOW_SHORT.map((l) => (
        <Caps key={l} className="text-outline text-[9px] text-center">
          {l.slice(0, 1)}
        </Caps>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <span key={`lead-${i}`} />
      ))}
      {Array.from({ length: dim }, (_, i) => i + 1).map((d) => {
        const date = dstr(d);
        const isToday = date === today;
        const future = date > today;
        const marked = h.doneDates.includes(date);
        const verdict = dayVerdict(h, date, today);
        const act = () => {
          if (!isToday) return;
          if (kind !== "quit") return ctx.toggleHabit(h.id);
          return marked ? ctx.undoRelapse(h.id) : ctx.logRelapse(h);
        };
        const what = dayWord(verdict, kind, future);
        // o número do dia cabe nesse tamanho de célula, então ele fica: com 31
        // bolinhas iguais e sem eixo por cima, contar dia a dia era o único jeito
        // de saber qual é qual
        const text = verdict ? DAY_TEXT[verdict] : future ? "text-outline/50" : "text-on-surface-variant";
        return (
          <button
            key={d}
            onClick={act}
            disabled={!isToday}
            aria-label={`${h.name} em ${d}/${pad2(m)}${what ? `: ${what}` : ""}`}
            title={`${d}/${pad2(m)}${isToday ? " — hoje, toque pra marcar" : what ? ` — ${what}` : ""}`}
            className={`aspect-square rounded-full grid place-items-center text-[11px] tabular-nums ${
              verdict ? DAY_CLS[verdict] : future ? "bg-surface-variant/30" : "bg-surface-variant"
            } ${text} ${isToday ? "ring-2 ring-on-surface" : ""} ${isToday ? "cursor-pointer" : "cursor-default"}`}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

// Número que resume o hábito no cabeçalho do cartão. Cada tipo tem o seu: o
// diário vive de sequência, o semanal de contagem na semana, o vício de dias
// limpo. Um "12" solto não diria de qual dos três se trata.
function HabitBadge({ h }) {
  const kind = h.kind || "build";
  if (kind === "quit") {
    const clean = cleanDays(h);
    return (
      <span className="flex items-center gap-1 shrink-0">
        <span className="font-display-timer text-[20px] leading-none tabular-nums text-primary">{clean}</span>
        <Caps className="text-outline text-[9px]">{clean === 1 ? "DIA LIMPO" : "DIAS LIMPO"}</Caps>
      </span>
    );
  }
  if (kind === "weekly") {
    const target = h.weeklyTarget || 3;
    const count = weekCount(h);
    const dir = h.direction || "min";
    const over = dir === "max" && count > target;
    const hit = dir === "min" && count >= target;
    return (
      <span className="flex items-center gap-1 shrink-0">
        <span className={`font-headline-md text-[18px] leading-none tabular-nums ${over ? "text-error" : hit ? "text-primary-container" : "text-on-surface"}`}>
          {count}/{target}
        </span>
        <Caps className="text-outline text-[9px]">NA SEMANA</Caps>
      </span>
    );
  }
  const streak = habitStreak(h);
  return (
    <span className="flex items-center gap-1 shrink-0">
      <MI name="local_fire_department" fill className={`text-base ${streak > 0 ? "flame-active" : "text-outline"}`} />
      <span className={`font-display-timer text-[20px] leading-none tabular-nums ${streak > 0 ? "text-primary" : "text-outline"}`}>{streak}</span>
    </span>
  );
}

// Ação de hoje no cartão: botão largo, porque no toque o alvo é o dedo e não o
// pixel. Mesmas regras do desktop — passo em aberto trava diário/semanal, e
// largar registra ou desfaz recaída (com a confirmação de sempre).
function TodayAction({ h, ctx }) {
  const kind = h.kind || "build";
  const today = ctx.today;
  const marked = h.doneDates.includes(today);
  const prog = habitStepProgress(h, today);
  const blocked = habitStepsBlock(h, today);

  if (kind === "quit")
    return marked ? (
      <div className="flex gap-2">
        <div className="flex-1 py-2.5 text-center font-label-caps text-[10px] rounded-lg bg-error/15 text-error">RECAÍDA HOJE</div>
        <button
          onClick={() => ctx.undoRelapse(h.id)}
          className="px-3 py-2.5 rounded-lg font-label-caps text-[10px] border border-white/15 text-on-surface-variant active:scale-[.98] transition"
        >
          DESFAZER
        </button>
      </div>
    ) : (
      <button
        onClick={() => ctx.logRelapse(h)}
        className="w-full py-2.5 font-label-caps text-[10px] rounded-lg border border-error/40 text-error active:scale-[.98] transition"
      >
        RECAÍ HOJE
      </button>
    );

  // no semanal de LIMITE marcar é consumir, não cumprir — o rótulo e a cor
  // seguem o card grande, senão o botão pareceria premiar o estouro
  const isMax = kind === "weekly" && (h.direction || "min") === "max";
  const due = kind === "weekly" || habitIsScheduled(h, today);
  const isMin = habitMinDone(h, today);
  const label = blocked
    ? `FALTAM ${prog.pending} MICROATIVIDADE${prog.pending > 1 ? "S" : ""}`
    : isMax
      ? marked
        ? "CONSUMIDO HOJE · DESFAZER"
        : "CONSUMI HOJE"
      : marked
        ? isMin
          ? "FEITO NO MÍNIMO ✓"
          : "FEITO HOJE ✓"
        : due
          ? "MARCAR HOJE"
          : "FOLGA HOJE — MARCAR MESMO";
  return (
    <button
      onClick={() => ctx.toggleHabit(h.id)}
      role="switch"
      aria-checked={marked}
      aria-disabled={blocked}
      className={`w-full py-2.5 font-label-caps text-[10px] rounded-lg border active:scale-[.98] transition ${
        blocked
          ? "border-white/10 text-outline"
          : isMax
            ? marked
              ? "bg-error/15 text-error border-error/40"
              : "border-error/40 text-error"
            : marked
              ? isMin
                ? "bg-primary-container/15 text-primary-container border-primary-container/60"
                : "bg-primary-container text-on-primary-container border-primary-container"
              : "border-primary text-primary"
      }`}
    >
      {blocked ? <MI name="lock" className="text-sm align-middle mr-1" /> : null}
      {label}
    </button>
  );
}

function MobileHabitCard({ h, i, ctx, y, m, dim }) {
  const hasSteps = habitSteps(h).length > 0;
  return (
    <div className="glass-card rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <HabitName h={h} i={i} ctx={ctx} />
        <HabitBadge h={h} />
      </div>
      {hasSteps && <StepSegments h={h} ctx={ctx} wide />}
      <MiniMonth h={h} ctx={ctx} y={y} m={m} dim={dim} />
      <MinimumBar h={h} ctx={ctx} />
      <TodayAction h={h} ctx={ctx} />
    </div>
  );
}

function MonthLayout({ habits, ctx }) {
  const [off, setOff] = useState(0);
  const [ordering, setOrdering] = useState(false);
  const today = ctx.today;
  const base = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + off, 1);
  const y = base.getFullYear();
  const m = base.getMonth() + 1;
  const dim = new Date(y, m, 0).getDate();
  const days = Array.from({ length: dim }, (_, i) => i + 1);
  const dstr = (d) => `${y}-${pad2(m)}-${pad2(d)}`;
  const label = base.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const openHabit = habits.find((h) => h.id === ctx.openId) || null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setOff((o) => o - 1)} aria-label="Mês anterior" className="w-9 h-9 shrink-0 rounded-full bg-surface-container-high grid place-items-center active:scale-95 transition">
          <MI name="chevron_left" />
        </button>
        <Caps className="text-primary text-[13px] capitalize flex-1 text-center">{label}</Caps>
        <button
          onClick={() => setOff((o) => Math.min(0, o + 1))}
          disabled={off >= 0}
          aria-label="Próximo mês"
          className="w-9 h-9 shrink-0 rounded-full bg-surface-container-high grid place-items-center active:scale-95 transition disabled:opacity-30"
        >
          <MI name="chevron_right" />
        </button>
        {(habits.length > 1 || ordering) && (
          <button
            onClick={() => setOrdering((v) => !v)}
            aria-pressed={ordering}
            title={ordering ? "Terminar de ordenar" : "Escolher a ordem dos hábitos"}
            className={`h-9 px-3 shrink-0 rounded-full font-label-caps text-[10px] flex items-center gap-1.5 border transition active:scale-95 ${
              ordering ? "bg-primary-container text-on-primary-container border-primary-container" : "border-white/10 text-on-surface-variant hover:border-white/25"
            }`}
          >
            <MI name={ordering ? "check" : "swap_vert"} className="text-lg" />
            <span className="hidden sm:inline">{ordering ? "CONCLUIR" : "ORDENAR"}</span>
          </button>
        )}
      </div>

      {ordering ? (
        <div className="glass-card rounded-xl p-3 space-y-2">
          <Caps className="text-outline text-[10px] block">ARRASTE A ALÇA OU USE AS SETAS · A ORDEM VALE NO CALENDÁRIO, NA HOME E NA AGENDA</Caps>
          <OrderList habits={habits} ctx={ctx} />
        </div>
      ) : (
        <>
        {/* tela larga: o mês inteiro numa linha por hábito */}
        <div className="hidden md:block glass-card rounded-xl overflow-x-auto ff-scroll">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface-container px-3 py-2 text-left font-label-caps text-[11px] text-outline">HÁBITO</th>
                {days.map((d) => (
                  <th key={d} className={`px-[3px] pb-1 pt-2 font-label-caps text-[11px] tabular-nums ${dstr(d) === today ? "text-on-surface" : "text-outline"}`}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {habits.map((h, i) => {
                const kind = h.kind || "build";
                const hasSteps = habitSteps(h).length > 0;
                return (
                  <tr key={h.id} className="border-t border-white/5">
                    <td className="sticky left-0 z-10 bg-surface-container px-3 py-1 max-w-[260px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <HabitName h={h} i={i} ctx={ctx} />
                        <MinFlag h={h} ctx={ctx} />
                        {hasSteps && <StepSegments h={h} ctx={ctx} />}
                      </div>
                    </td>
                    {days.map((d) => {
                      const date = dstr(d);
                      const isToday = date === today;
                      const future = date > today;
                      const marked = h.doneDates.includes(date);
                      const verdict = dayVerdict(h, date, today);
                      const act = () => {
                        if (!isToday) return;
                        if (kind !== "quit") return ctx.toggleHabit(h.id);
                        return marked ? ctx.undoRelapse(h.id) : ctx.logRelapse(h);
                      };
                    const what = dayWord(verdict, kind, future);
                      return (
                        <td key={d} className="px-[3px] py-1">
                          <button
                            onClick={act}
                            disabled={!isToday}
                            aria-label={`${h.name} em ${d}/${pad2(m)}${what ? `: ${what}` : ""}`}
                            title={`${d}/${pad2(m)}${isToday ? " — hoje, clique pra marcar" : what ? ` — ${what}` : ""}`}
                            // anel neutro (não colorido) pra marcar HOJE: um terceiro tom
                            // aqui competiria com as duas cores que carregam o significado
                            className={`block w-5 h-5 rounded-full ${
                              verdict ? DAY_CLS[verdict] : future ? "bg-surface-variant/30" : "bg-surface-variant"
                            } ${isToday ? "ring-2 ring-on-surface" : ""} ${isToday ? "cursor-pointer" : "cursor-default"}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* celular: um cartão por hábito, mês em grade de 7 colunas */}
        <div className="md:hidden space-y-3">
          {habits.map((h, i) => (
            <MobileHabitCard key={h.id} h={h} i={i} ctx={ctx} y={y} m={m} dim={dim} />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {[
            { c: DAY_CLS.done, t: "CUMPRIU" },
            { c: DAY_CLS.min, t: "CUMPRIU NO MÍNIMO" },
            { c: DAY_CLS.fail, t: "FALHOU / RECAÍDA" },
            { c: "bg-surface-variant", t: "SEM COBRANÇA (FOLGA, META SEMANAL)" },
          ].map((l) => (
            <span key={l.t} className="flex items-center gap-1.5">
              <span className={`w-4 h-4 rounded-full ${l.c}`} />
              <Caps className="text-outline text-[10px]">{l.t}</Caps>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-surface-variant ring-2 ring-on-surface" />
            <Caps className="text-outline text-[10px]">HOJE — CLIQUE PRA MARCAR</Caps>
          </span>
          <span className="flex items-center gap-1.5">
            <MI name="flag" className="text-base text-outline" />
            <Caps className="text-outline text-[10px]">MÍNIMO EXECUTÁVEL — MARCA O DIA FAZENDO MENOS</Caps>
          </span>
        </div>
        </>
      )}

      {openHabit && <HabitModal h={openHabit} i={habits.indexOf(openHabit)} ctx={ctx} onClose={ctx.closeOpen} />}
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
  const [editMins, setEditMins] = useState({}); // { [id]: mínimo executável em edição }
  const [pickingIcon, setPickingIcon] = useState(null); // id do hábito com picker aberto
  const [stepDrafts, setStepDrafts] = useState({}); // { [id]: texto do passo sendo digitado }
  const [openId, setOpenId] = useState(null); // hábito com o card aberto em modal (um por vez)
  const today = getDateStr(0);

  const toggleOpen = (id) => setOpenId((cur) => (cur === id ? null : id));
  const closeOpen = () => setOpenId(null);

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
          minimum: "", // mínimo executável: definido depois, no card
          minDays: [],
          pos: prev.habits.length, // entra no fim da ordem escolhida
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

  // ===== ordem escolhida pelo usuário =====
  // `pos` é reescrito pra TODOS a cada mudança, não só pros que se moveram: base
  // legada nasce com pos=0 em tudo, e gravar só o par movido deixaria o resto
  // empatado em 0 — a leitura seguinte voltaria na ordem de criação.
  const reindex = (habits) => habits.map((h, i) => (h.pos === i ? h : { ...h, pos: i }));

  function reorderHabits(ids) {
    setState((prev) => {
      const byId = new Map((prev.habits || []).map((h) => [h.id, h]));
      const next = ids.map((id) => byId.get(id)).filter(Boolean);
      if (next.length !== (prev.habits || []).length) return prev; // lista mudou no meio do arraste
      return { ...prev, habits: reindex(next) };
    });
  }

  function moveHabit(id, dir) {
    setState((prev) => {
      const habits = [...(prev.habits || [])];
      const i = habits.findIndex((h) => h.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= habits.length) return prev;
      [habits[i], habits[j]] = [habits[j], habits[i]];
      return { ...prev, habits: reindex(habits) };
    });
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
    const h = state.habits.find((x) => x.id === id);
    // o reducer também recusa; aqui é só pra dizer POR QUE nada aconteceu
    if (h && !h.doneDates.includes(today) && habitStepsBlock(h, today)) {
      const p = habitStepProgress(h, today);
      return toast(`Faltam ${p.pending} microatividade(s) em "${h.name}"`, { type: "error" });
    }
    setState((prev) => toggleHabitState(prev, id, today));
  }

  // ===== mínimo executável =====
  // O aviso é parte da feature, não enfeite: marcar no mínimo com passo em aberto é
  // legítimo, mas o usuário precisa VER que o dia entrou como mínimo — senão amanhã
  // ele lê um mês de bolinhas azuis e acha que fez tudo cheio.
  function markMinimum(id) {
    const h = state.habits.find((x) => x.id === id);
    if (!h) return;
    setState((prev) => markHabitMinimum(prev, id, today));
    toast(`"${h.name}" marcado no mínimo`, { sub: `+${habitMinXp(h)} XP · metade do dia cheio`, icon: "flag" });
  }

  function completeFull(id) {
    const h = state.habits.find((x) => x.id === id);
    if (!h) return;
    if (habitStepsBlock(h, today)) {
      const p = habitStepProgress(h, today);
      return toast(`Faltam ${p.pending} microatividade(s) em "${h.name}"`, { type: "error" });
    }
    setState((prev) => completeHabitFull(prev, id, today));
    toast(`"${h.name}" virou dia cheio`, { type: "success" });
  }

  // ===== microatividades =====
  // Fechar o último passo conclui o hábito (e reabrir um passo desmarca) — a regra
  // mora em toggleHabitStep, pra Home e a Agenda herdarem o mesmo comportamento.
  function toggleStep(id, stepId) {
    const h = state.habits.find((x) => x.id === id);
    const before = habitStepProgress(h, today);
    setState((prev) => toggleHabitStep(prev, id, stepId, today));
    if (before && before.pending === 1 && !habitStepDone(h, today, stepId)) toast(`"${h.name}" concluído hoje`, { type: "success" });
  }

  function addStep(id) {
    const text = (stepDrafts[id] || "").trim().slice(0, HABIT_STEP_LEN);
    if (!text) return;
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => {
        if (h.id !== id) return h;
        const steps = habitSteps(h);
        if (steps.length >= HABIT_STEPS_MAX) return h;
        const step = { id: crypto.randomUUID(), text };
        // Passo criado num dia que o hábito JÁ foi marcado nasce feito: o ato do dia
        // já aconteceu, e deixá-lo aberto criaria hábito feito com passo pendente —
        // exatamente o estado que a trava existe pra impedir. Vale a partir de amanhã.
        if (!(h.doneDates || []).includes(today)) return { ...h, steps: [...steps, step] };
        const day = [...(h.stepChecks?.[today] || []), step.id];
        return { ...h, steps: [...steps, step], stepChecks: { ...(h.stepChecks || {}), [today]: day } };
      }),
    }));
    setStepDrafts((d) => ({ ...d, [id]: "" }));
  }

  function removeStep(id, stepId) {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => {
        if (h.id !== id) return h;
        // limpa o id dos checks também: passo apagado não pode continuar contando em dia nenhum
        const checks = {};
        for (const [d, ids] of Object.entries(h.stepChecks || {})) {
          const keep = ids.filter((x) => x !== stepId);
          if (keep.length) checks[d] = keep;
        }
        return { ...h, steps: habitSteps(h).filter((st) => st.id !== stepId), stepChecks: checks };
      }),
    }));
  }

  function moveStep(id, stepId, dir) {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => {
        if (h.id !== id) return h;
        const steps = [...habitSteps(h)];
        const i = steps.findIndex((st) => st.id === stepId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= steps.length) return h;
        [steps[i], steps[j]] = [steps[j], steps[i]];
        return { ...h, steps };
      }),
    }));
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
    setEditMins((e) => ({ ...e, [h.id]: h.minimum || "" }));
  };
  const cancelEdit = (id) => {
    const drop = (o) => {
      const { [id]: _, ...rest } = o;
      return rest;
    };
    setEdits(drop);
    setEditWhys(drop);
    setEditDetails(drop);
    setEditMins(drop);
    setStepDrafts(drop);
  };
  function saveEdit(id) {
    const name = (edits[id] || "").trim();
    if (!name) return;
    const why = (editWhys[id] || "").trim().slice(0, WHY_MAX);
    const detail = (editDetails[id] || "").trim().slice(0, 500);
    const minimum = (editMins[id] || "").trim().slice(0, HABIT_MIN_LEN);
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => (h.id === id ? { ...h, name: name.slice(0, 80), why, detail, minimum } : h)),
    }));
    cancelEdit(id);
  }

  // handlers/estado compartilhados com os cards (identidade estável evita remount dos inputs)
  const ctx = {
    edits,
    editWhys,
    editDetails,
    editMins,
    setEdits,
    setEditWhys,
    setEditDetails,
    setEditMins,
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
    stepDrafts,
    setStepDrafts,
    addStep,
    removeStep,
    moveStep,
    toggleStep,
    openId,
    toggleOpen,
    closeOpen,
    moveHabit,
    reorderHabits,
    markMinimum,
    completeFull,
    // abre o card em modal JÁ em modo edição: o convite do mínimo sai do cartão do
    // celular, onde o formulário de edição nem está montado
    openEdit: (h) => {
      startEdit(h);
      setOpenId(h.id);
    },
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
        <MonthLayout habits={state.habits} ctx={ctx} />
      )}
    </>
  );
}
