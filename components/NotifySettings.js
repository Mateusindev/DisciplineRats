"use client";

// Card de lembrete da agenda. Ele diz na cara o que funciona e o que não:
// notificação com o app fechado depende do push do servidor, e no iOS depende
// de estar instalado na tela de início. Prometer o que não vai chegar é pior
// que não ter o recurso.

import { useEffect, useState } from "react";
import { MI, Caps } from "@/components/ui";
import { NOTIFY_LEAD_OPTIONS, agendaReminders } from "@/lib/state";
import { ensureNotifyPermission, notify, notifySupport, getPushSubscription, subscribePush, unsubscribePush } from "@/lib/notify";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export default function NotifySettings({ state, setSetting, toast, onSaveSubscription }) {
  const [support, setSupport] = useState(null); // só no cliente: depende de navigator
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupport(notifySupport());
    getPushSubscription().then((s) => setPushOn(!!s));
  }, []);

  const on = !!state.settings?.notifyAgenda;
  const lead = state.settings?.notifyLeadMin ?? 15;
  const next = agendaReminders(state, { leadMin: lead, horizonDays: 7 }).slice(0, 3);

  async function toggle() {
    if (on) {
      setSetting("notifyAgenda", false);
      return toast("Lembretes desligados", { icon: "notifications_off" });
    }
    setBusy(true);
    // a permissão SÓ é concedida dentro do gesto do usuário — daí ser aqui
    const okPerm = await ensureNotifyPermission();
    if (!okPerm) {
      setBusy(false);
      setSupport(notifySupport());
      return toast("Permissão negada", { sub: "Libere as notificações nos ajustes do navegador", type: "error" });
    }
    // assina o push na mesma ação: sem isso, nada chega com o app fechado
    if (VAPID) {
      const sub = await subscribePush(VAPID);
      if (sub) {
        setPushOn(true);
        await onSaveSubscription?.(sub);
      }
    }
    setSetting("notifyAgenda", true);
    setSupport(notifySupport());
    setBusy(false);
    toast("Lembretes ligados", { sub: `Aviso ${lead} min antes`, icon: "notifications_active" });
  }

  async function test() {
    const okPerm = await ensureNotifyPermission();
    if (!okPerm) return toast("Permissão negada", { type: "error" });
    const sent = await notify("Teste da agenda", "Se você está lendo isso no celular, o caminho funciona.", {
      tag: "agenda-teste",
      url: "/calendario",
    });
    toast(sent ? "Notificação enviada" : "Não foi possível enviar", { type: sent ? "success" : "error", icon: "notifications" });
  }

  async function dropPush() {
    setBusy(true);
    await unsubscribePush();
    setPushOn(false);
    await onSaveSubscription?.(null);
    setBusy(false);
    toast("Push removido deste aparelho", { icon: "notifications_off" });
  }

  // ---- estados em que nem faz sentido oferecer o toggle ----
  if (!support) return null; // primeira pintura no cliente
  if (support.reason === "ios-precisa-instalar") {
    return (
      <div className="glass-card rounded-xl p-4 flex items-start gap-3">
        <MI name="ios_share" className="text-primary shrink-0" />
        <div className="min-w-0">
          <Caps className="text-on-surface text-[11px] block">INSTALE PRA RECEBER LEMBRETE</Caps>
          <p className="text-[12px] text-on-surface-variant mt-1">
            No iPhone, notificação só funciona com o site instalado na tela de início: <strong className="font-semibold">Compartilhar → Adicionar à Tela de
            Início</strong>, e abrir por lá. Em aba do Safari o iOS não deixa, nem pede permissão.
          </p>
        </div>
      </div>
    );
  }
  if (!support.ok) {
    return (
      <div className="glass-card rounded-xl p-4 flex items-start gap-3">
        <MI name="notifications_off" className="text-outline shrink-0" />
        <p className="text-[12px] text-on-surface-variant">Este navegador não suporta notificação. Em celular, instale o app pela tela de início.</p>
      </div>
    );
  }

  const denied = support.permission === "denied";

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Caps className="text-on-surface text-[11px] flex items-center gap-1.5">
            <MI name={on ? "notifications_active" : "notifications"} className="text-base text-primary" />
            LEMBRETE NO CELULAR
          </Caps>
          <p className="text-[12px] text-on-surface-variant mt-1">
            Avisa antes de cada evento com hora marcada. Evento de dia inteiro não avisa — sem hora não existe "15 minutos antes".
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={test} className="px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high font-label-caps text-[10px] transition">
            TESTAR
          </button>
          <button
            onClick={toggle}
            disabled={busy || denied}
            role="switch"
            aria-checked={on}
            className={`w-12 h-7 rounded-full p-1 shrink-0 transition-colors disabled:opacity-40 ${on ? "bg-primary-container" : "bg-surface-variant"}`}
          >
            <span className={`block w-5 h-5 rounded-full bg-on-primary-container transition-transform ${on ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>

      {denied && (
        <p className="text-[11px] text-error mt-2">
          Você negou a permissão neste aparelho. Libere nos ajustes do navegador (ou do app, se instalado) e volte aqui.
        </p>
      )}

      {on && (
        <>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Caps className="text-outline text-[10px]">AVISAR</Caps>
            {NOTIFY_LEAD_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setSetting("notifyLeadMin", m)}
                aria-pressed={lead === m}
                className={`px-2.5 py-1 rounded-full font-label-caps text-[10px] border transition ${
                  lead === m ? "bg-primary-container text-on-primary-container border-primary-container" : "border-white/10 text-outline hover:border-white/25"
                }`}
              >
                {m === 0 ? "NA HORA" : `${m} MIN`}
              </button>
            ))}
            {lead > 0 && <Caps className="text-outline text-[10px]">ANTES</Caps>}
          </div>

          {/* o que o usuário precisa saber pra não achar que está quebrado */}
          <div className="mt-3 rounded-lg border border-white/10 p-3 space-y-1.5">
            <Caps className="text-outline text-[10px] block">ONDE ISSO CHEGA</Caps>
            <p className="text-[11px] text-on-surface-variant flex items-start gap-1.5">
              <MI name="check" className="text-[14px] text-primary shrink-0 mt-px" />
              <span><strong className="font-semibold">Com o app aberto</strong>: funciona agora, sem depender de mais nada.</span>
            </p>
            <p className="text-[11px] text-on-surface-variant flex items-start gap-1.5">
              <MI name={pushOn ? "check" : "priority_high"} className={`text-[14px] shrink-0 mt-px ${pushOn ? "text-primary" : "text-error"}`} />
              <span>
                <strong className="font-semibold">Com o app fechado</strong>:{" "}
                {pushOn
                  ? "este aparelho está assinado no push."
                  : VAPID
                    ? "este aparelho ainda não assinou o push — desligue e ligue o lembrete de novo."
                    : "falta configurar o servidor de push (chave VAPID e a função que dispara). Sem isso, só chega com o app aberto."}
              </span>
            </p>
            {pushOn && (
              <button onClick={dropPush} disabled={busy} className="font-label-caps text-[10px] text-outline hover:text-error transition">
                REMOVER PUSH DESTE APARELHO
              </button>
            )}
          </div>

          {next.length > 0 && (
            <div className="mt-3">
              <Caps className="text-outline text-[10px] block mb-1">PRÓXIMOS AVISOS</Caps>
              <div className="space-y-0.5">
                {next.map((r) => (
                  <p key={r.key} className="text-[11px] text-on-surface-variant tabular-nums">
                    {r.fireAt.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} ·{" "}
                    <span className="text-on-surface">{r.title}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
