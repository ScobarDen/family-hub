# apps/web

The Telegram Mini App, which outside Telegram is also the Installed App «Домовой» (`GLOSSARY.md`): React 19 and Reatom v1001, shadcn on Base UI with Tailwind v4, a static build for GitHub Pages under `/family-hub/`.

## Shape

- MVVM on FEOD levels, as in the `frontend-mvvm` skill: a ViewModel `*.vm.ts` per screen, a passive `*.view.tsx` built with `reatomComponent`, data in `*.api.ts` / `*.model.ts`, a module's public API in `index.ts`, a README in every module that has a ViewModel. The role matrix in `vite.config.ts` decides who imports whom.
- `src/app/main.tsx` builds the real Telegram wrapper (or its browser stand-in outside Telegram) and hands it, with `fetch`, `document` and the socket, to `reatomApp` in `src/app/vm/app.vm.ts`: the composition root that builds the HTTP client and live updates (`app.model.ts`) and wires every model and ViewModel. A new module touches `vm/screens.vm.ts` and `vm/routing.vm.ts`. Neither file holds logic of its own, and a test builds the same app over fakes. `vm/prefetch.vm.ts` reads Today and the two tab-bar slot screens once sign-in returns; other sections load when opened.
- `src/app/install.tsx` (`install.html`) is the install page alone. `public/` holds the manifest, the icons and `sw.js` (see `member-settings`).
- Nothing imports `global`, not even `main.tsx` (the FEOD lint plugin forbids it): `index.html` links `global/styles.css`, and `global/*.d.ts` augments Vite's ambient types. A browser global owned by a shared module is declared beside that module's types.
- A shared entity that is one neutral file sits flat in `common/`, imported by its path; anything of several files, anything that needs one of those and anything that names the product is a module reached through its `index.ts`.

## Context

Read the README before using or changing:

- Navigation (tabs, trail, wide/narrow window, opening records, transitions): `src/app/route/README.md`.
- `common/` — the HTTP client's session, token and 401 handling, `records` rollbacks, formatters: `src/common/README.md`.
- `ui` — every shared component: `Sheet` and `FormDrawer`, `FailureBar`, `LiveRegion`, skeletons, `slideScreens`, pickers: `src/modules/ui/README.md`.
- `telegram` — the wrapper and its browser stand-in outside Telegram: `src/modules/telegram/README.md`.
- `live-resource` — every read of Family data: `src/modules/live-resource/README.md`.
- `live-updates` — the socket and per-module versions: `src/modules/live-updates/README.md`.
- `device-cache` — what a screen renders before sign-in: `src/modules/device-cache/README.md`.
- `changes` — commands, optimistic changes, failure text: `src/modules/changes/README.md`.
- `form` — create/edit forms, unsaved-changes confirmation, `NestedBack`: `src/modules/form/README.md`.
- `browser-platform`, `photo-viewer`, `photo-attachments`, `sidebar`, `tab-bar` and every feature module: the `README.md` in its folder.

Modules too small for a README: `photo` (Exif date and shrinking before upload, signed photo links), `sections` (each section's title, icon and icon colour, the «Разделы» order the sidebar follows too, and `NavigationTab`), `visibility` (the «Для всей семьи» / «Только я» choices of a record's form).

## Rules

- **State and async are Reatom.** Every read of Family data is a live resource holding its device cache and rollback; there is no `withCache` ([ADR 0012](../../docs/adr/0012-screens-render-from-a-device-cache-before-sign-in.md), [ADR 0020](../../docs/adr/0020-every-server-read-is-a-live-resource.md)). Commands use `withAsync`, optimistic ones `reatomOptimistic`. Forms are `reatomForm` bound to shadcn `Field*` through a thin adapter over `bindField`. Routing is the Reatom router on pathname under the `/family-hub/` base.
- **reactuse** holds only ephemeral DOM state that lives and dies with one View, so it is imported only in `*.view.tsx`. Anything a ViewModel reads, anything that outlives an unmount or touches async, validation, the URL or storage is Reatom.
- **Server calls** go through `common/http-client.api.ts`: every response is parsed with its Zod schema from `@family-hub/contract`, which is the only type link to `apps/api` (the Worker's app type cannot be imported: both apps alias `@/` and the Worker leans on Cloudflare globals).
- **Telegram** is reached only through `modules/telegram`.
- **UI**: shadcn on Base UI — custom triggers use `render`, not `asChild`. Components land in `modules/ui/view` (aliases in `components.json`). Theme colours come from Telegram `themeParams`: `telegram-web-app.js` keeps the `--tg-theme-*` and safe-area variables current, and `global/styles.css` maps them onto the shadcn variables with fallbacks. Charts are shadcn charts.
- **Icons** are lucide only, imported one by one; the curated set for Savings Goal covers lives in the goals module's `goals.config.ts`. Emoji appear only in user text and bot messages.
- **tsconfig** keeps `paths` without `baseUrl`, whatever the shadcn guide says: `baseUrl` switches off the type-aware lint and type-check in Vite+.
- **React Compiler** stays off until its compatibility with `reatomComponent` is verified.
- **Dates** use Temporal (`temporal-dates` skill); user-facing text is Russian.

## Tests

ViewModels and models are unit-tested with Vitest, isolated per test through the Reatom context (`reatom-testing` skill), with a fake transport and a fake `modules/telegram`: the real `common/http-client.api.ts` and module `.api` run over a fake `fetch` that answers with shapes typed by `@family-hub/contract`, so the token, schema parsing and 401 handling are covered too. Wait for an async outcome with `vi.waitFor` on what the View reads, not with sleeps. Assert what the View receives: screen state, optimistic updates and rollbacks, 401 handling. What crosses modules (a write refreshing another screen, how often a screen loads) is tested on the whole app: `startApp` in `app/app.fixtures.ts` builds `reatomApp` over a fake Worker, a fake socket and a fake Telegram. Component tests and Storybook are out of scope for now.
