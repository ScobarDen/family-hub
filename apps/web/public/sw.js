// Push and opening the app from one; nothing is cached here (ADR 0012 keeps the device cache).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function urlOf(startParameter) {
  const target = new URL("./", self.registration.scope);

  if (typeof startParameter === "string" && startParameter !== "") {
    target.searchParams.set("open", startParameter);
  }

  return target.href;
}

self.addEventListener("push", (event) => {
  const message = event.data === null ? { text: "" } : event.data.json();

  event.waitUntil(
    self.registration.showNotification("Домовой", {
      body: message.text,
      icon: new URL("icons/icon-192.png", self.registration.scope).href,
      data: { url: urlOf(message.startParam) },
    }),
  );
});

async function openApp(url) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const open = windows.find((client) => client.url.startsWith(self.registration.scope));

  if (open === undefined) {
    await self.clients.openWindow(url);

    return;
  }

  await open.focus();
  await open.navigate(url);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openApp(event.notification.data.url));
});
