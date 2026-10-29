# Push is signed and encrypted by our own code on WebCrypto

A Push needs a VAPID signature (RFC 8292) and an `aes128gcm` payload encrypted to the subscription's keys (RFC 8291). The Worker does both with WebCrypto in a few functions of its own, tested against the RFC's own test vectors, in the spirit of [ADR 0004](0004-own-bot-api-client-without-grammy.md). The push service is called with `fetch`, so the test harness replaces it like the Bot API and can answer 404 and 410, which drop the subscription.

## Considered Options

- **`web-push`** — the common library, but it relies on Node's `crypto` and does not run on Workers.
- **A Worker-compatible Web Push library** — less code of ours, but the ones that exist are small and little used, and a new runtime dependency to carry for two RFCs that WebCrypto already covers.
