# Navigation

Which screen is on top, which tab or sidebar item is active and where Back leads. The URL names only the top screen; the tab and the Back trail live in Reatom atoms and are worked out again from the screen on a reload. Narrow-window rules are [ADR 0009](../../../../../docs/adr/0009-today-hub-and-fixed-tab-bar.md); the wide window is [ADR 0023](../../../../../docs/adr/0023-a-sidebar-replaces-the-tab-bar-on-a-wide-screen.md).

## Files

- `screen.route.ts`: `Place` and `Screen`, the routes, URL → `Screen`, `goTo`, and the pure relations between screens (`rootOf`, `placeScreen`, `isTabRoot`).
- `tab-stack.route.ts`: the tab stack. `reatomTabs` holds `tab` and `trail`; `activeTab` falls back to `wideTabOf` or `narrowTabOf` (the reload rule). `settle` sets a tab with its trail, `switchTo` is a tab switch, `push` / `pop` / `launch` / `landOnToday` are the other moves.
- `opening.route.ts`: `reatomOpening` — `open`, `openModule`, `openPet`, `openProfile`, `openTabBarMenu`, with the wide and narrow rules for where a record lands.
- `back.route.ts`: Back steps through a module's `NestedBack` first, then pops the stack; `isVisible` drives Telegram's Back button.
- `app.route.ts`: `reatomNavigation`, the one entry point: wires the parts, follows Telegram's Back and settings buttons, and keeps a wide window off «Разделы».

## Wide and narrow window

- `isWide` is a `reatomMediaQuery` atom on `(min-width: 1024px)`, built in `main.tsx` and handed to `reatomApp`, which passes it here through `routing.vm.ts`. Tests flip it with `startApp`'s `setWide`.
- **Narrow**: Today, two slot modules and «Разделы» are tabs; any other module opens on top of Today.
- **Wide**: every module and the Profile are tabs. A record opened from anywhere switches to its module's tab and Back leads to that module's root; a Pet card lies over the Pets inside the `pet` tab; a launch link lands under its module; the Profile opens as a root. «Разделы» and the slot setup never show: at launch or on widening the app lands on Today.
- **Crossing 1024px** keeps the URL and every module's own state (an open card or form, its `NestedBack`), resets `tab` and `trail` (`atomResetOnWidthChange`), so the active tab is worked out again as on a reload.
- **Transitions**: `switchTo` reports a tab switch as `fade` on a wide window and `forward` on a narrow one; push and Back slide. `slideScreens` in `modules/ui` plays them.

## Around it

- Every «open this record» — a `start_param` deep link, a tap in the Feed or another module, a quick-add tile — goes through `app/vm/opener.vm.ts`: it switches the module, waits for the session or a picked Pet where needed and calls the module's own «open by id».
- The shell (`app/vm/shell.vm.ts`, `app/view/home.view.tsx`) draws the tab bar with its «+» on a narrow window and `modules/sidebar` from 1024px up; both read `activeTab` from here.
- Tests: `app.route.test.ts` drives the navigation over fakes (`startNavigation`, `startSliding`); what crosses modules runs on the whole app in `app/vm/*.test.ts`.
