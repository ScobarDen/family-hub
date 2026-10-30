// Push, opening the app from one and answering its buttons; nothing is cached here (ADR 0012
// keeps the device cache). The worker has no session: a Push's buttons and a replaced
// subscription carry their own proof (ADR 0016).
const apiUrl = new URL(self.location.href).searchParams.get("api") ?? self.location.origin;

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

const icon = new URL("icons/icon-192.png", self.registration.scope).href;

// iOS shows no buttons; there a Push only opens what it is about.
function actionsOf(pressToken) {
  return typeof pressToken === "string"
    ? [
        { action: "done", title: "Готово" },
        { action: "snooze", title: "Отложить" },
      ]
    : [];
}

// The same tag replaces the Reminder's earlier Push; renotify makes the replacement ring again.
self.addEventListener("push", (event) => {
  const message = event.data === null ? { title: "Домовой", body: "", tag: "" } : event.data.json();
  const url = urlOf(message.startParam);

  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon,
      ...(message.tag === "" ? {} : { tag: message.tag, renotify: true }),
      actions: actionsOf(message.pressToken),
      data: { url, pressToken: message.pressToken },
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

const notPressedText = "Не получилось отметить, откройте приложение";
const refusedStatus = 409;

// Nothing when the press did what it says, or what the Worker refused it with, such as «Уже
// сделано» after «Готово» on another Device.
async function refusalOf(token, action) {
  try {
    const response = await fetch(new URL("/api/reminders/press", apiUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, action }),
    });

    if (response.ok) {
      return null;
    }

    const { message } = await response.json();

    return response.status === refusedStatus && typeof message === "string"
      ? message
      : notPressedText;
  } catch {
    return notPressedText;
  }
}

// A press that did not go through leaves a Push that opens the app, where it can be done by hand.
async function press(notification, action) {
  notification.close();

  const refusal = await refusalOf(notification.data.pressToken, action);

  if (refusal === null) {
    return;
  }

  await self.registration.showNotification(notification.title, {
    body: refusal,
    icon,
    tag: notification.tag,
    data: { url: notification.data.url },
  });
}

self.addEventListener("notificationclick", (event) => {
  if (event.action === "done" || event.action === "snooze") {
    event.waitUntil(press(event.notification, event.action));

    return;
  }

  event.notification.close();
  event.waitUntil(openApp(event.notification.data.url));
});

// Without the old subscription there is nothing to prove the Device with; the app saves the new
// one at its next launch instead.
async function rotate(previous, next) {
  if (previous === null || previous === undefined) {
    return;
  }

  const subscription = next ?? (await self.registration.pushManager.subscribe(previous.options));

  await fetch(new URL("/api/push/rotation", apiUrl), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ oldEndpoint: previous.endpoint, subscription: subscription.toJSON() }),
  });
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    rotate(event.oldSubscription, event.newSubscription).catch((error) => {
      console.error("Push subscription not rotated", error);
    }),
  );
});
