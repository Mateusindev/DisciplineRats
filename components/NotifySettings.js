"use client";

// Card de lembrete da agenda. Enxuto: um interruptor e a antecedência.
//
// O único aviso que sobrou é o do caso em que a notificação NÃO vai chegar com o
// app fechado. Ligar o interruptor e não receber nada é pior que uma linha a mais
// na tela — e essa linha some sozinha quando está tudo certo.

import { useEffect, useState } from "react";
import { MI, Caps } from "@/components/ui";
import { NOTIFY_LEAD_OPTIONS } from "@/lib/state";
import { ensureNotifyPermission, notifySupport, getPushSubscription, subscribePush } from "@/lib/notify";

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
      <div className="glass-card rounded-xl p-4 flex items-start gap-3">
        <MI name="ios_share" className="text-primary shrink-0" />
        <div className="min-w-0">
          <Caps className="text-on-surface text-[11px] block">INSTALE PRA RECEBER LEMBRETE</Caps>
          <p className="text-[12px] text-on-surface-variant mt-1">
            No iPhone, notificação só funciona com o site instalado na tela de início: <strong className="font-semibold">Compartilhar → Adicionar à Tela de
            Início</strong>, e abrir por lá.
          </p>
        </div>
      </div>
    );
  }
  if (!support.ok) return null;

  const denied = support.permission === "denied";

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Caps className="text-on-surface text-[11px] flex items-center gap-1.5">
            <MI name={on ? "notifications_active" : "notifications"} className="text-base text-primary" />
            LEMBRETE NO CELULAR
          </Caps>
          <p className="text-[12px] text-on-surface-variant mt-1">Avisa antes de cada evento com hora marcada.</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* a antecedência só aparece com o lembrete ligado: desligado ela não
              configura nada e só ocupa espaço */}
          {on && (
            <div className="flex items-center gap-1">
              {NOTIFY_LEAD_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setSetting("notifyLeadMin", m)}
                  aria-pressed={lead === m}
                  title={m === 0 ? "Na hora do evento" : `${m} minutos antes`}
                  className={`px-2 py-1 rounded-full font-label-caps text-[10px] transition ${
                    lead === m ? "bg-primary-container text-on-primary-container" : "text-outline hover:text-on-surface"
                  }`}
                >
                  {m === 0 ? "0" : m}
                </button>
              ))}
              <Caps className="text-outline text-[9px] ml-0.5">MIN ANTES</Caps>
            </div>
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
