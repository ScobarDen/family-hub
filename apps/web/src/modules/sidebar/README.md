# sidebar

The navigation of a window 1024px wide and wider, in place of the tab bar ([ADR 0023](../../../../../docs/adr/0023-a-sidebar-replaces-the-tab-bar-on-a-wide-screen.md)): «+ Добавить» at the top, then «Сегодня», then every module in the «Разделы» order (the Member's two slots first, then the rest), and the Profile at the bottom. It takes the look of the rest of the app: a solid card on Android, glass on iOS. Each item is its icon and title; the open one gets a tinted pill behind it, so it does not rely on colour. There is no «Разделы» and no slot setup: the sidebar already lists every module.

## Injected

- `slots` — the Member's two tab-bar slots, which only set the order here.
- `activeTab`, `onOpen` — from the app's navigation, where on a wide window every module and the Profile are tabs; clicking the active item again returns to its root.
- `onAdd` — the quick-add's `open`, as the tab bar's «+».
- `titles` — a module renamed by its content, like the Pets after the Family's only Pet.

Out of scope: the screens the items open (their own modules), the quick-add sheet (`quick-add`), each section's title, icon and colour (`sections`), the slots themselves (`tab-bar`).
