---
name: reatom-field-notes
description: Non-obvious Reatom runtime behavior, deliberate design choices, structural traps and field-tested patterns harvested from the author's own channel (t.me/artalog). Load ALONGSIDE the `reatom` skill whenever writing, debugging or reviewing Reatom code — especially for unexplained aborts, recursion errors, suspicious v3-era snippets, perf claims, SSR wiring, observability, choosing `reatomBoolean`/`reatomEnum`/collection primitives over a bare `atom`, or "why Reatom instead of MobX/Zustand/Jotai/Effector/react-query" questions. For tests, load `reatom-testing` instead.
---

# Reatom Field Notes

Companion to the official `reatom`, `reatom-async`, `reatom-jsx` and `reatom-review` skills, plus the local `reatom-testing` skill. Those carry the API. This one carries what an API reference does not say: behavior that looks like a bug but is deliberate, structural traps, and the reasoning behind the design.

## Provenance and precedence

- Source: posts by Reatom's author (artalar) in `t.me/artalog`, swept 2026-08-27 across the full channel history (posts 1–1993). Every claim cites its post — read it at `https://t.me/artalog/<id>` before relying on a detail. The one exception is *Specialized primitives before a bare atom*, which cites the v1001 source tree instead.
- **`REFERENCE.md` from the `reatom` skill always wins.** These are notes from a chat channel, not a spec: some posts describe work in progress, some describe a version that has since changed.
- If anything here contradicts the code in `node_modules/@reatom/*`, the code wins. Say so and move on.
- Pinned to **v1001** as the current major (as of 2026-08).

## Traps that look like your bug but are not

### `Stuck in recursion` is a deliberate refusal (1933)

If a computed updates its own dependency without an exit condition, Reatom throws **`Stuck in recursion`** at the 10th nested update instead of silently stopping. This is a conscious disagreement with other reactive libraries (including the Vue-reactivity correctness suite, which Reatom otherwise passes almost entirely): the library cannot know at which step the value became correct, so it refuses to guess.

Implication when debugging: do **not** "fix" this by reshaping the graph until the error stops appearing, and do not report it as a Reatom bug. Add the explicit exit condition to the computed, or stop writing to your own dependency.

### Abort leakage across the process graph (1760, 1449)

The async context threads through everything, and the `AbortController`s living inside it abort eagerly. The classic symptom:

- a route change (or a param change) aborts the old process;
- the new process was started *from within* the old one (through a chain of callbacks);
- so the brand-new request is aborted immediately, for no visible reason.

The author calls this "recursion that caught up with itself". Routes and `reatomComponent` currently act as a **hardcoded watershed** — the traversal does not look for abort context below them. This is acknowledged as a hardcode rather than a derived rule, so cases outside those two boundaries can still leak.

When you hit an inexplicable instant abort: check whether the new work was kicked off from inside the thing that just got aborted, and move the kick-off behind a route/component boundary instead of fighting the abort.

### Stale-API detector

A snippet found online (or produced from memory) is pre-v1000 if it shows any of these:

| Stale marker | Current shape |
| --- | --- |
| `ctx` as the first argument of every function (710) | async context + `wrap` |
| `reatomResource`, `reatomAsyncReaction` (1094, 1025) | `withAsync` / `withAsyncData` |
| `.actions` on a model (1754) | removed on purpose — "confused more than it helped" |
| doc links to `reatom.dev/package/...` or `v1000.reatom.dev` | `v1001.reatom.dev` |

Doc entry points: `v1001.reatom.dev`, mirror without VPN `reatom.github.io/reatom`, LLM digest `v1001.reatom.dev/llms.txt` (1954). For prototyping with an LLM, feed it the digest rather than trusting recall (1863).

## Patterns worth reaching for

### Specialized primitives before a bare atom (source: `packages/core/src/primitives`, `v1001.reatom.dev/reference/primitives/`)

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
| large or reorderable list of item models | `reatomLinkedList` — incremental `changes` log that `@reatom/jsx` patches instead of re-rendering; `create`, `remove`, `move`, `swap`, `batch`, computed `array` |
| a hand-written `reset` back to the initial value | any of the above |

The list reflects v1001 as of 2026-09; the exports of `@reatom/core` (the `primitives` directory in `node_modules`) are the truth when it drifts.

The project's own convention wins: if the codebase consistently writes `atom(false)` with its own toggle, follow it and mention the primitive in one line rather than switching style. On review, a hand-rolled toggle / setter set / reset is a non-blocking smell — name the primitive that replaces it.

### Derived computation attached to a writable atom (1856)

The pattern with no clean React equivalent, and the strongest argument for Reatom in a form-heavy app: an extra dependent computation can be hung onto a **writable** atom. React forces either a `useEffect` sync (extra renders plus glitch frames) or dragging the setter up into the data source (boilerplate plus coupling); Svelte's answer — writing into computeds — the author considers a bad practice because it is not obvious at the call site.

Canonical cases: reset pagination when the query refetches; drop a draft when its server data refreshes.

### Extensions compose; that is the whole ecosystem contract (1623, 1624, 1482)

Every feature is an extension over the same primitive, which is why cross-feature options exist at all (e.g. `withCache` accepting a persist extension). A custom persist extension is genuinely small:

```ts
const withLocalStorage = (key?: string): GenericExt => target =>
  target.extend(
    withInit(state => {
      let snapshot = localStorage.getItem(key ?? target.name)
      return snapshot ? JSON.parse(snapshot) : state
    }),
    withChangeHook(state => {
      localStorage.setItem(key ?? target.name, JSON.stringify(state))
    }),
  )
```

Writing a full custom storage adapter is "a couple dozen lines instead of a couple hundred" after the v1001 persist rework, with the required checks still applied (1781). All adapters (localStorage, indexedDB, BroadcastChannel, …) share one interface — that is what lets an option like "persist this cache" exist without special-casing.

### Atomization: state per item, not per list (1275, 1277, 1290, 692; handbook `atomization`)

Give each list item its own model. Then per-item concerns (debounce of that card's update, that card's visibility under a filter) live inside the item's model as one line, and the "stale props / zombie children" class of bug does not arise. Excessive normalization is the anti-pattern here. For large lists, `reatomLinkedList` gives incremental recomputation instead of rebuilding derived state (see *Specialized primitives before a bare atom*).

A useful sibling pattern: filter *before* inserting into a collection, not only when rendering it, whenever the collection can otherwise grow unbounded (1594).

### Transactions are process-scoped (1787)

Not synchronous, not asynchronous — built on the async call stack. `withRollback` for state, `withTransaction` for actions, and `reatomTransaction` to create separate transaction scopes per domain.

### The router is an architecture primitive, not a URL parser (1839)

It is meant to drive state initialization and the matching of key view parts. `params` accepts a validation schema **or a callback**, so params that are not URL-bound still flow through it, and `params` is reactive. See the modal-gate pattern in the handbook.

### Observability is the selling point, so use it (1772, 1897, 1426, 1976)

- `connectLogger` is ~1KB — shippable to production behind a flag.
- Log entries carry `[#N]` counters; navigate a noisy log by pasting `name[#N]` into the console's find.
- The built-in `log` action has a `.label` method.
- Devtools filters have a "do not store matching logs" mode — the one that matters on a page emitting hundreds of updates on mount, since the other modes accumulate.
- Design intent behind all of it: writing code is cheap, debugging it is expensive. Reatom optimizes for stack traces, logging and forced structure, not for the shortest hello-world.

### Names are load-bearing (758, 759, 1336)

Atom/action names build the log tree and the devtools hierarchy, so unnamed atoms silently cost the main feature. Naming is enforced by `@reatom/eslint-plugin` with autofix — deliberately a linter rule rather than a Babel plugin, so it works regardless of build tooling and stays visible in the source.

## Testing

Moved out: load the **`reatom-testing`** skill. It covers context isolation instead of store mocks (`context.start` / `context.reset`), the real mocking seams (`mock`, `mockRandom`, variable IoC, `createMemStorage`), async assertion timing, vitest/browser-mode runner setup and review smells.

## How to talk about performance (1618)

Do not claim Reatom is the fastest signal library. The author published a benchmark where it loses:

```
dynamic resubscription, median across subscriber counts (higher = better)
Reatom 25% · mobx 40% · $mol_wire 42% · act 66% · alien-signals 98%
```

The stated cost centers are the extension system, context virtualization (tests and SSR), and immutability for the async context. The argument is not speed: it is that one contract covers every feature, so a new requirement does not force a rewrite — and that folding these features into a monolith instead of separate interfaces would cost 10–20x rather than ~4x.

Use this framing in reviews and comparisons; overclaiming perf is easy to falsify.

## SSR

A new context per request gives full isolation (832). The persist layer is the seam: a mem storage adapter holds the snapshot, and `withCache` participates (942, 837, 825). The point of the design is that **client code is unchanged** — no "fetch only on the server" split and no server-snapshot checks inside components. `withCache` was extended specifically for SSR needs during the v1001 cycle (1914, 1919).

## Grounded comparison cheatsheet

Only these claims are sourced; do not embellish.

| vs | Claim (post) |
| --- | --- |
| MobX | Lazy per-model analytics loading, event streaming / stream sharing, one-shot events without state races in checkout-like flows (846) |
| Zustand | No type inference, weak SSR, no computeds, no async logic (1079) |
| Jotai | "atom" as a buzzword vs naming derived from ACID/Clojure; `jotai-effect` appeared right after `reatomAsyncReaction` (996, 1063) |
| Effector | Third-party review: Reatom code reads more procedurally, simpler API, ~1.5x less library-specific code; downsides at the time — no one-line action logging, two ways to declare a computed (863, 791) |
| react-query | Base examples are equivalent; advanced ones diverge. `enabled` is the concrete pain: it wrecks types, still constructs every hook, and invites bugs — signals allow an early return instead (1766, 1095, 800) |
| Vue refs | Per-atom lifecycle hooks (init a resource on first subscription, dispose on last unsubscription), a separate "action" entity, automatic names for logs, and usability as a microfrontend core across vue/react/solid/svelte adapters (1207) |

## Ecosystem facts worth knowing

- v1001 core ships JSX, React and Vite support; claimed <10% overhead mounting 70k nodes (1976).
- `@reatom/jsx`: real DOM elements from `<div />`, no re-renders, ~1KB on top of core, built-in style handling via native nesting and CSS variables (1250, 1793). Reference apps: a game under 18KB with a 200-line `model.ts` (1827, 1828) and a photo gallery — 10k lines of source, 60KB shipped, Reatom as the only dependency (1945).
- With Preact option hooks an atom can be read directly in JSX (`{count()}`); callbacks still need an explicit `wrap` (1801).
- Large real-world app to study for wiring at scale: `github.com/Guria/modern-stack` (1954).
- The paid `artalogg` calls produce published notes and recordings that often contain the actual design reasoning (1754, 1763, 1790) — a decent lead when a decision looks arbitrary.
