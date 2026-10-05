---
name: role-files
description: Files named by the role they play — `{subject}.{role}.{ext}` (`checkout.vm.ts`, `order.dto.ts`) or a role folder, from a closed role list; one file of a role sits at the module root, two or more move into a folder named after the role; tests sit beside what they test; a role import matrix. Load when naming or placing a file inside a module, when a module or a file is too big to navigate, when deciding whether a role gets its own folder, or when setting up which role may import which. Stack-neutral; levels and public API are feod, what each role owns is mvvm, enforcement is frontend-boundaries or qt-cmake-boundaries.
---

# Role files

The goal is a module you understand from its file list: open the folder, read the names, know what happens and where.

## Provenance and precedence

- This family's own convention, built on `feod` (modules, submodules) and `mvvm` (roles). FEOD leaves a module's insides to the module; its examples use `ui/ model/ api/ lib/`, and role markers replace them.
- Suffix choice weighed against the [Angular style guide](https://angular.dev/style-guide), which dropped `.component` / `.service` as decoration, and NestJS, which keeps them. Here the role marker stays because tooling keys off it: lint globs and build targets enforce role boundaries, and fuzzy search on `checkout vm` finds the file.
- **Project conventions win.** An existing naming scheme or a file-based router outranks this file. Follow it and mention the divergence in one line.

## 1. Role marker

A file states its role through a **role marker**: a dot-suffix in its name (`checkout.vm.ts`) or the role folder it sits in (`vm/`). The stack skill says which one the stack uses:

- `frontend-mvvm`: the suffix is always there; a folder appears when a role grows (§4) and its files keep the suffix.
- `qt-mvvm`: the folder is always there, because the build gives every role folder its own target; file names follow Qt's own idiom.

## 2. The roles

| Marker | Holds | MVVM role (`mvvm`) |
| --- | --- | --- |
| `model` | domain types, domain rules, domain state | Model |
| `api` | transport plus the backend → domain adapter | Model |
| `dto` | raw backend shapes; they stop at `api` | Model |
| `vm` | screen state, commands, UI-shaped data, list adapters | ViewModel |
| `view` | passive render of ViewModel output | View |
| `route` | route declaration; lives in `pages` | — |
| `config` | constants, feature flags | — |
| `types` | types with no single owner file | — |
| `lib` | pure helpers internal to the module | — |
| `test`, `stories` | as the runner requires | — |

The list is **closed**. A file that fits no role signals that the module holds two responsibilities. A genuinely new role extends this table, or the project README, first. A stack that spells markers its own way maps them to this table in its skill.

## 3. Names

- **Subject.** The file named after the module is the entry of its role: `checkout.vm.ts`, `checkout.view.tsx`. Every other file is named after its concept: `delivery-address.model.ts`, `promo-code.api.ts`. The path supplies the module.
- **Hosts.** A module rendered by several hosts puts the host before the role: `checkout.web.view.tsx`, `checkout.native.view.tsx`. A glob on the role still matches both.
- **Tests** sit beside the file they test and repeat its name: `checkout.vm.test.ts`. Past ~500 lines a test splits by behaviour and keeps the prefix: `order-total.model.discounts.test.ts`.
- Case follows the stack's idiom; the stack skill states it.

## 4. One file or one folder per role

Count the files of each role in the module, tests and stories included (`checkout.vm.test.ts` counts as `vm`):

- **One file** → it sits at the module root.
- **Two or more** → all of them move into a folder named exactly like the marker: `model/`, `vm/`, `view/`, `api/`, `dto/`, `lib/`, `config/`, `types/`. Where the suffix is the marker, files keep it inside the folder; the suffix is what globs and search see.

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

The root shows at a glance which roles are one file and which have grown. Each role in a module is laid out one way: one file at the root, or all of its files in its folder. A submodule (`feod` §4) repeats the same layout inside its own folder.

## 5. Size is a prompt, the cut is by responsibility

Past ~200 lines (tests ~500), name the responsibilities inside the file. One name keeps the file; several split it along their reasons to change (`code-craft`). A pricing file mixing promo codes, loyalty points and shipping fees, each tuned on its own, is three files at any length.

## 6. The View lives in its module

The module owns its whole MVVM stack, View included; `pages` only mounts it and passes dependencies. A page holding a module's markup splits one module across two levels, and understanding it means reading both. A module never knows the route it is mounted at.

A **headless module** (Model and ViewModel only, Views elsewhere) is legitimate when it is decided, and its README says so.

## 7. Role import matrix

| Files of role | Must not import | Why |
| --- | --- | --- |
| every role except `api`, `dto` and tests | `dto` | raw backend shapes stop at `api` |
| `view` | `api`, `dto` | the View binds ViewModel output and never sees transport |
| `vm` | `view`, `dto`; `api` values (types pass) | the ViewModel does not know how it is drawn, and reaches transport through `model` or an injected instance it never constructs |
| `model` | `vm`, `view`, `dto` | the Model sits below the ViewModel |
| `api` | `vm`, `view` | transport sits below the ViewModel |
| the root contract | wildcard re-exports | the contract is explicit (`feod` §3) |

A boundary no tool checks lasts until the first deadline. `frontend-boundaries` turns this table into lint rules; `qt-cmake-boundaries` turns it into include paths the compiler enforces.

## 8. Review checklist

- [ ] Every file with a role carries a marker from §2
- [ ] Suffix stacks: a role with one file sits at the root; a role with two or more, tests included, is a folder named like the marker. Folder stacks: every role is a folder
- [ ] Tests are named after the file they test and sit beside it
- [ ] Every file past ~200 lines (tests ~500) names one responsibility
- [ ] The module's View is inside the module, or the README records it as headless
- [ ] Routes and page views live in `pages`; the module does not know its URL
- [ ] The role matrix is enforced by the stack's boundaries skill, or checked here

## Related skills

| Need | Load |
| --- | --- |
| Levels, public API, submodules | `feod` |
| What each role owns | `mvvm` |
| Role files in TypeScript; lint rules | `frontend-mvvm`, `frontend-boundaries` |
| Role folders in Qt; CMake targets | `qt-mvvm`, `qt-cmake-boundaries` |
