---
name: feod
description: FEOD (Fractal Entity Oriented Design) — where code lives and who may import it. Five levels (`app`, `pages`, `modules`, `common`, `global`), the import matrix, a module's public API, submodules, deep imports, the "module or common" fork. Load when placing new code on a level, creating a module or a common entity, splitting a module into submodules, reviewing imports between modules, or migrating from FSD or a layout sorted by technical kind. Stack-neutral; file names inside a module are role-files, what each MVVM role owns is mvvm.
---

# FEOD

Levels answer one question: *where does this code live and who may import it*. Inside a module, file names are `role-files` and responsibilities are `mvvm`.

## Provenance and precedence

- Source: [FEOD](https://fractal-oriented.tech/llms-full.txt) and its normative pages `reference/import-matrix`, `reference/public-api`, `reference/naming`, `core-concepts/fractality`, `guides/code-review` (read 2026-10-03). Where this file and the site disagree, re-read the site; it wins.
- FEOD is written for frontend projects and its examples are TypeScript paths. Applying it to Qt / C++ is this skill family's extension; `qt-mvvm` maps every rule here to C++ and QML.
- Rules marked **Stricter than FEOD** are this family's own decisions. Everything else is FEOD.
- **Project conventions win.** An existing layout or naming scheme outranks this file. Follow it and mention the divergence in one line.

## 1. Levels and the import matrix

| Level | Holds | May import |
| --- | --- | --- |
| `app` | entry, bootstrap, routing, providers, the composition root, the mediator between modules | `pages`, `modules`, `common` |
| `pages` | screens and routes: mount modules and hand them their dependencies | `modules`, `common` |
| `modules` | product responsibilities and the domain; most of the code | `common`, other modules' public API, own submodules' public API |
| `common` | neutral entities with no product meaning | other common entities' public API, external packages |
| `global` | environment declarations, shims, polyfills, global styles, settings applied before the app starts | nothing |

- Read imports left to right: `pages → modules` means pages depend on modules, never the reverse.
- `global` is imported by **nobody**. One infrastructure point connects it: the entry, the bundler config, the test setup. After that, no code on any level reaches for it.
- `modules` import each other only through the target's public API. They sit on one level, so "imports only levels below" is the wrong mental model: the matrix is the rule.
- A page never imports another page. `common` never names a module.
- Five levels. A sixth is an architecture decision written down, not a folder.
- An external package wrapped by a common entity or a module is used only through that wrapper.

## 2. Module or common

Something is needed in two places. Ask one question:

> Can you state what it is **without naming the product domain**?
> Yes → `common`. No → a module, possibly a cross-cutting one (`auth`, `notifications`, `feature-flags`).

"Used twice" is never the reason by itself. Money formatting, an HTTP client, a date range with its "start not after end" invariant, a coloured dot with a label: `common`. The same dot named `CategoryDot` because "this is how a category looks here" is a thin wrapper in the `category` module over the neutral primitive. Naming a thing after a product entity is product meaning.

## 3. Public API

Every module and every common entity has one root contract: `index.ts` in TypeScript, a public include directory plus `qmldir` in Qt (`qt-mvvm`). Everything else inside is internal.

- Consumers import the entity's root, never a file or a folder inside it. Type-only imports obey the same rule.
- A **deep import** is any import from outside that reaches past the root. It turns an internal file into a hidden contract.
- Exports are named one by one. A wildcard re-export publishes whatever lands in the folder next.
- Every export is a promise. A new export has a consumer or a stated reason.
- Exported names are clean domain names (`Checkout`, `getOrderTotal`, `UserAvatarProps`). A name that repeats an internal folder (`UserModel`, `CheckoutApi`) describes the file tree, not the contract.
- The owner exports its types. A consumer rebuilding a type from a function's signature is reverse-engineering what the owner forgot to export.
- Moving files inside an entity changes no consumer's import.
- Relative imports stay inside the entity that owns both files.

## 4. Submodules and fractality

A module grows by the same rules that shape the project.

- A **submodule** appears when a part of the module gets its own reason to change: `modules/checkout/delivery/`. It has its own root contract and its own internal layout.
- It sits directly in the parent and is **invisible outside** until the parent exports it. Its own `index.ts` does not make it public.
- Two files are too early. A flat module is fine until stable parts appear inside it.
- Nesting stays within two or three levels; deeper needs a written reason. Folders that group by technical kind (`features/forms/parts/`) are not submodules.
- A part with its own consumers and its own product responsibility is a separate module. Extracting it before that independence is real adds external dependencies for nothing.

## 5. Names

- **Level names** are fixed: `app`, `pages`, `modules`, `common`, `global` (not `globals`).
- **Modules** are domain nouns in kebab-case: `checkout`, `user`, `feature-flags`. If the responsibility cannot be named briefly in product terms, the boundary is not clear yet.
- **Common entities** name a neutral contract: `button`, `format-date`, `http-client`. Each has its own root contract.
- **Pages** are named after the route or screen they assemble. Route-bound helpers stay inside the page.
- `utils`, `helpers`, `shared`, `misc`, `services`, `components`, `hooks` name no responsibility, on any level.

## 6. Module README

FEOD asks for a README when boundaries, public API, submodules or constraints are not obvious.

**Stricter than FEOD:** every module with a ViewModel (`mvvm`) has one, because it always has injected dependencies worth naming. Five to ten lines; a long README rots.

```md
# checkout

Turns a cart into a placed order: address, delivery slot, payment.

- Injected: `cartSource`, `paymentClient` (from `app/`).
- Out of scope: cart editing (`cart`), order history (`orders`).
```

The exports are already in the root contract. The README carries what the tree cannot tell: why the module exists, what it receives, where the neighbouring work lives. A parent README names significant submodules.

## 7. Exceptions

An exception is legal only when a project decision describes it and a tool can check it. The known classes:

- the entry connects global styles, polyfills or settings before the app starts;
- test setup connects mocks and polyfills outside the production graph;
- build-time configuration imports files outside the runtime graph;
- a temporary migration alias, pointing at the target public API, with an end date;
- a documented cross-boundary read the public API cannot express (a report joining another module's table in SQL), written next to the code and in the module's build or lint file.

An exception never turns an internal file into an implicit public API.

## 8. Migrating

From **FSD** — not a rename of layers. FEOD has levels and modules, not layers, slices and segments.

| FSD | FEOD |
| --- | --- |
| `app`, `pages` | `app`, `pages` |
| `shared` | `common` for neutral code, `global` for declarations and polyfills; code with product meaning goes to a module |
| `entities`, `features` | `modules`, grouped by responsibility: `entities/user`, `features/change-email` and `widgets/profile-card` can become one `user` module |
| `widgets` | a module when reused as a product unit, otherwise `pages` |
| segments `ui` `api` `model` `lib` `config` | role files (`role-files`) |

A `modules/entities/` or `modules/features/` folder is FSD renamed, not migrated.

From a **modular or technical-kind layout** (`components/`, `hooks/`, `utils/`): find the stable product areas first, give each a public API, stop deep imports one consumer at a time, make dependency direction explicit.

Either way the migration is **gradual**. Each PR leaves no new violation behind; no PR is required to fix all legacy at once. A temporary alias (§7) keeps old imports compiling while consumers move.

Stack skills carry a worked migration (`frontend-mvvm`).

## 9. Review checklist

- [ ] Changed code sits on the level whose role matches it
- [ ] External imports end at an entity's root; no new deep import
- [ ] Root contracts name every export; no wildcard re-export
- [ ] Every new export has a consumer or a reason
- [ ] `common` names no product term and no module
- [ ] Pages assemble; they export no reusable business logic and import no other page
- [ ] Nothing imports `global`; one infrastructure point connects it
- [ ] Submodules are reached only through the parent's root
- [ ] Every module with a ViewModel has a README with purpose, injected dependencies, out of scope
- [ ] Exceptions are written down and checkable

## Related skills

| Need | Load |
| --- | --- |
| What each role inside a module owns | `mvvm` |
| How files inside a module are named and grouped | `role-files` |
| FEOD on a web frontend; lint enforcement | `frontend-mvvm`, `frontend-boundaries` |
| FEOD on Qt Quick; compiler enforcement | `qt-mvvm`, `qt-cmake-boundaries` |
| Naming one symbol, a signature | `code-craft` |
