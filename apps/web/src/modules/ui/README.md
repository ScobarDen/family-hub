# ui

The shared components: shadcn on Base UI, plus the app's own pieces every module builds its screens from. The drawer and dialog parts stay internal; modules reach them only through `Sheet`.

## Sheets and forms

- `Sheet` / `SheetContent` / `SheetTitle` — the one way to show a sheet. On a wide window (1024px and up) a Base UI dialog centred over an overlay, which holds focus inside while open and returns it to the opener on close. Below that a Base UI drawer: a bottom sheet with a swipe handle below the Telegram header and above the bottom safe area, sliding only under `prefers-reduced-motion: no-preference` and fading otherwise, keeping the focused field above the on-screen keyboard through Base UI's `VirtualKeyboardProvider`. A swipe down, the overlay and Escape all reach the model's `onClose`, which for a form is its module's `back`: one with unsaved input asks «Отменить изменения?» first, as «Отмена» and Telegram Back do.
- `WideWindow` — the React context `App` fills from the shell's `isWide` atom: the only place a `Sheet` learns the width, so no ViewModel changes with it.
- `FormDrawer` — a title, the content and `onClose`. Every create and edit form and every deletion confirmation is one, and the quick-add sheet is a `Sheet` too; each opens over the screen it came from, which the module keeps rendered under it.
- `FormShell` — the shared form shell; it holds Telegram's closing confirmation while the form has unsaved changes (`confirmClosingWhileDirty` from `form`).
- `Button`'s `isPending` — on every form submit: a spinner over the transparent label, which stays the accessible name; the button is blocked but still focusable and `aria-busy`.
- `PickerField` / `PickerInput` — every date and time field: the native picker under an icon and Russian text, «×» on optional ones.

## Feedback and loading

- `FailureBar` — where every module reports a change the server did not take, with only its text in the live region.
- `LiveRegion` — every polite announcement, mounted empty before its text and never `display: contents`, which older WebKit drops from the accessibility tree.
- `LoadState` — a load failure with «Повторить».
- `Skeleton` — the shimmer, and the shapes each module builds its screen skeleton from: a section of rows, Today tiles, a photo grid, the `SectionLayout` head.
- `Revealed` — a hidden «Загружаем…» for screen readers while the skeleton shows. Content that replaces a skeleton at launch fades in (Today staggers its blocks); after the first slide it shows at once.

## Screens

- `slideScreens` — the transition the navigation runs for a push, a tab switch and Back (not for Back that only closes a drawer, which slides down over a screen that stays), and for a module opening a record from its own list: the new screen renders at once and slides in from the right, from the left on Back, and the old one is gone at once. A switch between sidebar items on a wide window comes as `fade` and plays as a short fade (150ms), while a record opened inside the item and Back still slide. `prefers-reduced-motion` skips both.
- `SectionLayout` — the summary, one primary button and tabs that Pets, Goals, Recipes and Albums share.
- `CheckButton` — the one circle that completes a Task Occurrence or a Subtask wherever it is listed.
- `FallbackImage` — every signed photo; it keeps its box with a placeholder when an expired link fails.
- `ModalDialog` — the full-screen photo viewer as a native `<dialog>` opened with `showModal()` from the model's open state, so the page behind is inert, Escape reaches the model's close and focus returns to the opener.

Out of scope: the viewer's behaviour (`photo-viewer`), a form's model (`form`), the failure text (`changes`).
