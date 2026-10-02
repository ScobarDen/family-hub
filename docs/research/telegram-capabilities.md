# Research: возможности Telegram для Family Hub

Тикет: [#3](https://github.com/ScobarDen/family-hub/issues/3) · Карта: [#1](https://github.com/ScobarDen/family-hub/issues/1)
Проверено: **2026-10-02**, актуальная версия Bot API на эту дату — **10.3** (от 2026-08-24).

## Источники

Все утверждения ниже взяты из первоисточников Telegram. В тексте источник указан в квадратных скобках.

- **[WA]** Telegram Mini Apps — https://core.telegram.org/bots/webapps
- **[API]** Telegram Bot API — https://core.telegram.org/bots/api
- **[FAQ]** Bots FAQ — https://core.telegram.org/bots/faq
- **[FEAT]** Bot Features (deep linking, BotFather) — https://core.telegram.org/bots/features
- **[BOTS]** Introduction to Bots — https://core.telegram.org/bots
- **[LINKS]** Deep links (MTProto) — https://core.telegram.org/api/links

Пометка **(вывод)** — это моя интерпретация или рекомендация, в документации прямо так не написано. Пометка **(не проверено)** — поведение, которое документация не описывает и которое стоит проверить руками.

---

## 1. Сводная таблица: возможность → польза для Family Hub → ограничения

### Mini Apps API

| Возможность | Чем полезна Family Hub | Ограничения |
|---|---|---|
| `themeParams` + событие `themeChanged` | Визуальный стиль поверх темы Telegram: цвета приходят как CSS-переменные, светлая/тёмная тема бесплатно | Набор ключей растёт по версиям: `section_*`, `accent_text_color` — 7.6+, `bottom_bar_bg_color` — 7.10+ [WA]. Нужен фолбэк для старых клиентов |
| `MainButton` / `SecondaryButton` (BottomButton) | Главное действие экрана («Добавить покупку», «Сохранить»), вторичное — «Отмена» | `SecondaryButton`, `position`, `hasShineEffect` — 7.10+; `iconCustomEmojiId` — 9.5+ [WA]. Максимум две нижние кнопки |
| `BackButton` | Навигация назад внутри Mini App, вписывается в шапку Telegram | 6.1+ [WA]. Логику стека навигации делаем сами |
| `SettingsButton` | Пункт «Настройки» в меню Mini App → экран настроек Family/Member | 7.0+, событие `settingsButtonClicked` [WA] |
| `HapticFeedback` | Отклик на отметку покупки, свайпы, ошибки валидации | 6.1+; `impactOccurred`, `notificationOccurred`, `selectionChanged` [WA]. На десктопе ничего не делает **(вывод)** |
| `CloudStorage` | Пер-Member настройки UI: активная Family, фильтры, свёрнутые секции. Синхронизируется между устройствами Member-а | 6.9+; до **1024** ключей на пользователя; ключ 1–128 символов `A-Za-z0-9_-`; значение 0–4096 символов [WA]. Привязано к Member, не к Family → **не годится для Shared-данных** |
| `DeviceStorage` | Офлайн-кэш на чтение (список покупок, последние данные) | 9.0+; до **5 MB** на пользователя, только локально, только этот бот [WA] |
| `SecureStorage` | Хранение собственного сессионного токена бэкенда (Keychain / Keystore) | 9.0+; до **10** элементов на пользователя [WA]. На платформах без Keychain/Keystore может быть недоступно **(вывод)** — нужен фолбэк |
| `requestFullscreen` / `exitFullscreen`, `safeAreaInset`, `contentSafeAreaInset` | Полноэкранный режим для галереи фото Pet, дашбордов | 8.0+ [WA]. Обязательно учитывать safe area (CSS-переменные есть) |
| `addToHomeScreen` / `checkHomeScreenStatus` | Ярлык «Family Hub» на домашнем экране — ощущение отдельного приложения | 8.0+; статусы `unsupported` / `unknown` / `added` / `missed`; событие `homeScreenAdded` может не прийти [WA] |
| `requestWriteAccess` | Разрешение боту писать Member-у первым → Reminder-ы | 6.9+; нативный попап, callback с `boolean` [WA]. Подробнее в разделе 4 |
| `requestContact` | Не нужно для MVP **(вывод)** | 6.9+ [WA] |
| `shareMessage` + Bot API `savePreparedInlineMessage` | Поделиться инвайтом в Family в любой чат красивой карточкой с кнопкой | 8.0+; сообщение готовит бот заранее через `savePreparedInlineMessage` [WA][API] |
| `shareToStory` | Низкая ценность для семейного приложения **(вывод)** | 7.8+; медиа по HTTPS-URL, подпись 0–200 символов (Premium — 0–2048) [WA] |
| `showScanQrPopup` | Инвайт по QR при личной встрече; потенциально — QR фискального чека для бюджета | 6.4+; текст подсказки 0–64 символа [WA] |
| `LocationManager` | Низкая ценность для MVP (разве что прогулки с Pet) **(вывод)** | 8.0+, требует `init()` и разрешения пользователя [WA] |
| `BiometricManager` | Опционально: «замок» на Private-разделы (финансы) | 7.2+; `init`, `requestAccess`, `authenticate`, `updateBiometricToken` [WA] |
| `downloadFile` | Экспорт данных / бэкапа Family файлом через нативный попап | 8.0+ [WA] |
| Direct link + `startapp` | Инвайт-ссылки прямо в Mini App: `https://t.me/<bot>?startapp=<payload>` → `start_param` в initData и `tgWebAppStartParam` [WA] | Символы `A-Za-z0-9_-`. Явный лимит длины для `startapp` в [WA] не указан; для `/start`-параметра — до **64** символов [FEAT]. Закладываемся на ≤64 **(вывод)** |
| `isVersionAtLeast`, `platform` | Feature-detection для всего выше | 6.1+ [WA] |

### Bot API

| Возможность | Чем полезна Family Hub | Ограничения |
|---|---|---|
| Inline-клавиатуры + `callback_query` | Кнопки в Reminder-ах: «Сделано», «Отложить на час» | `callback_data` — **1–64 байта** [API]. Нужно всегда вызывать `answerCallbackQuery`, иначе у пользователя висит прогресс-бар [API] |
| Deep links `t.me/<bot>?start=<payload>` | Инвайт через чат с ботом: `/start <payload>` одновременно даёт боту право писать Member-у | До 64 символов `A-Za-z0-9_-`, рекомендуют base64url [FEAT]. Payload — непрозрачный токен инвайта, а не id Family **(вывод)** |
| Menu button (`setChatMenuButton`, `MenuButtonWebApp`) / Main Mini App | Кнопка запуска Mini App прямо в чате с ботом | По умолчанию menu button показывает список команд [API]; Main Mini App настраивается в BotFather и открывается через `t.me/<bot>?startapp` [WA][LINKS] |
| Webhook (`setWebhook`) на Cloudflare Worker | Бот без постоянного сервера, бесплатный тариф Workers | Порты **443, 80, 88, 8443**; `max_connections` 1–100 (по умолчанию 40); `secret_token` 1–256 символов `A-Za-z0-9_-` приходит в заголовке `X-Telegram-Bot-Api-Secret-Token` — **проверять в каждом запросе** [API] |
| Лимиты отправки | Reminder-ы и уведомления | См. раздел 5 |
| `editMessageText` / `editMessageReplyMarkup` | После «Сделано» — обновить Reminder-сообщение, убрать кнопки | Ограничение 48 ч — только для business messages [API]; для обычных сообщений бота не действует |
| `deleteMessage` | Удалять устаревшие Reminder-ы | Только сообщения младше **48 часов** [API] |

---

## 2. Хранение фото в Telegram: приватный канал + `file_id`

### Схема

1. Создаём приватный канал-хранилище, бот — администратор с `can_post_messages`.
2. Mini App отправляет фото на Worker (multipart) → Worker вызывает `sendPhoto` (или `sendDocument`) с `chat_id` канала.
3. Из ответа (`Message.photo[]` / `Message.document`) сохраняем в БД `file_id`, `file_unique_id`, `message_id`, размеры.
4. Для показа: Mini App ходит на Worker `/photos/<id>` → Worker проверяет права Member-а (Shared/Private), вызывает `getFile` → получает `file_path` → стримит `https://api.telegram.org/file/bot<token>/<file_path>` клиенту.

### Факты из документации

| Вопрос | Ответ | Источник |
|---|---|---|
| Долговечность `file_id` | «Yes, file_ids can be treated as persistent» | [FAQ] |
| Привязка к боту | `file_id` уникален для каждого бота и **не переносится в другого бота**. У одного файла может быть **несколько разных валидных `file_id`** даже для одного бота | [API] «Sending files» |
| `file_unique_id` | Одинаков со временем и между ботами, но **им нельзя скачать или переотправить файл** — годится только для дедупликации | [API] |
| Загрузка multipart | **10 MB** для фото, **50 MB** для остальных файлов | [API] «Sending files» |
| Загрузка по URL | 5 MB фото, 20 MB прочее | [API] |
| Ограничения `sendPhoto` | ≤10 MB; ширина + высота ≤ **10000**; соотношение сторон ≤ **20** | [API] `sendPhoto` |
| Повторная отправка по `file_id` | Без лимитов по размеру; тип файла поменять нельзя (фото не переотправить документом); переотправка фото отдаёт все его размеры | [API] |
| Скачивание `getFile` | **Не больше 20 MB** | [API] `getFile`, [FAQ] |
| URL скачивания | `https://api.telegram.org/file/bot<token>/<file_path>` — **содержит токен бота** | [API] `File` |
| Срок жизни ссылки | Гарантированно **не меньше 1 часа**; после истечения — снова вызвать `getFile` | [API] `File`, `getFile` |
| Удаление | `deleteMessage` — только сообщения младше **48 часов**; бот с `can_post_messages` удаляет свои сообщения в канале; с `can_delete_messages` — любые | [API] `deleteMessage` |
| Local Bot API Server | Снимает лимиты (загрузка до 2000 MB, скачивание без лимита), но это свой сервер — не вписывается в Cloudflare Workers free | [API] |

### Подводные камни

- **Ловушка 50/20.** Через `sendDocument` можно залить файл до 50 MB, но скачать через `getFile` — только до 20 MB. Значит, всё, что больше 20 MB, бот залить сможет, а отдать обратно — нет. Ограничиваем загрузку **≤10 MB** (это и лимит `sendPhoto`), а лучше ресайзим на клиенте **(вывод)**.
- **Токен в URL.** Ссылку из `getFile` нельзя отдавать в браузер: в ней `bot<token>`, а утёкший токен — это полный контроль над ботом. **Только проксирование через Worker** **(вывод)**.
- **Привязка к боту.** Смена бота (новый токен у того же бота — не проблема, новый бот — проблема) делает все `file_id` бесполезными: бот-хранилище и есть идентичность хранилища. Это аргумент сразу использовать **одного бота навсегда** и не путать боевого бота с тестовым **(вывод)**.
- **Удаление ненадёжно.** Из-за окна 48 часов удалить старое фото из канала через API в общем случае нельзя. Будет ли работать `file_id` после удаления сообщения, документация не говорит **(не проверено)**. Практически «удалить фото» = удалить запись в нашей БД и забыть `file_id`; сам файл остаётся на серверах Telegram. Для Private-фото это важно проговорить в спеке **(вывод)**.
- **Кэширование `file_path`.** Ссылка живёт ≥1 часа, поэтому Worker может закэшировать `file_path` (KV или Cache API) примерно на 50 минут, а сами байты кэшировать через Cache API под нашим URL, чтобы не дёргать Telegram на каждый показ **(вывод)**.
- **`sendPhoto` vs `sendDocument`.** `sendPhoto` отдаёт массив `PhotoSize` — Telegram сам нарезает превью разных размеров, и это даёт бесплатные миниатюры для ленты. Оригинал при этом пережимается (точные параметры сжатия в документации не указаны **(не проверено)**). `sendDocument` хранит оригинал, но превью не будет **(вывод)**.
- **Лимиты отправки в канал.** Канал — это чат, поэтому действует «не больше одного сообщения в секунду в один чат» с допустимыми короткими всплесками [FAQ]. При массовой загрузке (альбом из 20 фото) нужна очередь и обработка `429` с `retry_after` [API]. Можно отправлять альбомом через `sendMediaGroup`, но это не проверено на лимитах **(не проверено)**.

### Вывод по хранению фото

**Годится для MVP, с оговорками.** Приватный канал + `file_id` — бесплатное и долговечное хранилище («file_ids can be treated as persistent»), которое отлично ложится на Workers free:

- ✅ храним `file_id` (для скачивания) и `file_unique_id` (для дедупликации) по каждому нужному размеру `PhotoSize`;
- ✅ на клиенте ресайзим до разумного размера (например, длинная сторона ≤2560 px, JPEG/WebP, <10 MB) и грузим через `sendPhoto`;
- ✅ показываем только через прокси на Worker-е с проверкой прав Shared/Private; токен никогда не уходит на клиент;
- ✅ кэшируем `file_path` (<1 ч) и байты (Cache API);
- ⚠️ принимаем, что физическое удаление не гарантировано — в спеке и в UI для Private-фото честно пишем «удалено из Family Hub»;
- ⚠️ бот, на которого завязано хранилище, — критический ресурс: один бот на prod, отдельный тестовый бот со своим каналом;
- ⚠️ вынести хранилище за интерфейс (`PhotoStorage`), чтобы при необходимости переехать на R2 без переписывания домена **(вывод)**.

---

## 3. Валидация initData

### Алгоритм (HMAC, свой бэкенд — наш случай) [WA]

1. Клиент отправляет на Worker сырую строку `Telegram.WebApp.initData` (query string) — **не** `initDataUnsafe`.
2. Worker парсит её, вынимает `hash`.
3. `data_check_string` = все **остальные** поля (включая `signature`, если он есть — для HMAC исключается только `hash`), отсортированные по ключу, в формате `key=<value>`, через `\n` (0x0A).
4. `secret_key = HMAC_SHA256(key = "WebAppData", message = bot_token)`. В документации это записано как `HMAC_SHA256(<bot_token>, "WebAppData")` с пояснением «the HMAC-SHA-256 signature of the bot's token with the constant string WebAppData used as a key»: **ключ — строка `WebAppData`**, а не токен. Классическая ошибка — перепутать аргументы.
5. Сверяем `hex(HMAC_SHA256(key = secret_key, message = data_check_string)) == hash` (сравнение в постоянное время — **(вывод)**).
6. Проверяем `auth_date`.
7. `user` — JSON-строка, её надо распарсить после проверки («Complex data types are represented as JSON-serialized objects»).

На Cloudflare Workers всё это делается через WebCrypto `crypto.subtle` (HMAC SHA-256) без зависимостей **(вывод)**.

### Ed25519 (third-party validation) [WA]

- Bot API 8.0+. В initData есть поле `signature` — base64url-представление Ed25519-подписи.
- `data_check_string` = `"<bot_id>:WebAppData"` + `\n` + все поля **кроме `hash` и `signature`**, отсортированные, `key=<value>` через `\n`.
- Публичные ключи Telegram (hex):
  - production: `e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d`
  - test: `40055058a4ee38156a06562e52eece92a771bcd8346a8c4615cb7376eddf72ec`
- Нужно, когда проверяющий **не владеет токеном бота**. У нас токен есть в Worker-е, поэтому для MVP достаточно HMAC. Ed25519 пригодится, если появится сервис без доступа к токену **(вывод)**. Ed25519 поддерживается в WebCrypto Workers **(не проверено)**.

### `auth_date` и время жизни

- Документация **не задаёт TTL**: только «you can additionally check the auth_date field» (для своего бэкенда) и «should additionally validate» (для третьей стороны) [WA].
- initData не обновляется, пока Mini App открыт, поэтому жёсткий TTL порядка минут выбьет Member-а из долгой сессии **(вывод)**.
- **Рекомендация (вывод):** initData используем только для входа — обмениваем на свою сессию (токен в `SecureStorage`, если он есть, иначе в памяти или `DeviceStorage`). Принимаем `auth_date` не старше **~1 часа**, плюс допуск на рассинхрон часов. Сессию Worker выдаёт на ограниченный срок и при повторном открытии Mini App перевыпускает её по свежему initData.

### Что приходит в initData [WA]

- `query_id`, `chat_join_request_query_id` (10.1+), `user`, `receiver`, `chat`, `chat_type` (`sender` / `private` / `group` / `supergroup` / `channel`), `chat_instance`, `start_param`, `can_send_after`, `auth_date`, `hash`, `signature`.
- `user` (`WebAppUser`): `id`, `is_bot`, `first_name`, `last_name`, `username`, `language_code`, `is_premium`, `added_to_attachment_menu`, `allows_write_to_pm` (6.9+), `photo_url` (8.0+; jpeg или svg).
- Идентичность Member-а — `user.id`. `username` и имя меняются и годятся только для отображения **(вывод)**.

---

## 4. Когда бот может написать Member-у первым

- Базовое правило: «Bots can't start conversations with users. A user must either add them to a group or send them a message first» [BOTS].
- Способы получить право писать:
  1. Member нажал **Start** / отправил боту сообщение (в том числе через deep link `t.me/<bot>?start=<invite>`) [BOTS][FEAT];
  2. Member принял **`requestWriteAccess()`** в Mini App (6.9+) [WA] — бот получает service message `write_access_allowed` (`WriteAccessAllowed.from_request = true`) [API];
  3. доступ выдан при запуске Web App по ссылке (`WriteAccessAllowed.web_app_name`) или при добавлении бота в attachment/side menu (`from_attachment_menu`) [API].
- Флаг `user.allows_write_to_pm` в initData показывает, что право уже есть [WA].
- **Рекомендация (вывод):** при первом входе в Mini App, если `allows_write_to_pm` не `true`, показываем экран «Включить напоминания» → `requestWriteAccess()`. Состояние храним на сервере (`Member.canReceiveReminders`) и обновляем по `write_access_allowed`. Если пользователь заблокирует бота, отправка начнёт падать с ошибкой: Reminder-ы должны помечать Member-а «недоступен», а не ретраить бесконечно.

---

## 5. Лимиты на отправку сообщений [FAQ]

- В **один чат** — не больше ~**1 сообщения в секунду**; короткие всплески допускаются, но дальше будут `429`.
- В **группу** — не больше **20 сообщений в минуту**.
- **Массовая рассылка** — около **30 сообщений в секунду** суммарно. Paid broadcasts поднимают лимит до 1000/с по 0.1 Stars за сообщение сверх 30/с, но требуют ≥100 000 Stars на балансе и ≥100 000 MAU — не наш случай.
- При превышении — `429`, в ответе `parameters.retry_after` — сколько секунд ждать [API].
- **Для Family Hub (вывод):** при семейном масштабе лимиты не страшны, но Reminder-ы, которые срабатывают в одну и ту же минуту (например, в 09:00 у всех Family), надо отправлять через очередь (Cloudflare Queues или Cron + батчи), соблюдать `retry_after` и не слать в один чат чаще 1/с. Загрузка фото в канал-хранилище тоже упирается в лимит 1/с на чат.

---

## 6. Открытые вопросы (кандидаты в тикеты)

- Работает ли `file_id` после удаления сообщения из канала-хранилища, и можно ли удалить сообщение старше 48 часов при правах `can_delete_messages` (проверить руками на тестовом боте).
- Точные параметры пережатия у `sendPhoto` (максимальное разрешение, качество) — от этого зависит, хранить ли оригинал отдельно через `sendDocument`.
- Решение «Telegram-канал против Cloudflare R2» для фото Private: приемлемо ли, что физическое удаление не гарантировано.
- TTL `auth_date` и модель сессии (свой токен, срок, где хранить на клиенте).
- Минимальная поддерживаемая версия Bot API на клиенте (6.9 / 7.10 / 8.0 / 9.0) и фолбэки для `SecureStorage`, `DeviceStorage`, `SecondaryButton`.
- Инвайт-флоу: `?start=` (сразу даёт право писать) против `?startapp=` (сразу открывает Mini App) — или оба сразу.
- Лимит длины `startapp` явно не задокументирован в [WA] — проверить на практике или закладываться на 64.
