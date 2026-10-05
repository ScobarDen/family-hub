# apps/web

The Telegram Mini App: React 19 and Reatom v1001, shadcn on Base UI with Tailwind v4, a static build for GitHub Pages under `/family-hub/`.

## Shape

- MVVM on FEOD levels, as in the `frontend-mvvm` skill: a ViewModel `*.vm.ts` per screen, a passive `*.view.tsx` built with `reatomComponent`, data in `*.api.ts` / `*.model.ts`, a module's public API in `index.ts`, a README in every module that has a ViewModel. The role matrix in `vite.config.ts` decides who imports whom.
- `src/app/main.tsx` is the composition root and the only importer of `global`.
- `common/` holds the shared entities: `telegram` (the Mini App wrapper, `telegram-mini-app` skill), `http-client`, `ui` (shadcn components), `icons`, `format-date`, `format-money`.

## Rules

- **State and async are Reatom.** Loading, caching and optimistic updates with rollback use Reatom async (`withAsyncData`, `withCache`) in `.api` / `.model`. Forms are `reatomForm` bound to shadcn `Field*` through a thin adapter over `bindField`. Routing is the Reatom router on pathname under the `/family-hub/` base.
- **reactuse** holds only ephemeral DOM state that lives and dies with one View, so it is imported only in `*.view.tsx`. Anything a ViewModel reads, anything that outlives an unmount or touches async, validation, the URL or storage is Reatom.
- **Server calls** go through the Hono RPC client `hc` in `common/http-client`, typed by the `apps/api` app type. It attaches the session token; a 401 shows «перезапустите приложение».
- **Telegram** is reached only through `common/telegram`.
- **UI**: shadcn on Base UI — custom triggers use `render`, not `asChild`. Components land in `common/ui` (aliases in `components.json`). Theme colours come from Telegram `themeParams` mapped onto the shadcn CSS variables. Charts are shadcn charts.
- **Icons** are lucide only, imported one by one; the curated set for Savings Goal covers lives in `common/icons`. Emoji appear only in user text and bot messages.
- **tsconfig** keeps `paths` without `baseUrl`, whatever the shadcn guide says: `baseUrl` switches off the type-aware lint and type-check in Vite+.
- **React Compiler** stays off until its compatibility with `reatomComponent` is verified.
- **Dates** use Temporal (`temporal-dates` skill); user-facing text is Russian.

## Tests

ViewModels and models are unit-tested with Vitest, isolated per test through the Reatom context (`reatom-testing` skill), with a fake API client typed by `@family-hub/contract` and a fake `common/telegram`. Assert what the View receives: screen state, optimistic updates and rollbacks, 401 handling. Component tests and Storybook are out of scope for now.
