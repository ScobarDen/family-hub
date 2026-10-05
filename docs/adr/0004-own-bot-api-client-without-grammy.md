# The bot talks to Telegram through our own thin client, not grammY

The Worker needs a handful of Bot API methods (`sendMessage`, `editMessageText`, `answerCallbackQuery`, `sendPhoto`, `getFile`) and a webhook that routes into our own services. We call them with a typed `fetch` wrapper (`apps/api/src/common/telegram/bot.api.ts`) over `@grammyjs/types`, so the Bot API is one interface the test harness replaces with a recording fake that can answer 403 and 429.

## Considered Options

- **grammY** — brings its own update routing, middleware and session model, which would sit beside Hono and the services and make the bot a second application inside the Worker; its HTTP layer would also be one more thing to fake.
