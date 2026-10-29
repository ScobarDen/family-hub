# photo-attachments

Photos picked for a record before it is saved: each one is shrunk, uploaded at once and shown with its progress, a failed one says why («Фото больше 10 МБ» or «Не загрузилось, попробуйте ещё раз») and can be removed. The record's form saves only the ids that uploaded.

## Injected

- `api` — the owning module's `uploadPhoto`.
- `preparePhoto` — `modules/photo`: Exif date and shrinking before upload.
- `canUploadPhotos` — whether the Family's photo storage is connected.
- `haptics` — `modules/telegram`: the error tap on a failed upload.
- `max` — how many photos the record takes: five for a Care Entry, ten for a Recipe.

Out of scope: showing saved photos (`photo-viewer`), signed links (`photo`).
