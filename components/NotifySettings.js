"use client";

// Card de lembrete da agenda. UMA LINHA: interruptor e antecedência, nada mais.
//
// Ele mora acima da grade da semana, então cada pixel que ocupa é pixel que a agenda
// perde — e no celular isso custava metade da primeira tela. A descrição em prosa só
// aparece a partir do sm, a antecedência é um seletor (que diz "15 min antes" por
// escrito) em vez de seis chips que quebravam em duas linhas, e o título encurta pra
// "LEMBRETE" no estreito.
//
// O único aviso que sobrou é o do caso em que a notificação NÃO vai chegar com o
// app fechado. Ligar o interruptor e não receber nada é pior que uma linha a mais
// na tela — e essa linha some sozinha quando está tudo certo.

import { useEffect, useState } from "react";
import { MI, Caps, Select } from "@/components/ui";
import { NOTIFY_LEAD_OPTIONS } from "@/lib/state";
import { ensureNotifyPermission, notifySupport, getPushSubscription, subscribePush } from "@/lib/notify";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// Rótulo por escrito em vez de número solto: "15" sozinho não diz de quê.
const LEAD_OPTS = NOTIFY_LEAD_OPTIONS.map((m) => ({ value: m, label: m === 0 ? "na hora" : `${m} min antes` }));

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

  // ---- estados em que nem faz sentido oferecer o interruptor ----
  if (!support) return null; // primeira pintura no cliente
  if (support.reason === "ios-precisa-instalar") {
    return (
      <div className="glass-card rounded-xl p-3 sm:p-4 flex items-start gap-2.5">
        <MI name="ios_share" className="text-primary text-base shrink-0 mt-0.5" />
        <p className="min-w-0 text-[12px] leading-snug text-on-surface-variant">
          <span className="text-on-surface font-semibold">Lembrete no iPhone pede o app instalado.</span>{" "}
          Compartilhar → Adicionar à Tela de Início, e abrir por lá.
        </p>
      </div>
    );
  }
  if (!support.ok) return null;

  const denied = support.permission === "denied";

  return (
    <div className="glass-card rounded-xl px-3 py-2.5 sm:p-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <MI name={on ? "notifications_active" : "notifications"} className="text-base text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <Caps className="text-on-surface text-[11px] block truncate">
            <span className="sm:hidden">LEMBRETE</span>
            <span className="hidden sm:inline">LEMBRETE NO CELULAR</span>
          </Caps>
          <p className="hidden sm:block text-[12px] text-on-surface-variant mt-0.5">Avisa antes de cada evento com hora marcada.</p>
        </div>

        {/* a antecedência só aparece com o lembrete ligado: desligado ela não
            configura nada e só ocupa espaço */}
        {on && (
          <Select
            value={lead}
            options={LEAD_OPTS}
            onChange={(v) => setSetting("notifyLeadMin", v)}
            className="w-[7.5rem] sm:w-36 shrink-0"
          />
        )}

        <button
          onClick={toggle}
          disabled={busy || denied}
          role="switch"
          aria-checked={on}
          aria-label="Lembrete no celular"
          className={`w-12 h-7 rounded-full p-1 shrink-0 transition-colors disabled:opacity-40 ${on ? "bg-primary-container" : "bg-surface-variant"}`}
        >
          <span className={`block w-5 h-5 rounded-full bg-on-primary-container transition-transform ${on ? "translate-x-5" : ""}`} />
        </button>
      </div>

      {denied && (
        <p className="text-[11px] text-error mt-2">
          Permissão negada neste aparelho. Libere nos ajustes do navegador e volte aqui.
        </p>
      )}

      {/* Único aviso que sobrou, e só quando é verdade: ligado mas sem push
          assinado significa que nada chega com o app fechado. */}
      {on && !pushOn && (
        <p className="text-[11px] text-outline mt-2 flex items-start gap-1.5">
          <MI name="info" className="text-[14px] shrink-0 mt-px" />
          Só chega com o app aberto — este aparelho não está assinado no push.
        </p>
      )}
    </div>
  );
}
