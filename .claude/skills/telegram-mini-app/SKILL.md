---
name: telegram-mini-app
description: How Family Hub talks to Telegram — the Mini App wrapper in apps/web `common/telegram`, initData login, `start_param` deep links, theme, the bot client and webhook in apps/api, inline buttons and callbacks, and photos kept in a Family's Telegram channel. Load when touching any of these, or before reaching for a Telegram SDK or library.
---

# Telegram in Family Hub

Telegram is reached through two thin, hand-written layers, one per app. Both exist so that the project keeps one reactivity system on the front and one HTTP client on the back; extend them instead of adding a package ([ADR 0004](../../../docs/adr/0004-own-bot-api-client-without-grammy.md), [ADR 0005](../../../docs/adr/0005-own-telegram-wrapper-on-reatom.md)).

Feature and version tables, limits and the exact wording of Telegram's docs live in [docs/research/telegram-capabilities.md](../../../docs/research/telegram-capabilities.md). Read it before using a WebApp API you have not used here yet: most features need a minimum client version and a fallback.

## Mini App side (`apps/web`)

- The official `telegram-web-app.js` script is the only SDK. `common/telegram` wraps it as Reatom atoms (theme, viewport, safe area, launch params) and actions (main / secondary / back / settings buttons, haptics, `requestWriteAccess`, `shareMessage`). ViewModels reach Telegram through this module, so tests swap it for a fake.
- **Theme**: `themeParams` and `themeChanged` feed the shadcn CSS variables. Newer keys (`section_*`, `bottom_bar_bg_color`) need a fallback colour.
- **Launch params** are read before the first navigation. Telegram owns the URL hash (`#tgWebAppData=…`), so routing is by pathname under the `/family-hub/` base.
- **`start_param`** is `<kind>_<id>`: `inv_<token>`, `pet_<uuid>`, `entry_<uuid>`, `event_<uuid>`, `goal_<uuid>`. Its codec with validation lives in `packages/contract` and is shared with the bot, which builds the same links. Keep payloads within 64 characters of `[A-Za-z0-9_-]`. Opening a payload is a `route.go(…, true)` on start; a reload of a deep page falls back to the home screen and re-applies `start_param`.
- **Session**: the client sends raw `Telegram.WebApp.initData` (the signed string, never `initDataUnsafe`) and gets back the Worker's own token, kept in memory only. Every launch logs in again; a 401 shows «перезапустите приложение».
- **Write access**: ask with `requestWriteAccess` during a Family Request and on joining by Invite. Without it the app shows the «Включите уведомления» banner, since Reminders cannot reach the Member.

## Bot side (`apps/api`)

- **Bot API client** is `common/telegram/bot.api.ts`: `fetch` plus types from `@grammyjs/types`, a typed `call(method, params)` and `BotApiError` carrying `errorCode` and `retryAfterSeconds`. Add a method by calling it; tests use `test/fake-bot-api.ts`, which records calls and can answer 403 and 429.
- **Webhook** `/bot/webhook` checks `X-Telegram-Bot-Api-Secret-Token` against `WEBHOOK_SECRET` on every request.
- **initData check** is HMAC over WebCrypto: `secret = HMAC_SHA256(key = "WebAppData", message = BOT_TOKEN)` — the constant is the key, the token is the message; `data_check_string` drops only `hash`, keeps `signature`, sorts `key=value` lines joined by `\n`; compare in constant time; accept `auth_date` up to one hour old; parse `user` JSON only after the check. Identity is `user.id`; names and `username` are display-only.
- **Callbacks**: `callback_data` fits 64 bytes, shaped `rd:<action>:<dispatchId>` for Reminders. Every `callback_query` gets `answerCallbackQuery`. A press from an account other than the row's Recipient answers «это не ваше напоминание» and changes nothing.
- **Sending**: about one message per second per chat. A 429 stops the cron tick and releases its claimed rows for the next one; a 403 sets `can_message = false` on the Member, which `/start` or `requestWriteAccess` restores.
- **Editing**: after «✅ Готово» the bot edits every Recipient's message by stored `chat_id` + `message_id`. A snooze sends a fresh message when due, because an edit does not notify.

## Photos ([ADR 0002](../../../docs/adr/0002-photos-in-each-familys-telegram-channel.md))

- Each Family's Photo Storage is its own private channel with the bot as admin. Upload with `sendPhoto` (≤ 10 MB, long side capped at 2560 px), keep the `file_id`s of the 320 / 1280 / 2560 variants and `file_unique_id` for dedup.
- Telegram file URLs embed the bot token, so the browser only ever sees our signed, edge-cached Worker URLs.
- Everything sits behind the `PhotoStorage` interface in `apps/api`, the seam for a later move to R2.
- The production bot is permanent: `file_id`s belong to the bot that received them. Rotate its token with BotFather `/revoke`; a test bot has its own channel.
