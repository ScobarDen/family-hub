# join-family

The screen of a person who opened the Mini App from an Invite link (`start_param` `inv_<token>`, read with the contract's deep-link codec): «Ася зовёт вас в семью «Гущины»» with «Вступить», which asks Telegram for write access and joins the Family. A used, expired, revoked or mangled Invite shows «Приглашение не действует»; a Member of another Family is told to leave it first; a Member of the inviting Family goes straight home. «Продолжить» closes the screen and leaves the person on whatever the session shows.

## Injected

- `api` — `createJoinFamilyApi(httpClient)`: previews and accepts the Invite with raw `initData`, turning `INVITE_UNAVAILABLE` and `ALREADY_MEMBER` into outcomes.
- `telegram` — `initData`, `startParam` and `requestWriteAccess` from `common/telegram`.
- `onJoined` — the session's `signIn`, which lets the new Member in.

The preview is a Reatom async action (`withAsyncData`) that `app/main.tsx` starts with `load()` at launch; «Повторить» calls it again. `isOpen` is handed to the session as `isJoiningFamily`, so the session shows `<JoinFamily model={…} />` instead of its own screens until the person joins or closes it.
