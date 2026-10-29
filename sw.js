// yaparmi.com servis çalışanı: uygulama olarak yüklenebilsin ve bildirime tıklanınca site açılsın.
// Önbellek tutmuyor (her şey her zaman güncel gelsin), sadece ağdan getiriyor.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* ağdan normal şekilde gelir */ });
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const hedef = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const p of pencereler) {
      if ("focus" in p) { await p.focus(); if ("navigate" in p) await p.navigate(hedef); return; }
    }
    if (self.clients.openWindow) await self.clients.openWindow(hedef);
  })());
});
