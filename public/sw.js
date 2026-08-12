// Service worker: habilita showNotification (Android exige SW), recebe push do
// servidor (é o que faz o lembrete chegar com o app FECHADO) e foca o app no clique.
//
// Sem cache de assets de propósito: o app é online-only (fala direto com o
// Supabase), e um cache mal configurado serviria versão velha depois do deploy.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Push do servidor. O payload vem como JSON { title, body, url, tag }.
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (err) {
    d = { body: e.data?.text?.() || "" };
  }
  const title = d.title || "Discipline Rats";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: d.tag || "agenda",
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: d.url || "/calendario" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/foco";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          // já tem janela aberta: foca e navega, em vez de abrir uma segunda
          if ("navigate" in c) c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
