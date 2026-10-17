# family-request

The Family Request form a stranger reaches from «Создать свою семью»: a family name, Telegram's write-access prompt, then the request goes to the Operator. Afterwards it shows «Заявка отправлена», «Заявка уже на рассмотрении» or the 7-day cooldown after a rejection; «Проверить» signs in again, which lets the requester in once the Operator has approved.

## Injected

- `api` — `createFamilyRequestApi(httpClient)`: posts raw `initData` with the family name and turns the server's refusals (`FAMILY_REQUEST_PENDING`, `FAMILY_REQUEST_COOLDOWN`, `ALREADY_MEMBER`) into outcomes.
- `telegram` — `initData` and `requestWriteAccess` from `common/telegram`.
- `onBack`, `onCheck` — the session's `closeFamilyRequest` and `signIn`.

The form is `reatomForm` with the family name schema; its `submit` keeps the outcome as data. `app/main.tsx` builds the model with `reatomFamilyRequest({ api, telegram, onBack, onCheck })`, and `app.view.tsx` hands `<FamilyRequest model={…} />` to the session, which shows it instead of the stranger screen.
