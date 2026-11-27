# changes

The pieces every command and optimistic change is built from:

- `detached` — a command the View fires without its promise.
- `Slide` — a change that slides the screen (`slideScreens` in `ui`); `instantly` by default. Tests take `fakeSlide`.
- `readOnly` — an atom handed out to read.
- `reatomFailure` — a failed command's text.
- `reatomOptimistic` — a change shown at once and rolled back, through the live resource's `rollback` and `withTransaction`, when the server refuses it.
- `reatomRollbackFailure` — the failure bar's words: the caller's own for a refusal, `offlineFailure` («Нет связи — не сохранилось. Проверьте интернет и повторите.») when the request got no answer.

Out of scope: rolling back only the records a change touched (`common/records.lib.ts`), the bar itself (`FailureBar` in `ui`).
