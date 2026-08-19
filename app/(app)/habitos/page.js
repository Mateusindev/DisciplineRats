"use client";

import { useState, useEffect, Fragment } from "react";
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
                  name={on ? "check_box" : "check_box_outline_blank"}
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

// Marcar/desmarcar o hábito do dia. Interruptor em vez de botão: o estado fica
// escrito em palavras, então nunca resta a dúvida de "cliquei ou não?".
// Marcar credita XP, desmarcar estorna o valor exato pago no dia.
// Travado (passo em aberto) segue CLICÁVEL de propósito: o clique é o que dispara o
// aviso dizendo quantos passos faltam. Botão morto não explica nada.
function DoneSwitch({ done, dueToday, xp, blocked = false, pending = 0, onToggle }) {
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
          {done ? "FEITO HOJE" : dueToday ? "AINDA NÃO FEITO" : "NÃO AGENDADO HOJE"}
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

      <DoneSwitch
        done={done}
        dueToday={dueToday}
        xp={prio.xp}
        blocked={blocked}
        pending={prog?.pending || 0}
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
              ? "PRATICADO HOJE ✓"
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
// LISTA EM TABELA — hábito por linha, denso e escaneável. Clicar na linha
// expande e mostra o card cheio original (BuildCard/WeeklyCard/QuitCard) por
// baixo, então nenhuma funcionalidade (editar, ícone, passos, dias, recaída
// etc.) fica de fora — só escondida até o usuário pedir detalhe.
// ============================================================================

// controle de "feito hoje" em botão redondo pequeno — mesma ação do DoneSwitch
// (toggleHabit cobre build e weekly), só que pra caber numa célula estreita.
function MiniDone({ h, ctx }) {
  const done = h.doneDates.includes(ctx.today);
  const blocked = habitStepsBlock(h, ctx.today);
  return (
    <button
      onClick={() => ctx.toggleHabit(h.id)}
      role="switch"
      aria-checked={done}
      aria-label={done ? "Feito hoje" : "Marcar feito hoje"}
      title={done ? "Feito hoje" : blocked ? "Faltam microatividades" : "Marcar feito hoje"}
      className={`w-9 h-9 rounded-full grid place-items-center border shrink-0 active:scale-95 transition ${
        done
          ? "bg-primary-container border-primary-container text-on-primary-container"
          : blocked
            ? "border-white/10 text-outline opacity-60"
            : "border-white/15 text-outline hover:border-primary-container/50 hover:text-primary-container"
      }`}
    >
      <MI name={blocked ? "lock" : done ? "check" : "radio_button_unchecked"} className="text-lg" />
    </button>
  );
}

// mesma ideia pro hábito de largar: recaiu/não recaiu hoje, versão compacta dos
// botões do QuitCard (confirm e desfazer continuam vindo do ctx).
function MiniQuit({ h, ctx }) {
  const relapsedToday = h.doneDates.includes(ctx.today);
  return relapsedToday ? (
    <button
      onClick={() => ctx.undoRelapse(h.id)}
      title="Desfazer recaída de hoje"
      aria-label="Desfazer recaída de hoje"
      className="w-9 h-9 rounded-full grid place-items-center border border-error/40 bg-error/15 text-error shrink-0 active:scale-95 transition"
    >
      <MI name="undo" className="text-lg" />
    </button>
  ) : (
    <button
      onClick={() => ctx.logRelapse(h)}
      title="Registrar recaída hoje"
      aria-label="Registrar recaída hoje"
      className="w-9 h-9 rounded-full grid place-items-center border border-white/15 text-outline hover:border-error/40 hover:text-error shrink-0 active:scale-95 transition"
    >
      <MI name="block" className="text-lg" />
    </button>
  );
}

// badge de tipo — a tabela mistura os 3 tipos numa lista só, então cada linha
// precisa dizer o que é (diário/semanal/largar).
function KindBadge({ kind }) {
  const label = kind === "quit" ? "LARGAR" : kind === "weekly" ? "SEMANAL" : "DIÁRIO";
  return <Caps className={`text-[9px] shrink-0 ${kind === "quit" ? "text-error" : "text-outline"}`}>{label}</Caps>;
}

// número/barra compacta por tipo — mesma matemática das telas cheias
// (habitStreak/weekCount/cleanDays), só que formatada pra caber numa coluna.
function RowMetric({ h, ctx }) {
  const kind = h.kind || "build";
  if (kind === "build") {
    const streak = habitStreak(h);
    return (
      <div className="flex items-center gap-1 w-14 justify-end" title={`Sequência de ${streak} · recorde ${bestHabitStreak(h)}`}>
        <MI name="local_fire_department" fill className={`text-base ${streak > 0 ? "flame-active" : "text-outline"}`} />
        <span className={`tabular-nums font-label-caps text-[13px] ${streak > 0 ? "text-primary" : "text-outline"}`}>{streak}</span>
      </div>
    );
  }
  if (kind === "weekly") {
    const target = h.weeklyTarget || 3;
    const dir = h.direction || "min";
    const count = weekCount(h);
    const pct = Math.min(100, Math.round((count / Math.max(1, target)) * 100));
    const over = dir === "max" && count > target;
    const hit = dir === "min" && count >= target;
    return (
      <div className="w-20" title={`${count}/${target} essa semana`}>
        <Caps className={`text-[10px] block text-right ${over ? "text-error" : hit ? "text-primary-container" : "text-outline"}`}>
          {count}/{target}
        </Caps>
        <div className="w-full h-1 bg-surface-variant rounded-full overflow-hidden mt-0.5">
          <div className={`h-full rounded-full ${over ? "bg-error" : "bg-primary-container"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  const clean = cleanDays(h);
  return (
    <div className="text-right w-14 shrink-0" title={`Recorde: ${bestCleanRun(h)} dias`}>
      <span className="tabular-nums font-label-caps text-[15px] text-primary block leading-none">{clean}</span>
      <Caps className="text-outline text-[9px]">LIMPO</Caps>
    </div>
  );
}

// uma linha da tabela. Clique expande numa <tr colSpan> com o card cheio
// original dentro (bare, sem o container glass-card duplicado).
function TableRow({ h, i, ctx }) {
  const kind = h.kind || "build";
  const expanded = !!ctx.expanded[h.id] || ctx.edits[h.id] !== undefined;
  return (
    <Fragment>
      <tr onClick={() => ctx.toggleExpanded(h.id)} className="border-t border-white/5 hover:bg-white/[0.03] cursor-pointer transition">
        <td className="py-2.5 pl-4 pr-3">
          <div className="flex items-center gap-2 min-w-0">
            <MI
              name={h.icon || HABIT_ICONS[i % HABIT_ICONS.length]}
              className={`text-xl shrink-0 ${kind === "quit" ? "text-error" : "text-primary-container"}`}
            />
            <span className="truncate text-on-surface text-[13px]">{h.name}</span>
          </div>
        </td>
        <td className="py-2.5 pr-3"><KindBadge kind={kind} /></td>
        <td className="py-2.5 pr-3"><PriorityLabel h={h} /></td>
        <td className="py-2.5 pr-3 text-[11px] text-outline whitespace-nowrap">
          {kind === "build"
            ? habitScheduleLabel(h) || "TODO DIA"
            : kind === "weekly"
              ? `${(h.direction || "min") === "min" ? "MÍN" : "MÁX"} ${h.weeklyTarget || 3}×/SEM`
              : "—"}
        </td>
        <td className="py-2.5 pr-3">
          <RowMetric h={h} ctx={ctx} />
        </td>
        <td className="py-2.5 pr-3 text-center" onClick={(e) => e.stopPropagation()}>
          {kind === "quit" ? <MiniQuit h={h} ctx={ctx} /> : <MiniDone h={h} ctx={ctx} />}
        </td>
        <td className="py-2.5 pl-1 pr-4 text-right">
          <MI name={expanded ? "expand_less" : "expand_more"} className="text-outline" />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="p-2 bg-black/10">
            {kind === "build" && <BuildCard h={h} i={i} ctx={ctx} bare />}
            {kind === "weekly" && <WeeklyCard h={h} i={i} ctx={ctx} bare />}
            {kind === "quit" && <QuitCard h={h} i={i} ctx={ctx} bare />}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

const TABLE_COLS = ["HÁBITO", "TIPO", "PRIORIDADE", "PROGRAMAÇÃO", "MÉTRICA", "HOJE", ""];

function TableLayout({ groups, ctx }) {
  return (
    <div className="glass-card rounded-xl overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[720px]">
        <thead>
          <tr className="border-b border-white/10">
            {TABLE_COLS.map((label) => (
              <th key={label} className="font-label-caps text-[10px] text-outline px-3 py-2 first:pl-4">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(({ key, title, icon, habits, accent }) => (
            <Fragment key={key}>
              {groups.length > 1 && (
                <tr>
                  <td colSpan={TABLE_COLS.length} className="pt-4 pb-1 pl-4">
                    <Caps className={`text-[11px] flex items-center gap-1.5 ${accent}`}>
                      <MI name={icon} className="text-sm" />
                      {title}
                    </Caps>
                  </td>
                </tr>
              )}
              {habits.map((h, i) => (
                <TableRow key={h.id} h={h} i={i} ctx={ctx} />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
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
  const [stepDrafts, setStepDrafts] = useState({}); // { [id]: texto do passo sendo digitado }
  const [expanded, setExpanded] = useState({}); // { [id]: bool } — linha da tabela expandida mostrando o card cheio
  const today = getDateStr(0);

  const toggleExpanded = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

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
    const h = state.habits.find((x) => x.id === id);
    // o reducer também recusa; aqui é só pra dizer POR QUE nada aconteceu
    if (h && !h.doneDates.includes(today) && habitStepsBlock(h, today)) {
      const p = habitStepProgress(h, today);
      return toast(`Faltam ${p.pending} microatividade(s) em "${h.name}"`, { type: "error" });
    }
    setState((prev) => toggleHabitState(prev, id, today));
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
  };
  const cancelEdit = (id) => {
    const drop = (o) => {
      const { [id]: _, ...rest } = o;
      return rest;
    };
    setEdits(drop);
    setEditWhys(drop);
    setEditDetails(drop);
    setStepDrafts(drop);
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
    stepDrafts,
    setStepDrafts,
    addStep,
    removeStep,
    moveStep,
    toggleStep,
    expanded,
    toggleExpanded,
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
  const groups = [
    { key: "build", title: "Construindo", icon: "trending_up", accent: "text-primary-container", habits: buildHabits },
    { key: "weekly", title: "Metas da Semana", icon: "event_repeat", accent: "text-primary-container", habits: weeklyHabits },
    { key: "quit", title: "Largando", icon: "block", accent: "text-error", habits: quitHabits },
  ].filter((g) => g.habits.length > 0);

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
        <TableLayout groups={groups} ctx={ctx} />
      )}
    </>
  );
}
