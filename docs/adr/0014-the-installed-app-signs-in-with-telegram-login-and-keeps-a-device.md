# The Installed App signs in with Telegram Login and keeps a revocable Device

The Installed App runs outside Telegram, so it has no initData. A Member signs in there with Telegram Login (the bot's domain set through BotFather), and the Worker checks the login's hash with the bot token the way it checks initData, so the Member is the same Telegram account as in the Mini App. Only Members of a Family get in; anyone else is sent to the bot.

Signing in creates a Device: a random credential the Installed App keeps on the device and the Worker keeps hashed in D1. The app exchanges it for the usual short session token from [ADR 0006](0006-session-token-carries-only-member-id.md). A Device lives 90 days from its last use, and a Member can revoke any of their Devices from the settings. This narrows [ADR 0013](0013-the-session-token-renews-while-the-app-stays-open.md) for the Installed App only: the Mini App still persists nothing and signs in with initData at launch.

## Considered Options

- **Handing the session over from the Mini App** — a button in Telegram opens the browser with a one-time token, but an app installed to the iOS home screen does not share storage with Safari, so the handover never reaches it.
- **A one-time code from the bot** — needs no domain setup, but every sign-in becomes a trip to the chat and back.
- **A long-lived JWT in storage** — no table, but a leaked token lives for its whole term and cannot be revoked.
- **Telegram Login on every launch** — nothing kept on the device, but opening the app from its icon would start with a login every time.
