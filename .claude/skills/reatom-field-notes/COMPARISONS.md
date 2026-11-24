# Reatom comparisons

The "why Reatom instead of X" branch of [`reatom-field-notes`](SKILL.md). Only these claims are sourced; do not embellish. For performance, use the framing in `SKILL.md` → "How to talk about performance".

| vs | Claim |
| --- | --- |
| MobX | Lazy per-model analytics loading, event streaming / stream sharing, one-shot events without state races in checkout-like flows |
| Zustand | No type inference, weak SSR, no computeds, no async logic |
| Effector | Third-party review: Reatom code reads more procedurally, simpler API, ~1.5x less library-specific code |
| react-query | Base examples are equivalent; advanced ones diverge. `enabled` is the concrete pain: it wrecks types, still constructs every hook, and invites bugs — signals allow an early return instead |
| Vue refs | Per-atom lifecycle hooks (init a resource on first subscription, dispose on last unsubscription), a separate "action" entity, automatic names for logs, and usability as a microfrontend core across vue/react/solid/svelte adapters |

## Ecosystem numbers

- v1001 core ships JSX, React and Vite support; claimed <10% overhead mounting 70k nodes.
- `@reatom/jsx`: real DOM elements from `<div />`, no re-renders, ~1KB on top of core, built-in style handling via native nesting and CSS variables.
- Reference apps: a game under 18KB with a 200-line `model.ts`, and a photo gallery — 10k lines of source, 60KB shipped, Reatom as the only dependency.
