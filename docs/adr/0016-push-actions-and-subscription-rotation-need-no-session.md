# Push actions and subscription rotation need no session

The service worker cannot reach the Device credential, which the Installed App keeps in `localStorage` ([ADR 0014](0014-the-installed-app-signs-in-with-telegram-login-and-keeps-a-device.md)), yet it must answer «Готово» and «Отложить» on a Push and save a subscription the browser replaced. So each Push carries an action token: an HMAC over the dispatch row, the Occurrence, the Member and the Device, keyed from the VAPID private key. The Worker accepts a press while that Device is live, so revoking the Device kills its buttons and the token needs no expiry. The Occurrence travels in the token because a pushed row has already moved on to the next one. A replaced subscription is saved by presenting the old endpoint, an unguessable URL only the push service and the Worker know; when the browser gives no old subscription, the app saves the new one at its next launch.

## Considered Options

- **The Device credential in IndexedDB for the service worker** — one way to sign in everywhere, but a second copy of the credential in storage the page and the worker share, and a sign-in flow inside the worker.
- **Buttons that open the app to do the action** — no new route, but the press is no longer in the background and the window opens anyway.
- **A separate `PUSH_ACTION_SECRET`** — independent rotation, but one more secret to set, while rotating VAPID drops every subscription and so every button with it.
