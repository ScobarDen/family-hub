# recipes

The «Рецепты» tab: the Family's recipes, always Shared. A Recipe has a title, its ingredients one per line, «как готовить», up to ten photos and the Family's Recipe Tags; any Member edits it and its author deletes it after a confirmation. The list is searched on the server by every word of the title, the ingredients and the method, narrowed by a tag chip and by «⭐ Избранное», which is each Member's own. On a Recipe's screen the ingredients tick off as «уже положил» — screen state only, gone on the next visit. Tags are added, renamed and deleted on their own screen; deleting one takes it off every Recipe.

Recipe photos go to the Photo Storage like any other but stay out of «Все фото» and the Albums.

## Injected

- `api` — `createRecipesApi(httpClient)`: Recipes, their tags, favourites and photos.
- `telegram` — `showPopup` from `common/telegram` for the confirmations.
- `preparePhoto` — `preparePhoto` from `common/photo`.
- `photoHint` — from `photo-storage`: why photos cannot be added now.

The photo picker is `common/photo-attachments` and the viewer `common/photo-viewer`, shared with the care and albums modules. `reatomRecipesScreen` goes to the navigation as the recipes module's `nestedBack`.
