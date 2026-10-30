# browser-platform

What the Installed App «Домовой» takes from the browser itself, outside Telegram: the install prompt Chromium fires once (`beforeinstallprompt`, caught before the first render), standalone mode, iOS and Android, Notification permission, PushManager with the Worker's VAPID key, going to a URL, and sharing a photo file through the system share sheet. `shareOrCopy` is the one share sheet, or the clipboard with «Ссылка скопирована» where there is none; a dismissed sheet is no failure. `modules/telegram` uses it for `t.me/share` links.

## Injected

- `window` — the browser's own; `app/main.tsx` and `app/install.tsx` build `reatomBrowserPlatform(window)` only outside Telegram.

Tests take `fakeBrowserPlatform(options)` in its place.

Out of scope: the Telegram wrapper's browser stand-in (`telegram`), what the install page shows (`install-app`), Push settings (`member-settings`).
