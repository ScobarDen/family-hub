# photo-viewer

The full-screen viewer over a record's photos: Telegram goes full screen while it is open, `PhotoThumbs` opens it from a row of thumbnails. Delete asks «Удалить фото?», applies at once and rolls back into the module's failure bar, shown inside the viewer while it is open. Pick and share appear where a module offers them.

## Injected

- `api` — the owning module's `deletePhoto`.
- `telegram` — `modules/telegram`: the confirmation dialog, full screen and haptics.
- `onPick` — optional: the module's own action on the photo shown, such as making it a Pet's avatar.
- `onDeleted` — the module refreshes what showed the photo.
- `failure` — the module's failure bar.
- `sharing` — optional: sharing the photo to a Telegram chat.

Out of scope: picking and uploading photos (`photo-attachments`), signed links (`photo`).
