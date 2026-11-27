# telegram

The only way to Telegram: the Mini App wrapper behind the `TelegramWebApp` interface (`telegram-mini-app` skill). Its semantic `haptics` follow the map in [docs/haptics.md](../../../../../docs/haptics.md). `window.Telegram` is declared in `telegram.types.ts`, beside the types that use it, because nothing may import `global`.

## Outside Telegram

`app/main.tsx` decides at launch whether it runs inside Telegram. Outside it, `reatomBrowserWebApp` serves the same interface from the browser:

- theme from `prefers-color-scheme`;
- Back through the system back gesture: a history entry while a screen asks for Back, and a swipe from the left edge on iOS, which has none;
- haptics as no-ops;
- `?open=` in place of `start_param`;
- Web Share or copy for `t.me/share` links (`shareOrCopy` from `browser-platform`);
- `localStorage` for DeviceStorage.

Telegram-only features report themselves unsupported, and their entries hide.

Tests take `fakeWebApp`, `fakeHaptics`, `fakeDeviceStorage` and `fakeWindow` in its place.

Out of scope: what the browser itself offers the Installed App: install prompt, standalone mode, Notification permission, PushManager, file sharing (`browser-platform`).
