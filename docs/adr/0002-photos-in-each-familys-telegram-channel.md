# Photos live in each Family's own Telegram channel

Cloudflare R2 cannot be enabled without a payment method, and the project runs on free tiers only. Photos are therefore stored in Telegram: each Family connects its own private channel (its Photo Storage) by adding our bot as an admin, the Worker uploads with `sendPhoto` and keeps the `file_id` of the 320 / 1280 / 2560 variants, and serves them through signed, edge-cached URLs because Telegram file URLs embed the bot token. Storage sits behind a `PhotoStorage` interface in `apps/api` so it can move to R2 later.

## Consequences

- **Never recreate the production bot.** A `file_id` is valid only for the bot that received the file; a new bot makes every stored photo unreachable. Rotating the token with BotFather's `/revoke` keeps the same bot and is safe.
- Deleting a photo in the app only forgets its `file_id`: Telegram keeps the file and `getFile` still serves it after the message is deleted. Photos are physically erased only when the Family deletes its channel.
- Telegram keeps no original: `sendPhoto` caps the long side at 2560 px.
- A Family without a connected channel cannot upload photos; a disconnected channel makes its existing photos unavailable for good.

## Considered Options

- **Cloudflare R2** — requires a card on the account.
- **One shared storage channel for the whole installation** — no per-Family isolation and no way to truly erase a Family's photos.
- **A bot per Family (bring your own bot)** — means storing other people's bot tokens and routing initData, webhooks and reminders across many bots; ruled out of scope as white-labelling.
