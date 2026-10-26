"use client";

import { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { MI, Spinner, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { gamify, fmtK, computeBadges } from "@/lib/state";
import { hasSupabase, NICK_RE } from "@/lib/persistence";
import { MODES, DEFAULT_MODE } from "@/lib/themes";
import Pet from "./Pet";

// Linha de configuração: rótulo e descrição à esquerda, controle à direita.
function SettingRow({ label, desc, children }) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-sm font-medium text-on-surface">{label}</div>
        {desc && <p className="mt-0.5 text-xs text-on-surface-variant">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionTitle({ title, meta }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-base font-semibold text-on-surface">{title}</h2>
      {meta && <span className="text-xs text-outline tabular-nums">{meta}</span>}
    </div>
  );
}

export default function PerfilPage() {
  const { state, myName, board, updateNickname, setSetting, resetAllData, handleLogout, saveError } = useApp();
  const [editingNick, setEditingNick] = useState(false);
  const [nick, setNick] = useState("");
  const [savingNick, setSavingNick] = useState(false);
  const g = gamify(state.stats);

  // Rolagem até a âncora do mascote. O browser não faz isso sozinho aqui: a seção só
  // existe depois do primeiro paint (daí o rAF), e voltar pra MESMA página só troca o
  // hash — sem navegação, sem remount, sem efeito novo (daí o hashchange).
  useEffect(() => {
    const go = () => {
      if (window.location.hash !== "#mascote") return;
      document.getElementById("mascote")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const raf = requestAnimationFrame(go);
    window.addEventListener("hashchange", go);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("hashchange", go);
    };
  }, []);

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
  // agrupa por categoria preservando a ordem de definição
  const badgeGroups = [];
  for (const b of badges) {
    const key = b.group || "Geral";
    let grp = badgeGroups.find((x) => x.key === key);
    if (!grp) badgeGroups.push((grp = { key, items: [] }));
    grp.items.push(b);
  }
  const s = state.stats;

  const goal = state.settings.sleepGoalMin || 450;
  const sleepGoalNights = Object.values(state.sleep || {}).filter((n) => (n?.durationMin || 0) >= goal).length;
  const focusHours = Math.round((s.totalMinutes || 0) / 60);
  const name = myName || "Discípulo";
  const rankIdx = hasSupabase() ? board.findIndex((r) => r.username === myName) : -1;

  const stats = [
    { label: "XP total", value: fmtK(g.xp) },
    { label: "Nível", value: g.level },
    { label: "Sequência", value: s.streak || 0 },
    { label: "Melhor sequência", value: s.bestStreak || 0 },
    { label: "Sessões", value: s.totalSessions || 0 },
    { label: "Horas focadas", value: `${focusHours}h` },
    { label: "Treinos", value: (state.exerciseLogs || []).length },
    { label: "Noites na meta", value: sleepGoalNights },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Perfil" subtitle="Seu nível, o mascote e as preferências da conta." />

      {/* Identidade: avatar, nick, tier e a barra do nível */}
      <section className="rounded-xl border border-outline-variant bg-surface-container p-4 sm:p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-variant text-on-surface-variant">
              <MI name="person" className="text-[26px]" />
            </div>

            <div className="min-w-0 flex-1">
              {editingNick ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={nick}
                    onChange={(e) => setNick(e.target.value)}
                    onKeyDown={(e) => (e.key === "Enter" ? saveNick() : e.key === "Escape" ? setEditingNick(false) : null)}
                    autoFocus
                    maxLength={20}
                    aria-label="Nick"
                    aria-invalid={!!(nick.trim() && !nickValid)}
                    placeholder="seu_nick"
                    className="max-w-[240px]"
                  />
                  <Button size="icon" onClick={saveNick} disabled={savingNick || !nickValid} aria-label="Salvar nick">
                    {savingNick ? <Spinner size={16} /> : <MI name="check" className="text-[18px]" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingNick(false)} aria-label="Cancelar">
                    <MI name="close" className="text-[18px]" />
                  </Button>
                </div>
              ) : (
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="min-w-0 break-all text-lg font-semibold tracking-tight text-on-surface">{name}</h2>
                  {hasSupabase() && (
                    <Button size="icon-sm" variant="ghost" onClick={startNick} aria-label="Editar nick" className="text-outline">
                      <MI name="edit" className="text-[16px]" />
                    </Button>
                  )}
                  <Badge variant="secondary">{g.tier}</Badge>
                </div>
              )}
              {editingNick && nick.trim() && !nickValid && (
                <p className="mt-1 text-xs text-error">3–20 caracteres: letras, números, _ . -</p>
              )}
              <p className="mt-1 text-xs text-outline">
                <span className="tabular-nums">
                  {earned.length}/{badges.length}
                </span>{" "}
                insígnias
                {rankIdx >= 0 && (
                  <>
                    {" · "}
                    <span className="tabular-nums">#{rankIdx + 1}</span> no ranking
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="w-full md:w-72 md:shrink-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium text-on-surface">Nível {g.level}</span>
              <span className="text-outline tabular-nums">
                {g.intoLevel}/{g.toNext} XP · próx. nível {g.level + 1}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
              <div className="h-full rounded-full bg-primary-container" style={{ width: `${g.pct}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* Mascote */}
      <Pet />

      {/* Estatísticas: uma faixa só, dividida por linhas finas (o gap-px deixa o fundo aparecer) */}
      <section>
        <SectionTitle title="Estatísticas" />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-outline-variant bg-outline-variant md:grid-cols-4">
          {stats.map((st) => (
            <div key={st.label} className="bg-surface-container p-4">
              <div className="text-xs text-outline">{st.label}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-on-surface">{st.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Insígnias */}
      <section>
        <SectionTitle title="Insígnias" meta={`${earned.length} de ${badges.length} conquistadas`} />
        <div className="space-y-6">
          {badgeGroups.map((grp) => {
            const got = grp.items.filter((b) => b.earned).length;
            return (
              <div key={grp.key}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-medium text-on-surface-variant">{grp.key}</h3>
                  <span className="text-xs text-outline tabular-nums">
                    {got}/{grp.items.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
                  {grp.items.map((b) => (
                    <div
                      key={b.id}
                      className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:gap-3 ${
                        b.earned ? "border-outline-variant bg-surface-container" : "border-outline-variant/60"
                      }`}
                    >
                      <MI
                        name={b.earned ? b.icon : "lock"}
                        fill={b.earned}
                        className={`mt-0.5 shrink-0 text-[20px] ${b.earned ? "text-on-surface" : "text-outline/70"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-medium leading-tight ${b.earned ? "text-on-surface" : "text-on-surface-variant"}`}>
                          {b.name}
                        </div>
                        <div className="mt-0.5 text-xs leading-snug text-outline">{b.desc}</div>
                        {b.earned ? (
                          <div className="mt-2 text-xs text-on-surface-variant">Conquistada</div>
                        ) : (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-variant">
                              <div className="h-full rounded-full bg-outline" style={{ width: `${b.pct}%` }} />
                            </div>
                            <span className="text-[11px] text-outline tabular-nums">
                              {b.cur}/{b.target}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Preferências: lista de configurações, rótulo à esquerda e controle à direita */}
      <section>
        <SectionTitle title="Preferências" />
        <div className="divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-container">
          <SettingRow label="Tema" desc="Aparência do app.">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={state.settings.mode || DEFAULT_MODE}
              onValueChange={(v) => v && setSetting("mode", v)}
            >
              {MODES.map((m) => (
                <ToggleGroupItem key={m.id} value={m.id} aria-label={m.label}>
                  <MI name={m.icon} className="text-[16px]" />
                  {m.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SettingRow>
          {hasSupabase() && (
            <SettingRow label="Sair da conta" desc="Encerra a sessão neste aparelho.">
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <MI name="logout" className="text-[16px]" /> Sair
              </Button>
            </SettingRow>
          )}
          <SettingRow label="Reiniciar todos os dados" desc="Apaga hábitos, sono, treinos e XP. Pede confirmação antes.">
            <Button variant="destructive" size="sm" onClick={resetAllData}>
              Reiniciar dados
            </Button>
          </SettingRow>
          {saveError && <p className="p-4 text-xs text-error">Não foi possível salvar agora. Progresso pode não persistir.</p>}
        </div>
      </section>
    </div>
  );
}
