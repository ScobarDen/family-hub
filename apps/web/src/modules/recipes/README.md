# recipes

The «Рецепты» tab: the Family's recipes, always Shared. A Recipe has a title, its ingredients one per line, «как готовить», up to ten photos and the Family's Recipe Tags; any Member edits it and its author deletes it after a confirmation. The list is searched on the server by every word of the title, the ingredients and the method, narrowed by a tag chip and by «⭐ Избранное», which is each Member's own. On a Recipe's screen the ingredients tick off as «уже положил» — screen state only, gone on the next visit. «🍳 Приготовили» marks a Recipe cooked today or on an earlier day; its screen shows how many times and when it was last cooked, a Member takes back only their own mark, and the list sorts by «Давно не готовили», never cooked first. Marking it cooked, taking a mark back and deleting a Recipe show at once and roll back with the failure bar when the server does not take them; the cook button rests until the mark is saved, so a double tap does not cook twice. Each mark reaches the Feed as «<имя> приготовил(а) <рецепт>» with the Recipe's photo. Tags are added, renamed and deleted on their own screen; deleting one takes it off every Recipe, shows at once and rolls back with the failure bar when the server does not take it. «Поделиться» sends a Recipe to a chat as a card the bot prepares — its first photo, title and the ingredients that fit a caption, with «Открыть» to the Recipe — and is hidden where Telegram cannot share a prepared message.

Recipe photos go to the Photo Storage like any other but stay out of «Все фото» and the Albums.

The Recipe form is a `reatomEditableRecord` from `common/form`, which owns creating, editing and the saving flags; the form adds its tags, its photos and saving while a photo still uploads.

## Injected

- `api` — `createRecipesApi(httpClient)`: Recipes, their tags, favourites and photos.
- `deviceCache` — `common/device-cache`: the Recipe cards (without «как готовить», which the Recipe's own screen loads) and the tag chips of the last launch show at once. Only the whole book in its usual order is kept, never a search, a chip, «⭐» or another sort.
- `telegram` — `showPopup` from `common/telegram` for the confirmations, `canShareMessage` and `shareMessage` for «Поделиться».
- `preparePhoto` — `preparePhoto` from `common/photo`.
- `photoHint` — from `photo-storage`: why photos cannot be added now.
- `today`, `timeZone` — the viewer's date and zone: an earlier day is marked at its midday.

The photo picker is `common/photo-attachments` and the viewer `common/photo-viewer`, shared with the care and albums modules. `reatomRecipesScreen` goes to the navigation as the recipes module's `nestedBack`.
