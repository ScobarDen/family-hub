---
name: frontend-mvvm
description: MVVM, FEOD and role files applied to a web frontend — the ViewModel as a hook, a composable or a Reatom model, the passive component, `index.ts` as a module's public API, `{subject}.{role}.ts` in TypeScript, routes and file-based routers, a new-module recipe and a worked shop migration. Load when building or reviewing a React or Vue screen or module, writing an `index.ts`, a DTO reaching a component, a fetch or `useQuery` inside a presentational component, or migrating a frontend to modules. Doctrine is in mvvm, feod and role-files; state library choice is frontend-state-stack; lint enforcement is frontend-boundaries.
---

# Frontend MVVM

How `mvvm`, `feod` and `role-files` look in a TypeScript frontend. Load those three for the rules; this file adds only what the web stack changes.

## Provenance and precedence

- Hooks adapter and render rules: [MVVM for React](https://www.youtube.com/watch?v=H0pKvQ8P3UI). Level and public API rules: [FEOD](https://fractal-oriented.tech/llms-full.txt), whose own examples are TypeScript.
- **Project conventions win.** An existing layout, a file-based router or a ViewModel convention outranks this file. Follow it and mention the divergence in one line.
- Picking Zustand vs Reatom vs MobX vs hooks is `frontend-state-stack`. MobX wiring is `mobx-mvvm`. Reatom API is `reatom` / `reatom-async`.
- Hook *return shape* (`form` / `state` / `functions` / `refs` / `features`) is `react-hooks-best-practices` rule `dx-extract-complex-hook`. This file owns the fact that the hook **is** the ViewModel.

## 1. The ViewModel on each framework

React ties logic to component lifecycle, so a pure ViewModel class is optional. The physical split is not:

```tsx
export function Checkout(props: CheckoutProps) {
  const vm = useCheckout(props)
  return <CheckoutView {...vm} />
}
```

`useCheckout` is the ViewModel: queries, mapping, handlers, wiring. `CheckoutView` and its children bind; they do not call the API. `Checkout` is the module's root View.

- **Vue**: the ViewModel is a composable (`useCheckout`), the View is the SFC template. SFC mechanics stay in the Vue skills.
- **Reatom**: the ViewModel is a model of atoms and actions. Load `reatom`; do not re-implement `mvvm` as atoms here.
- **MobX**: `ViewModelBase` + `withViewModel`, see `mobx-mvvm`.
- Mediator arguments on hooks: `useTable({ getTasks, params })` receives getters; it does not call `useFilters()` inside.
- React infrastructure (debounce, click-outside, `createStore` / `useSyncExternalStore` selectors, disclosure) comes from `reactuse`. Business use cases do not.
- Inject services through props, hook arguments or the composition root in `app/`. A ViewModel does not `new AxiosClient()` in a leaf.

## 2. Renders

Do not smear fetches and maps across the tree to "localize state" or dodge re-renders. Boundaries first. If a measured problem exists (profiler, real jank), subscribe the widget to its own store or hook, not the whole page ViewModel. `vercel-react-best-practices` applies **after** a measurement and does not override `mvvm`. Memo sprinkled on a god component is not architecture.

## 3. Public API in TypeScript

`feod` §3, spelled out:

- `index.ts` at the entity root, `export { A, B } from './…'` only; `export *` is banned (`frontend-boundaries` checks it in ESLint).
- Consumers import `@/modules/checkout`, never `@/modules/checkout/vm/checkout.vm`. `import type` obeys the same rule.
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
- `.api` files take transport from `common/http-client`, not from `fetch` or `ky` directly.
- `global/` holds `polyfills.ts`, `vite-env.d.ts`, global styles; `app/main.tsx` connects them and nothing else imports them.

## 5. Routes and pages

`pages/<page>/<page>.route.ts` declares the route; `pages/<page>/<page>.view.tsx` mounts module roots and passes their dependencies. The page is the mediator between modules on one screen:

```tsx
import { useCartSource } from '@/modules/cart'
import { Checkout } from '@/modules/checkout'

export function CheckoutPage() {
  return <Checkout cartSource={useCartSource()} />
}
```

A file-based router (Next, Nuxt, TanStack Router, React Router fs-routes) dictates its own file names. They win; `.route.ts` is not used, and the route file stays as thin as `.view.tsx` above.

## 6. Recipe: a new module

1. **Qualify it** (`feod` §2): name it in product terms, kebab-case, under `modules/`.
2. **Files**: `index.ts`, `README.md` if it has a ViewModel, then one file per role you need (`<name>.api.ts`, `<name>.dto.ts`, `<name>.model.ts`, `<name>.vm.ts`, `<name>.view.tsx`). Folders appear only when a role reaches two files.
3. **Model**: domain types and the DTO → domain adapter in `.api` / `.model`. The DTO goes no further.
4. **ViewModel**: the hook takes services as arguments, returns UI-shaped data and commands; tests beside it with a fake service and a fixed clock.
5. **View**: the root View in `<name>.view.tsx` calls the hook and renders passive children.
6. **Public API**: `index.ts` exports the root View, its props type and the domain types consumers need. Nothing else.
7. **Mount**: a page imports the module root and passes its dependencies; the module never imports the page or another module's internals.
8. **Check**: lint is green with the `frontend-boundaries` config; the README names what is injected.

## 7. Worked example

[`references/worked-example.md`](references/worked-example.md) takes a typical shop frontend sorted by technical kind (`components/`, `hooks/`, `utils/`, `types/`) to this layout, row by row: every level, every role folder, submodules, and a page wiring two modules. Read it when migrating a project or starting a new one.

## Review smells

- `useQuery` / `fetch` / DTO field access inside a presentational component.
- A DTO type in a component's props.
- `selectOptions` assembled in JSX from a raw enum or DTO.
- "We put the query in the row component so the table doesn't re-render."
- `export *` in an `index.ts`; an import path past a module root.
- `ReturnType<typeof …>` reconstructing a type another module owns.
- A component file without a role suffix inside a module.

## Related skills

| Need | Load |
| --- | --- |
| What each role owns | `mvvm` |
| Levels and public API | `feod` |
| File names and role folders | `role-files` |
| Lint rules for levels and roles | `frontend-boundaries` |
| Which state library | `frontend-state-stack` |
| Project is already MobX | `mobx-mvvm` |
| Reatom API | `reatom` / `reatom-async` |
| Hook return contract | `react-hooks-best-practices` (`dx-extract-complex-hook`) |
| Which ReactUse hook | `reactuse` |
| Render optimization after a measurement | `vercel-react-best-practices` |
