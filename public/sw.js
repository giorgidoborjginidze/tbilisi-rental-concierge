// Activo's service worker: only the owner's notifications (lib/notify/owner.ts).
// No caching, no offline pages — the app always loads fresh from the server.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let note = {};
  try {
    note = event.data ? event.data.json() : {};
  } catch {
    note = { title: "Activo", body: event.data ? event.data.text() : "" };
  }
  const title = note.title || "Activo";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: note.body || "",
      tag: note.tag || undefined,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: typeof note.url === "string" && note.url.startsWith("/") ? note.url : "/alerts" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/alerts", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // An open Activo tab is reused; otherwise a new one opens.
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus().then((focused) => (focused && "navigate" in focused ? focused.navigate(url) : focused));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
