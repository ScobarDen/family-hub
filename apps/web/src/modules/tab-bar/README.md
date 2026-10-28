# tab-bar

The bottom tab bar and «Разделы». The bar is `Сегодня · slot · microphone · slot · Разделы`: only the two slots are the Member's choice (Дела and Питомцы until they change them), a floating pill on Android and glass on iOS, with the centre free for the microphone (`center`). Each tab is its icon over its title; the open one also gets a pill behind the icon and a bolder title, so it does not rely on colour. «Разделы» lists all six modules, the Feed included, the slotted ones in their own group with «Настроить»; it offers «Быстро добавить» and «Семья и настройки». «Настроить» opens the slot setup.

## Injected

- `api` — `createTabBarApi(httpClient)`: saves the two slots for the session Member, so they follow them to every device.
- `saved` — the Member's `settings.tabBar` from the session.
- `activeTab`, `onOpen` — from the app's navigation, which owns the routes and each tab's stack; tapping the active tab again returns to its root.
- `contributionGoalId` — from the Today hub's payload: the nearest Savings Goal, which «+ Взнос» goes to (no Goal, no button).
- `canAddPhoto` — whether the Family has Photo Storage; without it there is no «+ Фото».
- `onQuickAdd`, `onAddPhotos`, `onConfigure`, `onOpenSettings` — the app's opener and navigation: each quick-add opens that module's own create form.

`tab-bar.model.ts` holds the slots: each change shows at once and is saved; a failed save puts back the last saved pair. `reatomTabBar` turns them into the five places of the bar, `reatomTabBarMenu` into the slot setup, where picking a module already in the other slot swaps the two, and `reatomSections` into «Разделы».
