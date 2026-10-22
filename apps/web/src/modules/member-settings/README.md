# member-settings

The Member's own settings in the Profile, which belong to no Family: whether the bot may write first, the morning digest and the time zone. A change shows at once and is saved right away; a refused one goes back to the last value the server accepted and says so (`reatomSavedSetting` in `member-settings.model.ts`).

- **Notifications** — whether the bot can write to the Member first, which Reminders need. While it cannot, the «Включите уведомления» banner sits above every module screen and the Profile shows the same state with «Включить», which asks Telegram for write access (`requestWriteAccess`, 6.9+). Once the Member allows it, the banner goes away at once; the server learns it from initData at the next launch, so nothing is posted.
- **Digest** — on by default at 09:00 on the Member's own clock. The bot then sends what is overdue and what falls today — Event Occurrences, Plan and Subplan deadlines, Reminders, Pet birthdays and Due Dates the Member may see — with «Открыть ленту», and stays silent on a day with nothing to say.
- **Time zone** — the zone dates and Reminders are shown in. It follows the device until the Member picks one by hand, and «Как на устройстве» brings the device's zone back. `keepFollowingDevice()` is an effect started by `app/main.tsx`: once the settings arrive it saves the device's zone for a Member without one, or whose zone follows the device and has drifted from it.

## Injected

- `api` — `createMemberSettingsApi(httpClient)`: saves the digest and the time zone of the session Member.
- `saved` — the Member's `settings.digest` / `settings.timeZone` from the session: `undefined` until they arrive, a `null` zone while the server knows none.
- `canMessage` — the Member's `settings.canMessage`. The server turns it on when initData reports `allows_write_to_pm`; only a 403 from the bot turns it off.
- `telegram` — `requestWriteAccess` from `common/telegram`.
- `deviceZone` — `deviceTimeZone()` from `common/format-date`; `zones` — the IANA names the picker offers.
