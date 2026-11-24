---
name: reatom-field-notes
description: Non-obvious Reatom runtime behavior, deliberate design choices, structural traps and field-tested patterns. Load ALONGSIDE the `reatom` skill whenever writing, debugging or reviewing Reatom code — especially for unexplained aborts, recursion errors, suspicious v3-era snippets, perf claims, SSR wiring, observability, choosing `reatomBoolean`/`reatomEnum`/collection primitives over a bare `atom`, or "why Reatom instead of MobX/Zustand/Effector/react-query/Vue" questions. For tests, load `reatom-testing` instead.
---

# Reatom Field Notes

**Prerequisite:** the official `reatom`, `reatom-async`, `reatom-jsx` and `reatom-review` skills (`npx skills add https://github.com/reatom/reatom/tree/v1001/skills`). They carry the API; this skill carries what an API reference does not say: behavior that looks like a bug but is deliberate, structural traps, and the reasoning behind the design.

## Precedence

- **`REFERENCE.md` from the `reatom` skill always wins** over these notes.
- If anything here contradicts the code in `node_modules/@reatom/*`, the code wins. Say so and move on.
- Pinned to **v1001** (`@reatom/core@1001.3.0`).

## Traps that look like your bug but are not

### `Stuck in recursion` is a deliberate refusal

If a computed updates its own dependency without an exit condition, Reatom throws **`Stuck in recursion`** at the 10th nested update instead of silently stopping. This is a conscious disagreement with other reactive libraries (including the Vue-reactivity correctness suite, which Reatom otherwise passes almost entirely): the library cannot know at which step the value became correct, so it refuses to guess.

When debugging: add an explicit exit condition to the computed, or move the write out of it so the computed only reads. Treat the error as a report about your graph, not a Reatom bug.

### Abort leakage across the process graph

The async context threads through everything, and the `AbortController`s living inside it abort eagerly. The classic symptom:

- a route change (or a param change) aborts the old process;
- the new process was started *from within* the old one (through a chain of callbacks);
- so the brand-new request is aborted immediately, for no visible reason.

Routes and `reatomComponent` currently act as a **hardcoded watershed**: the traversal does not look for abort context below them. Cases outside those two boundaries can still leak.

When you hit an inexplicable instant abort: check whether the new work was kicked off from inside the thing that just got aborted. Start it from a route loader or from a `reatomComponent` mount instead of from a callback that runs in the old process's frame.

### Stale-API detector

`REFERENCE.md` → "v3 migration highlights" maps the `ctx`-era API (`ctx.spy`, `ctx.schedule`, `reatomAsync`, `reatomResource`, `reaction`, …) to the current shape. On top of that list, a snippet is pre-v1000 if it shows any of these:

| Stale marker | Current shape |
| --- | --- |
| `reatomAsyncReaction` | `computed(...).extend(withAsyncData())` |
| `.actions` on a model | removed on purpose — attach methods with `.extend` / `withActions` |
| doc links to `reatom.dev/package/...` or `v1000.reatom.dev` | `v1001.reatom.dev` |
| `uvu` test files | vitest |

Doc entry points: `v1001.reatom.dev`, mirror `reatom.github.io/reatom`, LLM digest `v1001.reatom.dev/llms.txt`. For prototyping with an LLM, feed it the digest rather than trusting recall.

## Patterns worth reaching for

### Specialized primitives before a bare atom

Before writing `atom(...)` plus hand-made update actions, check whether a primitive from `@reatom/core` already carries that shape — it gives named actions (readable in the log tree as `isOpen.toggle`), a built-in `reset` to the initial state, and immutable updates for free. Default to the primitive; keep a bare `atom` for a value that is only ever `set` wholesale.

| Signal in the code you are about to write | Primitive and what it adds |
| --- | --- |
| `atom(false)` with `set(p => !p)` / `set(true)` | `reatomBoolean` — `toggle`, `setTrue`, `setFalse`, `reset` |
| TS `enum` or a string union with a `setX` action per variant | `reatomEnum(variants)` — inferred union, generated `setX()` setters (`format: 'camelCase' \| 'snake_case'`), `enum` object, `reset`, runtime rejection of unknown values; initial state is `variants[0]` unless `initState` |
| counter with `set(p => p + 1)` | `reatomNumber` — `increment(by)`, `decrement(by)`, `random`, `reset` |
| string that needs a way back to its initial value | `reatomString` — adds only `reset` |
| `set(p => [...p, x])` | `reatomArray` — `push`, `pop`, `shift`, `unshift` (no `reset`) |
| `new Set(p)` round-trips, selection toggling | `reatomSet` — `add`, `delete`, `toggle`, `clear`, `reset`, computed `size` |
| `new Map(p).set(...)`, cache or registry keyed by id | `reatomMap` — `set`, `delete`, `clear`, `reset`, `getOrCreate`, computed `size` |
| `set(p => ({ ...p, ...patch }))` | `reatomRecord` — `merge`, `omit`, `reset(...keys)` for a per-field reset |
| list of item models where inserts, removals or reordering are the main workflow | `reatomLinkedList` — incremental `changes` log that `@reatom/jsx` patches instead of re-rendering; `create`, `remove`, `move`, `swap`, `batch`, computed `array`, lookup by `key` |
| a hand-written `reset` back to the initial value | any of the above |

The list reflects v1001; the exports of `@reatom/core` (the `primitives` directory in `node_modules`) are the truth when it drifts. Pick `reatomLinkedList` over `reatomArray` by workflow, not size: a list the user reorders or edits item by item is a linked list; a list replaced wholesale from the server is an array.

`reatomEnum` rejects an unknown value by storing the failure: after `set('unknown')` throws, every read of the atom throws the same error until a valid `set` or `reset()`. Validate external input (server payloads, URL params, storage) against `.enum` before it reaches `set`, and cover invalid values with a type test rather than a runtime one.

The project's own convention wins: if the codebase consistently writes `atom(false)` with its own toggle, follow it and mention the primitive in one line rather than switching style. On review, a hand-rolled toggle / setter set / reset is a non-blocking smell — name the primitive that replaces it.

### Derived state on a writable atom: `withComputed`

A writable atom can recompute its own state when its dependencies change: `withComputed(state => ...)` reads dependencies and returns the next state, while the atom stays settable by hand. This replaces a `useEffect` sync (extra renders plus glitch frames) and dragging the setter up into the data source.

```ts
const query = atom('', 'query').extend(withSearchParams('query'))
const page = atom(1, 'page').extend(
  withSearchParams('page'),
  withComputed((state) => {
    query()
    return isInit() ? state : 1
  }),
)
```

`isInit()` keeps a persisted or URL-restored value on the first run. Canonical cases: reset pagination when the query changes; drop a draft when its server data refreshes.

### Cross-cutting behavior is an extension

Every feature is an extension over the same primitive, which is why cross-feature options exist (`withCache({ withPersist })`). For storage, reach for the built-in persist extensions first (`withLocalStorage`, `withSessionStorage`, `withIndexedDb`, `withBroadcastChannel`, `withCookie`). When an atom needs a behavior none of them covers, write it as an extension from `withInit` and `withChangeHook`:

```ts
const withAuditTrail = (log: (name: string, state: unknown) => void): GenericExt => target =>
  target.extend(
    withInit(state => {
      log(target.name, state)
      return state
    }),
    withChangeHook(state => {
      log(target.name, state)
    }),
  )
```

### Atomization: state per item, not per list

Give each list item its own model (see `REFERENCE.md` → "Atomization"). Then per-item concerns (debounce of that card's update, that card's visibility under a filter) live inside the item's model as one line, and the "stale props / zombie children" class of bug does not arise. Keep the list flat rather than normalizing items into id-keyed tables.

Filter *before* inserting into a collection, not only when rendering it, whenever the collection can otherwise grow unbounded.

### Transactions are process-scoped

A transaction's scope is the async call stack, not a sync block; `reatomTransaction({ name })` creates a separate scope per domain. The rest is in `REFERENCE.md` → "Transactions notes".

### The router drives state, not only URLs

Use routes to drive state initialization and the matching of key view parts. `params` accepts a validation schema **or a callback**, so params that are not URL-bound still flow through it, and `params` is reactive. Modal gates: `REFERENCE.md` → "Protected routes and modal gates".

### Observability is the selling point, so use it

- `connectLogger()` from `@reatom/core` is ~1KB — call it behind your own flag (`if (import.meta.env.DEV || debugFlag) connectLogger()`), production included. `connectLogger({ match: name => name.startsWith('feature.') })` narrows it; names starting with `_` or containing `._` are never logged.
- Log entries carry `[#N]` counters; navigate a noisy log by pasting `name[#N]` into the console's find.
- Devtools filters have a "do not store matching logs" mode — the one that matters on a page emitting hundreds of updates on mount, since the other modes accumulate.

### Enforce names with the linter

Naming is enforced by `@reatom/eslint-plugin` (`npm i -D @reatom/eslint-plugin@alpha` — the `latest` tag is the v3-era 3.x). Its README documents only the legacy config: `"plugins": ["@reatom"]` with `"extends": ["plugin:@reatom/recommended"]`, or the single rule `"@reatom/unit-naming-rule": "error"`.

## Testing

Load the **`reatom-testing`** skill.

## How to talk about performance

Argue for Reatom by its contract, not by speed. The author published a benchmark where it loses:

```
dynamic resubscription, median across subscriber counts (higher = better)
Reatom 25% · mobx 40% · $mol_wire 42% · act 66% · alien-signals 98%
```

The stated cost centers are the extension system, context virtualization (tests and SSR), and immutability for the async context. The argument is that one contract covers every feature, so a new requirement does not force a rewrite — and that folding these features into a monolith instead of separate interfaces would cost 10–20x rather than ~4x.

## SSR

A new context per request gives full isolation. The persist layer is the seam: give every persist extension an in-memory storage inside the request's context, and `withCache` participates through its `withPersist` option. **Client code is unchanged** — no "fetch only on the server" split and no server-snapshot checks inside components.

```ts
const { markup, snapshot } = await context.start(async () => {
  const storage = createMemStorage({ name: 'ssr' })
  withLocalStorage.storageAtom.set(storage)
  const markup = await renderApp()
  const snapshot = Object.fromEntries(
    Object.entries(storage.snapshotAtom()).map(([key, record]) => [key, record.data]),
  )
  return { markup, snapshot }
})
```

On the client, before the app's atoms are read, seed the same extension with `withLocalStorage.storageAtom.set(createMemStorage({ name: 'hydrate', snapshot }))`. `snapshotAtom()` holds persist records; the `snapshot` option takes plain values keyed the same way, hence the `.data` map.

## Comparisons and ecosystem

For "why Reatom instead of X" questions, read [`COMPARISONS.md`](COMPARISONS.md). Only its claims are sourced; do not embellish.

- With Preact option hooks an atom can be read directly in JSX (`{count()}`); callbacks still need an explicit `wrap`.
- Large real-world app to study for wiring at scale: `github.com/Guria/modern-stack`.
