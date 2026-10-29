# photo-storage

The Family's Photo Storage in the Profile: the private Telegram channel the Family Owner connects by adding the bot as an admin that may post. It shows whether the channel is connected, not yet connected or lost, with the steps for the Family Owner and a «ask the owner» line for everyone else.

## Injected

- `api` — `createPhotoStorageApi(httpClient)`: the Family's channel and its status.
- `isFamilyOwner` — from the session, to choose between the steps and the «ask the owner» line.

The status is an async computed (`withAsyncData`) that loads when the Profile or a photo block subscribes. `uploadHint` is what every photo upload shows instead of the upload while no channel is connected; `app/main.tsx` hands it to the modules that show photos.

Out of scope: uploading and showing photos (`photo-attachments`, `photo-viewer`, `albums`).
