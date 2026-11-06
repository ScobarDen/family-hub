# quick-add

The «+» in the centre of the tab bar and the «Добавить» sheet it opens. The sheet offers Дело, Запись питомцу, Взнос and Фото; a tile closes the sheet and opens that module's own create form, and Фото opens the file picker straight away. Each tile carries its section's icon and colour (`sections`).

## Injected

- `contributionGoalId` — from the Today hub's payload: the nearest Savings Goal, which «Взнос» goes to (no Goal, no tile).
- `canAddPhoto` — whether the Family has Photo Storage; without it there is no «Фото».
- `onQuickAdd`, `onAddPhotos` — the app's opener.
- `telegram` — a light haptic tap when the «+» opens the sheet.

Out of scope: the forms themselves (their own modules), the tab bar around the button (`tab-bar`).
