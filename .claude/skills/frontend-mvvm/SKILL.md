---
name: frontend-mvvm
description: MVVM, FEOD and role files on a web frontend. Load when building or reviewing a React or Vue screen or module, a component growing props that show, hide or replace its parts, writing a module's `index.ts`, a DTO or a fetch reaching a View, or migrating a frontend to modules.
---

# Frontend MVVM

How `mvvm`, FEOD (`feod`, `feod-preset`) and `role-files` look in a TypeScript frontend. Load those four for the rules; this file adds only what the web stack changes. Prerequisites: `npx skills add Sdju/feod`, and `npx skills add ScobarDen/scobar-skills --skill <name>` for `mvvm`, `feod-preset` and `role-files`.

**Project conventions win.** An existing layout, a file-based router or a ViewModel convention outranks this file. Follow it and mention the divergence in one line.

## 1. The ViewModel on each framework

React ties logic to component lifecycle, so a pure ViewModel class is optional. The physical split is not:

```tsx
export function Checkout(props: CheckoutProps) {
  const vm = useCheckout(props)
  return <CheckoutView {...vm} />
}
```

`useCheckout` is the ViewModel: queries, mapping, handlers, wiring. `CheckoutView` and its children bind; they do not call the API. `Checkout` is the module's root View and, in React, the module's composition root (`mvvm` §4): it starts the first load in a `useEffect` calling the hook's `load` command, or leaves it to a query library that loads on mount. The hook itself starts nothing, so its test calls `load` explicitly.

- **Return shape**: the hook returns one object grouped by kind: `state` (UI-shaped data), `functions` (commands), and `form`, `refs` or `features` when the screen has them. The `.vm.ts` exports that object's type by name (`CheckoutViewModel`), and the passive View takes it as props; `ReturnType<typeof useCheckout>` hides that contract.

- **Vue**: the ViewModel is a composable (`useCheckout`), the View is the SFC template.
- **Reatom**: the ViewModel is a model of atoms and actions. The roles and their boundaries stay exactly as `mvvm` states them; atoms are only the mechanism, and the Reatom API comes from `reatom`.
- Mediator arguments on hooks: `useTable({ getTasks, params })` receives getters; it does not call `useFilters()` inside.
- React infrastructure hooks (debounce, click-outside, `useSyncExternalStore` selectors, disclosure) come from the project's hook library or `common/lib/`. Business use cases live in the ViewModel.
- Inject services through props, hook arguments or the composition root in `app/`. A ViewModel does not `new AxiosClient()` in a leaf.

## 2. Renders

Optimize renders only after a measurement (profiler, real jank): then subscribe the widget to its own store or hook instead of the whole page ViewModel. Render-performance advice applies at that point and yields to `mvvm`.

## 3. Public API in TypeScript

`feod-preset`'s module public API, spelled out:

- `index.ts` at the module root, `export { A, B } from './…'` only; `export *` is banned (`frontend-boundaries` checks it in ESLint).
- Consumers import `@/modules/checkout`, never `@/modules/checkout/vm/checkout.vm`. `import type` obeys the same rule.
- `common` has no `index.ts`: consumers import the file, `@/common/lib/format-money.lib`.
- UI primitives come from the `ui-kit` module, `import { Button } from '@/modules/ui-kit'`. A design-system View holds UI state only, so it is imported, not one of the stateful collaborators `mvvm` §4 injects.
- Public names: `Checkout`, `useCheckout`, `CheckoutProps`, `getOrderTotal`. Inside the module, names follow the library's convention (mobx-view-model's `CheckoutVM` class); the public surface does not restate the role.
- A consumer writing `ReturnType<typeof getOrderStatus>` or `Parameters<typeof placeOrder>[0]` means the owner forgot to export the type.

## 4. Role files in TypeScript

`role-files` with the suffix as the marker, kebab-case throughout: `checkout-form.view.tsx`, not `CheckoutForm.tsx`.

| Marker | Files |
| --- | --- |
| `view` | `.view.tsx`, `.view.ts`, `.view.vue` |
| everything else | `.model.ts`, `.vm.ts`, `.api.ts`, `.dto.ts`, `.route.ts`, `.config.ts`, `.types.ts`, `.lib.ts` |
| tests, stories | `.test.ts`, `.stories.tsx`, after the role: `checkout.vm.test.ts` |

- The hooks adapter from §1 lives in `checkout.view.tsx` and is what `index.ts` exports as `Checkout`.
- `.api` files take transport from `common/api/http-client.api.ts`, not from `fetch` or `ky` directly. Its base URL lives in `common/config/http-client.config.ts` as `import.meta.env.VITE_API_BASE_URL ?? ''`; in development `vite.config.ts` proxies `/api` to the backend.
- Tests run on the project's runner; a project with none gets Vitest with jsdom and `@testing-library/react` (or `@testing-library/vue`). Its setup file sits beside `vite.config.ts`, outside `src/`, so it lives on no level.
- `global/` holds polyfills named after what they patch (`array.polyfill.ts`) and `vite-env.d.ts`. No code imports them, `app/main.tsx` included: `tsconfig.json` picks up the `.d.ts`, `index.html` loads polyfills before the entry.

`feod`'s templates group files by technical kind. Each of their folders becomes a role:

| `feod`'s folder | Role |
| --- | --- |
| `components/`, `ui/` | `view` |
| `composables/`, `hooks/` | `vm` |
| `api/` | `api`; raw response shapes `dto` |
| `store/` | `model` |
| `types/` | `model` for domain types; `types` for types with no owner file |
| `utilities/` | `lib` |
| `constants/` | `config`, or the file of the rule they tune (`role-files` §3) |
| `layouts/` on `app` | `view` |
| `integrations/` on `app` | each file's own role, usually `api` |
| `init/` on `app` | the composition root in the entry point (`role-files` §4, App and global) |
| `styles/` on `app` | `app/main.css`, imported by `app/main.tsx` (`role-files` §4, App and global) |

## 5. Routes and pages

`pages/<page>/<page>.route.ts` declares the route as data and imports nothing; `pages/<page>/<page>.view.tsx` mounts module roots and passes their dependencies. The page is the mediator between modules on one screen:

```tsx
import type { CartSource } from '@/modules/cart'
import { Checkout } from '@/modules/checkout'

export type CheckoutPageProps = { cartSource: CartSource }

export function CheckoutPage({ cartSource }: CheckoutPageProps) {
  return <Checkout cartSource={cartSource} />
}
```

`app/app.route.ts` joins each route with its page View, and `app/main.tsx`, the composition root, calls it once with the dependencies it constructs. A page's route file and its View never import each other: the FEOD plugin reads that as page → page (`frontend-boundaries`, Project config). Only the page's wiring test imports its View, under one lint exception.

```ts
// pages/checkout/checkout.route.ts
export const checkoutRoute = { path: '/checkout' }

// app/app.route.ts
import { createElement } from 'react'
import { checkoutRoute } from '@/pages/checkout/checkout.route'
import { CheckoutPage, type CheckoutPageProps } from '@/pages/checkout/checkout.view'

export function createRoutes(deps: CheckoutPageProps) {
  return [{ ...checkoutRoute, element: createElement(CheckoutPage, deps) }]
}

// app/main.tsx
import { createCartSource } from '@/modules/cart'

const router = createBrowserRouter(createRoutes({ cartSource: createCartSource() }))
```

A file-based router (Next, Nuxt, TanStack Router, React Router fs-routes) dictates its own file names. They win; `.route.ts` is not used, and the route file stays as thin as `.view.tsx` above.

## 6. Recipe: a new module

1. **Qualify it** (`feod-preset`, Module or common): name it in product terms, kebab-case, under `modules/`.
2. **Files**: `index.ts`, `README.md`, then one file per role you need (`<name>.api.ts`, `<name>.dto.ts`, `<name>.model.ts`, `<name>.vm.ts`, `<name>.view.tsx`). Folders appear only when a role reaches two files.
3. **Model**: domain types and the DTO → domain adapter in `.api` / `.model`. The DTO goes no further.
4. **ViewModel**: the hook takes services as arguments, returns UI-shaped data and commands; tests beside it with a fake service and a fixed clock.
5. **View**: the root View in `<name>.view.tsx` calls the hook, starts the first load (§1) and renders passive children.
6. **Public API**: `index.ts` exports the root View, its props type and the domain types consumers need. Nothing else.
7. **Mount**: a page imports the module root and passes its dependencies; the module never imports the page or another module's internals. A test of that wiring sits beside the page's View (`mvvm` §9).
8. **Check**: lint is green with the `frontend-boundaries` config; the README has the parts `feod-preset` lists, `Exports:` matching `index.ts`.

## 7. Compound components and presets

A component that grows a prop per variant becomes unreadable. Split it into a **compound** (`CardRoot`, `CardHeader`, `CardActions`, flat named exports) and keep the usual assembly as a **preset** (`UserCard`).

On the first **structural prop** (`showHeader`, `renderActions`, a `variant` that changes which parts exist), or when building any reusable component, read [`references/compound-components.md`](references/compound-components.md): the rules, presets, FEOD placement and React and Vue examples.

## 8. Worked example

[`references/worked-example.md`](references/worked-example.md) takes a typical shop frontend sorted by technical kind (`components/`, `hooks/`, `utils/`, `types/`) to this layout, row by row: every level, every role folder, submodules, and a page wiring two modules. Read it when migrating a project or starting a new one.

## Review smells

- `useQuery` / `fetch` / DTO field access inside a View.
- `export *` in an `index.ts`; an import path past a module root.
- `ReturnType<typeof …>` reconstructing a type another module owns.
- A component file without a role suffix inside a module.
- A View under `common/`: UI primitives belong to `ui-kit`.

## Related skills

| Need | Load |
| --- | --- |
| What each role owns | `mvvm` (`npx skills add ScobarDen/scobar-skills --skill mvvm`) |
| Levels and public API | `feod` (`npx skills add Sdju/feod`), `feod-preset` (`npx skills add ScobarDen/scobar-skills --skill feod-preset`) |
| File names and role folders | `role-files` (`npx skills add ScobarDen/scobar-skills --skill role-files`) |
| Lint rules for levels and roles | `frontend-boundaries` (`npx skills add ScobarDen/scobar-skills --skill frontend-boundaries`) |
| Reatom API | `reatom` / `reatom-async` (`npx skills add https://github.com/reatom/reatom/tree/v1001/skills`) |
