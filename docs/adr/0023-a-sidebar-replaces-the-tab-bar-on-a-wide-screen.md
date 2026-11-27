# A sidebar replaces the tab bar on a wide screen

Amends [ADR 0009](0009-today-hub-and-fixed-tab-bar.md) for windows 1024px wide and wider.

The app opens on a computer in two places: Telegram Desktop or Web, and the Installed App in a browser. There the mobile shell stretched across the whole window and kept what only a phone needs: a bottom tab bar with a «+», bottom sheets with a swipe handle, a photo viewer stepped by a swipe. From 1024px of viewport width, whatever the platform, a sidebar takes the tab bar's place: «+ Добавить» at the top, then «Сегодня», then every module in the «Разделы» order, and the Profile at the bottom. Below 1024px the mobile shell stays, its content held to the tab bar's width.

## Decisions

- **Every module is a tab.** On a wide screen each module behaves as a slot module does in ADR 0009: picking it in the sidebar opens its root, a record opened from Today, the Feed or another module switches the sidebar to its module instead of going on top of the hub, and Back from it goes to the module's root. The highlighted item is always the one on screen. A module keeps its own stack inside, such as a Pet card over the Pets.
- **«Разделы» and the tab bar settings are not shown.** The sidebar already lists every module. The Member's two slots stay saved and keep shaping the tab bar on a narrow window.
- **The Profile is a root.** Its sidebar item and Telegram's settings button both open it as its own tab, not on top of the current one.
- **Crossing 1024px keeps the screen, not the trail.** The URL and each module's own state, such as an opened card or form, survive a resize. The tab is worked out again as on a reload: on a narrow window a module outside the slots lands on top of Today. The remembered trail is dropped either way.
- **Bottom sheets become dialogs.** On a wide screen the quick-add sheet, every create and edit form and every deletion confirmation open as a centred dialog with the same content; Escape, the overlay and «Отмена» close it as a swipe down did.
- **Back stays where the platform puts it**: Telegram's own button in Telegram Desktop and Web, the browser's back in the Installed App. The content draws no back arrow of its own.

## Considered Options

- **Navigation across the top** — keeps the page's full height for content, but ten items do not fit a Telegram Desktop window around 1000px wide, and the list grows with every module.
- **Only a centred column** — the cheapest fix for the stretched layout, but a computer would still get a phone's tab bar, sheets and swipes.
- **Forms in a panel sliding in from the right** — keeps the screen behind visible, but stretches short forms over the whole window height.
