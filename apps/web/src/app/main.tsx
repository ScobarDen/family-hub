import { noop } from "@reatom/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { deviceTimeZone } from "@/common/format-date.lib.ts";
import { reatomBrowserPlatform } from "@/modules/browser-platform";
import { openLiveSocket } from "@/modules/live-updates";
import { followInstalledApp, reatomBrowserWebApp, reatomTelegram } from "@/modules/telegram";
import { slideScreens } from "@/modules/ui";

import { reatomApp } from "./app.vm.ts";
import { App } from "./view/app.view.tsx";

const root = document.getElementById("root");

if (!root) {
  throw new Error("#root is missing from index.html");
}

// Outside Telegram this is the Installed App: the browser serves the Telegram wrapper's interface.
const browser = window.Telegram.WebApp.initData === "" ? reatomBrowserWebApp(window) : undefined;

// Built first: it reads the launch params before the first navigation rewrites the URL.
const telegram = reatomTelegram(browser?.webApp ?? window.Telegram.WebApp);
const apiUrl = import.meta.env.VITE_API_URL ?? window.location.origin;
const app = reatomApp({
  telegram,
  platform: browser && reatomBrowserPlatform(window),
  apiUrl,
  fetch: async (input, init) => fetch(input, init),
  page: document,
  storage: window.localStorage,
  liveClientId: crypto.randomUUID(),
  openSocket: openLiveSocket,
  wait: async (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
  slide: slideScreens,
  base: import.meta.env.BASE_URL,
  botUsername: import.meta.env.VITE_BOT_USERNAME,
  installUrl: new URL(`${import.meta.env.BASE_URL}install.html`, window.location.origin).href,
  deviceZone: deviceTimeZone,
  zones: Intl.supportedValuesOf("timeZone"),
});

telegram.followColorScheme(document.documentElement);
telegram.followPlatform(document.documentElement);

if (browser) {
  followInstalledApp(document);
}

app.launch();

// A static service worker reads no build env, so it learns where the API is from its own URL.
if (browser !== undefined) {
  navigator.serviceWorker
    ?.register(`${import.meta.env.BASE_URL}sw.js?api=${encodeURIComponent(apiUrl)}`)
    .catch(noop);
}

createRoot(root).render(
  <StrictMode>
    <App {...app.home} familyRequest={app.familyRequest} joinFamily={app.joinFamily} />
  </StrictMode>,
);
