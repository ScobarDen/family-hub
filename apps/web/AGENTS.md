# apps/web

The Telegram Mini App: React 19 and Reatom v1001, shadcn on Base UI with Tailwind v4, a static build for GitHub Pages under `/family-hub/`.

## Shape

- MVVM on FEOD levels, as in the `frontend-mvvm` skill: a ViewModel `*.vm.ts` per screen, a passive `*.view.tsx` built with `reatomComponent`, data in `*.api.ts` / `*.model.ts`, a module's public API in `index.ts`, a README in every module that has a ViewModel. The role matrix in `vite.config.ts` decides who imports whom.
- `src/app/main.tsx` is the composition root: it builds the real Telegram wrapper, HTTP client and models and hands them down. Nothing imports `global` (`@feod/analyzer` forbids it even from `main.tsx`): `index.html` links `global/styles.css`, and `global/*.d.ts` augments Vite's ambient types. A browser global owned by a common entity is declared beside that entity's types (`window.Telegram` in `common/telegram/telegram.types.ts`), because `global` may not import from `common`.
- `common/` holds the shared entities: `telegram` (the Mini App wrapper, `telegram-mini-app` skill), `http-client`, `ui` (shadcn components), `icons`, `format-date`, `format-money`.

## Rules

- **State and async are Reatom.** Loading, caching and optimistic updates with rollback use Reatom async (`withAsyncData`, `withCache`) in `.api` / `.model`. Forms are `reatomForm` bound to shadcn `Field*` through a thin adapter over `bindField`. Routing is the Reatom router on pathname under the `/family-hub/` base.
- **reactuse** holds only ephemeral DOM state that lives and dies with one View, so it is imported only in `*.view.tsx`. Anything a ViewModel reads, anything that outlives an unmount or touches async, validation, the URL or storage is Reatom.
- **Server calls** go through `common/http-client`: every response is parsed with its Zod schema from `@family-hub/contract`, which is the only type link to `apps/api` (the Worker's app type cannot be imported: both apps alias `@/` and the Worker leans on Cloudflare globals). The client keeps the session token in memory and attaches it; any 401 flips `isSessionLost`, which shows «перезапустите приложение».
- **Telegram** is reached only through `common/telegram`.
- **UI**: shadcn on Base UI — custom triggers use `render`, not `asChild`. Components land in `common/ui` (aliases in `components.json`). Theme colours come from Telegram `themeParams`: `telegram-web-app.js` keeps the `--tg-theme-*` and safe-area variables current, and `global/styles.css` maps them onto the shadcn variables with fallbacks. Charts are shadcn charts.
- **Icons** are lucide only, imported one by one; the curated set for Savings Goal covers lives in `common/icons`. Emoji appear only in user text and bot messages.
- **tsconfig** keeps `paths` without `baseUrl`, whatever the shadcn guide says: `baseUrl` switches off the type-aware lint and type-check in Vite+.
- **React Compiler** stays off until its compatibility with `reatomComponent` is verified.
- **Dates** use Temporal (`temporal-dates` skill); user-facing text is Russian.

## Tests

ViewModels and models are unit-tested with Vitest, isolated per test through the Reatom context (`reatom-testing` skill), with a fake transport and a fake `common/telegram`: the real `common/http-client` and module `.api` run over a fake `fetch` that answers with shapes typed by `@family-hub/contract`, so the token, schema parsing and 401 handling are covered too. Wait for an async outcome with `vi.waitFor` on what the View reads, not with sleeps. Assert what the View receives: screen state, optimistic updates and rollbacks, 401 handling. Component tests and Storybook are out of scope for now.
