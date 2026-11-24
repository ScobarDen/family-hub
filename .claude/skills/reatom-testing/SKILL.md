---
name: reatom-testing
description: How to test Reatom code — context isolation instead of store mocks (`context.start` / `context.reset`), the real mocking seams (`mock`, `mockRandom`, variable IoC, `createMemStorage`), async assertion timing rules, vitest/browser-mode runner setup, and review smells. Load whenever writing, fixing or reviewing tests for code that uses Reatom, or when a Reatom test fails for no obvious reason (missing async stack, state leaking between cases, a subscriber spy that did not fire).
---

# Reatom Testing

**Prerequisite:** the official `reatom`, `reatom-async` and `reatom-review` skills (`npx skills add https://github.com/reatom/reatom/tree/v1001/skills`). `reatom-field-notes` explains the runtime traps (deliberate `Stuck in recursion`, abort leakage) behind a chunk of confusing test failures.

API facts here are checked against `@reatom/core@1001.3.0`; the installed typings (`dist/index.d.ts` JSDoc) win when they disagree.

## The context is the seam — not mocks

Reatom runs atoms in isolated contexts itself, so the usual "reset all the stores" scaffolding is redundant.

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
| `createMemStorage` | In-memory persist adapter for tests (and SSR snapshots): `withLocalStorage.storageAtom.set(createMemStorage({ name: 'test' }))`. |
| `isConnected(atom)` | Assert whether an atom currently has subscribers. |
| `sleep(ms)` | Exported from core — `await sleep(0)` lets queued subscriber notifications flush. |

`framePromise()` is not a flush helper: it returns the result of the *current* atom or action frame, for use inside an action.

Three traps in this area:

- **`reset(target)` is not `context.reset()`.** The top-level `reset` drops a computed's dependencies (resource invalidation) without recomputing it; `retryComputed(target)` resets and re-evaluates. For a clean test context, call `context.reset()`.
- **`anonymizeNames()` is not a testing tool.** It is a security/obfuscation switch that must be called before any atom is created, and it destroys the names that logs and devtools depend on. Never put it in test setup.
- There is **no `@reatom/testing` package and no `testing.*` export** in core 1001.3.0. A subscriber spy is a `vi.fn()` passed to `atom.subscribe`.

## Testing an async action

Put the transport behind a `variable`, give it a production default, and swap it per test with `.run`:

```ts
// todos.ts
export type Transport = { get: (url: string, signal: AbortSignal) => Promise<unknown> }
export const transportVar = variable<Transport>('todos.transport')

export const loadTodos = action(async () => {
  const transport = transportVar.get() ?? fetchTransport
  const payload = await wrap(transport.get('/api/todos', abortVar.require().signal))
  todos.set(parseTodos(payload))
}, 'todos.load').extend(withAsync(), withAbort())

// todos.test.ts
test('loadTodos fills the list', async () => {
  const get = vi.fn(async () => [{ id: '1', title: 'a' }])
  await transportVar.run({ get }, () => loadTodos())
  expect(get).toHaveBeenCalledWith('/api/todos', expect.any(AbortSignal))
  expect(loadTodos.ready()).toBe(true)
  expect(loadTodos.error()).toBeUndefined()
  expect(todos()).toHaveLength(1)
})
```

Assert on the outcome (`ready()`, `error()`, the state the action wrote). Which `withAsync` / `withAbort` options a command needs is `reatom-async`'s call.

## Async assertion rules that break naive tests

- **`atom.subscribe(cb)` calls `cb` immediately with the current state; later updates arrive on a microtask.** After `.set()`, `await sleep(0)` before asserting on a subscriber spy, and count calls after `spy.mockClear()` following the subscribe — or read the atom directly.
- **Reading `.pending()` in timing-sensitive tests can itself affect scheduling** (`reatom-async` reference) — assert on the outcome, not on transient async status, in hot tests.
- **A downleveled build breaks context propagation.** If `async/await` is transpiled to `.then()` chains, the async context is lost and you get "missing async stack"-shaped failures that look like library bugs. Check the *test* transform's target (not just the app's) before blaming Reatom.
- **An instant, unexplained abort** is usually the abort-leakage trap — see `reatom-field-notes`.
- The Reatom repo's own tests are the de-facto documentation for these edge cases, under `github.com/reatom/reatom/tree/v1001/packages/core/src`: `async/withAsync.test.ts`, `async/withAsyncData.test.ts`, `extensions/withAbort.test.ts`, `methods/wrap.test.ts`, `methods/take.test.ts`, `methods/framePromise.test.ts`, `extensions/withSuspense.test.ts`, and `core/atom.recursion.test.ts` for the recursion behavior.

## Runner setup

- **Turn vitest isolation off when all shared state lives in Reatom atoms**: `isolate: false` + `fileParallelism: false` cut the Reatom core suite to 1/6 of the wall clock, since Reatom isolates internally anyway. Keep the default isolation while module-level non-Reatom state (singletons, caches, patched globals) is shared between test files.
- Run real-browser cases through **`@vitest/browser-playwright`** and keep plain units for the rest. Headless browsers are not the slow option — 34 tests in 0.6s; browser mode is no excuse to skip component tests.
- **Type tests** run in the same command: `expectTypeOf` from vitest, with `test.typecheck.enabled: true` and `typecheck.include` covering the test files.

## What counts as a good test

- Prefer **e2e, or component tests in a real browser, with as few mocks as possible**; rewrite a passing unit test into an integration one when it only exercises mocks. Every mock is a liability to keep watching.
- **Type tests are first-class**: a refactor silently killed optional-argument inference in Reatom itself, and only a type test caught it. Cover inferred unions, factory return types and optional arguments.

## Review smells

- Hand-rolled store mock/reset helpers where `context.start` / `context.reset()` would do.
- A `beforeEach` that manually re-seeds atoms one by one.
- Synchronous assertions right after `.set()`, or `await Promise.resolve()` sprinkled by trial and error.
- Suites sharing the default global context with no reset — state leaks between cases and order becomes load-bearing.
- Casual `clearStack()` / `anonymizeNames()` in setup files.
- Mocking the transport with a module mock when a `variable` seam already exists in the code under test.
