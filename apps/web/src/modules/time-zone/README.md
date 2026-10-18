# time-zone

The Member's own time zone, in which dates and Reminders are shown to them. It follows the device until the Member picks one by hand in the Profile, and «Как на устройстве» brings the device's zone back.

## Injected

- `api` — `createTimeZoneApi(httpClient)`: saves `{ timeZone, isAuto }` for the session Member.
- `saved` — the Member's `settings.timeZone` from the session: `undefined` until they arrive, `null` while the server knows none.
- `deviceZone` — `deviceTimeZone()` from `common/format-date`; `zones` — the IANA names the picker offers.

`keepFollowingDevice()` is an effect started by `app/main.tsx`: once the settings arrive it saves the device's zone for a Member without one, or whose zone follows the device and has drifted from it. A failed save puts the previous zone back.
