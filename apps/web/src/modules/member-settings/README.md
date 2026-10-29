# member-settings

The Member's own settings in the Profile, which belong to no Family: whether the bot may write first, the morning digest, the time zone and the app's icon on the home screen. A change shows at once and is saved right away; a refused one goes back to the last value the server accepted and says so (`reatomSavedSetting` in `member-settings.model.ts`).

- **Notifications** — whether the bot can write to the Member first, which Reminders need. While it cannot, the «Включите уведомления» banner sits above every module screen and the Profile shows the same state with «Включить», which asks Telegram for write access (`requestWriteAccess`, 6.9+). Once the Member allows it, the banner goes away at once; the server learns it from initData at the next launch, so nothing is posted.
- **Digest** — on by default at 09:00 on the Member's own clock. The bot then sends what is overdue and what falls today — Task Occurrences and Pet birthdays the Member may see — with «Открыть ленту», and stays silent on a day with nothing to say.
- **Time zone** — the zone dates and Reminders are shown in. It follows the device until the Member picks one by hand, and «Как на устройстве» brings the device's zone back. `keepFollowingDevice()` is an effect started by `app/main.tsx`: once the settings arrive it saves the device's zone for a Member without one, or whose zone follows the device and has drifted from it.

- **Telegram shortcut** — `load()`, started by `app/main.tsx`, asks Telegram for the home screen status (`checkHomeScreenStatus`, 8.0+). The Profile shows «Ярлык Telegram на экране «Домой»» with «Добавить» wherever Telegram supports it, and «Уже добавлен» once it is there. It never offers itself.
- **Installed App** — «Установить как приложение» in the Mini App opens the install page (`install-app`) in the device's own browser through Telegram's `openLink`. Inside the Installed App neither entry shows.
- **Push** — only in the Installed App: «Push на этом устройстве» asks the browser for permission only when switched on, subscribes through `BrowserPlatform` and saves the subscription for this Device; switched off, it drops both. A denied permission says where to allow it; on iOS outside the home screen it says to add the app first.
- **Reminder channel** — «Куда слать напоминания»: the bot, Push or both (the default), saved like the digest. The server falls back to the bot when «Push» finds no live subscription.
- **Devices** — where the Member is signed in to the Installed App, with when each was last used. «Выйти» asks first; signing out of this Device leaves the app on its sign-in screen.

## Injected

- `api` — `createMemberSettingsApi(httpClient)`: saves the digest, the time zone and the reminder channel of the session Member, lists and revokes their Devices, and saves or drops this Device's push subscription.
- `saved` — the Member's `settings.digest` / `settings.timeZone` from the session: `undefined` until they arrive, a `null` zone while the server knows none.
- `canMessage` — the Member's `settings.canMessage`. The server turns it on when initData reports `allows_write_to_pm`; only a 403 from the bot turns it off.
- `telegram` — `requestWriteAccess`, `addToHomeScreen`, `checkHomeScreenStatus`, `openLink`, `isInTelegram` and `showPopup` from `modules/telegram`.
- `platform` — `BrowserPlatform` from `modules/browser-platform` (Notification permission and PushManager), for Push only.
- `currentDeviceId` / `onSignedOut` — this Device and signing out of it, from the session.
- `deviceZone` — `deviceTimeZone()` from `common/format-date.lib.ts`; `zones` — the IANA names the picker offers.

Out of scope: the Family and its Members (`family`), the Family's Photo Storage (`photo-storage`).
