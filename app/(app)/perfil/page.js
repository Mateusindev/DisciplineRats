"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, Spinner, inputCls } from "@/components/ui";
import { gamify, fmtK, computeBadges } from "@/lib/state";
import { hasSupabase, NICK_RE } from "@/lib/persistence";

function StatCell({ icon, label, value }) {
  return (
    <div className="glass-card p-4 rounded-xl flex flex-col gap-1">
      <div className="flex items-center gap-2 text-outline">
        <MI name={icon} className="text-base text-primary-container" />
        <Caps className="text-[10px]">{label}</Caps>
      </div>
      <span className="font-headline-lg text-headline-lg text-primary leading-none">{value}</span>
    </div>
  );
}

export default function PerfilPage() {
  const { state, myName, board, updateNickname } = useApp();
  const [editingNick, setEditingNick] = useState(false);
  const [nick, setNick] = useState("");
  const [savingNick, setSavingNick] = useState(false);
  const g = gamify(state.stats);

  function startNick() {
    setNick(myName || "");
    setEditingNick(true);
  }
  async function saveNick() {
    const v = nick.trim();
    if (v === myName) {
      setEditingNick(false);
      return;
    }
    setSavingNick(true);
    const ok = await updateNickname(v);
    setSavingNick(false);
    if (ok) setEditingNick(false);
  }
  const nickValid = NICK_RE.test(nick.trim());
  const badges = computeBadges(state);
  const earned = badges.filter((b) => b.earned);
  const s = state.stats;

  const goal = state.settings.sleepGoalMin || 450;
  const sleepGoalNights = Object.values(state.sleep || {}).filter((n) => (n?.durationMin || 0) >= goal).length;
  const focusHours = Math.round((s.totalMinutes || 0) / 60);
  const name = myName || "DISCÍPULO";
  const rankIdx = hasSupabase() ? board.findIndex((r) => r.username === myName) : -1;

  const stats = [
    { icon: "military_tech", label: "XP TOTAL", value: fmtK(g.xp) },
    { icon: "stars", label: "NÍVEL", value: g.level },
    { icon: "local_fire_department", label: "SEQUÊNCIA", value: s.streak || 0 },
    { icon: "whatshot", label: "MELHOR SEQUÊNCIA", value: s.bestStreak || 0 },
    { icon: "timer", label: "SESSÕES", value: s.totalSessions || 0 },
    { icon: "history", label: "HORAS FOCADAS", value: `${focusHours}h` },
    { icon: "fitness_center", label: "TREINOS", value: (state.exerciseLogs || []).length },
    { icon: "bedtime", label: "NOITES NA META", value: sleepGoalNights },
  ];

  return (
    <div className="space-y-8">
      {/* Cartão de identidade */}
      <section className="glass-card p-6 md:p-8 rounded-xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative shrink-0">
            <div className="w-28 h-28 rounded-full bg-surface-container flex items-center justify-center border-4 border-primary-container/30">
              <MI name="account_circle" className="text-primary text-[96px]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-black text-lg border-4 border-background">
              {g.level}
            </div>
          </div>

          <div className="flex-1 w-full text-center sm:text-left">
            {editingNick ? (
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <input
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  onKeyDown={(e) => (e.key === "Enter" ? saveNick() : e.key === "Escape" ? setEditingNick(false) : null)}
                  autoFocus
                  maxLength={20}
                  aria-label="Nick"
                  placeholder="seu_nick"
                  className={`${inputCls} font-headline-lg text-headline-lg uppercase w-full max-w-[260px] ${nick.trim() && !nickValid ? "border-error/60" : ""}`}
                />
                <button
                  onClick={saveNick}
                  disabled={savingNick || !nickValid}
                  aria-label="Salvar nick"
                  className="w-10 h-10 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center active:scale-95 transition disabled:opacity-40 shrink-0"
                >
                  {savingNick ? <Spinner size={16} /> : <MI name="check" />}
                </button>
                <button
                  onClick={() => setEditingNick(false)}
                  aria-label="Cancelar"
                  className="w-10 h-10 rounded-lg bg-surface-variant text-on-surface-variant flex items-center justify-center active:scale-95 transition shrink-0"
                >
                  <MI name="close" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h2 className="font-headline-lg text-headline-lg text-primary uppercase break-all">{name}</h2>
                {hasSupabase() && (
                  <button onClick={startNick} aria-label="Editar nick" className="text-outline hover:text-primary-container transition p-1 shrink-0">
                    <MI name="edit" className="text-xl" />
                  </button>
                )}
              </div>
            )}
            {editingNick && nick.trim() && !nickValid && (
              <Caps className="text-error text-[10px] block mt-1">3–20 CARACTERES: LETRAS, NÚMEROS, _ . -</Caps>
            )}
            <Caps className="text-primary-container">{g.tier}</Caps>

            <div className="mt-4">
              <div className="flex justify-between text-[10px] font-label-caps text-outline mb-1">
                <span>NÍVEL {g.level}</span>
                <span>{g.intoLevel}/{g.toNext} XP · PRÓX. NÍVEL {g.level + 1}</span>
              </div>
              <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
                <div className="bg-primary-container h-full rounded-full" style={{ width: `${g.pct}%` }} />
              </div>
            </div>

            <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-4">
              <div className="flex items-center gap-2">
                <MI name="workspace_premium" className="text-primary-container" fill />
                <Caps className="text-on-surface-variant">
                  {earned.length}/{badges.length} INSÍGNIAS
                </Caps>
              </div>
              {rankIdx >= 0 && (
                <div className="flex items-center gap-2">
                  <MI name="leaderboard" className="text-primary-container" />
                  <Caps className="text-on-surface-variant">#{rankIdx + 1} NO RANKING</Caps>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Estatísticas */}
      <section>
        <h3 className="font-headline-md text-headline-md text-primary uppercase mb-4">Estatísticas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-card-gap">
          {stats.map((st) => (
            <StatCell key={st.label} {...st} />
          ))}
        </div>
      </section>

      {/* Insígnias */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <h3 className="font-headline-md text-headline-md text-primary uppercase">Insígnias</h3>
          <Caps className="text-outline">{earned.length} DE {badges.length} CONQUISTADAS</Caps>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-card-gap">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`glass-card p-5 rounded-xl flex flex-col items-center text-center gap-2 border transition-colors ${
                b.earned ? "border-primary-container/40" : "border-white/5 opacity-60"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  b.earned ? "bg-primary-container text-on-primary-container" : "bg-surface-variant text-outline"
                }`}
              >
                <MI name={b.earned ? b.icon : "lock"} fill={b.earned} className="text-3xl" />
              </div>
              <div className="font-headline-md text-headline-md text-on-surface leading-tight">{b.name}</div>
              <Caps className="text-[10px] text-on-surface-variant leading-tight">{b.desc}</Caps>
              {b.earned ? (
                <Caps className="text-[10px] text-primary-container mt-1">CONQUISTADA</Caps>
              ) : (
                <div className="w-full mt-1">
                  <div className="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden">
                    <div className="bg-primary/50 h-full rounded-full" style={{ width: `${b.pct}%` }} />
                  </div>
                  <Caps className="text-[9px] text-outline mt-1 block">
                    {b.cur}/{b.target}
                  </Caps>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
