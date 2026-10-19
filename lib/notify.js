// Notificações de sistema (mobile/desktop) via Service Worker.
//
// Dois caminhos, e a diferença importa:
//
//   LOCAL (notify) — a página manda a notificação. Só funciona enquanto o app
//   está aberto (ou, no Android, poucos minutos depois de sair). Serve pro
//   pomodoro, que roda com o app na frente.
//
//   PUSH (subscribePush) — o servidor manda, e chega com o app FECHADO. É o
//   único jeito de lembrete de agenda funcionar de verdade. Exige VAPID e alguém
//   pra disparar na hora certa (ver supabase/functions/agenda-reminders).
//
// Android Chrome exige reg.showNotification (new Notification() não funciona lá).
// iOS: só em PWA instalado pela tela de início (iOS 16.4+), e a permissão só é
// concedida dentro de um gesto do usuário — nunca peça no carregamento.

import { HOME_ROUTE } from "@/lib/state";

export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

// Pede permissão (chamar em gesto do usuário). Idempotente.
export async function ensureNotifyPermission() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch (e) {
    return false;
  }
}

// `tag` agrupa/substitui: sem tag distinta, um lembrete de agenda apagaria a
// notificação do pomodoro (e vice-versa) em vez de conviver com ela.
export async function notify(title, body, { tag = "geral", url = HOME_ROUTE, data } = {}) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag,
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url, ...(data || {}) },
      });
      return true;
    }
    new Notification(title, { body, icon: "/icons/icon-192.png" });
    return true;
  } catch (e) {
    return false;
  }
}

// ---- diagnóstico: a UI precisa poder dizer POR QUE não vai funcionar ----
export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

// O que este aparelho consegue fazer, e o motivo quando não consegue.
export function notifySupport() {
  if (typeof window === "undefined") return { ok: false, reason: "ssr" };
  const hasSW = "serviceWorker" in navigator;
  const hasNotif = typeof Notification !== "undefined";
  const hasPush = typeof window.PushManager !== "undefined";
  if (!hasSW || !hasNotif) return { ok: false, push: false, reason: "browser" };
  // iOS só expõe PushManager em PWA instalado — em aba do Safari nem aparece
  if (isIOS() && !isStandalone()) return { ok: false, push: false, reason: "ios-precisa-instalar" };
  return { ok: true, push: hasPush, permission: Notification.permission, standalone: isStandalone() };
}

// ---- push (app fechado) ----
function urlB64ToUint8Array(base64) {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function getPushSubscription() {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager?.getSubscription()) || null;
  } catch (e) {
    return null;
  }
}

// Assina o push. Devolve a subscription em JSON (endpoint + chaves) pra guardar
// no servidor, ou null se não deu. Chamar dentro de gesto do usuário.
export async function subscribePush(vapidPublicKey) {
  try {
    if (!vapidPublicKey) return null;
    if (!(await ensureNotifyPermission())) return null;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return null;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing.toJSON();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true, // exigido pelos navegadores; push silencioso não passa
      applicationServerKey: urlB64ToUint8Array(vapidPublicKey),
    });
    return sub.toJSON();
  } catch (e) {
    return null;
  }
}

export async function unsubscribePush() {
  try {
    const sub = await getPushSubscription();
    if (sub) await sub.unsubscribe();
    return true;
  } catch (e) {
    return false;
  }
}
