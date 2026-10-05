# The Mini App wraps `telegram-web-app.js` itself instead of using `@telegram-apps/sdk`

The Mini App loads Telegram's official `telegram-web-app.js` and exposes it through `apps/web/src/common/telegram` as Reatom atoms (theme, viewport, safe area, launch params) and actions (buttons, haptics, `requestWriteAccess`, `shareMessage`). The whole front then has one reactivity system, and ViewModel tests replace the module with a fake.

## Considered Options

- **`@telegram-apps/sdk`** — a complete SDK with its own signals and lifecycle; bridging those into Reatom would leave two sources of truth for the same Telegram state.
