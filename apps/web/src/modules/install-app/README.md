# install-app

The install page of the Installed App: what «Установить как приложение» in the Mini App's Profile opens in the device's own browser, since Telegram's in-app browser cannot install apps. It lives at `install` under the site's base and needs no sign-in.

- **Chromium** (Android, desktop Chrome and Edge) — the browser's own install prompt from one button, once `beforeinstallprompt` was captured; after «Установить» the page offers to open the app.
- **iOS Safari** — Safari has no prompt, so the page shows the steps «Поделиться → На экран Домой».
- **Anything else** — says plainly that this browser does not install apps.
- **Already installed** — opened in standalone mode, the page goes straight into the app.

## Injected

- `platform` — `BrowserPlatform` from `modules/browser-platform`: the captured install prompt, standalone mode, iOS, and going to a URL.
- `appUrl` — the site's base, where the Installed App starts.

Out of scope: signing in (`session`), Push (`member-settings`).
