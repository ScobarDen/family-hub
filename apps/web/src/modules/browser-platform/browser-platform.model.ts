import { atom, wrap } from "@reatom/core";

import { pushSubscription } from "@family-hub/contract";

import type {
  BrowserPlatform,
  InstallPromptEvent,
  PushPermission,
} from "./browser-platform.types.ts";

const base64Quantum = 4;

// PushManager takes the VAPID key as bytes; the Worker hands it out as base64url.
function keyBytesOf(publicKey: string): Uint8Array<ArrayBuffer> {
  const base64 = publicKey.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / base64Quantum) * base64Quantum, "=");

  return Uint8Array.from(atob(padded), (char) => char.codePointAt(0) ?? 0);
}

function isInstallPrompt(event: Event): event is InstallPromptEvent {
  return "prompt" in event;
}

function isDismissed(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

type ShareWindow = Pick<Window, "alert"> & {
  navigator: {
    share?: (data: ShareData) => Promise<void>;
    clipboard?: Pick<Clipboard, "writeText">;
  };
};

// The system share sheet, or the clipboard where there is none or it fails; a dismissed sheet is
// no failure.
export async function shareOrCopy(
  window: ShareWindow,
  { data, link }: { data: ShareData; link: string },
): Promise<void> {
  const { share, clipboard } = window.navigator;

  try {
    if (share !== undefined) {
      await wrap(share.call(window.navigator, data));

      return;
    }
  } catch (error) {
    if (isDismissed(error)) {
      return;
    }
  }

  await wrap(clipboard?.writeText(link) ?? Promise.resolve());
  window.alert("Ссылка скопирована");
}

async function photoShareOf(window: Window, url: string): Promise<ShareData> {
  const blob = await wrap(fetch(url).then(async (response) => response.blob()));
  const file = new File([blob], "family-hub.jpg", { type: blob.type });

  return window.navigator.canShare({ files: [file] }) ? { files: [file] } : { url };
}

// A photo that cannot be fetched is shared as its link.
async function shareFileIn(window: Window, url: string): Promise<void> {
  const data = await wrap(photoShareOf(window, url).catch(() => ({ url })));

  await wrap(shareOrCopy(window, { data, link: url }));
}

// Chromium fires its install prompt once, early, and only to whoever listens by then.
function installPromptOf(window: Window) {
  const captured = atom<InstallPromptEvent | undefined>(undefined, "browser.installPrompt");

  window.addEventListener(
    "beforeinstallprompt",
    wrap((event: Event) => {
      if (isInstallPrompt(event)) {
        event.preventDefault();
        captured.set(event);
      }
    }),
  );

  return {
    canPromptInstall: () => captured() !== undefined,
    async promptInstall() {
      const prompt = captured();

      if (prompt === undefined) {
        return "dismissed" as const;
      }

      captured.set(undefined);
      await wrap(prompt.prompt());

      const choice = await wrap(prompt.userChoice);

      return choice.outcome;
    },
  };
}

function pushOf(window: Window) {
  const hasPush = "PushManager" in window && "serviceWorker" in window.navigator;

  async function currentSubscription(): Promise<PushSubscription | null> {
    const registration = await wrap(window.navigator.serviceWorker.ready);

    return wrap(registration.pushManager.getSubscription());
  }

  return {
    hasPush,
    pushPermission: (): PushPermission =>
      "Notification" in window ? Notification.permission : "denied",
    requestPushPermission: async (): Promise<PushPermission> =>
      wrap(Notification.requestPermission()),
    async subscribePush(publicKey: string) {
      const registration = await wrap(window.navigator.serviceWorker.ready);
      const subscription = await wrap(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytesOf(publicKey),
        }),
      );

      return pushSubscription.parse(subscription.toJSON());
    },
    async unsubscribePush() {
      const subscription = await wrap(currentSubscription());

      await wrap(subscription?.unsubscribe() ?? Promise.resolve(false));
    },
    async pushSubscription() {
      const subscription = hasPush ? await wrap(currentSubscription()) : null;

      return subscription === null
        ? undefined
        : pushSubscription.safeParse(subscription.toJSON()).data;
    },
  };
}

// Built before the first render, so the install prompt is caught when it comes.
export function reatomBrowserPlatform(window: Window): BrowserPlatform {
  // iPadOS Safari introduces itself as a Mac; only the touch screen gives it away.
  const isIos =
    /iPhone|iPad/u.test(window.navigator.userAgent) ||
    (/Macintosh/u.test(window.navigator.userAgent) && window.navigator.maxTouchPoints > 1);
  const isAndroid = /Android/u.test(window.navigator.userAgent);
  const { hasPush, ...push } = pushOf(window);

  function isStandalone(): boolean {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && window.navigator.standalone === true)
    );
  }

  return {
    isIos,
    isAndroid,
    isStandalone,
    ...installPromptOf(window),
    ...push,
    // iOS pushes only to an app on the home screen.
    pushAvailability: () => {
      if (isIos && !isStandalone()) {
        return "needs-install";
      }

      return hasPush && "Notification" in window ? "available" : "unsupported";
    },
    goTo: (url) => {
      window.location.replace(url);
    },
    shareFile: async (url) => shareFileIn(window, url),
  };
}
