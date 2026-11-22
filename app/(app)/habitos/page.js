"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "../AppContext";
import { MI, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  cleanDays,
  bestCleanRun,
  lastRelapse,
  relapsesInWindow,
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
  markHabitMinimum,
  HABIT_MIN_LEN,
} from "@/lib/state";

// Limite do porquê. Curto de propósito: motivo que não cabe numa linha não é lido
// na hora da decisão, e é justamente aí que ele precisa funcionar. Notas longas
// vão pro campo de detalhes.
const WHY_MAX = 140;

// Os rótulos de prioridade moram em caixa alta em lib/state (compartilhado com
// Home e Agenda). Aqui a tela é em caixa normal, então a conversão é local.
const sentence = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s);

// Dias agendados por extenso curto ("Seg, Qua, Sex"). habitScheduleLabel devolve
// caixa alta e decide o "todo dia" (null); aqui só reescrevemos o texto.
const scheduleText = (h) =>
  habitScheduleLabel(h) && [...habitWeekdays(h)].sort((a, b) => a - b).map((d) => DOW_SHORT[d]).join(", ");

// rótulo pequeno de campo/grupo
function FieldLabel({ children, className = "" }) {
  return <span className={`text-xs font-medium text-on-surface-variant ${className}`}>{children}</span>;
}

// Dias da semana do hábito (0=Seg..6=Dom). Nada marcado = todo dia.
// Um seletor só pra criação e edição. Nenhum dia marcado = TODO DIA, que é o
// padrão; como "vazio" e "todo dia" são o mesmo estado, ele precisa se anunciar:
// o botão "Todo dia" fica pressionado — sem isso, padrão ativo parece campo não
// preenchido. No celular os dias viram uma letra (o nome inteiro vai no title).
function DowPicker({ value, onChange }) {
  const sel = (value || []).map(String);
  const all = sel.length === 0;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        value={sel}
        onValueChange={(v) => onChange(v.map(Number).sort((a, b) => a - b))}
        aria-label="Dias da semana"
        className="w-full sm:w-auto"
      >
        {DOW_SHORT.map((label, d) => (
          <ToggleGroupItem
            key={d}
            value={String(d)}
            aria-label={label}
            title={all ? `${label} — incluído em todo dia` : label}
            className="px-0 flex-1 sm:flex-none sm:w-10 text-xs"
          >
            <span className="sm:hidden">{label.slice(0, 1)}</span>
            <span className="hidden sm:inline">{label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([])}
        aria-pressed={all}
        title={all ? "Vale todo dia da semana" : "Voltar pra todo dia"}
        className={`text-xs ${all ? "bg-surface-variant text-on-surface" : "text-on-surface-variant"}`}
      >
        <MI name={all ? "done_all" : "restart_alt"} className="text-[16px]" />
        Todo dia
      </Button>
    </div>
  );
}

// Prioridade como controle segmentado: importância do hábito, nada além disso.
function PriorityPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={String(value)}
        onValueChange={(v) => v && onChange(Number(v))}
        aria-label="Prioridade"
      >
        {HABIT_PRIORITIES.map((p) => (
          <ToggleGroupItem key={p.v} value={String(p.v)} aria-label={`Prioridade ${sentence(p.label)}`} className="text-xs">
            {sentence(p.label)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

// ============================================================================
// FORM DE CRIAÇÃO — tipo, nome e porquê na primeira linha; dias/alvo,
// prioridade e adicionar na segunda. Tudo à vista, sem menu escondendo opção.
// ============================================================================
const KINDS = [
  { id: "build", label: "Diário", icon: "trending_up" },
  { id: "weekly", label: "Semanal", icon: "event_repeat" },
  { id: "quit", label: "Largar", icon: "block" },
];

// nome + porquê: dois campos lado a lado na tela larga, empilhados no celular
function NameFields({ f }) {
  return (
    <div className="flex-1 min-w-0 grid gap-2 md:grid-cols-2">
      <Input
        value={f.newHabit}
        onChange={(e) => f.setNewHabit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && f.addHabit()}
        placeholder={f.newKind === "quit" ? "Largar o quê? Ex: cigarro, açúcar..." : "Nome do hábito"}
        aria-label="Nome do hábito"
      />
      <Input
        value={f.newWhy}
        onChange={(e) => f.setNewWhy(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && f.addHabit()}
        maxLength={WHY_MAX}
        placeholder={f.newKind === "quit" ? "Por que largar? (opcional)" : "Por que isso importa? (opcional)"}
        aria-label="Porquê do hábito"
      />
    </div>
  );
}

// tipo como controle segmentado com ícone + nome
function KindToggle({ value, onChange }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="default"
      value={value}
      onValueChange={(v) => v && onChange(v)}
      aria-label="Tipo de hábito"
      className="w-full md:w-auto shrink-0"
    >
      {KINDS.map((k) => (
        <ToggleGroupItem key={k.id} value={k.id} aria-label={k.label} title={k.label} className="flex-1 md:flex-none text-[13px]">
          <MI name={k.icon} className="text-[18px] text-on-surface-variant" />
          {k.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

// alvo semanal: direção (meta/limite) + N
function WeeklyCompact({ direction, onDirection, target, onTarget }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={direction}
        onValueChange={(v) => v && onDirection(v)}
        aria-label="Direção do alvo semanal"
      >
        <ToggleGroupItem value="min" title="Pelo menos N vezes na semana" className="text-xs">
          Pelo menos
        </ToggleGroupItem>
        <ToggleGroupItem value="max" title="No máximo N vezes na semana" className="text-xs">
          No máximo
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" onClick={() => onTarget(Math.max(1, target - 1))} aria-label="Diminuir alvo">
          −
        </Button>
        <span className="w-20 text-center text-sm tabular-nums text-on-surface">{target}× por semana</span>
        <Button variant="outline" size="icon-sm" onClick={() => onTarget(Math.min(7, target + 1))} aria-label="Aumentar alvo">
          +
        </Button>
      </div>
    </div>
  );
}

// controle que troca com o tipo escolhido
function ContextControl({ f }) {
  if (f.newKind === "build")
    return (
      <div className="flex flex-col gap-1.5 w-full sm:w-auto">
        <FieldLabel>Dias</FieldLabel>
        <DowPicker value={f.newWeekdays} onChange={f.setNewWeekdays} />
      </div>
    );
  if (f.newKind === "weekly")
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Alvo</FieldLabel>
        <WeeklyCompact direction={f.newDirection} onDirection={f.setNewDirection} target={f.newTarget} onTarget={f.setNewTarget} />
      </div>
    );
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Registro</FieldLabel>
      <span className="h-8 flex items-center text-sm text-on-surface-variant">Conta só as recaídas</span>
    </div>
  );
}

function HabitForm({ f }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <KindToggle value={f.newKind} onChange={f.setNewKind} />
        <NameFields f={f} />
      </div>
      {/* No celular os sete dias já comem a linha inteira, então cada grupo ganha
          a própria linha e o adicionar vai pro fim, alinhado à direita. */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <ContextControl f={f} />
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Prioridade</FieldLabel>
          <PriorityPicker value={f.newPriority} onChange={f.setNewPriority} />
        </div>
        <Button onClick={f.addHabit} aria-label="Adicionar hábito" className="ml-auto">
          <MI name="add" className="text-[18px]" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}


// ---- header comum do card (ícone + editar/excluir/fechar + nome) ----
// Componentes em escopo de módulo (não aninhados na página): identidade estável
// entre renders, então os inputs de edição não remontam a cada tecla (evita o
// foco pular pro título ao digitar os detalhes).
function CardHeader({ h, i, ctx }) {
  const { edits, editDetails, editWhys, editMins, setEdits, setEditDetails, setEditWhys, setEditMins, pickingIcon, setPickingIcon, setIcon, saveEdit, cancelEdit, startEdit, removeHabit, setPriority } = ctx;
  const editing = edits[h.id] !== undefined;
  const picking = pickingIcon === h.id;
  const icon = h.icon || HABIT_ICONS[i % HABIT_ICONS.length];
  const quit = (h.kind || "build") === "quit";
  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-4">
        {/* Picker em Popover: fecha sozinho no clique fora (onOpenChange), sem a
            camada fixa que antes cobria a tela. */}
        <Popover open={picking} onOpenChange={(o) => setPickingIcon(o ? h.id : null)}>
          <PopoverTrigger asChild>
            <button
              aria-label="Escolher ícone"
              title="Escolher ícone"
              className="size-10 shrink-0 rounded-lg border border-outline-variant bg-surface-container-high text-on-surface-variant grid place-items-center hover:bg-surface-variant hover:text-on-surface active:scale-95 transition"
            >
              <MI name={icon} className="text-[22px]" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <div className="grid grid-cols-6 gap-1">
              {HABIT_ICONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setIcon(h.id, ic)}
                  aria-label={ic}
                  className={`size-9 rounded-md grid place-items-center transition ${
                    icon === ic ? "bg-surface-variant text-on-surface" : "text-on-surface-variant hover:bg-surface-variant/60 hover:text-on-surface"
                  }`}
                >
                  <MI name={ic} className="text-[20px]" />
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => cancelEdit(h.id)} aria-label="Cancelar">
                Cancelar
              </Button>
              <Button size="sm" onClick={() => saveEdit(h.id)} aria-label="Salvar">
                Salvar
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon-sm" onClick={() => startEdit(h)} aria-label="Editar" title="Editar" className="text-on-surface-variant">
                <MI name="edit" className="text-[18px]" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => removeHabit(h.id)} aria-label="Remover" title="Excluir" className="text-on-surface-variant hover:text-error">
                <MI name="delete" className="text-[18px]" />
              </Button>
            </>
          )}
          <span className="w-px h-5 bg-outline-variant mx-1" />
          <Button variant="ghost" size="icon-sm" onClick={ctx.closeOpen} aria-label="Fechar" title="Fechar" className="text-on-surface-variant">
            <MI name="close" className="text-[18px]" />
          </Button>
        </div>
      </div>
      {editing ? (
        <div className="space-y-3 mb-4">
          <label className="grid gap-1.5">
            <FieldLabel>Nome</FieldLabel>
            <Input
              value={edits[h.id]}
              onChange={(e) => setEdits((es) => ({ ...es, [h.id]: e.target.value }))}
              onKeyDown={(e) => (e.key === "Enter" ? saveEdit(h.id) : e.key === "Escape" ? cancelEdit(h.id) : null)}
              autoFocus
              aria-label="Nome do hábito"
            />
          </label>
          <label className="grid gap-1.5">
            <FieldLabel>Porquê</FieldLabel>
            <Input
              value={editWhys[h.id] || ""}
              onChange={(e) => setEditWhys((es) => ({ ...es, [h.id]: e.target.value }))}
              onKeyDown={(e) => (e.key === "Enter" ? saveEdit(h.id) : e.key === "Escape" ? cancelEdit(h.id) : null)}
              maxLength={WHY_MAX}
              placeholder={quit ? "Por que largar isso?" : "Por que esse hábito importa?"}
              aria-label="Porquê do hábito"
            />
          </label>
          <label className="grid gap-1.5">
            <FieldLabel>Detalhes</FieldLabel>
            <Textarea
              value={editDetails[h.id] || ""}
              onChange={(e) => setEditDetails((es) => ({ ...es, [h.id]: e.target.value }))}
              onKeyDown={(e) => (e.key === "Escape" ? cancelEdit(h.id) : null)}
              rows={3}
              maxLength={500}
              placeholder="Como executar, onde, com o quê..."
              aria-label="Detalhes do hábito"
              className="resize-y"
            />
          </label>
          {/* O mínimo é config de hábito, mas é TEXTO — então mora aqui com os
              outros campos de texto e é gravado pelo mesmo salvar. Fora do diário
              e da meta semanal ele nem aparece: em vício e em limite semanal a
              ideia de "mínimo" não significa nada (ver habitHasMinimum). */}
          {habitMinAllowed(h) && (
            <label className="grid gap-1.5">
              <FieldLabel>Mínimo executável</FieldLabel>
              <Input
                value={editMins[h.id] || ""}
                onChange={(e) => setEditMins((es) => ({ ...es, [h.id]: e.target.value }))}
                onKeyDown={(e) => (e.key === "Enter" ? saveEdit(h.id) : e.key === "Escape" ? cancelEdit(h.id) : null)}
                maxLength={HABIT_MIN_LEN}
                placeholder="A menor versão que ainda conta. Ex: 10 flexões"
                aria-label="Mínimo executável do hábito"
              />
              <span className="text-xs text-outline">
                Feito o mínimo, o dia é marcado mesmo com microatividade em aberto — e vale o dia cheio.
              </span>
            </label>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <h2 className="text-lg font-semibold tracking-tight text-on-surface">{h.name}</h2>
          <PriorityLabel h={h} />
        </div>
      )}
      {/* o porquê fica ACIMA de tudo que é métrica: é o que você lê antes de decidir marcar */}
      {!editing &&
        (h.why ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-surface-container-high px-3 py-2.5">
            <MI name="format_quote" className="text-[18px] shrink-0 text-outline" />
            <p className="text-sm text-on-surface-variant whitespace-pre-wrap">{h.why}</p>
          </div>
        ) : (
          <button
            onClick={() => startEdit(h)}
            className="mb-4 flex items-center gap-1.5 text-xs font-medium text-outline hover:text-on-surface transition"
          >
            <MI name="add_circle" className="text-[16px]" />
            {quit ? "Por que largar isso?" : "Por que esse hábito importa?"}
          </button>
        ))}
      {!editing && h.detail && (
        <p className="text-sm text-on-surface-variant whitespace-pre-wrap mb-4">{h.detail}</p>
      )}
      {/* prioridade só é editável no modo edição: fora dele é rótulo. Três botões
          sempre clicáveis no card viviam trocando a prioridade sem querer. */}
      {editing && (
        <div className="mb-4 grid gap-1.5">
          <FieldLabel>Prioridade</FieldLabel>
          <PriorityPicker value={h.priority || 2} onChange={(v) => setPriority(h.id, v)} />
        </div>
      )}
    </>
  );
}

// Rótulo de prioridade ao lado do título: leitura, não controle. Três degraus
// preenchidos até o nível, em tom neutro.
function PriorityLabel({ h }) {
  const p = habitPriority(h);
  const label = sentence(p.label);
  return (
    <span title={`Prioridade ${label}`} className="shrink-0 inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
      <span className="flex items-end gap-0.5">
        {[6, 9, 12].map((px, idx) => (
          <span key={px} className={`w-1 rounded-sm ${idx < p.v ? "bg-on-surface-variant" : "bg-outline/25"}`} style={{ height: `${px}px` }} />
        ))}
      </span>
      Prioridade {label.toLowerCase()}
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
    <div className="mb-4 rounded-lg border border-outline-variant px-4 py-3 flex items-center gap-4">
      <div className="flex flex-col items-start shrink-0 min-w-14">
        <span className={`text-3xl font-semibold tracking-tight leading-none tabular-nums ${on ? "text-on-surface" : "text-outline"}`}>{streak}</span>
        <span className="text-xs text-outline mt-1">{sched ? "em sequência" : streak === 1 ? "dia" : "dias"}</span>
      </div>
      <div className="w-px self-stretch bg-outline-variant" />
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <MI name="local_fire_department" fill={on} className={`text-[18px] ${on ? "text-primary-container" : "text-outline"}`} />
          <span className={`text-sm font-medium ${on ? "text-on-surface" : "text-on-surface-variant"}`}>
            {!on ? "Comece hoje" : done ? "Mantida hoje" : dueToday ? "Em risco — falta hoje" : "Descanso hoje"}
          </span>
        </div>
        {next && <span className="text-xs text-outline block">Próximo marco: {next} dias</span>}
        {best > streak && <span className="text-xs text-outline block">Recorde: {best} dias</span>}
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
    <div className="mb-4 grid gap-1.5">
      <FieldLabel>
        Microatividades <span className="text-outline tabular-nums">({steps.length}/{HABIT_STEPS_MAX})</span>
      </FieldLabel>
      {steps.length > 0 && (
        <ul className="rounded-lg border border-outline-variant divide-y divide-outline-variant">
          {steps.map((st, idx) => (
            <li key={st.id} className="flex items-center gap-1 pl-3 pr-1 py-1">
              <span className="w-4 shrink-0 text-xs text-outline tabular-nums">{idx + 1}</span>
              <span className="flex-1 min-w-0 truncate text-sm text-on-surface">{st.text}</span>
              <Button variant="ghost" size="icon-xs" onClick={() => moveStep(h.id, st.id, -1)} disabled={idx === 0} aria-label="Subir" className="text-outline">
                <MI name="arrow_upward" className="text-[16px]" />
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={() => moveStep(h.id, st.id, 1)} disabled={idx === steps.length - 1} aria-label="Descer" className="text-outline">
                <MI name="arrow_downward" className="text-[16px]" />
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={() => removeStep(h.id, st.id)} aria-label="Remover passo" className="text-outline hover:text-error">
                <MI name="close" className="text-[16px]" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setStepDrafts((d) => ({ ...d, [h.id]: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && addStep(h.id)}
          disabled={full}
          maxLength={HABIT_STEP_LEN}
          placeholder={full ? "Limite de passos atingido" : "Novo passo"}
          aria-label="Nova microatividade"
          className="h-8 flex-1"
        />
        <Button variant="outline" size="icon-sm" onClick={() => addStep(h.id)} disabled={full} aria-label="Adicionar passo">
          <MI name="add" className="text-[18px]" />
        </Button>
      </div>
      <span className="text-xs text-outline">
        {steps.length > 0 ? "Com passos, o hábito só é marcado depois que todos estiverem feitos." : "Sem passos, o hábito é marcado direto."}
      </span>
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
    <div className="mb-4 rounded-lg border border-outline-variant p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-on-surface-variant">Microatividades</span>
        <span className="text-xs tabular-nums text-outline">
          {p.done}/{p.total}
        </span>
      </div>
      <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden mb-2">
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
                className="w-full flex items-center gap-2.5 py-1.5 text-left group"
              >
                <span
                  className={`size-[18px] shrink-0 rounded-[5px] grid place-items-center border transition ${
                    on ? "bg-primary-container border-primary-container text-on-primary-container" : "border-outline group-hover:border-on-surface-variant"
                  }`}
                >
                  {on && <MI name="check" className="text-[15px] leading-none font-semibold" />}
                </span>
                <span className={`text-sm leading-snug ${on ? "line-through text-outline" : "text-on-surface"}`}>{st.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================
// O MÍNIMO NO CARD — dois estados, um bloco só.
//
//   não marcado  → o texto do mínimo + o botão que marca o dia por ele
//   marcado      → o mínimo recua pra lembrete apagado; hoje ele já não importa
//
// Não existe terceiro estado. Dia marcado pelo mínimo é dia marcado: a tela não
// diz por qual caminho a marcação veio, porque a resposta não muda nada — mesma
// bolinha, mesma sequência.
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
        className={`flex items-center gap-1.5 text-xs font-medium text-outline hover:text-on-surface transition ${className}`}
      >
        <MI name="flag" className="text-[16px]" />
        Definir mínimo executável
      </button>
    );
  const done = (h.doneDates || []).includes(today);

  if (done)
    return (
      <div className={`flex items-start gap-1.5 text-xs text-outline ${className}`}>
        <MI name="flag" className="text-[16px] shrink-0" />
        <span className="min-w-0">Mínimo: {text}</span>
      </div>
    );

  return (
    <div className={`rounded-lg border border-dashed border-outline-variant p-3 ${className}`}>
      <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1 mb-1">
        <MI name="flag" className="text-[16px] text-outline" /> Mínimo executável
      </span>
      <p className="text-sm text-on-surface mb-3 whitespace-pre-wrap">{text}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => ctx.markMinimum(h.id)}
        title="Marca o dia mesmo com microatividade em aberto"
        className="w-full"
      >
        Fiz só o mínimo
      </Button>
    </div>
  );
}

// Marcar/desmarcar o hábito do dia. Interruptor em vez de botão: o estado fica
// escrito em palavras, então nunca resta a dúvida de "cliquei ou não?".
// Travado (passo em aberto) segue CLICÁVEL de propósito: o clique é o que dispara o
// aviso dizendo quantos passos faltam. Botão morto não explica nada.
function DoneSwitch({ done, dueToday, blocked = false, pending = 0, onToggle }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={done}
      aria-disabled={blocked}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-outline-variant transition active:scale-[.99] ${
        blocked ? "opacity-60" : "hover:bg-surface-variant/50"
      }`}
    >
      <span className="text-left min-w-0">
        <span className="text-sm font-medium block text-on-surface">
          {done ? "Feito hoje" : dueToday ? "Ainda não feito" : "Não agendado hoje"}
        </span>
        <span className="text-xs text-outline block">
          {blocked ? `Faltam ${pending} microatividade${pending > 1 ? "s" : ""}` : done ? "Toque pra desmarcar" : "Toque pra marcar como feito"}
        </span>
      </span>
      {blocked ? (
        <MI name="lock" className="text-outline text-[20px] shrink-0" />
      ) : (
        <span className={`w-10 h-6 rounded-full p-0.5 shrink-0 transition-colors ${done ? "bg-primary-container" : "bg-surface-variant"}`}>
          <span className={`block size-5 rounded-full bg-background shadow-xs transition-transform ${done ? "translate-x-4" : ""}`} />
        </span>
      )}
    </button>
  );
}

function BuildCard({ h, i, ctx, bare = false }) {
  const { today, toggleHabit, setWeekdays } = ctx;
  const done = h.doneDates.includes(today);
  const streak = habitStreak(h);
  const best = bestHabitStreak(h);
  const sched = habitScheduleLabel(h); // null = todo dia
  const dueToday = habitIsScheduled(h, today);
  const editing = ctx.edits[h.id] !== undefined;
  const prog = habitStepProgress(h, today);
  const blocked = habitStepsBlock(h, today);
  return (
    <div className={bare ? "p-4" : "p-5 relative"}>
      <CardHeader h={h} i={i} ctx={ctx} />

      {editing ? (
        <div className="mb-4 grid gap-1.5">
          <FieldLabel>Dias da semana</FieldLabel>
          <DowPicker value={habitWeekdays(h)} onChange={(wd) => setWeekdays(h.id, wd)} />
          <div className="mt-3">
            <StepEditor h={h} ctx={ctx} />
          </div>
        </div>
      ) : (
        sched && (
          <span className="text-xs text-outline mb-3 flex items-center gap-1">
            <MI name="event_repeat" className="text-[16px]" /> {scheduleText(h)}
          </span>
        )
      )}

      {/* a faixa já diz o estado do dia — uma linha de resumo aqui seria repetição */}
      <StreakBanner streak={streak} sched={sched} best={best} dueToday={dueToday} done={done} />

      {!editing && <StepChecklist h={h} ctx={ctx} />}

      {!editing && <MinimumBar h={h} ctx={ctx} className="mb-4" />}

      <DoneSwitch
        done={done}
        dueToday={dueToday}
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
  const pct = Math.min(100, Math.round((count / Math.max(1, target)) * 100));
  const over = dir === "max" && count > target;
  const hit = dir === "min" && count >= target;
  const editing = ctx.edits[h.id] !== undefined;
  const prog = habitStepProgress(h, today);
  const blocked = habitStepsBlock(h, today);
  return (
    <div className={bare ? "p-4" : "p-5 relative"}>
      <CardHeader h={h} i={i} ctx={ctx} />
      {editing && <StepEditor h={h} ctx={ctx} />}
      <div className="mb-4 rounded-lg border border-outline-variant px-4 py-3">
        <div className="flex items-end justify-between mb-2">
          <span className="text-xs text-outline">
            {dir === "min" ? "Pelo menos" : "No máximo"} {target}× por semana
          </span>
          <span className={`text-2xl font-semibold tracking-tight leading-none tabular-nums ${over ? "text-error" : "text-on-surface"}`}>
            {count}/{target}
          </span>
        </div>
        <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden mb-2">
          <div className={`h-full rounded-full ${over ? "bg-error" : "bg-primary-container"}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between items-center gap-2 text-xs">
          <span className={over ? "text-error" : hit ? "text-on-surface font-medium" : "text-outline"}>
            {dir === "min" ? (hit ? "Meta batida" : `Faltam ${target - count}`) : over ? "Limite estourado" : `Restam ${target - count}`}
          </span>
        </div>
      </div>
      {!editing && <StepChecklist h={h} ctx={ctx} />}
      {!editing && <MinimumBar h={h} ctx={ctx} className="mb-4" />}
      <Button
        onClick={() => toggleHabit(h.id)}
        aria-disabled={blocked}
        variant={blocked || dir === "max" ? "outline" : "default"}
        className={`w-full ${
          blocked
            ? "text-outline"
            : dir === "min"
              ? done
                ? "bg-primary-container text-on-primary-container hover:bg-primary-container/90"
                : ""
              : done
                ? "text-error bg-error/10 hover:bg-error/15 hover:text-error"
                : "text-error hover:text-error"
        }`}
      >
        {blocked && <MI name="lock" className="text-[16px]" />}
        {!blocked && dir === "min" && done && <MI name="check" className="text-[18px]" />}
        {blocked
          ? `Faltam ${prog.pending} microatividade${prog.pending > 1 ? "s" : ""}`
          : dir === "min"
            ? done
              ? "Praticado hoje"
              : "Pratiquei hoje"
            : done
              ? "Consumido hoje · desfazer"
              : "Consumi hoje"}
      </Button>
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
  return (
    <div className={bare ? "p-4" : "p-5 relative"}>
      <CardHeader h={h} i={i} ctx={ctx} />
      <div className="mb-4 rounded-lg border border-outline-variant px-4 py-3">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-4xl font-semibold tracking-tight leading-none tabular-nums text-on-surface">{clean}</span>
          <span className="text-sm text-on-surface-variant">{clean === 1 ? "dia limpo" : "dias limpo"}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-outline">
          <span>
            Recorde: {best} {best === 1 ? "dia" : "dias"}
          </span>
          {next ? (
            <span className="text-right">
              Próximo marco: {next.days}d
            </span>
          ) : (
            <span />
          )}
          <span>Últimos 30d: {last30} recaída(s)</span>
          {trend !== null && (
            <span className={`text-right ${trend <= 0 ? "text-on-surface-variant" : "text-error"}`}>
              {trend <= 0 ? "▼" : "▲"} {Math.abs(trend)} vs 30d anteriores
            </span>
          )}
        </div>
      </div>
      {relapsedToday ? (
        <div className="flex gap-2">
          <div className="flex-1 h-9 rounded-md bg-error/10 text-error text-sm font-medium grid place-items-center">Recaída hoje</div>
          <Button variant="outline" onClick={() => undoRelapse(h.id)}>
            Desfazer
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => logRelapse(h)} className="w-full text-error hover:text-error">
          Recaí hoje
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// CALENDÁRIO MENSAL — a visão de hábitos. Matriz hábito × dia do mês.
//
// Duas cores, e só duas: o accent cumpriu, o erro falhou ou recaiu. Vêm dos
// tokens (`primary-container` / `error`), que já carregam o ajuste de contraste
// de cada tema.
//
// O que NÃO ganha cor é tão importante quanto: dia de hábito sem meta diária
// (meta semanal) e o dia de hoje ainda em aberto ficam neutros. Pintar de
// vermelho um dia que ainda dá tempo de cumprir seria acusar falha que não
// aconteceu.
//
// Clicar no nome do hábito abre o card cheio numa janela, com tudo que ele
// sempre teve: editar, ícone, microatividades, dias da semana, prioridade, recaída.
// ============================================================================

// Card cheio do tipo certo — o detalhe que abre na janela.
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

const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// Dias que aceitam clique. Do nascimento do hábito até hoje: o registro é
// retroativo de propósito — quem esqueceu de marcar ontem marca hoje, e o
// calendário É o formulário disso. O que não se registra é o futuro (não
// aconteceu) e o período anterior ao hábito (não havia o que cumprir).
function dayEditable(h, date, today) {
  if (date > today) return false;
  const born = createdOn(h);
  return !born || date >= born;
}

// Veredito de um dia. Devolve a classe de fundo ou null pra neutro.
//
// Cada tipo cobra de um jeito diferente, e é isso que decide a cor:
//   diário  — só falha em dia AGENDADO que já passou; dia de folga conta como
//             cumprido, igual a um dia feito (ver abaixo)
//   semanal — a meta é da semana, então nenhum dia isolado é falha; só marcação
//             pinta como cumprido
//   largar  — todo dia sem recaída é dia cumprido; recaída pinta como falha
//
// Devolve token ("done" | "fail" | null), não classe: quem pinta escolhe
// como, e quem lê o veredito pra montar o texto do title não precisa comparar
// nome de classe.
function dayVerdict(h, date, today) {
  const kind = h.kind || "build";
  const marked = h.doneDates.includes(date);
  if (date > today) return null; // futuro não tem veredito
  // Antes de existir, o hábito não cobra nada. Sem isto, criar um hábito hoje
  // pintaria todo o mês passado de vermelho — falha que nunca houve.
  const born = createdOn(h);
  if (born && date < born) return null;
  if (kind === "quit") return marked ? "fail" : "done";
  // Dia marcado é dia cumprido, tenha vindo da checklist ou do mínimo executável:
  // o calendário conta comparecimento, e um dia de mínimo é comparecimento.
  if (marked) return "done";
  if (kind === "weekly") return null;
  // Folga é dia cumprido, e pinta da mesma cor. Hábito de 3×/semana passava o mês
  // com quatro bolinhas cinzas por semana no meio das cheias, e a linha lia como
  // "quase sempre falho" quando o plano estava sendo seguido à risca. Dia em que
  // nada era devido é dia em dia — a mesma regra que o vício já usava.
  if (!habitIsScheduled(h, date)) return "done";
  return date === today ? null : "fail"; // hoje ainda dá tempo
}

// DUAS cores, e só. O dia feito no mínimo já foi um terceiro tom (vazado) —
// saiu de propósito: cumprir é cumprir, e a bolinha diferente transformava o dia
// ruim salvo pelo mínimo num asterisco permanente no calendário.
const DAY_CLS = {
  done: "bg-primary-container",
  fail: "bg-error/80",
};
const dayWord = (verdict, kind, future) =>
  verdict === "fail" ? (kind === "quit" ? "recaída" : "falhou") : verdict === "done" ? "cumpriu" : future ? "" : "sem cobrança";

// ============================================================================
// MICROATIVIDADES NO BLOCO — barra segmentada, um segmento por passo.
//
// Marcar custa UM clique e nenhuma navegação: antes a checklist só existia
// dentro do card cheio. Aqui a barra fica no próprio bloco do Hoje, e cada
// segmento é o alvo do seu passo.
//
// Age sobre HOJE, porque passo é registro diário (stepChecks[data]) e a checklist
// de um dia que já fechou não é editável — as bolinhas do histórico aceitam
// qualquer dia vivido, a barra de passos não. Hábito sem microatividade não
// mostra barra nenhuma. A lista com o texto de cada passo continua no card
// cheio (StepChecklist); aqui o texto vive no title/aria de cada segmento.
// ============================================================================
function StepSegments({ h, ctx }) {
  const steps = habitSteps(h);
  return (
    // 12px de altura: alvo de dedo, não só de mouse
    <div className="flex w-full items-center gap-0.5">
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
            className={`h-3 flex-1 first:rounded-l-full last:rounded-r-full transition ${
              on ? "bg-primary-container" : "bg-surface-variant hover:bg-outline/50"
            }`}
          />
        );
      })}
    </div>
  );
}

// Número que resume o hábito, numa linha de meta em cinza. Cada tipo tem o seu:
// o diário vive de sequência, o semanal de contagem na semana, o vício de dias
// limpo. Um "12" solto não diria de qual dos três se trata.
function HabitBadge({ h }) {
  const kind = h.kind || "build";
  if (kind === "quit") {
    const clean = cleanDays(h);
    return (
      <span className="inline-flex items-center gap-1 text-xs text-outline whitespace-nowrap">
        <span className="font-medium tabular-nums text-on-surface-variant">{clean}</span>
        {clean === 1 ? "dia limpo" : "dias limpo"}
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
      <span className="inline-flex items-center gap-1 text-xs text-outline whitespace-nowrap">
        <span className={`font-medium tabular-nums ${over ? "text-error" : hit ? "text-on-surface" : "text-on-surface-variant"}`}>
          {count}/{target}
        </span>
        na semana
      </span>
    );
  }
  const streak = habitStreak(h);
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-outline whitespace-nowrap">
      <MI name="local_fire_department" fill={streak > 0} className={`text-[15px] ${streak > 0 ? "text-primary-container" : "text-outline"}`} />
      <span className={`font-medium tabular-nums ${streak > 0 ? "text-on-surface" : "text-on-surface-variant"}`}>{streak}</span>
      <span className="ml-0.5">{streak === 1 ? "dia" : "dias"}</span>
    </span>
  );
}

// Card do hábito numa janela central (Dialog). Antes ele abria empilhado ABAIXO
// da matriz: empurrava a legenda pra fora da tela, e com vários abertos ao mesmo
// tempo não dava pra saber qual card era de qual linha. Modal resolve os dois —
// um por vez, no meio da tela. Esc e clique fora fecham (Radix); o botão de
// fechar mora no cabeçalho do card (CardHeader). Excluir e registrar recaída
// abrem o confirm do app, que também é Radix e empilha por cima desta janela.
//
// Fechar no meio de uma edição NÃO descarta o texto: o rascunho vive em `edits`,
// que sobrevive ao fechamento, então reabrir retoma de onde parou. Perder o que
// foi digitado por um clique fora seria pior do que a janela ficar por perto.
function HabitModal({ h, i, ctx, onClose }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="p-0 gap-0 sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto ff-scroll rounded-xl border-outline-variant bg-popover"
      >
        <DialogTitle className="sr-only">{`Hábito ${h.name}`}</DialogTitle>
        <FullCard h={h} i={i} ctx={ctx} />
      </DialogContent>
    </Dialog>
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
        return (
          <li
            key={h.id}
            style={{ height: ORDER_ROW }}
            className={`flex items-center gap-2 rounded-lg border px-1.5 transition ${
              dragging ? "border-ring bg-surface-variant" : "border-outline-variant bg-surface-container"
            }`}
          >
            <button
              onPointerDown={(e) => set({ ids, from: idx, to: idx, startY: e.clientY })}
              aria-label={`Arrastar ${h.name}`}
              title="Arraste pra mover"
              // touch-none: sem isso o navegador entende o gesto como rolagem da página
              className="size-9 grid place-items-center shrink-0 rounded-md text-outline hover:text-on-surface cursor-grab active:cursor-grabbing touch-none"
            >
              <MI name="drag_indicator" className="text-[20px]" />
            </button>
            <span className="text-xs text-outline w-4 text-center tabular-nums shrink-0">{idx + 1}</span>
            <MI name={h.icon || HABIT_ICONS[idx % HABIT_ICONS.length]} className="text-[18px] shrink-0 text-on-surface-variant" />
            <span className="flex-1 min-w-0 truncate text-sm text-on-surface">{h.name}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => ctx.moveHabit(h.id, -1)}
              disabled={idx === 0 || active}
              aria-label={`Mover ${h.name} pra cima`}
              className="text-on-surface-variant"
            >
              <MI name="arrow_upward" className="text-[18px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => ctx.moveHabit(h.id, 1)}
              disabled={idx === view.length - 1 || active}
              aria-label={`Mover ${h.name} pra baixo`}
              className="text-on-surface-variant"
            >
              <MI name="arrow_downward" className="text-[18px]" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

// ============================================================================
// HOJE — o dia de hoje, em blocos, em qualquer largura. É o que se faz todo
// dia, então vem primeiro e com alvo grande: o bloco inteiro é o toque. A matriz
// do mês (só desktop) virou histórico e registro retroativo, logo abaixo.
//
// Antes, no desktop, marcar hoje era acertar uma bolinha de 18px entre 31 — e só
// ela mudava de cor. Aqui o bloco feito muda inteiro (borda e fundo no accent,
// check cheio com um "pop", "Feito hoje"), e o placar do topo anda.
// Recaída de vício é o único estado em tom de erro.
//
// Mesmas regras de sempre: passo em aberto trava diário/semanal (o toque segue
// vivo, é ele que dispara o aviso), vício registra/desfaz recaída com a
// confirmação de sempre, e o mínimo executável aparece só onde existe.
// ============================================================================
function HabitBlocks({ habits, ctx, action = null }) {
  // Placar do dia: só o que cobra hoje. Vício fica de fora (lá `doneDates` é
  // recaída, contar como feito inverteria o placar) — mesma conta de lib/petMood.
  const due = habits.filter((h) => (h.kind || "build") !== "quit" && habitIsScheduled(h, ctx.today));
  const doneCount = due.filter((h) => h.doneDates.includes(ctx.today)).length;
  const pct = due.length ? Math.round((doneCount / due.length) * 100) : 0;

  return (
    <section aria-labelledby="hoje-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="hoje-title" className="text-base font-semibold tracking-tight text-on-surface">Hoje</h2>
          <p className="text-xs text-on-surface-variant">
            {due.length ? (
              <>
                <span className="font-medium tabular-nums text-on-surface">{doneCount}</span> de{" "}
                <span className="tabular-nums">{due.length}</span> {due.length === 1 ? "feito" : "feitos"}
                {doneCount === due.length ? " — dia fechado" : ""}
              </>
            ) : (
              "Nada cobrado hoje"
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {due.length > 0 && (
            <div className="h-1.5 w-24 sm:w-40 overflow-hidden rounded-full bg-surface-variant" aria-hidden>
              <div className="h-full rounded-full bg-primary-container transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          )}
          {action}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {habits.map((h, i) => {
          const kind = h.kind || "build";
          const marked = h.doneDates.includes(ctx.today);
          const blocked = kind !== "quit" && habitStepsBlock(h, ctx.today);
          const hasSteps = habitSteps(h).length > 0;
          const filled = marked && kind !== "quit";
          const relapsed = marked && kind === "quit";
          const offToday = kind === "build" && !habitIsScheduled(h, ctx.today);
          const minText = habitMinAllowed(h) ? habitMinimum(h) : "";
          const tap = () => (kind === "quit" ? (marked ? ctx.undoRelapse(h.id) : ctx.logRelapse(h)) : ctx.toggleHabit(h.id));
          return (
            <div
              key={h.id}
              className={`group relative flex min-h-[132px] flex-col gap-3 rounded-xl border p-3 transition-colors duration-300 ${
                filled
                  ? "border-primary-container/60 bg-primary-container/10"
                  : relapsed
                    ? "border-error/40 bg-error/5"
                    : "border-outline-variant bg-surface-container hover:border-outline/40"
              }`}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => ctx.toggleOpen(h.id)}
                aria-label={`Abrir ${h.name}`}
                className="absolute top-1.5 right-1.5 text-outline"
              >
                <MI name="more_horiz" className="text-[18px]" />
              </Button>
              <button
                onClick={tap}
                aria-pressed={kind === "quit" ? undefined : marked}
                aria-label={`${h.name}: ${kind === "quit" ? (marked ? "desfazer recaída" : "registrar recaída") : marked ? "desmarcar hoje" : "marcar hoje"}`}
                className="flex flex-1 flex-col items-start gap-2.5 rounded-md text-left outline-none transition active:scale-[.98] focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {filled ? (
                  // key muda com o estado: remonta e roda o "pop" uma vez a cada marcação
                  <span key="on" className="habit-pop grid size-8 place-items-center rounded-full bg-primary-container text-on-primary-container">
                    <MI name="check" className="text-[20px]" />
                  </span>
                ) : kind === "quit" ? (
                  <span
                    className={`grid size-8 place-items-center rounded-full ${
                      relapsed ? "bg-error/15 text-error" : "border border-outline-variant text-on-surface-variant"
                    }`}
                  >
                    <MI name={relapsed ? "close" : h.icon || HABIT_ICONS[i % HABIT_ICONS.length]} className="text-[17px]" />
                  </span>
                ) : blocked ? (
                  <span className="grid size-8 place-items-center rounded-full border border-outline-variant text-outline">
                    <MI name="lock" className="text-[16px]" />
                  </span>
                ) : (
                  <span key="off" className="grid size-8 place-items-center rounded-full border-2 border-outline/50 text-transparent transition group-hover:border-on-surface-variant group-hover:text-outline">
                    <MI name="check" className="text-[18px]" />
                  </span>
                )}
                <span className={`line-clamp-2 pr-6 text-sm font-medium leading-snug ${offToday && !filled ? "text-on-surface-variant" : "text-on-surface"}`}>
                  {h.name}
                </span>
                <span className="mt-auto flex min-h-5 items-center">
                  {filled ? (
                    <span className="text-xs font-medium text-on-surface">
                      Feito hoje
                    </span>
                  ) : relapsed ? (
                    <span className="text-xs text-error">Recaída hoje</span>
                  ) : offToday ? (
                    <span className="text-xs text-outline">Folga hoje</span>
                  ) : (
                    <HabitBadge h={h} />
                  )}
                </span>
              </button>
              {hasSteps && !filled && <StepSegments h={h} ctx={ctx} />}
              {minText && !marked && (
                <button
                  onClick={() => ctx.markMinimum(h.id)}
                  aria-label={`Marcar ${h.name} pelo mínimo: ${minText}`}
                  className="w-full rounded-lg border border-dashed border-outline-variant px-2.5 py-2 text-left transition hover:border-outline/60 active:scale-[.98]"
                >
                  <span className="flex items-center gap-1 text-xs font-medium text-on-surface">
                    <MI name="flag" className="text-[14px] text-outline" /> Só o mínimo
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-xs text-outline">{minText}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
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
  // "outubro de 2026" → "Outubro de 2026": só a primeira letra sobe (capitalize subiria o "de")
  const rawLabel = base.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
  const openHabit = habits.find((h) => h.id === ctx.openId) || null;

  // o mesmo botão mora em dois cabeçalhos (Hoje no celular, Histórico no desktop)
  const orderButton = (className = "") =>
    (habits.length > 1 || ordering) && (
      <Button
        variant={ordering ? "default" : "outline"}
        size="sm"
        onClick={() => setOrdering((v) => !v)}
        aria-pressed={ordering}
        title={ordering ? "Terminar de ordenar" : "Escolher a ordem dos hábitos"}
        className={className}
      >
        <MI name={ordering ? "check" : "swap_vert"} className="text-[18px]" />
        {ordering ? "Concluir" : "Ordenar"}
      </Button>
    );

  return (
    <div className="space-y-8">
      {ordering ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-on-surface">Ordem dos hábitos</h2>
            {orderButton()}
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface-container p-3 space-y-3">
            <p className="text-xs text-on-surface-variant px-1">Arraste a alça ou use as setas. A ordem vale no calendário, na home e na agenda.</p>
            <OrderList habits={habits} ctx={ctx} />
          </div>
        </section>
      ) : (
        <>
          {/* no celular o Ordenar mora no cabeçalho do Hoje; no desktop, no do histórico */}
          <HabitBlocks habits={habits} ctx={ctx} action={<span className="md:hidden">{orderButton()}</span>} />

          {/* desktop: o mês inteiro numa linha por hábito — histórico e registro atrasado */}
          <section aria-labelledby="hist-title" className="hidden md:block space-y-3">
            <div className="flex items-center gap-2">
              <h2 id="hist-title" className="text-base font-semibold tracking-tight text-on-surface mr-2">Histórico</h2>
              <Button variant="outline" size="icon-sm" onClick={() => setOff((o) => o - 1)} aria-label="Mês anterior">
                <MI name="chevron_left" className="text-[18px]" />
              </Button>
              <span className="min-w-36 text-center text-sm font-medium text-on-surface">{label}</span>
              <Button variant="outline" size="icon-sm" onClick={() => setOff((o) => Math.min(0, o + 1))} disabled={off >= 0} aria-label="Próximo mês">
                <MI name="chevron_right" className="text-[18px]" />
              </Button>
              <div className="ml-auto flex items-center gap-4 text-xs text-outline">
                <span className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${DAY_CLS.done}`} /> Feito
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${DAY_CLS.fail}`} /> Não feito
                </span>
              </div>
              {orderButton()}
            </div>
            {/* Só o nome e a bolinha de cada dia. Ações, sequência, passos e o mínimo
                moram nos blocos do Hoje e no card do hábito — aqui é leitura do mês
                (e o clique numa bolinha vivida segue registrando atrasado). */}
            <div className="rounded-xl border border-outline-variant bg-surface-container overflow-x-auto ff-scroll">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 w-48 min-w-40 max-w-48 bg-surface-container pl-5 pr-3 pt-4 pb-2" aria-label="Hábito" />
                    {days.map((d) => {
                      const isToday = dstr(d) === today;
                      return (
                        <th
                          key={d}
                          className={`px-0 pt-4 pb-2 text-center text-[11px] tabular-nums ${isToday ? "font-semibold text-on-surface" : "font-normal text-outline"}`}
                        >
                          {d}
                        </th>
                      );
                    })}
                    <th className="w-4" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {habits.map((h) => {
                    const kind = h.kind || "build";
                    return (
                      <tr key={h.id}>
                        <td className="sticky left-0 z-10 w-48 min-w-40 max-w-48 bg-surface-container pl-5 pr-3 py-1.5">
                          <span className="block truncate text-sm text-on-surface" title={h.name}>
                            {h.name}
                          </span>
                        </td>
                        {days.map((d) => {
                          const date = dstr(d);
                          const isToday = date === today;
                          const future = date > today;
                          const marked = h.doneDates.includes(date);
                          const verdict = dayVerdict(h, date, today);
                          const editable = dayEditable(h, date, today);
                          const act = () => {
                            if (!editable) return;
                            if (kind !== "quit") return ctx.toggleHabit(h.id, date);
                            return marked ? ctx.undoRelapse(h.id, date) : ctx.logRelapse(h, date);
                          };
                          const what = dayWord(verdict, kind, future);
                          return (
                            <td key={d} className="px-0 py-1.5 text-center">
                              <button
                                onClick={act}
                                disabled={!editable}
                                aria-label={`${h.name} em ${d}/${pad2(m)}${what ? `: ${what}` : ""}${editable ? ", clique pra registrar" : ""}`}
                                title={`${d}/${pad2(m)}${what ? ` — ${what}` : ""}`}
                                // hoje: anel neutro fino — um terceiro tom competiria com as
                                // duas cores que carregam o significado
                                className={`inline-block size-3.5 rounded-full align-middle transition ${
                                  verdict ? DAY_CLS[verdict] : future ? "bg-surface-variant/40" : "bg-surface-variant"
                                } ${isToday ? "ring-[1.5px] ring-on-surface-variant ring-offset-2 ring-offset-surface-container" : ""} ${
                                  editable ? "cursor-pointer hover:scale-125" : "cursor-default"
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="w-4" aria-hidden />
                      </tr>
                    );
                  })}
                  <tr aria-hidden>
                    <td className="h-3" colSpan={days.length + 2} />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
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
  const [showForm, setShowForm] = useState(false); // form de criação aberto (com hábitos já existentes)
  const today = getDateStr(0);

  const toggleOpen = (id) => setOpenId((cur) => (cur === id ? null : id));
  const closeOpen = () => setOpenId(null);

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
        },
      ],
    }));
    setNewHabit("");
    setShowForm(true); // o primeiro hábito não fecha o form: quem acabou de criar costuma criar mais um
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

  // ===== build/weekly: marcar/desmarcar o dia =====
  // `date` default hoje; o calendário passa qualquer dia já vivido (registro
  // retroativo). Dia passado ganha toast porque o clique acontece longe de onde o
  // olho está — sem confirmação em texto, marcar 12/08 por engano passa batido.
  function toggleHabit(id, date = today) {
    const h = state.habits.find((x) => x.id === id);
    const marked = !!h && h.doneDates.includes(date);
    // A trava de microatividade só vale HOJE (idem toggleHabitState). Aqui o
    // reducer também recusa; este toast é só pra dizer POR QUE nada aconteceu.
    if (h && !marked && date === today && habitStepsBlock(h, today)) {
      const p = habitStepProgress(h, today);
      return toast(`Faltam ${p.pending} microatividade(s) em "${h.name}"`, { type: "error" });
    }
    setState((prev) => toggleHabitState(prev, id, date));
    // Hoje também avisa: antes só o retroativo tinha toast, e marcar o dia de
    // hoje no desktop mudava uma bolinha e mais nada — parecia que não tinha ido.
    if (h && date === today) {
      toast(marked ? `"${h.name}" desmarcado` : `"${h.name}" feito hoje`, { icon: marked ? "undo" : "check_circle" });
    }
    if (h && date !== today) {
      toast(`"${h.name}" ${marked ? "desmarcado" : "registrado"} em ${ddmm(date)}`, { icon: "history" });
    }
  }

  // ===== mínimo executável =====
  // O toast é o mesmo de um dia qualquer: o mínimo é um atalho pra marcar, não um
  // tipo de marcação. Avisar "entrou como mínimo" seria recriar em texto a
  // diferenciação que a tela deixou de fazer.
  function markMinimum(id) {
    const h = state.habits.find((x) => x.id === id);
    if (!h) return;
    setState((prev) => markHabitMinimum(prev, id, today));
    toast(`"${h.name}" feito hoje`, { icon: "flag" });
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
  // `date` default hoje; o calendário passa o dia clicado. Recaída antiga também
  // se registra: a contagem de dias limpo só é verdade se o dia ruim couber nela.
  async function logRelapse(h, date = today) {
    if (h.doneDates.includes(date)) return;
    const quando = date === today ? "" : ` em ${ddmm(date)}`;
    // o porquê entra aqui de propósito: é o momento exato em que ele tem função
    const ok = await confirm({
      title: `Registrar recaída em "${h.name}"${quando}?`,
      body: h.why
        ? `Você largou porque: “${h.why}”. Registrar zera a contagem de dias limpo — sem julgamento, recomeça agora.`
        : "Zera a contagem de dias limpo. Sem julgamento — recomeça agora.",
      confirmLabel: date === today ? "Recaí hoje" : `Recaí em ${ddmm(date)}`,
    });
    if (!ok) return;
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((x) => (x.id === h.id ? { ...x, doneDates: [...x.doneDates, date] } : x)),
    }));
  }
  function undoRelapse(id, date = today) {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((x) => (x.id === id ? { ...x, doneDates: x.doneDates.filter((d) => d !== date) } : x)),
    }));
  }

  async function removeHabit(id) {
    const h = state.habits.find((x) => x.id === id);
    const ok = await confirm({ title: "Excluir hábito?", body: `"${h?.name || ""}" e todo o histórico dele serão apagados.`, confirmLabel: "Excluir" });
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
  const hasHabits = state.habits.length > 0;
  const formOpen = showForm || !hasHabits;

  return (
    <>
      <PageHeader
        title="Hábitos"
        subtitle="Construa os bons, largue os ruins."
        actions={
          hasHabits && (
            <Button variant={formOpen ? "outline" : "default"} onClick={() => setShowForm((v) => !v)} aria-expanded={formOpen}>
              <MI name={formOpen ? "close" : "add"} className="text-[18px]" />
              {formOpen ? "Fechar" : "Novo hábito"}
            </Button>
          )
        }
      />

      {/* ---- form de criação ----
          Recolhido quando já há hábitos: o dia a dia é marcar, não criar, e o
          form aberto empurrava o Hoje pra baixo da dobra no celular. Sem nenhum
          hábito ele fica sempre aberto — é a única coisa a fazer na tela. */}
      {formOpen && (
        <div className="rounded-xl border border-outline-variant bg-surface-container p-4 md:p-5 mb-8 animate-[fadeIn_.15s_ease-out]">
          <HabitForm f={formProps} />
        </div>
      )}

      {state.habits.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container p-8 text-center text-sm text-on-surface-variant">
          Nenhum hábito ainda. Crie o primeiro acima — ele aparece aqui, pronto pra marcar.
        </div>
      ) : (
        <MonthLayout habits={state.habits} ctx={ctx} />
      )}
    </>
  );
}
