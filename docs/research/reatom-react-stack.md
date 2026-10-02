# Research: Reatom v1001 + React + reactuse + shadcn

Тикет: [#6](https://github.com/ScobarDen/family-hub/issues/6) · Карта: [#1](https://github.com/ScobarDen/family-hub/issues/1)
Проверено: **2026-10-02**. Версии на эту дату: `@reatom/core` **1001.3.0**, `@reatom/react` **1001.0.1** (обе опубликованы 2026-07-20), `@siberiacancode/reactuse` **1.0.17**. Исходники Reatom смотрел на коммите `main` `56c86f2`.

## Источники

- **[R-LLM]** Reatom v1001 LLM-дайджест — https://v1001.reatom.dev/llms.txt → https://www.reatom.dev/llms-full.txt
- **[R-REACT]** Reatom React adapter — https://v1001.reatom.dev/reference/react/
- **[R-SRC-RC]** `packages/react/src/reatomComponent.ts` — https://github.com/reatom/reatom/blob/main/packages/react/src/reatomComponent.ts
- **[R-SRC-BF]** `packages/react/src/bindField.ts` — https://github.com/reatom/reatom/blob/main/packages/react/src/bindField.ts
- **[R-SRC-PKG]** `packages/react/package.json` и `pnpm-workspace.yaml` (catalog) — https://github.com/reatom/reatom/blob/main/packages/react/package.json, https://github.com/reatom/reatom/blob/main/pnpm-workspace.yaml
- **[R-SRC-URL]** `packages/core/src/web/url.ts` — https://github.com/reatom/reatom/blob/main/packages/core/src/web/url.ts
- **[R-SRC-ROUTE]** `packages/core/src/routing/route.ts` — https://github.com/reatom/reatom/blob/main/packages/core/src/routing/route.ts
- **[R-1311]** Issue «reatomComponent never re-renders when a dependency resolves before mount() subscribes» (closed 2026-07-20) — https://github.com/reatom/reatom/issues/1311
- **[TG-WA]** Telegram Mini Apps — https://core.telegram.org/bots/webapps
- **[TMA-LP]** Launch parameters — https://docs.telegram-mini-apps.com/platform/launch-parameters
- **[TMA-SP]** Start parameter — https://docs.telegram-mini-apps.com/platform/start-parameter
- **[SH-LLM]** shadcn/ui llms.txt — https://ui.shadcn.com/llms.txt
- **[SH-FIELD]** shadcn Field — https://ui.shadcn.com/docs/components/field
- **[SH-TW4]** shadcn Tailwind v4 — https://ui.shadcn.com/docs/tailwind-v4
- **[RU]** reactuse — https://reactuse.org/llms.txt, README https://github.com/siberiacancode/reactuse
- **[GH-404]** GitHub Pages custom 404 — https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site
- **[VITE]** Vite static deploy / `base` — https://vite.dev/guide/static-deploy#github-pages

Пометка **(вывод)** — моя интерпретация или рекомендация, прямо в источнике так не написано. **(не проверено)** — стоит проверить руками на прототипе.

---

## TL;DR

- `@reatom/react` v1001 — живой и рабочий адаптер; peer `react >=18.2`, но сам репозиторий Reatom собирается и тестируется на **React 19.2** → React 19 — нормальный выбор. **[R-SRC-PKG]**
- Роутер Reatom матчит **только `url.pathname`**, встроенного hash-режима нет. Hash в Telegram ещё и занят launch-параметрами (`#tgWebAppData=…`). → **pathname-роутинг + `404.html`-fallback + base path через корневой layout-роут**. **[R-SRC-ROUTE] [TMA-LP]** (вывод)
- `startapp` приезжает в **query** (`?tgWebAppStartParam=`) и в `initData.start_param`; на старте декодируем его в `route.go(…, true)`. **[TG-WA] [TMA-SP]**
- Формы: **`reatomForm` = модель, shadcn `Field*` = вёрстка**. Они ортогональны; React Hook Form не нужен. Нужен тонкий адаптер от `bindField` к пропсам shadcn-контролов. **[R-SRC-BF] [SH-FIELD]**
- reactuse — только для **эфемерного DOM/сенсорного состояния, которое живёт и умирает в одном View**. Всё, что читает ViewModel, переживает unmount, участвует в async/валидации/URL/хранилище — Reatom.

---

## 1. React-адаптер Reatom v1001 и React 19

### Факты

- Пакет `@reatom/react@1001.0.1`, peer: `react >=18.2.0`, `react-dom >=18.2.0`, `@reatom/core ^1001.3.0`. **[R-SRC-PKG]**, `npm view @reatom/react`.
- В catalog монорепы Reatom: `react ^19.2.6`, `react-dom ^19.2.6`, `@types/react ^19.2.15`, `@vitejs/plugin-react ^6.0.2` — то есть адаптер разрабатывается и тестируется именно на React 19. **[R-SRC-PKG]**
- В `packages/react/src` есть отдельные тесты `reatomStrictMode.test.tsx` и `reatomFactoryComponentStrictMode.test.tsx` — StrictMode покрыт. **[R-SRC-RC]** (листинг каталога)
- Публичное API: `reatomComponent`, `reatomFactoryComponent`, `useAtom`, `useAction`, `useWrap`, `useFrame`, `reatomContext`, `bindField`. **[R-REACT] [R-SRC-RC]**
- Документация прямо говорит: `reatomComponent` — «preferred way to use Reatom in React»; для простых случаев «native `useSyncExternalStore` will be enough». `useAtom` внутри использует `useSyncExternalStore`. **[R-REACT]**, `hooks.ts`.
- `reatomComponent` вызывает твою функцию внутри обычного React-рендера, подписку ставит в `useLayoutEffect`; если рендер «саспендится», при наличии `React.use` использует его (React 19 путь). **[R-SRC-RC]**
- Свежий баг «компонент не перерендеривается, если зависимость резолвится до подписки» (`useEffect` vs микротаска) закрыт 2026-07-20 переходом на `useLayoutEffect` — это ровно релиз `1001.0.1`. **[R-1311] [R-SRC-RC]** → **минимальная версия для нас — `@reatom/react@1001.0.1`**.
- `reatomContext.Provider` нужен только если стартуешь с `clearStack()`. **[R-REACT]**
- `@reatom/react` дополняет тип `RouteChild` из `@reatom/core` до `JSX.Element`, так что `render` у `reatomRoute` может возвращать JSX. `packages/react/src/index.ts`.

### Рекомендуемая связка (вывод)

- React 19 + `@reatom/core@^1001.3` + `@reatom/react@^1001.0.1`, ставить парой и дедуплицировать (`pnpm rm … && pnpm i …@latest` — рекомендация из доков **[R-LLM]**).
- View = `reatomComponent(() => …, 'Name')`; локальное состояние/эффекты экземпляра — `reatomFactoryComponent`. `useAtom`/`useAction` — только как интероп-клапан.
- Обычные React-хуки (в том числе reactuse) внутри `reatomComponent` вызывать можно — это обычная функция-компонент. **[R-SRC-RC]**
- Обработчики событий, которые зовут не-Reatom код с асинхронщиной, — через `wrap`. **[R-REACT]**
- React Compiler: ни подтверждения, ни опровержения совместимости в источниках нет — **(не проверено)**, в MVP не включаем.

---

## 2. Роутинг на GitHub Pages + Telegram deep links

### Факты

- `reatomRoute` матчит **`urlAtom().pathname`** (`matchPath(patternSegments, url.pathname, …)`), hash в матчинге не участвует. **[R-SRC-ROUTE]**
- `urlAtom` слушает `popstate`, перехватывает клики по same-origin `<a>` и пишет в `history.pushState/replaceState`. Отдельного hash-режима нет; есть шов для интеграций: `urlAtom.sync` (Reatom → внешний источник) и `urlAtom.syncFromSource` (источник → Reatom без обратной синхронизации). **[R-SRC-URL] [R-LLM]**
- `urlAtom.go(path)` строит `new URL(path, current)` — при переходе на новый путь hash текущего URL **отбрасывается**. **[R-SRC-URL]**
- В дайджесте упомянут `is404` для детекта несматченного URL. **[R-LLM]**
- Telegram передаёт launch-параметры в **hash**: `tgWebAppData`, `tgWebAppVersion`, `tgWebAppPlatform`, `tgWebAppThemeParams` и т.д.; предупреждение: «If the application uses hash routing, it may lose the initial hash after some time». **[TMA-LP]**
- `startapp` из ссылки `t.me/<bot>/<app>?startapp=…` (или `t.me/<bot>?startapp=…` для main Mini App) приходит в `initData.start_param` **и** GET-параметром `tgWebAppStartParam`. **[TG-WA]** Он **не** в hash, а в query; символы `A-Z a-z 0-9 _ -`, до 512 символов. **[TMA-SP]**
- GitHub Pages для project-сайта отдаёт `/<repo>/…`; отсутствующий путь отдаётся из `404.html`. **[GH-404]** Vite для этого случая требует `base: '/<repo>/'`. **[VITE]**

### Сравнение вариантов

| Вариант | Плюсы | Минусы |
| --- | --- | --- |
| **Hash-роутинг** (`#/shopping`) | Нет проблем с reload на GH Pages | В Reatom нет нативно — пришлось бы писать адаптер через `sync`/`syncFromSource`, переводящий hash в виртуальный pathname; **конфликтует с `#tgWebAppData=…`** от Telegram **[TMA-LP]** |
| **Pathname + `404.html`** | Нативно для `reatomRoute`, `.path()`/`.go()`/перехват ссылок работают как в доках | Reload на глубоком пути отдаётся из `404.html` со статусом 404 **[GH-404]** — для WebView это просто HTML, но **(не проверено)** в клиентах Telegram |
| **Только память / search-only / modal-gate роуты** | Не трогает pathname вообще | Теряем «роутер как архитектурный примитив» для экранов, reload всегда на главную |

### Рекомендация (вывод)

1. **Pathname-роутинг.** Сборка копирует `dist/index.html` → `dist/404.html` (одна строка в CI-шаге деплоя).
2. **Base path — корневым layout-роутом**, а не правкой Reatom: Vite `base: '/family-hub/'`, а корень дерева — `reatomRoute({ path: 'family-hub', layout: true, … })`, где сегмент выводится из `import.meta.env.BASE_URL`. Тогда все дочерние `.path()` автоматически содержат префикс, а при переезде на кастомный домен (`base: '/'`) меняется одна константа. Пример с одним сегментом базы корректен по исходнику (`pathnameBuilder` склеивает родительский путь) **[R-SRC-ROUTE]**; многосегментная база — **(не проверено)**.
3. **Hash не трогаем вообще** — он принадлежит Telegram. Launch-параметры читаем **до первой навигации**, потому что `go()` hash выбросит **[R-SRC-URL]**. На практике их и так парсит `telegram-web-app.js` при загрузке и кладёт в `Telegram.WebApp.initData` (подробнее — research [#3](https://github.com/ScobarDen/family-hub/issues/3)).
4. **Deep link `startapp`** — один init-action приложения:
   - читает `initDataUnsafe.start_param` (или `tgWebAppStartParam` из `location.search`);
   - декодирует по маленькой грамматике в духе `<kind>-<id>` (разрешены только `[A-Za-z0-9_-]`, ≤512 **[TMA-SP]**), валидирует схемой;
   - делает `targetRoute.go(params, true)` (replace, чтобы «назад» не вело на корень с параметром);
   - неизвестное/битое значение → главная, без ошибки.
   Кодек `startParam ↔ route` живёт рядом с роутами, и им же бот генерирует ссылки в Reminder-кнопках.
5. **Telegram BackButton** — `computed` «не на корневом роуте» → `BackButton.show/hide`, клик → `history.back()`. **[TG-WA]** (вывод)
6. Модалки/шиты без URL — modal-gate роуты (`params` callback) **[R-LLM]**, чтобы не плодить отдельные `isOpen`-атомы и не засорять историю.

---

## 3. Формы: Reatom vs shadcn

### Факты

- `reatomForm` / `reatomField` / `reatomFieldSet`: состояние, фокус, валидация (sync/async, Standard Schema, например zod), `submit` с `ready()`/`error()`, `reset()`. **[R-LLM]**
- `bindField(field)` из `@reatom/react` возвращает `{ value | checked, onChange, onBlur, onFocus, error }`. `onChange` принимает **или DOM-событие, или сырое значение** (`isEvent ? currentTarget.value/checked : event`). **[R-SRC-BF]**
- shadcn сам по себе не форм-библиотека: `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldSet`, `FieldGroup` и т.д. — вёрстка. Невалидность: `data-invalid` на `Field`, `aria-invalid` на контроле; `FieldError` принимает `errors: Array<{ message?: string }>`. **[SH-FIELD]**
- Интеграции в доках shadcn: React Hook Form, TanStack Form, Formisch — как примеры, а не обязательная зависимость. **[SH-LLM]**
- Новые проекты shadcn — Tailwind v4 + React 19, без `forwardRef`, с `data-slot` на каждом примитиве, `tw-animate-css` вместо `tailwindcss-animate`. **[SH-TW4]**

### Совместимость (вывод)

Сосуществуют чисто: **модель формы — Reatom, разметка — shadcn**, без React Hook Form. Подводные камни, которые закрывает тонкий адаптер в `common/ui` (или рядом с компонентами shadcn):

- `bindField` кладёт в результат `error` — если сделать `<Input {...bindField(f)} />`, shadcn `Input` прокинет `error="…"` атрибутом в DOM. Поэтому `error` вынимаем и превращаем в `aria-invalid` + `data-invalid` на `Field` + `<FieldError errors={[{ message: error }]} />`.
- Radix-контролы не используют `onChange`: `Checkbox` — `checked`/`onCheckedChange` (может прийти `'indeterminate'`), `Select` — `value`/`onValueChange`. Так как `bindField().onChange` принимает сырое значение, подключение — это переименование пропа, без обёрток. `NativeSelect`, `Input`, `Textarea` — спредом.
- Валидация — только в `reatomForm` (schema + `validate`), `FieldError` её лишь показывает. Двух валидаторов не держим.

Набросок формы адаптера (имена — на обсуждение):

```tsx
export const textFieldProps = (field: FieldAtom<any, string>) => {
  const { error, ...props } = bindField(field)
  return { props: { ...props, 'aria-invalid': !!error }, error }
}
```

---

## 4. reactuse во View: польза и граница с Reatom

Пакет — `@siberiacancode/reactuse` (peer `react ^18 || ^19`), есть и CLI `npx useverse add <hook>` для копирования хуков в проект. **[RU]**

### Дублируют Reatom → во View **не используем**

| reactuse | Что в Reatom | Источник |
| --- | --- | --- |
| `useQuery`, `useMutation`, `useAsync`, `useOptimistic` | `computed(async).extend(withAsyncData())`, `action(async).extend(withAsync())`, `withRollback`/`withTransaction` | **[R-LLM]** |
| `useForm`, `useField`, `useValidatedState` | `reatomForm`, `reatomField` | **[R-LLM]** |
| `useLocalStorage`, `useSessionStorage`, `useStorage`, `useCookie(s)` | `withLocalStorage`, `withSessionStorage`, `withCookie`, `withIndexedDb` | **[R-LLM]** |
| `useUrlSearchParam(s)`, `useHash`, `useBrowserLocation` | `urlAtom`, `withSearchParams`, `reatomRoute` (`useHash` ещё и бьёт по Telegram hash) | **[R-LLM] [TMA-LP]** |
| `useOnline`, `useNetwork` | `onLineAtom` | **[R-LLM]** |
| `useWebSocket`, `useBroadcastChannel` | `reatomWebSocket`, `withBroadcastChannel` | **[R-LLM]** |
| `useList`, `useMap`, `useSet`, `useCounter`, `useBoolean`/`useToggle` для доменного состояния | `reatomArray`, `reatomMap`, `reatomSet`, `reatomNumber`, `reatomBoolean` | **[R-LLM]** |
| `useStep`, `useWizard` для бизнес-флоу | вложенные роуты / protected-роуты как wizard | **[R-LLM]** |
| `cn` | у shadcn уже есть свой `cn` в `lib/utils` | **[SH-LLM]** |

### Реально полезны во View (вывод)

- **Списки/скролл:** `useIntersectionObserver`, `useInfiniteScroll` — триггер, который зовёт Reatom-action (`list.loadMore()`), сам ничего не хранит.
- **Жесты для списка покупок:** `useSwipe`, `useLongPress`, `useDoubleClick`.
- **Инпуты:** `useTextareaAutosize`, `useMergedRef`, `useFocus`.
- **Раскладка:** `useSize`/`useResizeObserver`/`useMeasure`, `useScrollIntoView`, `useLockScroll`, `useMediaQuery`/`useBreakpoints` — **только** для чисто визуальной адаптивности (если брейкпоинт влияет на логику — `reatomMediaQuery`).
- **Мелочи:** `useCopy` (скопировать инвайт-ссылку), `useDebounceCallback` для чисто визуальных эффектов.
- Осторожно, у Telegram есть нативные аналоги, они предпочтительнее: `useVibrate` → `HapticFeedback`, `useShare` → `shareMessage`/`switchInlineQuery`, `useVirtualKeyboard`/`useWindowSize` → события `viewportChanged`, `usePreferredDark` → `themeParams`/`colorScheme`. **[TG-WA]**
- `useClickOutside`, `useFocusTrap`, `useDisclosure` обычно не нужны: это уже делают Radix-примитивы внутри shadcn (`Dialog`, `Popover`, `DropdownMenu`).

### Правило границы (предложение)

> **Состояние идёт в Reatom, если хоть одно «да»:** его читает ViewModel или другой модуль; оно должно пережить unmount View; оно участвует в async, валидации, URL, хранилище или логике роутинга; его полезно видеть в логгере Reatom.
> **reactuse — только если все «нет»:** это эфемерное DOM/сенсорное/визуальное состояние, которое рождается и умирает в одном View. Результат reactuse-хука, имеющий доменный смысл, сразу уходит в Reatom-action, а не хранится в React-state.

Это хорошо ложится на линтер: `no-restricted-imports` на список из таблицы «Дублируют Reatom» для `*.view.tsx` (вывод).

---

## Открытые вопросы

- Реально ли Telegram-клиенты (iOS/Android/Desktop/Web) нормально переживают reload Mini App со статусом 404 от `404.html`? Проверить на прототипе. **(не проверено)**
- Нужен ли в MVP reload на глубокий экран вообще, или достаточно «reload → главная + replay `start_param`»? Если второе — можно не публиковать `404.html`, а при старте делать `homeRoute.go(…, true)`.
- Грамматика `start_param` (`<kind>-<id>` и т.д.) — общая контрактная штука между ботом (Workers) и фронтом; где живёт кодек — в shared-пакете?
- Совместимость `reatomComponent` с React Compiler — не задокументирована. **(не проверено)**
- shadcn теперь предлагает варианты на Radix и на Base UI (путь `/docs/components/base/field` в навигации) — выбрать один примитивный слой. **(не проверено)**
