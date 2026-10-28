# Screens render from a DeviceStorage cache before sign-in

Every launch showed «Входим…» while the app exchanged initData for a session, then «Загружаем…» while the screen fetched its data: two or three round trips from the Telegram WebView before anything useful appeared. Now the last data each list screen received is kept in Telegram's DeviceStorage, and the app draws the shell and the first screen from it at once; sign-in and the fresh data follow in the background and replace it quietly.

## Decisions

- **The cache is trusted until the server says otherwise.** The shell (the current Member, the Family, the tab-bar slots, the time zone) and Today render from the cache before sign-in answers. If sign-in returns another Member or Family, or a stranger, the whole cache is cleared and the matching screen is shown. A Member removed from the Family sees for about a second only what their own device already held. A 401 does not clear the cache: an expired token is not a lost membership.
- **An Invite deep link bypasses the cache**, so joining another Family never flashes the old one.
- **Telegram's own loading placeholder covers the read.** `webApp.ready()` is called once the first screen's keys are read, at most about 300 ms after launch, so a cold start shows Telegram's splash and then content, with no skeleton in between.
- **DeviceStorage only, memory elsewhere.** Where DeviceStorage is unavailable (Telegram Desktop, Web and old clients) data lives in memory for the session; nothing goes to `localStorage`, which would leave Family and Private records in a shared browser after the Member signs out of Telegram.
- **Everything the Member can see is cached**, Private records included: DeviceStorage is scoped to one Telegram user and one bot. List screens are kept whole; the Feed keeps its first page and Albums their list; single-record screens, an opened Album and «Все фото» are not cached. A key that does not fit the 5 MB is simply not saved.
- **No age limit for showing, but a hard limit for keeping.** Any cache beats a skeleton, since the network replaces it within a second. A cached value is parsed with the contract's Zod schema and dropped if it does not parse, if its version is older than the app's, or if it is older than 30 days.
- **A date-bound block is not shown stale.** Today's «сегодня» block from an earlier date shows a skeleton rather than yesterday's Tasks under today's heading, where a tap would complete the wrong Occurrence; the rest of Today renders from the cache.
- **One extension on the loaded data**, not a resource framework: a module adds the cache to the `data` atom of its existing `withAsyncData`, and a screen shows whatever `data()` holds instead of waiting for `ready()`.
- **Photo links in old data may have expired.** Photos are served `immutable`, so the WebView usually still has them under the same URL; when it does not, the image keeps its size behind a placeholder until fresh data brings a new link.

## Considered Options

- **Keep the session token on the device (SecureStorage)** to skip sign-in — saves one round trip, but stores a credential, and SecureStorage exists only on iOS and Android; a fresh initData arrives with every launch anyway.
- **`localStorage` fallback on Desktop and Web** — the same speed everywhere, but Family data would outlive the Telegram session on a shared computer.
- **Reatom `withCache` with persistence** — caches by action parameters, while screens load through a parameterless computed restarted by live-update versions.
- **A time-to-live for showing the cache** — would bring the skeleton back for anyone who has not opened the app for a while, which is exactly the case where waiting hurts most.
- **An offline queue for writes** — conflicts with other Members' edits under last-write-wins, retries and idempotency, for the rare tap without a network; optimistic writes roll back instead.
