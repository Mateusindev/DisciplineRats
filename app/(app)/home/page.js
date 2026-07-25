"use client";

import Link from "next/link";
import { useApp } from "../AppContext";
import { MI, Caps, StatTile } from "@/components/ui";
import { gamify, fmtK, getDateStr, toggleHabitState, habitPriority, computeHabitStreak, bookPct, mapaFocus } from "@/lib/state";

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// painel do treino do dia — divisão da academia OU modalidade simples
function WoDashboard({ workouts }) {
  return (
    <div className="space-y-3">
      {workouts.map((w) => (
        <div key={w.id} className="glass-card rounded-xl p-5 flex flex-col sm:flex-row gap-5">
          <div className="sm:w-32 shrink-0 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1">
            {w.simple ? (
              <MI name="sports_martial_arts" className="text-primary-container text-5xl" />
            ) : (
              <div className="text-metric-mobile font-metric-mobile text-primary-container leading-none">{w.items.length}</div>
            )}
            <div>
              <div className="font-headline-md text-[16px] text-primary leading-tight">{w.name}</div>
              {!w.simple && <Caps className="text-outline text-[9px]">{w.mod}</Caps>}
            </div>
          </div>
          <div className="flex-1 border-t sm:border-t-0 sm:border-l border-white/5 sm:pl-5 pt-3 sm:pt-0">
            {w.simple ? (
              <p className="text-[12px] text-on-surface-variant">Sessão de hoje — {w.name}.</p>
            ) : w.items.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {w.items.map((it) => (
                  <span key={it.id} className="px-2.5 py-1 rounded-full bg-surface-container-high text-[12px] text-on-surface-variant" title={it.detail || ""}>
                    {it.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-outline">Sem exercícios cadastrados</p>
            )}
            <Link href="/exercicio" className="inline-block mt-3 font-label-caps text-[10px] text-primary-container">REGISTRAR →</Link>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { state, setState, myName } = useApp();
  const g = gamify(state.stats);
  const today = getDateStr(0);
  const todayIdx = (new Date().getDay() + 6) % 7; // 0=Seg … 6=Dom (casa com weekStartOf)
  const FULL_DATE = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  // treino do dia: divisões da academia OU modalidades simples agendadas pra hoje
  const todayWorkouts = [];
  for (const m of state.workoutPlan || []) {
    const divs = m.divisions || [];
    if (divs.length) {
      for (const d of divs) {
        if ((d.weekdays || []).includes(todayIdx)) todayWorkouts.push({ id: d.id, mod: m.name, name: d.name, items: d.items || [], simple: false });
      }
    } else if ((m.weekdays || []).includes(todayIdx)) {
      todayWorkouts.push({ id: m.id, mod: m.name, name: m.name, items: [], simple: true });
    }
  }

  // missões pendentes (cards não concluídos do board) → lembrete sutil
  const rankTask = (k) => (k.due ? (k.due < today ? 0 : 1) : 2); // atrasada, com prazo, sem prazo
  const pendingTasks = (state.board?.columns || [])
    .flatMap((c) => (c.cards || []).filter((k) => !k.done))
    .sort((a, b) => rankTask(a) - rankTask(b) || ((a.due || "9999") < (b.due || "9999") ? -1 : 1) || (b.priority || 2) - (a.priority || 2));
  const priDot = (p) => (p === 3 ? "bg-error" : p === 1 ? "bg-outline" : "bg-primary-container");

  // foco do trimestre: nó fixado no Mapa — amarra o longo prazo no dia
  const focus = mapaFocus(state);

  // leitura: livros em andamento (bem enxuto)
  const reading = (state.books || []).filter((b) => b.status === "reading");
  const bookInitials = (t) => (t || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  // hábitos marcáveis (build + weekly; quit tem fluxo próprio)
  const habits = (state.habits || []).filter((h) => (h.kind || "build") !== "quit");

  function toggle(id) {
    setState((prev) => toggleHabitState(prev, id, today));
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="font-headline-lg text-headline-lg text-primary uppercase">
          {greeting()}{myName ? `, ${myName}` : ""}
        </h2>
        <p className="text-on-surface-variant text-body-md capitalize">{FULL_DATE}</p>
      </div>

      {/* resumo */}
      <section className="grid grid-cols-3 gap-card-gap mb-6">
        <StatTile label="SEQUÊNCIA" value={state.stats.streak}>
          <MI name="local_fire_department" fill className="flame-active text-2xl" />
        </StatTile>
        <StatTile label="NÍVEL" value={g.level}>
          <span className="text-on-surface-variant font-label-caps text-[10px]">{g.tier}</span>
        </StatTile>
        <StatTile label="XP TOTAL" value={fmtK(g.xp)}>
          <MI name="military_tech" className="text-primary-container" />
        </StatTile>
      </section>

      <div className="glass-card p-6 rounded-xl mb-12">
        <div className="w-full bg-surface-variant h-1.5 rounded-full">
          <div className="bg-primary-container h-full rounded-full transition-all" style={{ width: `${g.pct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] font-label-caps text-outline mt-1.5">
          <span>NÍVEL {g.level}</span>
          <span>FALTAM {fmtK(g.toNext)} XP</span>
        </div>
      </div>

      {/* foco do trimestre (nó fixado no Mapa) — item de maior altitude da página */}
      {focus && (
        <Link href="/mapa" className="block glass-card rounded-xl p-6 mb-12 border-l-4 hover:brightness-110 transition" style={{ borderLeftColor: focus.lane?.color || "var(--color-primary-container)" }}>
          <div className="flex items-center gap-2 mb-2">
            <MI name="explore" className="text-primary-container text-lg" fill />
            <Caps className="text-outline text-[10px]">FOCO DO TRIMESTRE</Caps>
            <span className="ml-auto flex items-center gap-1.5 text-[10px] font-label-caps text-outline">
              {focus.lane && <span className="w-2 h-2 rounded-full" style={{ background: focus.lane.color }} />}
              {focus.lane?.label ? `${focus.lane.label} · ` : ""}{focus.horizon.label}
            </span>
          </div>

          <div className="font-headline-md text-headline-md text-primary">
            {focus.mirror ? focus.mirror.label : focus.node.title || focus.node.text || "Sem título"}
          </div>

          {focus.node.why && <p className="text-body-md text-on-surface-variant mt-1">{focus.node.why}</p>}
          {focus.node.target && <Caps className="text-outline text-[10px] mt-1 block">META: {focus.node.target}</Caps>}

          {focus.mirror?.ok && (
            <div className="mt-4">
              <div className="w-full bg-surface-variant h-1.5 rounded-full">
                <div className="bg-primary-container h-full rounded-full transition-all" style={{ width: `${focus.mirror.pct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] font-label-caps text-outline mt-1.5">
                <span>{focus.mirror.sub}</span>
                <span>{focus.mirror.pct}%</span>
              </div>
            </div>
          )}
          {focus.mirror && !focus.mirror.ok && <Caps className="text-error text-[10px] mt-2 block">REFERÊNCIA PERDIDA — REAPONTE NO MAPA</Caps>}
        </Link>
      )}

      {/* missões pendentes (lembrete sutil) */}
      {pendingTasks.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-headline-md text-headline-md text-primary uppercase flex items-center gap-2">
              <MI name="flag" className="text-primary-container" /> Missões · {pendingTasks.length}
            </h3>
            <Link href="/missoes" className="font-label-caps text-[10px] text-outline hover:text-primary transition">VER TUDO</Link>
          </div>
          <div className="glass-card rounded-xl divide-y divide-white/5">
            {pendingTasks.slice(0, 5).map((k) => {
              const overdue = k.due && k.due < today;
              return (
                <Link key={k.id} href="/missoes" className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-variant/30 transition first:rounded-t-xl last:rounded-b-xl">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${priDot(k.priority || 2)}`} />
                  <span className="flex-1 min-w-0 text-[13px] text-on-surface truncate">{k.text}</span>
                  {k.due && (
                    <span className={`flex items-center gap-1 text-[10px] font-label-caps shrink-0 ${overdue ? "text-error" : "text-outline"}`}>
                      <MI name="event" className="text-[13px]" /> {k.due.slice(8, 10)}/{k.due.slice(5, 7)}
                    </span>
                  )}
                </Link>
              );
            })}
            {pendingTasks.length > 5 && (
              <Link href="/missoes" className="block px-4 py-2 text-[11px] font-label-caps text-outline hover:text-primary transition text-center">
                +{pendingTasks.length - 5} MAIS
              </Link>
            )}
          </div>
        </section>
      )}

      {/* treino do dia */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-headline-md text-headline-md text-primary uppercase flex items-center gap-2">
            <MI name="fitness_center" className="text-primary-container" /> Treino de hoje
          </h3>
          <Link href="/exercicio" className="font-label-caps text-[10px] text-outline hover:text-primary transition">
            VER TUDO
          </Link>
        </div>

        {todayWorkouts.length === 0 ? (
          <div className="glass-card p-8 rounded-xl text-center">
            <MI name="self_improvement" className="text-4xl text-outline mb-2" />
            <p className="font-headline-md text-headline-md text-on-surface-variant">Descanso hoje</p>
            <p className="text-[12px] text-outline mt-1">
              Nenhum treino agendado pra hoje. Defina os dias em <Link href="/exercicio" className="text-primary underline">Meus Treinos</Link>.
            </p>
          </div>
        ) : (
          <WoDashboard workouts={todayWorkouts} />
        )}
      </section>

      {/* hábitos */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-md text-headline-md text-primary uppercase flex items-center gap-2">
            <MI name="check_circle" className="text-primary-container" /> Hábitos de hoje
          </h3>
          <Link href="/habitos" className="font-label-caps text-[10px] text-outline hover:text-primary transition">
            VER TUDO
          </Link>
        </div>

        {habits.length === 0 ? (
          <div className="glass-card p-8 rounded-xl text-center">
            <p className="text-[12px] text-outline">
              Nenhum hábito ainda. Crie o primeiro em <Link href="/habitos" className="text-primary underline">Hábitos</Link>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {habits.map((h) => {
              const done = (h.doneDates || []).includes(today);
              const streak = computeHabitStreak(h.doneDates);
              const noXp = (h.kind || "build") === "weekly" && h.direction === "max";
              return (
                <button
                  key={h.id}
                  onClick={() => toggle(h.id)}
                  aria-pressed={done}
                  className={`glass-card p-4 rounded-xl text-left transition active:scale-[0.98] ${
                    done ? "border-primary-container/50 bg-primary-container/10" : "hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <MI name={h.icon || "check_circle"} className={done ? "text-primary-container" : "text-outline"} />
                    <MI
                      name={done ? "check_circle" : "radio_button_unchecked"}
                      fill={done}
                      className={done ? "text-primary-container" : "text-outline"}
                    />
                  </div>
                  <div className="font-body-md text-[14px] text-on-surface leading-tight mb-1 line-clamp-2">{h.name}</div>
                  <div className="flex items-center gap-1 text-outline-variant font-label-caps text-[9px]">
                    <MI name="local_fire_department" className={`text-xs ${streak > 0 ? "text-primary-container" : ""}`} />
                    {streak}D
                    {!noXp && <span className="ml-auto">+{habitPriority(h).xp} XP</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* leitura em andamento (enxuto) */}
      {reading.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-headline-md text-headline-md text-primary uppercase flex items-center gap-2">
              <MI name="menu_book" className="text-primary-container" /> Lendo
            </h3>
            <Link href="/leitura" className="font-label-caps text-[10px] text-outline hover:text-primary transition">VER TUDO</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto ff-scroll pb-1">
            {reading.map((b) => {
              const pct = bookPct(b);
              return (
                <Link key={b.id} href="/leitura" className="w-28 shrink-0 group">
                  <div className="aspect-[2/3] rounded-lg overflow-hidden border border-outline-variant/30 shadow-sm relative group-active:scale-[0.98] transition">
                    {b.cover ? (
                      <img src={b.cover} alt={b.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center bg-surface-container-high text-on-surface-variant font-bold">{bookInitials(b.title)}</div>
                    )}
                    {b.total > 0 && (
                      <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/30">
                        <div className="h-full bg-primary-container" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-on-surface leading-tight line-clamp-2 mt-1">{b.title}</div>
                  {b.total > 0 && <div className="text-[9px] text-outline font-label-caps">{pct}%</div>}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
