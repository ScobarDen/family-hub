# live-updates

The socket to the Family's Durable Object, open while the app is on screen, and a version per module that its live resources follow to refetch a change ([ADR 0010](../../../../../docs/adr/0010-live-updates-through-a-family-durable-object.md), [ADR 0018](../../../../../docs/adr/0018-live-versions-per-module-and-the-writers-own-refetch.md)). Another Member's change arrives through the socket; the app's own is reported by the HTTP client, and its echo from the socket is skipped.

Tests take `FakeSocket` and `FakePage`.

Out of scope: the reads that follow a version (`live-resource`).
