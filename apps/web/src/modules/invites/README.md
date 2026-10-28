# invites

A Member's Invites in the Profile: «Пригласить в семью» creates a single-use Invite that lives 7 days and opens Telegram's share sheet with the card the bot prepared («Ася зовёт вас в семью «Гущины»» with a «Вступить» button), or with the bare link where `shareMessage` is unavailable (Telegram before 8.0) or the bot could not prepare the card. Below it, the Member's own open Invites with the day each stops working and «Отозвать».

## Injected

- `api` — `createInvitesApi(httpClient)`: lists, creates and revokes the session Member's Invites; an Invite already gone on the server counts as revoked.
- `telegram` — `canShareMessage`, `shareMessage`, `openTelegramLink` and `haptics` from `common/telegram`.
- `timeZone` — the viewer's zone the expiry day is shown in; the Member's own zone, the device's until it is known.

The list is an async computed (`withAsyncData`) that loads when the View subscribes, so it waits for the session token. A new Invite joins the list from the create response; a revoke asks first in a bottom `FormDrawer` (`revoke` opens it, `confirmRevoke` or `cancelRevoke` answers), since the sent link stops working for good, then removes it at once and puts it back if the server call fails. `app/main.tsx` builds the model with `reatomInvites({ api, telegram, timeZone })`, and the Profile page mounts `<Invites model={…} />`.
