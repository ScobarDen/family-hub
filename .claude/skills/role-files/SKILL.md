---
name: role-files
description: "Role files — files named and placed by the role they play (`checkout.vm.ts`): a closed role list, one file at the root or a role folder, on every FEOD level, and a role import matrix. Load when naming or placing a file or a folder, when a module or a file is too big to navigate, or when deciding which role may import which."
---

# Role files

The goal is a module you understand from its file list: open the folder, read the names, know what happens and where.

**Project conventions win.** An existing naming scheme or a file-based router outranks this file. Follow it and mention the divergence in one line. Every other rule below holds for the files you add or move. Name any rule you could not satisfy and why.

## Terms

- **Level**: one of the five top-level folders `app`, `pages`, `modules`, `common`, `global` (FEOD). A project with no UI may name `pages` `routes` or `commands` (`feod-preset`, Stack spelling); every rule about `pages` holds for it.
- **Module**: a folder on the `modules` level holding one product responsibility, used from outside only through its public API. A **submodule** is a module nested in `modules/<name>/modules/<sub>/`.
- **Public API**: a module's public entry, the one file that is the contract it exposes to the rest of the code (`index.ts` in TypeScript, `__init__.py` in Python; `feod-preset`, Stack spelling); everything else in it is internal.
- **Common entity**: a file on the `common` level whose purpose can be stated without naming the product domain.
- **Role**: what a file is responsible for inside a module. Model, ViewModel and View are the MVVM roles; `route`, `config`, `types`, `lib` are supporting roles.

## 1. Role marker

A file states its role through a **role marker**: a suffix in its name, the last word before the extension (`checkout.vm.ts`; `checkout_vm.py` where §3 Case changes the separator), or the role folder it sits in (`vm/`). The suffix is the default and is always there; a folder appears when a role grows (§4) and its files keep the suffix. Tooling keys off the suffix: lint globs and build targets enforce role boundaries, and fuzzy search on `checkout vm` finds the file. A stack skill may make the folder alone the marker; then every role is a folder, a single file included.

On every level, role markers replace folders by technical kind (`components/`, `composables/`, `hooks/`, `store/`); `frontend-mvvm` §4 maps `feod`'s folders to roles.

A file with no role carries no marker: the public entry, the module `README.md`, and the files §4 App and global names. A stylesheet or an asset that belongs to one file takes that file's name with its own extension (`cart.web.view.css`) and counts in that file's role.

## 2. The roles

| Marker | Holds | MVVM role (`mvvm`) |
| --- | --- | --- |
| `model` | domain types, domain rules, domain state, and the type of every injected collaborator (`OrderRepository`, `PaymentClient`), which `api` implements; a store that is itself the source of truth in memory (a cart with no backend) is domain state, so `model` | Model |
| `api` | whatever crosses the process boundary, transport or storage, plus the backend → domain adapter; a repository is `api`, and so is its in-memory stand-in for that storage (`InMemoryOrderRepository`) | Model |
| `dto` | raw backend shapes; they stop at `api` | Model |
| `vm` | screen state, commands, UI-shaped data, list adapters | ViewModel |
| `view` | passive render of ViewModel output, and the module root that constructs the ViewModel (`mvvm` §4); with no screen, the delivery binding (`mvvm` §10) | View |
| `route` | route declaration; lives in `pages`, the router collecting them in `app` as `app.route.ts` | — |
| `config` | constants and feature flags the whole module shares | — |
| `types` | types with no single owner file | — |
| `lib` | pure helpers internal to the module | — |
| `test`, `stories` | as the runner requires | — |

The list is **closed**. A file that fits no role signals that the module holds two responsibilities. A genuinely new role extends this table, or the `## Roles` section of the repository's root `README.md`, first. A stack that spells markers its own way maps them to this table in its skill.

`feod`'s templates group files by technical kind; `frontend-mvvm` §4 maps each of their folders to a role.

## 3. Names

- **Subject**: the part of a file name before the role marker, naming the concept the file is about. The file whose subject is the module's name is the main file of its role: `checkout.vm.ts`, `checkout.view.tsx`. Every other file is named after its concept: `delivery-address.model.ts`, `promo-code.api.ts`. The path supplies the module. The module root (`mvvm` §4) shares the main `view` file with the passive View it mounts.
- **Case**: kebab-case for every file and folder, with a dot before the marker. Where the language cannot import such a name or its own linter rejects it, the language's file-naming idiom takes over for files and folders alike, and the marker stays the last word before the extension: `checkout_vm.py`, `feature_flags/`. The stack skill states the idiom; without one, pick it and record it as one line under `## Project notes` in `feod.profile.md`.
- **Hosts.** A module rendered by several hosts puts the host before the role: `checkout.web.view.tsx`, `checkout.native.view.tsx`. A glob on the role still matches both. The module keeps one public entry, exporting each host's View under its own name.
- **Tests** sit beside the file they test and repeat its name: `checkout.vm.test.ts`. Where the runner dictates its own tree or suffix, the test mirrors the file's path there and keeps its name: `test/modules/checkout/checkout.vm_test.dart`. A test split by behaviour (§5) keeps the prefix: `order-total.model.discounts.test.ts`. A test of two modules tests their mediator and sits beside it (`mvvm` §9).
- **Constants** tuned together with one rule live in that rule's file; `config` holds only what the whole module shares.

## 4. One file or one folder per role

### Modules

Count the files of each role that sit in the module, tests, stories and styles included (`checkout.vm.test.ts` counts as `vm`; a test the runner keeps in its own tree is not in the module):

- **One file** → it sits at the module root.
- **Two or more** → all of them move into a folder named exactly like the marker: `model/`, `vm/`, `view/`, `api/`, `dto/`, `lib/`, `config/`, `types/`. Files keep the suffix inside the folder; the suffix is what globs and search see.

```
modules/checkout/
  index.ts
  README.md
  checkout.api.ts
  checkout.dto.ts
  checkout.config.ts
  checkout.view.tsx
  model/
    checkout.model.ts
    delivery-address.model.ts
    order-total.model.ts
    order-total.model.test.ts
  vm/
    checkout.vm.ts
    checkout.vm.test.ts
```

A submodule (`modules/<name>/modules/<sub>/`) repeats the same layout inside its own folder.

### Common

`common` is at most one folder deep (FEOD) and groups its files by role: each common entity sits in its role's folder, `common/lib/format-money.lib.ts`, `common/api/http-client.api.ts`. `common` has no `view/`: UI primitives live in the `ui-kit` module (`feod-preset`, Module or common). A common entity is one file plus its test wherever the stack allows; one that keeps growing files is a module. `common` has no public entry: consumers import the file.

### Pages

The page folder follows the URL: `/cart` → `pages/cart/`, `/` → `pages/home/`. Inside it, `<page>.route.ts` declares the route and `<page>.view.tsx` mounts module roots; the subject is the page folder's name. A private page module (`pages/_<name>/`) is laid out like a module, public entry included. A page that renders nothing of its own is the `route` file alone. With no screen that is every page, and its `route` file mounts the module roots and wires them; with a screen, it is a page mounting one module root with nothing to wire. A page folder stays flat whatever its file count: tests sit beside its files, and no role folder appears.

`feod`'s module pages and a module's `routes.ts` are not used: the route lives here (§6). A page that mounts a single module root is expected, since it owns the route and wires the module; `feod`'s warning against a thin page targets a page wrapping a module page.

### App and global

Files on `app` carry role markers and follow the module layout, the one-file-or-folder count included; the entry point and its test carry no marker and stay at the `app` root: `app.config.ts`, `default-layout.view.tsx`, a `view/` folder once there are two Views. Global styles are imported, so they live on `app` as the entry point's stylesheet, named after it and beside it (`main.css` next to `main.tsx`); like the entry point, it carries no marker and counts in no role, so a root View is not needed to hold it. Entry points keep the name and the place the toolchain expects (`main.tsx`, Flutter's `lib/main.dart`), belong to the `app` level wherever they sit, and hold the app's composition root (`mvvm` §4), constructing `api` values from the modules' public entries; `feod`'s `info` reports one outside the `app` folder as belonging to no layer, which is expected; one that outgrows the entry point moves to `app.vm.ts`. Assets no single file owns (fonts, favicons) sit in `app/assets/` with no marker. Files on `global` are never imported (FEOD): ambient declarations, polyfills and shims only; a stack with none has no `global` folder. They carry no role marker: each is named after what it patches or declares, `array.polyfill.ts`; a declaration the toolchain names keeps that name, `vite-env.d.ts`.

## 5. Size is a prompt, the cut is by responsibility

Past ~200 lines (tests ~500), name the responsibilities inside the file. One name keeps the file; several split it along their reasons to change. A pricing file mixing promo codes, loyalty points and shipping fees, each tuned on its own, is three files at any length.

## 6. The View lives in its module

The module owns its whole MVVM stack, View included; `pages` only mounts it and passes dependencies. A page holding a module's markup splits one module across two levels, and understanding it means reading both. A module never knows the route it is mounted at.

A **headless module** (Model and ViewModel only, Views elsewhere) is legitimate when it is decided, and its README says so.

## 7. Role import matrix

| Files of role | Must not import | Why |
| --- | --- | --- |
| every role except `api`, `dto` and tests | `dto` | raw backend shapes stop at `api` |
| `view` | `api`, `dto`, types included | the View binds ViewModel output and never sees transport; the module root types its dependencies against `model` |
| `vm` | `view`, `dto`; `api` values (types pass) | the ViewModel does not know how it is drawn, and reaches transport through `model` or an injected instance it never constructs |
| `model` | `vm`, `view`, `dto` | the Model sits below the ViewModel |
| `api` | `vm`, `view` | transport sits below the ViewModel |
| `config`, `types`, `lib` | `vm`, `view`, `api` | supporting roles sit below every MVVM role |
| the public entry | wildcard re-exports | the public API names every export (`feod-preset`, Module public API) |

A test may import what its subject must not, inside its own module: a `vm` test takes the module's in-memory `api` as its fake.

Enforce the table with the stack's boundaries skill (`frontend-boundaries` on the web). Without one, check every import you add against the table and say so.

## 8. Review checklist

Done when every file you added or moved passes:

- [ ] Every file with a role carries a marker from §2; every file without one is listed in §1
- [ ] A role with one file sits at the root; a role with two or more, tests and styles included, is a folder named like the marker
- [ ] Tests are named after the file they test and sit beside it, or mirror its path where the runner dictates the tree
- [ ] Every file past ~200 lines (tests ~500) names one responsibility
- [ ] The module's View is inside the module, or the README records it as headless
- [ ] Routes and page views live in `pages`; the module does not know its URL
- [ ] `common`, `pages`, `app` and `global` follow §4
- [ ] Every import obeys §7

## Related skills

| Need | Load |
| --- | --- |
| Levels, public API, submodules | `feod` (`npx skills add Sdju/feod`), `feod-preset` (`npx skills add ScobarDen/scobar-skills --skill feod-preset`) |
| What each role owns | `mvvm` (`npx skills add ScobarDen/scobar-skills --skill mvvm`) |
| Role files in TypeScript; lint rules | `frontend-mvvm`, `frontend-boundaries` (`npx skills add ScobarDen/scobar-skills --skill <name>`) |
