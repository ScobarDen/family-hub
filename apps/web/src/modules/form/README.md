# form

What every module's form shares, so a module's own form only maps values from the record and into a change, and creates and updates.

- `fillForm` — refills a Reatom form without its `reset`, which aborts the next submit.
- `reatomSubmitFailure` — the «server refused the submit» message.
- `reatomEditableRecord` — a form that creates a record or edits one, with its saving flags and Telegram's closing confirmation while the form on screen has unsaved changes (`confirmClosingWhileDirty`, held by `FormShell` in `ui` and by the care form).
- `reatomNestedBack` — the only way to build the `NestedBack` the navigation steps back through inside a module; `firstNestedBack` stacks two, as the Pet tab does. While a form is open and the closing confirmation is on, its `back` asks «Отменить изменения?» before closing it.

Out of scope: the form shell and fields (`ui`).
