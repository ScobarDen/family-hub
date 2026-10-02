# Research: Vite+ как тулчейн монорепы Family Hub

- Тикет: https://github.com/ScobarDen/family-hub/issues/4
- Дата проверки источников: **2026-10-02**
- Контекст: монорепа `apps/web` (React + Reatom, shadcn + Tailwind v4, GitHub Pages) + `apps/api` (Hono на Cloudflare Workers, wrangler, D1) + `packages/contract`.

## TL;DR — вердикт

**Годится как тулчейн монорепы — да, с одной оговоркой по тестам `apps/api`.**

- Для `apps/web` и `packages/contract` Vite+ 1.0 закрывает всё: dev/build (Vite 8 + Rolldown), `vp check` (Oxfmt + Oxlint + type-check через tsgolint), `vp test` (Vitest 5), `vp run` (таск-раннер с кэшем), хуки, CI-экшен.
- Для `apps/api` Vite+ закрывает lint/format/type-check и таски. **Но** официальная интеграция тестов в workerd (`@cloudflare/vitest-plugin`, бывший `@cloudflare/vitest-pool-workers`) на дату проверки поддерживает только Vitest `^4.1.0`, а Vite+ 1.0 жёстко зашивает Vitest `5.0.1`. Тесты Worker-а внутри workerd/miniflare с D1-биндингами под `vp test` сейчас не взлетят — нужен обход (см. «Риски»).
- Проекту 4 дня в статусе stable (1.0.0 вышел 2026-09-28), но за ним VoidZero (Vite, Vitest, Rolldown, Oxc), который с июня 2026 — часть Cloudflare. Лицензия MIT, платных частей нет.

## Что такое Vite+ сегодня

Единый тулчейн: один пакет `vite-plus` + CLI `vp`, внутри Vite, Vitest, Oxlint, Oxfmt, Rolldown, tsdown и Vite Task. Плюс глобальный `vp`, который умеет управлять Node.js и пакетным менеджером. [guide](https://viteplus.dev/guide), [why](https://viteplus.dev/guide/why)

Версии, зашитые в `vite-plus@1.0.0` ([release v1.0.0](https://github.com/voidzero-dev/vite-plus/releases/tag/v1.0.0)):

| Инструмент | Версия |
| --- | --- |
| vite (через `@voidzero-dev/vite-plus-core`) | 8.3.1 |
| rolldown | 1.2.11 |
| vitest | 5.0.1 |
| oxlint / oxlint-tsgolint | 1.85.0 / 7.0.2003 |
| oxfmt | 0.70.0 |
| tsdown | 0.23.0 |

Требование к Node: `^22.18.0 || ^24.11.0 || >=26.0.0` (`engines` в `vite-plus@1.0.0`, [test guide](https://viteplus.dev/guide/test)).

### Команды

| Команда | Что делает | Источник |
| --- | --- | --- |
| `vp create` | скаффолд app/library/monorepo (`vite:monorepo`, `vite:application`, …), умеет community-шаблоны (`vp create vite -- --template react-ts`) | [create](https://viteplus.dev/guide/create) |
| `vp migrate` | перевод существующего проекта; в монорепе — только из корня | [migrate](https://viteplus.dev/guide/migrate) |
| `vp install` / `add` / `remove` / `update` / `why` / `dlx` / `pm …` | обёртка над обнаруженным пакетным менеджером | [install](https://viteplus.dev/guide/install) |
| `vp dev` / `vp build` / `vp preview` | обычный Vite dev server / production build на Vite 8 + Rolldown | [dev](https://viteplus.dev/guide/dev), [build](https://viteplus.dev/guide/build) |
| `vp check` | format + lint + type-check за один проход; `--fix` | [check](https://viteplus.dev/guide/check) |
| `vp lint` / `vp fmt` | Oxlint / Oxfmt по отдельности | [lint](https://viteplus.dev/guide/lint), [fmt](https://viteplus.dev/guide/fmt) |
| `vp test` / `vp test watch` | Vitest; по умолчанию **не** watch | [test](https://viteplus.dev/guide/test) |
| `vp pack` | библиотеки через tsdown | [pack](https://viteplus.dev/guide/pack) |
| `vp run` / `vpr` | скрипты `package.json` и таски из `vite.config.ts`, `-r`, `--filter`, `--parallel`, `dependsOn`, кэш | [run](https://viteplus.dev/guide/run), [cache](https://viteplus.dev/guide/cache) |
| `vp config` / `vp hooks` / `vp staged` | git-хуки и проверки staged-файлов | [commit-hooks](https://viteplus.dev/guide/commit-hooks) |
| `vp env` | пиннинг Node и PM (только глобальный CLI) | [env](https://viteplus.dev/guide/env) |

Важная семантика: встроенные команды (`dev`, `build`, `test`, `lint`, `fmt`, `check`, `pack`, `preview`) **нельзя переопределить** скриптом в `package.json`. Скрипт с тем же именем запускается через `vp run <name>`. [run](https://viteplus.dev/guide/run#built-in-commands-vs-scripts)

### Конфиг

Всё в одном `vite.config.ts` через `defineConfig` из `vite-plus`: обычные Vite-опции + блоки `lint`, `fmt`, `check`, `test`, `run`, `pack`, `staged`, `create`, `defaultPackage`. Отдельные `vitest.config.ts`, `.oxlintrc.json`, `.oxfmtrc.json` не рекомендуются. [config](https://viteplus.dev/config)

API тестов импортируется из `vite-plus/test` (`describe`, `expect`, `it`, `vi`), отдельно ставить `vitest` не нужно. [test](https://viteplus.dev/guide/test)

### Монорепа

- Корневой `vite.config.ts` держит общие `lint`/`fmt`/`staged`/`run`; пер-пакетные различия — через `lint.overrides` / `fmt.overrides` с глобами от корня (`apps/web/**`, `apps/api/**`). Вложенные `lint`/`fmt` блоки в пакетах **не** применяются к файлам при `vp check` — это осознанное решение команды. [monorepo](https://viteplus.dev/guide/monorepo), [troubleshooting](https://viteplus.dev/guide/troubleshooting)
- В пакетах остаются свои `vite.config.ts` для Vite/Vitest/плагинов.
- `vp dev` / `vp build` из корня сами выбирают пакет-приложение (или picker), в CI без цели падают с exit 1 и подсказкой; явная форма — `vp -C apps/web build` или `defaultPackage` в корневом конфиге. [monorepo#app-commands](https://viteplus.dev/guide/monorepo#app-commands)
- Порядок в `vp run -r` строится по обычным `dependencies` между workspace-пакетами. [run](https://viteplus.dev/guide/run)
- Шаблон `vite:monorepo` создаёт `apps/*`, `packages/*`, `tools/*`, `pnpm-workspace.yaml` с `catalogMode: prefer` и каталогом (`typescript: ^7.0.0`, `@types/node: ^24`), корневой `vite.config.ts` с `run.cache: true`. [template @ v1.0.0](https://github.com/voidzero-dev/vite-plus/tree/v1.0.0/packages/cli/templates/monorepo)

## Стабильность

- `v1.0.0` — **2026-09-28**, «promotes v1.0.0-rc.1 to stable with no code changes». До этого 0.2.x–0.3.x выходили раз в 1–2 недели с breaking-изменениями (например, переименования `VP_*` переменных в 0.2.8, перенос настроек кэша под `cache` в rc.1). [releases](https://github.com/voidzero-dev/vite-plus/releases)
- Анонс 1.0: ~2 млн загрузок в неделю, >2600 публичных зависимых репозиториев; сами авторы пишут, что проект «far from feature-complete» (впереди remote cache, `vp release`). [announcing 1.0](https://voidzero.dev/posts/announcing-vite-plus-1-0)
- Репозиторий: 5.9k звёзд, 190 открытых issue/PR, активные коммиты в день проверки. (`gh api repos/voidzero-dev/vite-plus`)
- Кэш задач между запусками GitHub Actions помечен **Experimental**. [github-actions-cache](https://viteplus.dev/guide/github-actions-cache)
- `vp-setup.exe` для Windows пока не подписан (SmartScreen). [guide](https://viteplus.dev/guide)

## Лицензия и условия

- **MIT**, Copyright VoidZero Inc. ([LICENSE](https://github.com/voidzero-dev/vite-plus/blob/main/LICENSE)). В анонсе 1.0: «open source under MIT», платных тарифов/коммерческих частей нет. [announcing 1.0](https://voidzero.dev/posts/announcing-vite-plus-1-0)
- VoidZero присоединилась к Cloudflare (2026-06-04); заявлено, что Vite, Vitest, Rolldown, Oxc и Vite+ остаются open source под MIT. [VoidZero is joining Cloudflare](https://voidzero.dev/posts/voidzero-cloudflare), [пресс-релиз Cloudflare](https://www.cloudflare.com/press/press-releases/2026/cloudflare-acquires-voidzero-to-build-the-future-of-the-ai-native-web/)
- Телеметрия в документации не упоминается.
- Для пет-проекта ограничений нет.

## Пакетный менеджер

- Vite+ — не пакетный менеджер, а обёртка: определяет PM по `packageManager` → `devEngines.packageManager` → `pnpm-workspace.yaml` → lock-файлам; **по умолчанию pnpm**. Поддерживаются pnpm, npm, Yarn, Bun. [install](https://viteplus.dev/guide/install)
- Шаблон монорепы и весь `migrate` заточены под pnpm (каталоги, `overrides` в `pnpm-workspace.yaml`). [template](https://github.com/voidzero-dev/vite-plus/tree/v1.0.0/packages/cli/templates/monorepo), [migrate-rules](https://viteplus.dev/guide/migrate-rules)
- Обязательные overrides на уровне workspace, чтобы плагины и зависимости видели тот же Vite/Vitest: `vite: npm:@voidzero-dev/vite-plus-core@<ver>` и `vitest: <bundled ver>`. `vp create`/`vp migrate` прописывают их сами. Dependabot/Renovate могут разъехать эти пины — это известная проблема ([#2356](https://github.com/voidzero-dev/vite-plus/issues/2356)). [local-cli](https://viteplus.dev/guide/local-cli#manual-installation)
- Рекомендация: **pnpm**, версия пиннится через `vp env pin pnpm@<ver>` или `packageManager`.

## Совместимость со стеком

| Компонент | Статус | Детали |
| --- | --- | --- |
| React | ✅ | `@vitejs/plugin-react@6.1.1` peer `vite ^8.0.0` — совпадает с Vite 8.3.1 в Vite+. Анонс: framework-agnostic, React в списке. [why](https://viteplus.dev/guide/why) |
| Tailwind v4 | ✅ | `@tailwindcss/vite@4.3.3` peer `vite ^5.2 \|\| ^6 \|\| ^7 \|\| ^8`. Обычный Vite-плагин в `plugins`. (npm view) |
| shadcn CLI | ✅ с нюансом | CLI определяет Vite-проект по наличию файла `vite.config.*` и читает алиас из `tsconfig` `paths` ([get-project-info.ts](https://github.com/shadcn-ui/ui/blob/main/packages/registry/src/utils/get-project-info.ts)) — что внутри конфига импортируется из `vite-plus`, ему всё равно. Нюанс: [гайд shadcn для Vite](https://ui.shadcn.com/docs/installation/vite) предлагает `compilerOptions.baseUrl`, а type-aware путь Oxlint (tsgolint) **не поддерживает `baseUrl`** — Vite+ тогда молча выключает `typeAware`/`typeCheck` ([troubleshooting](https://viteplus.dev/guide/troubleshooting)). Решение: `paths` без `baseUrl` (`"@/*": ["./src/*"]`). |
| Vitest | ✅ (Vitest 5) | Встроен, `vitest@5.0.1`, импорт из `vite-plus/test`. Браузерный режим: `@vitest/browser` + preview встроены, Playwright — opt-in. [test](https://viteplus.dev/guide/test), [migrate#vitest](https://viteplus.dev/guide/migrate#vitest) |
| Reatom | ✅ | Чистая runtime-библиотека без build-плагинов (`@reatom/core@1001.3.0`, `@reatom/react` peer только `react`/`@reatom/core`). На тулчейн не влияет. (npm view) |
| `@cloudflare/vite-plugin` | ⚠️ работает, есть открытые баги | peer `vite ^6.1 \|\| ^7 \|\| ^8`, `wrangler ^4.147.0` — совместим через alias на vite-plus-core. Открыто: [vite-plus#2481](https://github.com/voidzero-dev/vite-plus/issues/2481) — dev-сервер может зависнуть при рестарте, если в этот момент идёт запрос (воспроизводится только под Vite+); [workers-sdk#15969](https://github.com/cloudflare/workers-sdk/issues/15969) — с `@cloudflare/vite-plugin >=1.58.0` Vitest падает на старте, если в конфиге есть `cloudflare()` (регрессия, не специфична для Vite+). |
| Тесты Worker-а в workerd (`@cloudflare/vitest-plugin`) | ❌ на дату проверки | `@cloudflare/vitest-plugin@1.3.6` (и старый `@cloudflare/vitest-pool-workers@0.22.0`) peer `vitest ^4.1.0`; с Vitest 5 пул падает до запуска тестов. Поддержка Vitest 5 — открытый PR [workers-sdk#15500](https://github.com/cloudflare/workers-sdk/pull/15500), трекинг [workers-sdk#15618](https://github.com/cloudflare/workers-sdk/issues/15618). Vite+ 1.0 = Vitest 5 без выбора. |
| wrangler | ✅ | Вызывается как обычный бинарь из `vp run` / `vp exec` (`wrangler deploy`, `wrangler d1 migrations apply`). С Cloudflare Vite plugin `vite build` генерирует выходной `wrangler.json` в билде, деплой — `wrangler deploy`. [CF Vite plugin: get started](https://developers.cloudflare.com/workers/vite-plugin/get-started/), [static assets](https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/) |
| GitHub Pages base path | ✅ | Это стандартная Vite-опция `base: '/family-hub/'` (для `https://<user>.github.io/<repo>/`); `vp build` — это Vite build, конфиг тот же. [Vite static deploy](https://vite.dev/guide/static-deploy#github-pages), [build](https://viteplus.dev/guide/build) |

## GitHub Actions

Официальный экшен [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) ставит Vite+, Node и пакетный менеджер, кэширует данные PM (`cache: true`) — отдельные `setup-node` / `pnpm/action-setup` не нужны. Пиннить **точную версию** (последняя — `v1.21.1` от 2026-09-21) или SHA; тег `v1` больше не обновляется. [ci](https://viteplus.dev/guide/ci)

```yaml
- uses: actions/checkout@v4
- uses: voidzero-dev/setup-vp@v1.21.1
  with:
    node-version: '24'
    cache: true
- run: vp install --frozen-lockfile
- run: vp check
- run: vp run -r test
- run: vp -C apps/web build
```

Кэш Vite Task между запусками — через `actions/cache` на `node_modules/.vite/task-cache`, только для команд через `vp run`, статус Experimental; сначала замерить. [github-actions-cache](https://viteplus.dev/guide/github-actions-cache)

Деплой фронта: после `vp -C apps/web build` — стандартные `actions/upload-pages-artifact` (`apps/web/dist`) + `actions/deploy-pages`. [Vite static deploy](https://vite.dev/guide/static-deploy#github-pages)

## Рекомендуемый layout (эскиз)

```
family-hub/
├─ package.json            # private, type: module, packageManager: pnpm@…, scripts → vp
├─ pnpm-workspace.yaml     # packages: apps/*, packages/*; catalog; overrides vite/vitest (ставит vp)
├─ vite.config.ts          # defineConfig из 'vite-plus': lint (+overrides по apps/*), fmt, staged, run.tasks
├─ tsconfig.json           # базовый, без baseUrl
├─ .node-version           # или devEngines.runtime
├─ apps/
│  ├─ web/
│  │  ├─ package.json
│  │  ├─ vite.config.ts    # react(), tailwindcss(), resolve.alias '@', base: '/family-hub/', test: { environment: 'jsdom' | browser }
│  │  ├─ components.json   # shadcn
│  │  └─ tsconfig.json     # paths "@/*" без baseUrl
│  └─ api/
│     ├─ package.json      # deps: hono, @family-hub/contract; scripts: deploy → wrangler deploy
│     ├─ wrangler.jsonc    # D1 binding
│     ├─ vite.config.ts    # cloudflare() — только для dev/build, не для test (обход #15969)
│     └─ tsconfig.json
└─ packages/
   └─ contract/            # общие типы/схемы, без сборки (TS-исходники) или vp pack
```

Корневой `vite.config.ts` (идея):

```ts
import { defineConfig } from 'vite-plus';

export default defineConfig({
  lint: {
    plugins: ['typescript'],
    options: { typeAware: true, typeCheck: true },
    overrides: [
      { files: ['apps/web/**'], plugins: ['react'] },
      { files: ['**/*.test.ts', '**/*.test.tsx'], plugins: ['vitest'] },
    ],
  },
  fmt: { singleQuote: true },
  staged: { '*': 'vp check --fix' },
  run: { cache: true },
});
```

Старт: `vp create vite:monorepo`, затем `vp create vite -- --template react-ts` в `apps/web`, `apps/api` руками или через `create-hono`/`create-cloudflare` с последующим `vp migrate` из корня.

## Риски

1. **Тесты `apps/api` в workerd заблокированы** до выхода Vitest 5 в `@cloudflare/vitest-plugin` ([#15500](https://github.com/cloudflare/workers-sdk/pull/15500)). Обходы на сейчас:
   - тестировать Hono-приложение в Node-окружении через `app.request()` с фейковыми биндингами (D1 за интерфейсом репозитория — подменяется in-memory/SQLite-реализацией);
   - или для `apps/api` держать отдельный `vitest@4` + `@cloudflare/vitest-plugin` вне `vp test` — идёт против обязательного workspace-override `vitest` и рискует «split internals» ([local-cli](https://viteplus.dev/guide/local-cli#manual-installation)); не рекомендуется;
   - или подождать: PR активен (обновлён 2026-10-01), и VoidZero теперь внутри Cloudflare.
2. **Свежесть 1.0** (4 дня). До 1.0 breaking-изменения шли почти каждый минорный релиз. Пиннить точные версии `vite-plus` и `setup-vp`, апгрейдить через `vp migrate`.
3. **Двойной Vite/Vitest.** Если bot обновит `vite`/`vitest` отдельно от `vite-plus`, сломаются identity-проверки плагинов ([#1391](https://github.com/voidzero-dev/vite-plus/issues/1391), [#2356](https://github.com/voidzero-dev/vite-plus/issues/2356)). Группировать эти пакеты в Renovate/Dependabot.
4. **Глобальный vs локальный `vp`.** Глобальный `vp` с версией, отличной от локальной, ловил падения `vp test` ([#1076](https://github.com/voidzero-dev/vite-plus/issues/1076), закрыт). В скриптах и CI полагаться на локальный `vite-plus` из `node_modules`.
5. **Баги связки с `@cloudflare/vite-plugin`** в dev ([#2481](https://github.com/voidzero-dev/vite-plus/issues/2481)) и с Vitest ([workers-sdk#15969](https://github.com/cloudflare/workers-sdk/issues/15969)). Альтернатива для `apps/api`: вообще без Vite-плагина — `wrangler dev`/`wrangler deploy` через `vp run`, а Vite+ использовать только для check/test/таск-раннера.
6. **Oxlint вместо ESLint.** Нет 100% паритета правил ESLint-экосистемы; JS-плагины поддерживаются ([lint](https://viteplus.dev/guide/lint#js-plugins)). Для `react-hooks` и пр. проверить покрытие при настройке.
7. **`baseUrl` в tsconfig** молча выключает type-aware lint и type-check — держать `paths` без `baseUrl` (в т.ч. после `shadcn init`).

## Открытые вопросы

- Как тестировать `apps/api` до поддержки Vitest 5 в Cloudflare: Node + `app.request()` с абстракцией над D1, или ждать `@cloudflare/vitest-plugin` с Vitest 5?
- Нужен ли `@cloudflare/vite-plugin` для `apps/api` вообще, или достаточно голого wrangler (меньше движущихся частей)?
- Формат `packages/contract`: TS-исходники без сборки (проще) или `vp pack`?

## Источники

- https://viteplus.dev/llms.txt и страницы `/guide*.md`, `/config*.md` (скачаны 2026-10-02)
- https://github.com/voidzero-dev/vite-plus (releases, LICENSE, issues #1076, #1391, #1671, #2356, #2481, шаблон `packages/cli/templates/monorepo` @ v1.0.0)
- https://github.com/voidzero-dev/setup-vp/releases
- https://voidzero.dev/posts/announcing-vite-plus-1-0
- https://voidzero.dev/posts/voidzero-cloudflare
- https://developers.cloudflare.com/workers/vite-plugin/get-started/
- https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/
- https://github.com/cloudflare/workers-sdk/issues/15618, https://github.com/cloudflare/workers-sdk/pull/15500, https://github.com/cloudflare/workers-sdk/issues/15969
- https://vite.dev/guide/static-deploy#github-pages
- https://ui.shadcn.com/docs/installation/vite, https://github.com/shadcn-ui/ui/blob/main/packages/registry/src/utils/get-project-info.ts
- npm registry (`npm view`, 2026-10-02): `vite-plus`, `@cloudflare/vite-plugin`, `@cloudflare/vitest-plugin`, `@cloudflare/vitest-pool-workers`, `@tailwindcss/vite`, `@vitejs/plugin-react`, `@reatom/core`, `@reatom/react`, `wrangler`, `vitest`
