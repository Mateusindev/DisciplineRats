"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, Spinner, inputCls } from "@/components/ui";
import { gamify, fmtK } from "@/lib/state";
import { hasSupabase, fetchMyGroups, createGroup, joinGroup, leaveGroup, deleteGroup, fetchGroupRanking } from "@/lib/persistence";

export default function GruposPage() {
  const { userId, myName, toast, confirm } = useApp();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // group id
  const [ranking, setRanking] = useState(null); // null = carregando
  const [newName, setNewName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!hasSupabase() || !userId) {
      setLoading(false);
      return;
    }
    try {
      const gs = await fetchMyGroups(userId);
      setGroups(gs);
      setSelected((sel) => (sel && gs.some((g) => g.id === sel) ? sel : gs[0]?.id || null));
    } catch (e) {
      toast("Falha ao carregar grupos", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ranking do grupo selecionado
  useEffect(() => {
    if (!selected) {
      setRanking(null);
      return;
    }
    setRanking(null);
    fetchGroupRanking(selected).then(setRanking);
  }, [selected]);

  async function handleCreate() {
    const name = newName.trim();
    if (name.length < 3) {
      toast("Nome do grupo: mínimo 3 caracteres", { type: "error" });
      return;
    }
    setBusy(true);
    const res = await createGroup(name);
    setBusy(false);
    if (!res.ok) {
      toast("Falha ao criar grupo", { type: "error" });
      return;
    }
    setNewName("");
    toast("Grupo criado", { sub: `CONVITE: ${res.group.invite_code}`, icon: "groups" });
    await reload();
    setSelected(res.group.id);
  }

  async function handleJoin() {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    const res = await joinGroup(c);
    setBusy(false);
    if (!res.ok) {
      toast("Convite inválido", { type: "error" });
      return;
    }
    setCode("");
    toast("Você entrou no grupo", { sub: (res.group?.name || "").toUpperCase(), icon: "groups" });
    await reload();
    if (res.group?.id) setSelected(res.group.id);
  }

  async function handleLeave(g) {
    const ok = await confirm({
      title: `Sair de "${g.name}"?`,
      body: "Se voltar depois, seu XP no grupo recomeça do zero.",
      confirmLabel: "SAIR",
    });
    if (!ok) return;
    if (await leaveGroup(g.id, userId)) {
      toast("Você saiu do grupo");
      reload();
    } else toast("Falha ao sair", { type: "error" });
  }

  async function handleDelete(g) {
    const ok = await confirm({
      title: `Excluir "${g.name}"?`,
      body: "O grupo some pra todos os membros. Não dá pra desfazer.",
      confirmLabel: "EXCLUIR",
    });
    if (!ok) return;
    if (await deleteGroup(g.id)) {
      toast("Grupo excluído");
      reload();
    } else toast("Falha ao excluir", { type: "error" });
  }

  function copyInvite(g) {
    navigator.clipboard?.writeText(g.inviteCode).then(
      () => toast("Convite copiado", { sub: g.inviteCode, icon: "content_copy" }),
      () => toast("Falha ao copiar", { type: "error" })
    );
  }

  if (!hasSupabase()) {
    return (
      <div className="glass-card p-8 rounded-xl text-center text-on-surface-variant">
        Grupos precisam de conta. Configure o Supabase e faça login.
      </div>
    );
  }

  const sel = groups.find((g) => g.id === selected);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-headline-lg text-headline-lg text-primary uppercase">Grupos</h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          Compita com seus amigos. Todo mundo entra no nível 1 com 0 XP — só conta o que você faz depois de entrar.
        </p>
      </section>

      {/* criar / entrar */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <div className="glass-card p-6 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <MI name="add_circle" className="text-primary-container" />
            <h3 className="font-headline-md text-headline-md text-primary">CRIAR GRUPO</h3>
          </div>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Nome do grupo (ex.: Ratos da Academia)"
              maxLength={40}
              className={`${inputCls} flex-1`}
            />
            <button onClick={handleCreate} disabled={busy} className="px-4 rounded-lg bg-primary-container text-on-primary-container flex items-center active:scale-95 transition disabled:opacity-50">
              {busy ? <Spinner size={16} /> : <MI name="add" />}
            </button>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <MI name="key" className="text-primary-container" />
            <h3 className="font-headline-md text-headline-md text-primary">ENTRAR COM CONVITE</h3>
          </div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="Código (ex.: A1B2C3)"
              maxLength={6}
              className={`${inputCls} flex-1 uppercase tracking-widest`}
            />
            <button onClick={handleJoin} disabled={busy} className="px-4 rounded-lg bg-primary-container text-on-primary-container flex items-center active:scale-95 transition disabled:opacity-50">
              {busy ? <Spinner size={16} /> : <MI name="login" />}
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size={32} />
        </div>
      ) : groups.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center text-on-surface-variant">
          Você ainda não está em nenhum grupo. Crie um ou peça o código a um amigo.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          {/* lista de grupos */}
          <div className="lg:col-span-4 space-y-3">
            {groups.map((g) => {
              const active = g.id === selected;
              const isOwner = g.owner === userId;
              return (
                <button
                  key={g.id}
                  onClick={() => setSelected(g.id)}
                  className={`w-full text-left glass-card p-4 rounded-xl border transition-colors ${
                    active ? "border-primary-container/50 bg-primary/5" : "border-white/5 hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MI name="groups" className={active ? "text-primary-container" : "text-outline"} />
                    <span className="font-headline-md text-headline-md text-on-surface truncate flex-1">{g.name}</span>
                    {isOwner && <MI name="star" fill className="text-primary-container text-base" title="Você é o dono" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* detalhe do grupo */}
          {sel && (
            <div className="lg:col-span-8 space-y-gutter">
              <div className="glass-card p-6 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between mb-6">
                  <h3 className="font-headline-md text-headline-md text-primary uppercase">{sel.name}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyInvite(sel)}
                      className="px-3 py-2 rounded-lg bg-surface-container-high border border-white/10 flex items-center gap-2 font-label-caps text-[11px] text-on-surface hover:border-primary-container/40 active:scale-95 transition"
                    >
                      <MI name="content_copy" className="text-base" /> {sel.inviteCode}
                    </button>
                    {sel.owner === userId ? (
                      <button onClick={() => handleDelete(sel)} aria-label="Excluir grupo" className="text-outline hover:text-error transition p-2">
                        <MI name="delete" />
                      </button>
                    ) : (
                      <button onClick={() => handleLeave(sel)} aria-label="Sair do grupo" className="text-outline hover:text-error transition p-2">
                        <MI name="logout" />
                      </button>
                    )}
                  </div>
                </div>

                {ranking === null ? (
                  <div className="flex justify-center py-8">
                    <Spinner size={28} />
                  </div>
                ) : ranking.length === 0 ? (
                  <p className="text-[13px] text-outline text-center py-6">Sem membros ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {ranking.map((r, i) => {
                      const me = r.username === myName;
                      const g = gamify({ xp: r.xp });
                      return (
                        <div
                          key={r.username + i}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            me ? "bg-primary-container/10 border-primary-container/30" : "bg-surface-container-high border-white/5"
                          }`}
                        >
                          <span className={`font-headline-md text-headline-md w-8 text-center ${i === 0 ? "text-primary-container" : "text-outline"}`}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-[14px] font-bold truncate ${me ? "text-primary" : "text-on-surface"}`}>
                              {me ? "VOCÊ" : r.username}
                              {r.is_owner && <MI name="star" fill className="text-primary-container text-sm align-middle ml-1" />}
                            </div>
                            <Caps className="text-outline text-[10px]">NÍVEL {g.level} · {g.tier}</Caps>
                          </div>
                          <Caps className={me ? "text-primary" : "text-on-surface-variant"}>{fmtK(r.xp)} XP</Caps>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="text-[12px] text-outline">
                Compartilhe o código <span className="text-primary-container font-bold">{sel.inviteCode}</span> pra chamar os amigos. O XP do grupo conta a partir da entrada de cada um.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
