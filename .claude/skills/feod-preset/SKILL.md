---
name: feod-preset
description: FEOD preset — stricter module rules on top of the official `feod` skill. Use together with `feod` when starting a project, creating or placing a module, a submodule or a common entity, or reviewing a module's exports.
---

# FEOD preset

Load the official `feod` skill first (`npx skills add Sdju/feod`); it owns the levels, the import matrix, the project profile and the lint setup. Where this file and `feod`'s defaults differ, templates included, this file wins. An existing project's `feod.profile.md` and layout win over both: follow them and mention the divergence in one line. Load `mvvm` too (`npx skills add ScobarDen/scobar-skills --skill mvvm`): inside a module, responsibilities are `mvvm`.

Every rule below holds for the code you add or move. Name any rule you could not satisfy and why.

## Stack spelling

The rules below are stack-neutral; the examples are TypeScript. A stack skill spells them for its stack (`frontend-mvvm` on the web). Without one, spell each row in the language's own idiom and record the choice as one line under `## Project notes` in `feod.profile.md`:

| Rule says | TypeScript | Any other stack |
| --- | --- | --- |
| **public entry**: the one file that is a module's public API | `index.ts` | the file the language treats as a folder's entry (`__init__.py`, `mod.rs`); where it has none, `index.<ext>`. Only modules and submodules have one: level and role folders go without it where the language allows, the test runner configured for that layout, and keep it empty where it does not |
| wildcard re-export | `export *` | whatever re-exports a file without naming its symbols (`from x import *`, an `export` with no `show`) |
| cross-level and cross-module imports | the `@/` alias | the absolute path from the source root, under the project's package name where the language has one (`shop.modules.cart`, `package:shop/modules/cart/index.dart`); imports inside a module are relative |
| the FEOD config source | `package.json#feod` | `feod.config.json`, with `srcRoot` and, for a public entry other than `index.ts`, `modules.publicEntries` |
| level folders | `app`, `pages`, `modules`, `common`, `global` | the same; a project with no UI names the `pages` level `routes` or `commands` through `layerDirs`, as `feod`'s init hints, and every rule about `pages` holds for it |

`feod`'s lint plugins read JavaScript and TypeScript only. On another stack the config and the profile are still written, `feod`'s `info` script reads both, and every import you add is checked against `feod`'s import matrix by hand; say so in your final message.

## New project

After `feod`'s init flow writes `feod.profile.md`:

1. Under `## Project notes` in `feod.profile.md`, add one line: module rules follow the `feod-preset` skill, and naming follows `role-files` or `feod`, whichever Names picked.
2. With `role-files`, set `modulePages: no` and `fileBasedRouting: no` in the profile table. `feod`'s template writes `yes` to both, and the profile outranks `role-files`, so left alone it overrides `role-files` §6 before the first line of code. A framework that dictates its router (Next, Nuxt) keeps `fileBasedRouting: yes`.
3. Put these options into the FEOD config source `feod` set up, `package.json#feod` or `feod.config.json`. When there is none yet, lint wiring included, create `package.json#feod`, or `feod.config.json` in a project with no `package.json`:

   ```json
   {
     "modulePages": false,
     "submodules": { "visibility": "parent-only" },
     "modules": {
       "forbiddenNames": ["utils", "helpers", "shared", "misc", "services", "components", "composables", "hooks", "constants", "types"]
     }
   }
   ```

   Without `role-files`, drop `modulePages` and write the names in PascalCase (`Utils`, `Helpers`, …): the check is exact and case-sensitive.

The `global` level folder is `global`, the config schema's default; `feod`'s templates that show `globals/` do not apply. The folder is created with its first file: a stack with nothing ambient to declare or patch has none.

Done when the profile names the preset and the naming, module pages are off in both the profile and the config (with `role-files`), and the config holds the submodule and forbidden-name options.

## Module or common

> Can you state what it is **without naming the product domain**?
> Yes → `common`. No → a module, possibly a cross-cutting one (`auth`, `notifications`, `feature-flags`).

Decide by this test alone, whatever the reuse count. Money formatting, an HTTP client: `common`.

UI is the one exception, in a project that has UI: every UI primitive the project writes, a lone button included, goes to the design-system module `ui-kit`, as `feod` has it, and `common` holds no Views. A coloured dot with a label is `ui-kit`'s; the same dot named `CategoryDot` is a thin wrapper in the `category` module over it. A kit the platform or a library ships (Material, a component library) is used directly; `ui-kit` holds the project's own primitives and its wrappers over that kit.

A common entity is a file on the `common` level, at most one folder deep, whose purpose can be stated without naming the product domain. It has no public entry; consumers import the file.

## Module public API

- The public entry names every export one by one; a wildcard re-export publishes whatever lands in the folder next.
- A new export has a consumer or a stated reason.
- Exported names are domain names (`Checkout`, `getOrderTotal`); `CheckoutApi`, `createCheckoutApi` and `UserModel` echo an internal folder or role marker. A collaborator the app constructs is exported as what the domain calls it, with its kind when there are several: `OrderRepository`, `InMemoryOrderRepository`.
- The owner exports its types, and consumers import them from it. A type's owner is the module that creates its values: `checkout` places an order, so it owns `Order`, and `orders`, which keeps them, imports it.
- An external package wrapped by a common entity or a module is used only through that wrapper.

## Names

`role-files` decides naming when that skill is available (`npx skills add ScobarDen/scobar-skills --skill role-files`); without it, `feod`'s templates do. The switch covers every name:

| | With `role-files` | Without it |
| --- | --- | --- |
| Module folders | `role-files`' case (§3): kebab-case, `checkout`, `feature-flags`, or the language's idiom where it cannot import a hyphen | `feod`'s PascalCase: `Checkout`, `FeatureFlags` |
| Files and folders on every level, inside modules included | `role-files`: role folders replace `feod`'s folders by technical kind, mapped in `frontend-mvvm` §4 | `feod`'s templates |
| Routes | in `pages`, the module never knows its URL (`role-files` §6) | `feod`'s module pages and module `routes.ts` |

- Modules are domain nouns. If no short product name fits, the boundary is not clear yet.
- The names in the `forbiddenNames` list under New project never name a module.
- With `role-files`, a folder on every level is named after a responsibility or a role. The `forbiddenNames` names are neither, except `types`: a role folder inside a module, never a module name.

## Submodules

- Cut one when a part of the module gets its own reason to change, a single file included: `modules/checkout/modules/delivery/`. File count alone never cuts one, and a folder grouping files by technical kind is not a submodule.
- A part with its own consumers and its own product responsibility is a separate module.
- Code outside the parent reaches a submodule through the parent's public entry. Lint allows the submodule's own public entry until the config sets `submodules.visibility: "parent-only"`.

## Module README

Every module and submodule has a `README.md` of five to fifteen lines with these parts, in this order, and nothing else. It covers what `feod` asks of a README, purpose, public API and an example, plus the module's edges:

- `# <module>`.
- One sentence of purpose. A headless module, one with no View of its own, says so here.
- `Exports:` the names consumers mount or type against, as the public entry exports them; it changes in the same commit as the public entry.
- `Injected:` what is injected and from where; `nothing` when nothing is.
- `Out of scope:` neighbouring responsibilities, each with the module that owns it.
- `Usage:` how a consumer mounts or calls it, one to three lines.

```md
# checkout

Turns a cart into a placed order: address, delivery slot, payment.

- Exports: `Checkout`, `CheckoutProps`, `Order`.
- Injected: `cartSource` (from the page), `paymentClient` (from `app/`).
- Out of scope: cart editing (`cart`), order history (`orders`).
- Usage: `<Checkout cartSource={cartSource} paymentClient={paymentClient} />`
```

The README is the module's one description, for people and agents alike. A module's `AGENTS.md` holds only agent instructions specific to that module, such as a gotcha or a command, and leaves the description to the README.

## Exceptions

A rule gives way only to an exception written next to the code and checked by a tool (the FEOD config's `ignore`, a lint override with a comment); a temporary one carries an end date. On a stack no lint covers, the exception is a comment beside the import plus one line under `## Project notes` in the profile. The excepted import is the whole exception: the file it reaches stays internal.
