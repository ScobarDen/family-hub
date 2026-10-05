---
name: reatom-testing
description: How to test Reatom code — context isolation instead of store mocks (`context.start` / `context.reset`), the real mocking seams (`mock`, `mockRandom`, variable IoC, `createMemStorage`), async assertion timing rules, vitest/browser-mode runner setup, and review smells. Load whenever writing, fixing or reviewing tests for code that uses Reatom, or when a Reatom test fails for no obvious reason (missing async stack, state leaking between cases, a subscriber spy that did not fire).
---

# Reatom Testing

The official reference devotes three lines to testing (`reatom/REFERENCE.md`, "SSR and testing"), so this is the fullest picture available.

**Provenance.** API facts here were read off the installed `@reatom/core@1001.3.0` typings (`dist/index.d.ts` JSDoc). Behavioral and tooling facts come from posts by Reatom's author in `t.me/artalog` (cited by post id — read at `https://t.me/artalog/<id>`) and from the `reatom-review` / `reatom-async` skills. Re-verify a signature against the installed version before trusting it; the code wins over these notes.

**Related skills.** `reatom` for the API itself, `reatom-async` for the async primitives under test, `reatom-field-notes` for non-obvious runtime behavior (deliberate `Stuck in recursion`, abort leakage) that explains a chunk of confusing test failures, `reatom-review` for reviewing the result.

## The context is the seam — not mocks

Reatom runs atoms in isolated contexts itself, so the usual "reset all the stores" scaffolding is redundant (1851).

- **`context.start(cb)`** runs a callback inside a fresh isolated context and returns its result; **`context.start()`** returns the new root frame. This is the strict option — nothing leaks between cases.
- **`context.reset()`** throws away all accumulated state and related meta, and — per its JSDoc — **aborts `wrap`ed effects too**. Intended for tests, storybook and logout. The typings' own example is literally a vitest `beforeEach`:

```ts
import { context } from '@reatom/core'
import { beforeEach, describe, expect, test } from 'vitest'

import { counter, doubled } from './my-feature'

describe('My feature', () => {
  beforeEach(() => {
    context.reset()
  })

  test('counter increments', () => {
    counter.set(5)
    expect(doubled()).toBe(10)
  })
})
```

- **`clearStack()`** is the strict mode: it empties the context stack so any atom operation outside a properly `wrap`ped function throws "missing async stack". The reference marks it "not recommended by default"; if a suite does use it, `context.reset()` becomes unnecessary.
- Rule of thumb: scope with `context.start` where practical, `context.reset()` in `beforeEach` when the code under test touches the default global context.

## Mocking primitives that actually exist

| API | What it does |
| --- | --- |
| `mock(target, cb): Unsubscribe` | Replaces an atom's/action's implementation with `cb` for the duration; the returned function restores the original. JSDoc calls it out as the testing tool. |
| `mockRandom(fn): () => void` | Deterministic `random()`; returns a restore function. |
| `variable(...).run(impl, cb)` | The documented dependency-injection seam — the JSDoc example injects `{ log: vi.fn() }` in place of the real logger. Fake collaborators with a variable, not with a module mock. |
| `createMemStorage` | In-memory persist adapter for tests (and SSR snapshots). |
| `isConnected(atom)` | Assert whether an atom currently has subscribers. |
| `sleep(ms)`, `framePromise()` | Exported from core — use these to await the queue instead of hand-rolled timers. |

Three traps in this area:

- **`reset(target)` is not `context.reset()`.** The top-level `reset` drops a computed's dependencies (resource invalidation) without recomputing it; `retryComputed(target)` resets and re-evaluates. Do not reach for it expecting a clean test context.
- **`anonymizeNames()` is not a testing tool.** It is a security/obfuscation switch that must be called before any atom is created, and it destroys the names that logs and devtools depend on. Never put it in test setup.
- There is **no `@reatom/testing` package and no `testing.*` export** in core 1001.3.0. The `testing.subscribe` returning a vitest `Mock`, mentioned in post 1598, was the author's own private harness on top of `MIDDLEWARES` — treat it as an idea to copy, not an API to import.

## Async assertion rules that break naive tests

- **Never assert synchronously after `.set()`.** Subscriber callbacks and queue effects flush on a microtask. Await one (`await sleep(0)` / `framePromise()`) or read the atom directly instead of asserting on the subscriber spy.
- **Reading `.pending()` in timing-sensitive tests can itself affect scheduling** (`reatom-async` reference) — assert on the outcome, not on transient async status, in hot tests.
- **A downleveled build breaks context propagation.** If `async/await` is transpiled to `.then()` chains, the async context is lost and you get "missing async stack"-shaped failures that look like library bugs. Check the *test* transform's target (not just the app's) before blaming Reatom.
- **An instant, unexplained abort is usually the known structural trap**, not your test: work kicked off from inside a process that just got aborted gets aborted with it, and only routes / `reatomComponent` act as a watershed. See `reatom-field-notes`.
- The repo's own test files are the de-facto documentation for these edge cases: `withAsync.test.ts`, `withAsyncData.test.ts`, `withAbort.test.ts`, `wrap.test.ts`, `take.test.ts`, `framePromise.test.ts`, `withSuspense.test.ts`, and `atom.recursion.test.ts` for the recursion behavior (1848, 1924).

## Runner setup, as done in the Reatom repo

- **Turn vitest isolation off**: `isolate: false` + `fileParallelism: false` cut the core suite (290 tests / 44 files, heavily async) to **1/6 of the wall clock** — creating 44 isolates cost more than running the tests, and Reatom isolates internally anyway (1851).
- The core suite is split deliberately: real-browser cases through **`@vitest/browser-playwright`** ("очень рекомендую"), plain units for the rest (1851, 1542).
- Headless browsers are not the slow option — 34 tests in 0.6s (1528). Browser mode is not an excuse to skip component tests.
- History note: the project migrated **uvu → vitest** because uvu reported the wrong error in the wrong test (1445). Any uvu-based snippet from the archive is dead.

## What the author counts as a good test (1575, 548, 1761, 1933)

- Prefer **e2e, or component tests in a real browser, with as few mocks as possible** — he has deliberately had passing unit tests rewritten into integration ones. Every mock is a liability to keep watching.
- **Type tests are first-class**: a refactor silently killed optional-argument inference, and only a type test caught it (1761).
- "Story tests" — tests written with readable naming and comments, then copied into the docs automatically (548). An idea he floated, not shipped tooling.
- For reactive libraries, **correctness suites beat benchmarks** (1933); apply the same instinct to your own reactive code.

## Review smells

- Hand-rolled store mock/reset helpers where `context.start` / `context.reset()` would do.
- A `beforeEach` that manually re-seeds atoms one by one.
- Synchronous assertions right after `.set()`, or `await Promise.resolve()` sprinkled by trial and error.
- Suites sharing the default global context with no reset — state leaks between cases and order becomes load-bearing.
- Casual `clearStack()` / `anonymizeNames()` in setup files.
- Mocking the transport with a module mock when a `variable` seam already exists in the code under test.
