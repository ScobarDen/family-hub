---
name: feod-preset
description: This family's preset on top of the official FEOD skill (`feod`, Sdju/feod) — the "module or common" test, a strict module public API, kebab-case module names, banned dump names, the module README, when a submodule is due, written exceptions, and a FEOD review checklist. Load alongside `feod` when placing new code on a level, creating a module, a submodule or a common entity, reviewing imports or exports between modules, or migrating a project to FEOD. Stack-neutral; file names inside a module are role-files, what each MVVM role owns is mvvm.
---

# FEOD preset

Load the official **`feod`** skill first (`npx skills add Sdju/feod`); without it, the base is [feod.dev](https://feod.dev/) and [Sdju/feod](https://github.com/Sdju/feod). It owns the levels, the import matrix, submodules, module pages, private page modules, transit and single-file modules, the modifications and the lint plugins. This file adds what this skill family decided on top. Inside a module, file names are `role-files` and responsibilities are `mvvm`.

## Precedence

1. The project: `feod.profile.md`, a `feod` key in `package.json` or `feod.config.json`, then the existing layout. Follow it and mention a divergence from this preset in one line.
2. Official FEOD. Where this file and feod.dev disagree, re-read the site; it wins.
3. This preset. Rules marked **Stricter than FEOD** are this family's own decisions.

FEOD is written for frontend projects. Applying it to Qt / C++ is this family's extension; `qt-mvvm` maps it to C++ and QML.

## 1. The base in five lines

Enough to work without the official skill loaded; `feod` has the full matrix.

- `global`: `.d.ts`, shims, polyfills. Imported by nobody, the entry included; tsconfig, the HTML entry, the bundler config or the test setup wires it.
- `common`: small neutral entities, usually one file, no `index.ts`. Imports only `common`.
- `modules`: product responsibilities. Import `common` and other modules through `@/modules/<name>` (`index.ts`) only.
- `pages`: thin route screens. Import `modules` and `common`; never another page.
- `app`: bootstrap, router, layouts, integrations, the composition root. Imports everything below.

Submodules live in `modules/<name>/modules/<sub>/`. A submodule may reach its parent's internals; the parent reaches it only through its `index.ts`. **Stricter than FEOD:** other modules and pages reach a submodule only through the parent's `index.ts`; FEOD's linter lets them import the submodule's own `index.ts` unless the project sets `submodules.visibility: "parent-only"`, so set it.

## 2. Module or common

FEOD lists the signs of a common entity (no business logic, fits one file, usable anywhere, needs no module) and admits there is no exact rule. This family's test settles the borderline case:

> Can you state what it is **without naming the product domain**?
> Yes → `common`. No → a module, possibly a cross-cutting one (`auth`, `notifications`, `feature-flags`).

"Used twice" is never the reason by itself. Money formatting, an HTTP client, a date range with its "start not after end" invariant, a coloured dot with a label: `common`. The same dot named `CategoryDot` because "this is how a category looks here" is a thin wrapper in the `category` module over the neutral primitive. A UI kit or design system is a module, not `common` (FEOD).

## 3. Module public API

FEOD: `index.ts` is the module's only public entry; everything else inside is internal, type-only imports included. **Stricter than FEOD:**

- Exports are named one by one. `export *` publishes whatever lands in the folder next.
- Every export is a promise: a new export has a consumer or a stated reason.
- Exported names are clean domain names (`Checkout`, `getOrderTotal`, `UserAvatarProps`). A name that repeats an internal folder (`UserModel`, `CheckoutApi`) describes the file tree, not the contract.
- The owner exports its types. A consumer rebuilding a type from a function's signature is reverse-engineering what the owner forgot to export.
- An external package wrapped by a common entity or a module is used only through that wrapper.

## 4. Names

- **Level folders** keep FEOD's names, `global` included (not `globals`). A project that renames them sets `layerDirs` and the profile.
- **Modules** are domain nouns in kebab-case: `checkout`, `user`, `feature-flags`. FEOD's examples use PascalCase; kebab-case is this family's choice and the linter accepts both. If the responsibility cannot be named briefly in product terms, the boundary is not clear yet.
- **Common entities** name a neutral contract: `button.tsx`, `format-date.ts`, `http-client.ts`.
- **Pages** are named after the route or screen they assemble.
- **Stricter than FEOD:** `utils`, `helpers`, `shared`, `misc`, `services`, `components`, `hooks` name no responsibility on any level, inside modules too. FEOD's linter rejects them only as unknown top-level folders; inside a module `role-files` replaces them.

## 5. Submodules

FEOD fixes where a submodule lives and who may import it. When to make one is this family's heuristic:

- A submodule appears when a part of the module gets its own reason to change: `modules/checkout/modules/delivery/`.
- Two files are too early. A flat module is fine until stable parts appear inside it.
- Folders that group by technical kind (`forms/parts/`) are not submodules.
- A part with its own consumers and its own product responsibility is a separate module. Extracting it before that independence is real adds external dependencies for nothing.

## 6. Module README

FEOD recommends a `README.md` per module. **Stricter than FEOD:** every module with a ViewModel (`mvvm`) has one in this shape, because it always has injected dependencies worth naming. Five to ten lines; a long README rots.

```md
# checkout

Turns a cart into a placed order: address, delivery slot, payment.

- Injected: `cartSource`, `paymentClient` (from `app/`).
- Out of scope: cart editing (`cart`), order history (`orders`).
```

The exports are already in `index.ts`. The README carries what the tree cannot tell: why the module exists, what it receives, where the neighbouring work lives. A parent README names significant submodules.

## 7. Exceptions

An exception is legal only when a project decision describes it and a tool can check it (the FEOD config's `ignore`, `globals.allowedFiles`, a lint override with a comment). The known classes:

- the HTML entry, the bundler config or `main()` before the app starts connects global styles, polyfills or settings;
- test setup connects mocks and polyfills outside the production graph;
- build-time configuration imports files outside the runtime graph;
- a temporary migration alias, pointing at the target public API, with an end date;
- a documented cross-boundary read the public API cannot express (a report joining another module's table in SQL), written next to the code and in the module's build or lint file.

An exception never turns an internal file into an implicit public API.

## 8. Migrating

`feod` carries the migration steps and the FSD habits to unlearn. Two additions:

- A `modules/entities/` or `modules/features/` folder is FSD renamed, not migrated. Group by responsibility: `entities/user`, `features/change-email` and `widgets/profile-card` can become one `user` module.
- The migration is **gradual**. Each PR leaves no new violation behind; no PR fixes all legacy at once. A temporary alias (§7) keeps old imports compiling while consumers move.

Stack skills carry a worked migration (`frontend-mvvm`).

## 9. Review checklist

- [ ] Changed code sits on the level whose role matches it
- [ ] Imports from outside a module end at `@/modules/<name>`; no new deep or zigzag import
- [ ] `common` has no `index.ts`, names no product term and imports no module
- [ ] `index.ts` names every export; no `export *`; every new export has a consumer or a reason
- [ ] Pages assemble; they hold no business logic and import no other page
- [ ] Nothing imports `global`; one infrastructure point connects it
- [ ] Submodules sit in `modules/<name>/modules/` and are reached only through the parent's `index.ts`
- [ ] Every module with a ViewModel has a README with purpose, injected dependencies, out of scope
- [ ] Exceptions are written down and checkable
- [ ] If the FEOD lint plugin is configured, it passes

## Related skills

| Need | Load |
| --- | --- |
| Levels, matrix, special modules, modifications, lint plugins | `feod` (official) |
| What each role inside a module owns | `mvvm` |
| How files inside a module are named and grouped | `role-files` |
| FEOD on a web frontend; lint enforcement | `frontend-mvvm`, `frontend-boundaries` |
| FEOD on Qt Quick; compiler enforcement | `qt-mvvm`, `qt-cmake-boundaries` |
| Naming one symbol, a signature | `code-craft` |
