---
name: frontend-boundaries
description: Make the linter enforce FEOD levels and role boundaries on a web frontend — the official `@o-feod` structure plugin for levels, deep and zigzag imports, submodules and `common`, plus `no-restricted-imports` regex patterns for `.dto` and the role matrix, the `export *` ban, `max-lines` as a size prompt, copyable ESLint flat and oxlint configs. Load when setting up or reviewing a frontend lint config, adding a role or a host suffix, or when a review finds an import crossing a level or role boundary. What the boundaries mean is feod, feod-preset and role-files; this file only turns them into rules.
---

# Frontend boundaries

A boundary the linter does not check lasts until the first deadline. Two parts do the checking: the official FEOD plugin (`@o-feod/eslint-structure-plugin` or `@o-feod/oxlint-structure-plugin`, rules `feod-structure/*`) owns levels and module boundaries; `no-restricted-imports` with `regex` patterns owns the role matrix of `role-files` §7, whose suffixes come from `frontend-mvvm` §4. `max-lines` and the `export *` ban ride along. Both configs below were run on fixtures for every row with `@o-feod/*` 0.1.7, ESLint 10.13 with typescript-eslint and oxlint 1.90 (2026-10-27).

**Project conventions win.** An existing lint config, alias or boundary plugin keeps its shape; add the missing rows to it instead of replacing it. The official `feod` skill's lint reference covers installing the plugin, its options and diagnosing its errors.

## The matrix

This table is the lint translation of FEOD (`feod`, `feod-preset`) and `role-files` §7. Both configs below implement it, so a change here is a change in both, and a change of meaning starts in those skills.

| Files under `src/` | Must not | Checked by |
| --- | --- | --- |
| every file | import a level the matrix forbids (`common` → `modules`, page → page, anything → `global`) | `feod-structure/layer-imports` |
| every file | import past a module's `index.ts`, by alias or relative path | `layer-imports`, `no-zigzag-imports` |
| every file outside a module | import its submodule, even the submodule's `index.ts` | `layer-imports` with `submodules.visibility: "parent-only"` |
| `common/**` | have or import an `index.*`; sit more than one folder deep | `no-common-index`, `no-common-deep` |
| every file | live outside the five levels (`src/helpers/`) | `no-unknown-files` |
| every file except `.api`, `.dto` and tests | import `.dto` | `no-restricted-imports`: raw backend shapes stop at `.api`, re-exports from `index.ts` included |
| `*.view.{ts,tsx,vue}` | import `.api`, types included | the View binds VM output and never sees transport |
| `*.vm.ts` | import `.view`; `.api` values (types pass) | the VM does not know how it is drawn, and reaches transport through `.model` or an injected function (mediator in `mvvm` §4) |
| `*.model.ts` | import `.vm`, `.view` | the Model is below the VM |
| `*.api.ts` | import `.vm`, `.view` | transport is below the VM |
| `index.ts` | `export *` | `no-restricted-syntax`, ESLint only |
| every file | grow past 200 lines (tests 500) | `max-lines` as `warn`: a prompt to name the file's responsibilities |

## Project config

The plugin reads one source: a `feod` key in `package.json` or `feod.config.json`. The alias keys follow the project; `submodules` is this family's:

```json
{
  "feod": {
    "srcRoot": "src",
    "aliasPrefix": "@",
    "aliasRoot": "src",
    "submodules": { "visibility": "parent-only" }
  }
}
```

- `aliasPrefix`/`aliasRoot` teach the plugin the `@/` alias; without them it knows only `@modules`, `@common` and the other per-level aliases. Adjust to the project's.
- `submodules.visibility: "parent-only"` is `feod-preset`'s rule that a submodule is invisible outside its parent. The plugin's default, `"public"`, lets any module import a submodule's `index.ts`.

`global` is never imported, the entry included: `app/main.tsx` importing `@/global/polyfills` is a `layer-imports` error. Connect `global` outside the import graph: `.d.ts` files through `tsconfig.json` `include`, polyfills and global styles through `index.html` (`<script type="module" src="/src/global/polyfills.ts">` before the entry) or the bundler config.

## How overrides combine

Both linters apply overrides in order, and per rule the last matching one wins: its options replace the earlier ones for that file instead of merging. Two consequences:

- Each role override restates the base `.dto` pattern next to its own. The `restrict(role(...))` helpers do it.
- A rule the later override does not mention survives. `max-lines` from the base stays on a `.vm.ts` whose `no-restricted-imports` was replaced, and the `feod-structure/*` rules stay on every file.

A project boundary whose glob overlaps a role glob obeys the same law. A host rule for `*.web.view.tsx` that lists only `react-native` silently drops the View's `.api` / `.dto` patterns for web views; write it with the View's patterns plus its own, after the View override:

```js
{ files: ['src/**/*.web.view.{ts,tsx}'], rules: restrict(role('api', 'dto'), { group: ['react-native', 'react-native/*'] }) },
```

A pure-domain rule (`*.model.ts` imports no packages) is the same shape with its own glob.

`max-lines` as `warn` fails a build that treats warnings as errors (vite-plus `denyWarnings`, `eslint --max-warnings 0`). There, keep it out of CI and run it in review.

## ESLint (flat config)

Merge into the project's flat config: `.ts` files need its TypeScript parser (typescript-eslint), `.vue` files `vue-eslint-parser`, and `allowTypeImports` reads the type-import marks the TS parser sets. `configFromProject` registers the plugin and reads the `feod` config.

```js
import { fileURLToPath } from 'node:url'
import { configFromProject } from '@o-feod/eslint-structure-plugin'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const ext = String.raw`(\.([cm]?[jt]sx?|vue))?$`
const role = (...roles) => ({
  regex: String.raw`\.(${roles.join('|')})` + ext,
  message: 'Crosses a role boundary.',
})
const restrict = (...patterns) => ({ 'no-restricted-imports': ['error', { patterns }] })
const maxLines = (max) => ({
  'max-lines': ['warn', { max, skipBlankLines: true, skipComments: true }],
})

export default [
  { ...configFromProject({ rootDir, preset: 'recommended' }), files: ['src/**/*.{ts,tsx,vue}'] },
  { files: ['src/**/*.{ts,tsx,vue}'], rules: { ...restrict(role('dto')), ...maxLines(200) } },
  { files: ['src/**/*.test.{ts,tsx}'], rules: { 'no-restricted-imports': 'off', ...maxLines(500) } },
  {
    files: ['src/**/index.ts'],
    rules: {
      'no-restricted-syntax': ['error', { selector: 'ExportAllDeclaration', message: 'Name each export.' }],
    },
  },
  { files: ['src/**/*.dto.ts'], rules: { 'no-restricted-imports': 'off' } },
  { files: ['src/**/*.api.ts'], rules: restrict(role('vm', 'view')) },
  { files: ['src/**/*.model.ts'], rules: restrict(role('vm', 'view', 'dto')) },
  { files: ['src/**/*.vm.ts'], rules: restrict(role('view', 'dto'), { ...role('api'), allowTypeImports: true }) },
  { files: ['src/**/*.view.{ts,tsx,vue}'], rules: restrict(role('api', 'dto')) },
]
```

## oxlint

`oxlint.config.ts` (oxlint ≥ 1.86, the plugin's peer range), or the `lint` block of `vite.config.ts` under vite-plus. oxlint parses TypeScript and the script of `.vue` files on its own. It has no selector-based `no-restricted-syntax`, so `export *` stays a review item there (`feod-preset` §9).

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'oxlint'
import { configFromProject } from '@o-feod/oxlint-structure-plugin/configs'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const ext = String.raw`(\.([cm]?[jt]sx?|vue))?$`
const role = (...roles: string[]) => ({
  regex: String.raw`\.(${roles.join('|')})` + ext,
  message: 'Crosses a role boundary.',
})
const restrict = (...patterns: object[]) => ({ 'no-restricted-imports': ['error', { patterns }] })
const maxLines = (max: number) => ({
  'max-lines': ['warn', { max, skipBlankLines: true, skipComments: true }],
})

export default defineConfig({
  ...configFromProject({ rootDir, preset: 'recommended' }),
  overrides: [
    { files: ['src/**/*.{ts,tsx,vue}'], rules: { ...restrict(role('dto')), ...maxLines(200) } },
    { files: ['src/**/*.test.{ts,tsx}'], rules: { 'no-restricted-imports': 'off', ...maxLines(500) } },
    { files: ['src/**/*.dto.ts'], rules: { 'no-restricted-imports': 'off' } },
    { files: ['src/**/*.api.ts'], rules: restrict(role('vm', 'view')) },
    { files: ['src/**/*.model.ts'], rules: restrict(role('vm', 'view', 'dto')) },
    { files: ['src/**/*.vm.ts'], rules: restrict(role('view', 'dto'), { ...role('api'), allowTypeImports: true }) },
    { files: ['src/**/*.view.{ts,tsx,vue}'], rules: restrict(role('api', 'dto')) },
  ],
})
```

A project already on `.oxlintrc.json` keeps it: add `"jsPlugins": [{ "name": "feod-structure", "specifier": "@o-feod/oxlint-structure-plugin" }]`, the `feod-structure/*` rules with their options spelled out (JSON cannot call `configFromProject`), and the overrides above as JSON.

## Related skills

| Need | Load |
| --- | --- |
| What a level may import, the plugin's rules and options | `feod` (official) |
| This family's stricter rules: submodule visibility, public API | `feod-preset` |
| The role list and role matrix | `role-files` |
| Suffixes and `index.ts` in TypeScript | `frontend-mvvm` |
| The same boundaries enforced by a C++ compiler | `qt-cmake-boundaries` |
