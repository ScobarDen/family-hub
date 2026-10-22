# command

The microphone in the centre of the tab bar and the sheet that previews the Command Draft it produced ([ADR 0007](../../../../../docs/adr/0007-voice-and-text-commands-through-workers-ai.md)). Nothing is created without «Создать»; «Изменить» hands the draft to the ordinary form of its kind, together with when and in which zone its phrase was said, so the form dates it as «Создать» would.

## Microphone

Hold to talk, as in Telegram: `pointerdown` starts recording, `pointerup` sends, sliding off the button cancels, and 30 seconds sends by itself. Vertical swipes are off only while the finger is down, and haptics mark the start and the stop. A first hold spent on the permission prompt sends nothing and says «Держите кнопку и говорите». Without a microphone (no API, refused, no device) the button opens the bot chat, where a voice message does the same.

## Sheet

Shows what was heard and the draft as the bot shows it: both read it with `previewOf` from `@family-hub/commands`, the bot adding its emoji. A missing field or an unresolved Member takes «Создать» away; candidates are picked right in the sheet. «Создать» shows «Создано» at once and brings the draft back if the server refuses, with the bot's words for the refusal's reason. «×» drops a pending draft. Failures read the same as in the bot: the server sends the text.

## Injected

- `recorder` — `common/voice-recorder`, the browser's `MediaRecorder` behind a seam tests replace.
- `telegram` — haptics, vertical swipes and `openTelegramLink` from `common/telegram`.
- `botChat` — the bot chat link from `GET /api/commands/bot`, since the Mini App does not know its bot's name.
- `wait` — the one-second tick of the recording timer.
- `onRecorded` — the composition root passes the recording to the sheet.
- `members`, `pets` — the Family's shared queries from `app/main.tsx`, which name the candidates of the preview sheet.
- `onEdit` — the app's opener opens the form of the draft's kind; the form reports back so the draft becomes `created`.
- `onCreated` — what «Создать» made, for the module that lists it.

A `start_param` `cmd_<draftId>` from the bot's «Изменить» skips the sheet: once signed in, the app's opener calls `openForEdit`, which fetches the draft and goes straight to `onEdit`.
