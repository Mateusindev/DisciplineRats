// Notificações de sistema (mobile/desktop) via Service Worker.
// Android Chrome exige reg.showNotification (new Notification() não funciona lá);
// iOS só notifica em PWA instalado (Add to Home Screen, iOS 16.4+).

export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

// Pede permissão (chamar em gesto do usuário, ex.: iniciar o timer). Idempotente.
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

export async function notify(title, body) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: "pomodoro", // substitui a anterior em vez de empilhar
        renotify: true,
        vibrate: [200, 100, 200],
      });
    } else {
      new Notification(title, { body, icon: "/icon.svg" });
    }
  } catch (e) {}
}
