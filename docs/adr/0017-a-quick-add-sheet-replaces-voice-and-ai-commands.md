# A quick-add sheet replaces voice and AI commands

Supersedes [ADR 0007](0007-voice-and-text-commands-through-workers-ai.md).

Tasks mostly come to mind away from home — in a shop, on the way, at work — where talking to the phone is awkward, and a recognised phrase still had to be checked and often fixed in the form. Typing into the form is faster and more accurate. So the Mini App, the bot and the API drop voice and AI commands entirely: no Whisper, no LLM, no Command Draft, no `AI` binding. The centre of the tab bar becomes a «+» that opens a bottom sheet «Добавить» with Дело, Запись питомцу, Взнос (with a Savings Goal) and Фото (with Photo Storage); each tile opens that module's own create form, as the quick-add on «Разделы» did, which goes away.

## Decisions

- **The bot reads no messages.** A private text or voice message gets one answer — use the app — with a button that opens the Mini App. `/remind` is gone; `/start` and `/today` stay.
- **Old links fall through.** `cmd_<id>` leaves the `start_param` codec, so a «Изменить» button from an old preview opens the app like any unknown link; drafts lived 24 hours anyway.
- **`command_drafts` goes one release later.** The Worker live during the deploy still writes to it, so the table stays in the schema, unused, and a later migration drops it (expand / contract, `apps/api/migrations/README.md`).

## Considered Options

- **Keep voice in the bot only** — no microphone in the app, but the model, the prompts, the drafts and their upkeep all stay for a path nobody used on the go.
- **Typed commands without voice** — the same parsing and confirmation for a sentence that takes as long to type as the form.
