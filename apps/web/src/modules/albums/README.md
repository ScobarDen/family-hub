# albums

The «Альбомы» tab: the Family's Albums, always Shared, and each Pet's automatic Album of the photos of its Care Entries, plus «Все фото» with every photo once. An Album has a title, a description and a cover — any of its photos, picked in the viewer — and shows its photos by when they were taken in a three-across grid that opens full screen with a swipe between them. One photo may sit in several Albums.

«Добавить фото» takes up to 50 at a time: each is shrunk on the device and goes up one by one with «12 / 40» and «не закрывайте приложение»; a 429 from Telegram waits as long as it asks, a failure stays for «Повторить», and each uploaded photo joins the Album at once. Adding to a Pet's Album writes a Care Entry «Заметка» of that Pet instead, and that Album is neither renamed nor deleted. Deleting an Album asks «Только альбом» or «Альбом и фото»; the latter keeps the photos another Album or a Care Entry still shows. The Album leaves the list at once and comes back with the failure bar when the server does not take the deletion; a photo deleted in the viewer does the same. The Member who made an Album or the Family Owner deletes it; anyone edits it. The Album form is a `reatomEditableRecord` from `common/form`, which owns creating, editing and the saving flags.

## Injected

- `api` — `createAlbumsApi(httpClient)`: the Albums with their photos, «Все фото», creating, editing and deleting an Album, adding photos to it, uploading and deleting a photo.
- `deviceCache` — `common/device-cache`: the list of Albums of the last launch shows at once; an opened Album and «Все фото» load when opened.
- `telegram` — `showPopup` from `common/telegram` for the confirmations, `canShareMessage` and `shareMessage` for sharing a photo of the open Album from the viewer as a card with «Открыть» to that Album; «Все фото» belong to no one Album and offer no sharing.
- `timeZone` — the zone an Album's date span is shown in; the Member's own zone, the device's until it is known.
- `preparePhoto` — `preparePhoto` from `common/photo`: Exif date, then 2560 px JPEG.
- `wait` — a timer, so tests do not sleep through a 429.
- `photoHint` — from `photo-storage`: why photos cannot be added now.

`reatomAlbumsScreen` goes to the navigation as the albums module's `nestedBack`. The full-screen viewer is `common/photo-viewer`, shared with the care journal in `pets`.
