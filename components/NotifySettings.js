"use client";

// Controle de lembrete da agenda. Um botão de campainha, e só.
//
// Isto já foi um card com título, descrição e aviso. Ocupava uma faixa inteira acima
// da grade da semana pra configurar UMA coisa — e a informação que ele exibia era a
// mesma toda vez, então lida uma vez virou ruído permanente. O que sobrou: a
// campainha (o próprio interruptor, com o estado na cor e no ícone) e a antecedência,
// que só aparece quando o lembrete está ligado. Todo o resto — inclusive o aviso de
// "só chega com o app aberto" — vive no `title`, onde não custa pixel nenhum.
//
// Sem card: o componente devolve os controles soltos, e quem chama encaixa na barra
// de ações que já existe.

import { useEffect, useState } from "react";
import { MI } from "@/components/ui";
import { NOTIFY_LEAD_OPTIONS } from "@/lib/state";
import { ensureNotifyPermission, notifySupport, getPushSubscription, subscribePush } from "@/lib/notify";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

const leadLabel = (m) => (m === 0 ? "na hora" : `${m} min antes`);
const btn = "h-9 rounded-lg border flex items-center gap-1 transition font-label-caps text-[10px]";

export default function NotifySettings({ state, setSetting, toast, onSaveSubscription }) {
  const [support, setSupport] = useState(null); // só no cliente: depende de navigator
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);

  useEffect(() => {
    setSupport(notifySupport());
    getPushSubscription().then((s) => setPushOn(!!s));
  }, []);

  const on = !!state.settings?.notifyAgenda;
  const lead = state.settings?.notifyLeadMin ?? 15;

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
    toast("Lembretes ligados", { sub: `Aviso ${leadLabel(lead)}`, icon: "notifications_active" });
  }

  if (!support) return null; // primeira pintura no cliente

  // iOS fora de PWA não tem como notificar. Um ícone que explica ao toque, em vez de
  // um bloco de texto que explica pra sempre.
  if (support.reason === "ios-precisa-instalar")
    return (
      <button
        onClick={() => toast("Lembrete pede o app instalado", { sub: "Compartilhar → Adicionar à Tela de Início, e abrir por lá", icon: "ios_share" })}
        title="Lembrete no iPhone pede o app instalado na tela de início"
        aria-label="Por que não há lembrete neste aparelho"
        className={`${btn} w-9 justify-center border-outline-variant text-outline hover:text-on-surface-variant`}
      >
        <MI name="ios_share" className="text-[18px]" />
      </button>
    );

  if (!support.ok) return null;

  const denied = support.permission === "denied";
  const tip = denied
    ? "Permissão de notificação negada neste aparelho — libere nos ajustes do navegador"
    : !on
      ? "Lembrete de evento no celular: desligado"
      : pushOn
        ? `Avisa ${leadLabel(lead)} de cada evento com hora marcada`
        : `Avisa ${leadLabel(lead)} — só com o app aberto: este aparelho não está assinado no push`;

  return (
    <>
      <button
        onClick={toggle}
        disabled={busy || denied}
        role="switch"
        aria-checked={on}
        aria-label="Lembrete no celular"
        title={tip}
        className={`${btn} w-9 justify-center disabled:opacity-40 ${
          on
            ? pushOn
              ? "border-primary/40 text-primary bg-primary/10"
              : "border-primary/25 text-primary/70 bg-primary/5" // ligado sem push: aceso, mas sem promessa cheia
            : "border-outline-variant text-outline hover:text-on-surface-variant"
        }`}
      >
        <MI name={on ? "notifications_active" : "notifications_off"} fill={on} className="text-[18px]" />
      </button>

      {on && !denied && (
        <div className="relative">
          <button
            onClick={() => setLeadOpen((v) => !v)}
            aria-expanded={leadOpen}
            aria-label="Antecedência do aviso"
            title="Antecedência do aviso"
            className={`${btn} px-2.5 border-outline-variant text-on-surface-variant hover:bg-surface-container-high tabular-nums`}
          >
            {lead === 0 ? "NA HORA" : `${lead} MIN`}
            <MI name="expand_more" className="text-sm" />
          </button>
          {leadOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setLeadOpen(false)} />
              <ul className="absolute left-0 top-full mt-1 z-40 w-32 rounded-lg border border-outline-variant bg-surface-container-highest py-1 shadow-xl shadow-black/40 animate-[fadeIn_.1s_ease-out]">
                {NOTIFY_LEAD_OPTIONS.map((m) => (
                  <li key={m}>
                    <button
                      onClick={() => {
                        setSetting("notifyLeadMin", m);
                        setLeadOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-[12px] transition ${m === lead ? "text-primary" : "text-on-surface hover:bg-surface-variant/50"}`}
                    >
                      {leadLabel(m)}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}
