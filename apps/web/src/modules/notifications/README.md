# notifications

Whether the bot can write to the Member first, which Reminders need. While it cannot, the «Включите уведомления» banner sits above every module screen and the Profile shows the same state with «Включить», which asks Telegram for write access (`requestWriteAccess`, 6.9+).

## Injected

- `canMessage` — the Member's `settings.canMessage` from the session. The server turns it on when initData reports `allows_write_to_pm`; only a 403 from the bot turns it off.
- `telegram` — `requestWriteAccess` from `common/telegram`.

Once the Member allows it, the banner goes away at once; the server learns it from initData at the next launch, so nothing is posted. Bot delivery (403 → off) arrives with Reminders.
