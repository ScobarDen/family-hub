# recipes

The «Рецепты» tab: the Family's recipes, always Shared. A Recipe has a title, its ingredients one per line, «как готовить», up to ten photos and the Family's Recipe Tags; any Member edits it and its author deletes it after a confirmation. The list is searched on the server by every word of the title, the ingredients and the method, narrowed by a tag chip and by «⭐ Избранное», which is each Member's own. On a Recipe's screen the ingredients tick off as «уже положил» — screen state only, gone on the next visit. Deleting a Recipe shows at once and rolls back with the failure bar when the server does not take it. Tags are added, renamed and deleted on their own screen; deleting one takes it off every Recipe, shows at once and rolls back with the failure bar when the server does not take it. «Поделиться» sends a Recipe to a chat as a card the bot prepares — its first photo, title and the ingredients that fit a caption, with «Открыть» to the Recipe — and is hidden where Telegram cannot share a prepared message.

Recipe photos go to the Photo Storage like any other but stay out of «Все фото» and the Albums.

The Recipe form is a `reatomEditableRecord` from `modules/form`, which owns creating, editing and the saving flags; the form adds its tags, its photos and saving while a photo still uploads. It opens in a bottom `FormDrawer` (`isFormOpen`) over the list or the Recipe it came from; the tags stay a screen of their own.

## Injected

- `api` — `createRecipesApi(httpClient)`: Recipes, their tags, favourites and photos.
- `deviceCache` — `modules/device-cache`: the Recipe cards (without «как готовить», which the Recipe's own screen loads) and the tag chips of the last launch show at once. Only the whole book in its usual order is kept, never a search, a chip or «⭐».
- `telegram` — `showPopup` from `modules/telegram` for the confirmations, `canShareMessage` and `shareMessage` for «Поделиться».
- `preparePhoto` — `preparePhoto` from `modules/photo`.
- `photoHint` — from `photo-storage`: why photos cannot be added now.
- `today`, `timeZone` — the viewer's date and zone: an earlier day is marked at its midday.

The photo picker is `modules/photo-attachments` and the viewer `modules/photo-viewer`, shared with the care and albums modules. `reatomRecipesScreen` goes to the navigation as the recipes module's `nestedBack`.
