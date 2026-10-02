# Research: лимиты бесплатного Cloudflare

> Тикет: [#5](https://github.com/ScobarDen/family-hub/issues/5) · Карта: [#1](https://github.com/ScobarDen/family-hub/issues/1)
> Дата проверки источников: **2026-10-02**. Все цифры взяты из первоисточников (developers.cloudflare.com, hono.dev); лимиты Cloudflare меняются, перед спекой стоит перепроверить.

Все дневные лимиты free-плана сбрасываются в **00:00 UTC**. Если превышен любой из них, операции этого типа падают с ошибкой (никакого автосписания денег нет).

---

## 1. Workers Free

| Лимит | Free | Источник |
|---|---|---|
| Запросы | **100 000 / день**; при превышении — Error 1027, поведение зависит от роута (fail open / fail closed) | [limits](https://developers.cloudflare.com/workers/platform/limits/), [pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| CPU-время | **10 ms на вызов** (и для HTTP, и для Cron Trigger); при превышении — Error 1102 «Worker exceeded resource limits» | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Что считается CPU | Только исполнение кода. Ожидание `fetch()`, KV, D1 и т.п. **не считается** | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Wall-clock | HTTP — без жёсткого лимита; Cron Trigger — до 15 min | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Память | 128 MB на isolate | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Размер Worker-а | 64 MiB uncompressed (по текущей странице лимитов) | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Startup time | 1 s | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Subrequests | **50 / запрос** (внешний `fetch`); к внутренним сервисам (D1, KV, R2) — 1 000 | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Одновременные соединения | 6 на вызов, ожидающих заголовки ответа | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Workers на аккаунт | 100 | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Env vars | 64 на Worker, до 5 KB каждая | [limits](https://developers.cloudflare.com/workers/platform/limits/) |

Web Crypto: `crypto.subtle` поддерживает HMAC (`importKey`, `sign`, `verify`), плюс нестандартный `crypto.subtle.timingSafeEqual(a, b)` для сравнения подписей без timing-атак. Источник: [web-crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/).

## 2. Cron Triggers

| Пункт | Значение | Источник |
|---|---|---|
| Количество на free | **5 на аккаунт** | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Синтаксис | 5 полей + Quartz-расширения `* , - / L W #` | [cron-triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) |
| Часовой пояс | **только UTC** | [cron-triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) |
| Минимальный интервал | Явно не задокументирован; гранулярность cron-выражения — 1 минута (`* * * * *`), примеры в доках используют `*/3 * * * *` | [cron-triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) |
| Распространение изменений | до 15 min после деплоя | [cron-triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) |
| Точность / гарантии | Не задокументированы; scheduled-воркеры запускаются «на недогруженных машинах» | [cron-triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) |
| CPU | те же 10 ms, wall-clock до 15 min | [limits](https://developers.cloudflare.com/workers/platform/limits/) |

Не нашёл в доках: считается ли вызов `scheduled()` в дневные 100 000 запросов. Даже если считается — cron раз в минуту это 1 440 вызовов/день, т.е. ~1.4% лимита.

## 3. D1

| Лимит | Free | Источник |
|---|---|---|
| Rows read | **5 000 000 / день** | [d1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Rows written | **100 000 / день** | [d1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| При превышении | «you will not be able to run queries against D1» до сброса в 00:00 UTC | [d1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Размер одной БД | **500 MB** | [d1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| Хранилище на аккаунт | 5 GB | [d1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| БД на аккаунт | 10 | [d1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| Запросов на один вызов Worker-а | 50 | [d1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| Строка / BLOB / row | 2 MB | [d1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| SQL statement | 100 KB; bound params — 100; колонок — 100 | [d1 limits](https://developers.cloudflare.com/d1/platform/limits/) |

**Time Travel:** всегда включён, ничего настраивать не надо; окно на free — **7 дней** (на paid 30); история и восстановление бесплатны. Восстановление: `wrangler d1 time-travel restore <DB> --timestamp=<UNIX_TIMESTAMP>`. Источник: [time-travel](https://developers.cloudflare.com/d1/reference/time-travel/).

**Миграции:** `wrangler d1 migrations create | list | apply`; `.sql`-файлы с номером версии в папке `migrations/`; применённые фиксируются в таблице `d1_migrations` внутри самой БД. Настраиваются `migrations_dir`, `migrations_table`, `migrations_pattern` (для ORM-генерированных структур). Доки советуют ссылаться на БД по имени, а не по binding-у. Источник: [migrations](https://developers.cloudflare.com/d1/reference/migrations/).

## 4. R2

| Лимит | Free tier (в месяц) | Источник |
|---|---|---|
| Storage | 10 GB-month | [r2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| Class A (запись, list) | 1 000 000 | [r2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| Class B (чтение) | 10 000 000 | [r2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| Egress | **бесплатно** | [r2 pricing](https://developers.cloudflare.com/r2/pricing/) |

**Нужна ли карта:** в [get-started](https://developers.cloudflare.com/r2/get-started/) сказано, что для начала работы нужно «complete the checkout flow to add an R2 subscription». Явного утверждения «нужен payment method» в доках я не нашёл. Известно, что checkout просит карту или PayPal, но первоисточником это не подтверждено: **проверить руками в дашборде**. Важно: в отличие от Workers/D1, R2 — это месячный free tier с оплатой сверх лимита, а не жёсткий потолок, так что за превышение будут списывать деньги.

## 5. KV, Durable Objects, Queues

| Сервис | На free? | Лимиты free | Источник |
|---|---|---|---|
| **KV** | да | 100 000 reads/день; **1 000 writes/deletes/lists в день**; 1 GB; 1 запись в один ключ в секунду | [kv limits](https://developers.cloudflare.com/kv/platform/limits/), [workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| **Durable Objects** | да, **только SQLite storage backend** | 100 000 запросов/день; 13 000 GB-s duration/день; 5M rows read и 100k rows written в день; 5 GB SQL storage | [do pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| **Queues** | да | 10 000 операций/день; retention 24 h (не настраивается) | [queues pricing](https://developers.cloudflare.com/queues/platform/pricing/) |

У Durable Objects есть WebSocket Hibernation API: простаивающий объект не набирает duration. Это кандидат на realtime-синхронизацию списка покупок.

## 6. Hono на Workers

- **Старт:** `npm create hono@latest` → шаблон `cloudflare-workers`. Bindings типизируются через `new Hono<{ Bindings: Bindings }>()` или генерацией `wrangler types`; секреты локально лежат в `.dev.vars`, в коде читаются через `c.env.*`. `scheduled` и другие хендлеры экспортируются рядом с `fetch` в module-worker формате. Тесты — `@cloudflare/vitest-pool-workers`. Источник: [hono cloudflare-workers](https://hono.dev/docs/getting-started/cloudflare-workers).
- **RPC:** сервер экспортирует `type AppType = typeof route`, клиент делает `hc<AppType>(baseUrl)`. Типы входа выводятся из validator-ов. Ответы типизируются по статус-коду, если явно указывать статус в `c.json(data, 404)`. Есть `InferResponseType` и `ApplyGlobalResponse` для типов глобального error handler-а. Оговорки: на больших приложениях тормозит IDE. Лечится предкомпиляцией через `tsc`, project references в монорепе, разбиением на файлы, одной версией Hono на сервере и клиенте и `"strict": true`. `c.notFound()` в RPC не используйте — лучше `c.json(..., 404)`. Источник: [hono rpc](https://hono.dev/docs/guides/rpc).
- **Валидация:** `@hono/zod-validator` (`zValidator`) и `@hono/standard-validator` (`sValidator`, Standard Schema: Zod, Valibot, ArkType). Для Valibot путь по докам — `sValidator`. Источник: [hono validation](https://hono.dev/docs/guides/validation).

---

## Что это значит для Family Hub

- **HMAC initData укладывается в 10 ms с запасом.** Проверка — это два HMAC-SHA256 над строкой в сотни байт через нативный `crypto.subtle` (выполняется в нативном коде, а не в JS) — это микросекунды, а не миллисекунды. Ожидание D1 в CPU не идёт. Сравнение подписи — через `crypto.subtle.timingSafeEqual`. `CryptoKey` от `WebAppData` + bot token можно импортировать один раз на isolate.
- **Обработку фото в Worker-е (ресайз, перекодирование) делать нельзя:** 10 ms CPU и 128 MB на это не рассчитаны. Варианты: ресайзить на клиенте до загрузки и класть как есть в R2 либо отдавать фото в Telegram (`file_id`). Само проксирование байтов в R2 почти не тратит CPU.
- **R2 под вопросом из-за checkout-а и платы за превышение.** Если для активации нужна карта, это противоречит «free без биллинга» из скоупа (#1). Хранение фото в Telegram обходит проблему полностью. Решение — в отдельном тикете по фото.
- **Reminder-cron раз в 1 минуту реалистичен.** 1 440 вызовов/день; один слот cron-а из 5 на аккаунт. Но: только UTC (время Reminder-а хранить в UTC + tz Member-а/Family), точность не гарантирована (закладывать «окно» выборки `due_at <= now AND sent_at IS NULL`, а не точное совпадение минуты), и рассылка упирается в **50 внешних subrequests на вызов**: за один тик не больше ~50 сообщений в Telegram, остальное — на следующий тик или через Queues. Интервал 5 min надёжнее и экономнее, если UX это терпит.
- **Самый жёсткий лимит D1 — 100 000 rows written/день** (а не размер). Для нескольких семей это огромный запас, но индексы тоже считаются записями, а массовые операции (импорт, пересчёт) могут его выесть. Это аргумент для «Квот на Family и антиабуза» из «Not yet specified».
- **D1 500 MB на БД** — с запасом, пока фото не лежат в BLOB-ах (и класть их туда не надо: лимит строки 2 MB).
- **Time Travel 7 дней — единственный встроенный бэкап.** Для «Экспорт-бэкапов сверх Time Travel» нужен собственный cron-экспорт (например, `wrangler d1 export` из GitHub Actions).
- **KV почти бесполезен на free для записи** (1 000 writes/день) — годится только для редко меняющегося кеша/конфига. Сессии и состояние — в D1.
- **Realtime списка покупок технически доступен на free** через SQLite-backed Durable Objects + WebSocket Hibernation (100k запросов/день, 13 000 GB-s/день). Это вход для отдельного тикета.
- **Queues на free есть** (10 000 операций/день, retention 24 h) — запасной путь для fan-out Reminder-ов, если 50 subrequests на тик станет мало.
- **Webhook от Telegram** — обычный HTTP-запрос к Worker-у, укладывается в 100k/день; ответ на апдейт, требующий вызова Bot API, тратит subrequest-ы из тех же 50.
- **Hono подходит:** RPC даёт end-to-end типы для фронта на GitHub Pages; валидация — `@hono/standard-validator`, она оставляет свободу между Zod и Valibot (Valibot легче по бандлу). Не забыть `"strict": true` и одну версию Hono в монорепе.
- **Cron-триггеры — ресурс аккаунта (5),** а не воркера: если будет превью-деплой Worker-а на PR, cron-ы превью тоже их съедят.

## Открытые вопросы, которые не закрыли первоисточники

- Требует ли активация R2 payment method (карта/PayPal) — проверить в дашборде.
- Считается ли `scheduled()` в дневной лимит 100 000 запросов.
- Гарантии точности и at-least-once для Cron Triggers.
