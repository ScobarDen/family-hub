# tab-bar

The Member's own bottom tab bar: 2–5 of the six modules in their order (Лента · Планы · Календарь · Питомец until they change it), a floating pill on Android and glass on iOS, with a free centre slot for the microphone (`center`). The «Нижнее меню» screen turns modules on and off and moves them; the Profile lists the hidden ones (`HiddenModules`).

## Injected

- `api` — `createTabBarApi(httpClient)`: saves the modules for the session Member, so they follow them to every device.
- `saved` — the Member's `settings.tabBar` from the session.
- `activeModule`, `onOpen` — from the app's navigation, which owns the routes.

`tab-bar.model.ts` holds the modules: each change shows at once and is saved; a failed save puts back the last saved list. `reatomTabBar` turns them into tabs split evenly around the centre (the odd one to its left) and the hidden list; `reatomTabBarMenu` into the «Нижнее меню» rows, refusing to go below 2 or above 5.
