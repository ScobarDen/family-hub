---
name: code-craft
description: The decisions that make code readable at the moment it is written — names that state the result instead of the machinery, signatures with no positional flags, one status union instead of a constellation of booleans, guard clauses instead of nesting, and where a new file actually belongs. Load at a decision point — naming something, designing or extending a signature, a second boolean appearing in an argument list, a function outgrowing a screen, three flags describing one state, choosing which module or layer new code goes into, or a direct "what should I call this" / "is this signature ok". Not for judging code that already exists — that is refactor-advice. Stack-agnostic, and the project's own conventions outrank everything in it.
---

# Code craft

The handful of decisions that decide whether this code is readable in six months. All of them are made **while writing**, and none of them get cheaper afterwards.

Deliberately short. It loads at a decision point, not for the duration of a task.

## When this fires

- Naming anything — function, variable, type, file, module, component.
- Designing a signature, or adding a parameter to an existing one.
- A second boolean turning up in an argument list.
- A function outgrowing a screen, or growing a third level of nesting.
- Three flags describing what is really one state.
- Deciding which file, module or layer new code goes into.
- Asked outright — what should I call this, is this signature alright.

## When it doesn't

- Judging code that already exists → **`refactor-advice`**.
- A bug hunt, tests to write, a stack- or framework-specific question → the skill that matches it.
- Anything the project's own rules already answer.

## The project wins

Read how the neighbours in this repo already do it and follow that. A convention you'd have chosen differently, applied consistently, beats a better idea applied in one file. Everything below is the default for where the project has no opinion — never a licence to reshape code nobody asked you to touch.

## Names state the result, not the machinery

A reader should get what something does from its name, without opening it.

| Instead of | Write |
| --- | --- |
| `handleData()`, `processItem()`, `doStuff()` | what it achieves — `normalizeInvoice()`, `applyDiscount()` |
| `DataManager`, `Helper`, `Utils` | the thing it owns — `InvoiceRepository`, `PriceFormatter` |
| `retryWithBackoffLoop()` | `fetchWithRetry()` — *what* it achieves; *how* stays inside |
| `flag`, `tmp`, `data2`, `x` | the thing it holds — `isExpired`, `draftInvoice` |
| `check(user)` returning a boolean | `isActive(user)`, `hasUnpaidInvoices(user)`, `canEditOrder(user)` |

- Booleans read as a question: `is` / `has` / `can` / `should`.
- Length is not the goal; a name that needs a comment to be understood is the one to change.
- One concept, one word, across the whole codebase. `fetch`, `load`, `get` and `retrieve` meaning the same thing in four files is four times the reading cost.
- Don't abbreviate what isn't already an abbreviation in the domain. `usr`, `cnt`, `mgr` save four characters and cost a lookup.

## Signatures make the argument's meaning visible

The rule bites where the parameter's name is **invisible at the call site** — positional arguments. Named forms are already fine: keyword arguments, object fields, template props, builders. Nothing to fix there.

| Call site | The problem | Write instead |
| --- | --- | --- |
| `setContent(node, true, false)` | two flags, zero names, and you can't tell which is which | `setContent(node, { override: true, silent: false })` |
| `setContent(node, true)` | one flag that switches behaviour | a `'replace' \| 'append'` mode, or two functions — `replaceContent` / `appendContent` |
| `retry(3, 500, true)` | magic literals with no names in sight | `retry({ attempts: 3, delayMs: 500, jitter: true })` |
| `createUser(name, email, true, null, 2)` | five positionals is a struct wearing a trench coat | one options object, or a builder |

- **A boolean that *is* the data is fine.** `setVisible(true)`, `checked: true`, `setEnabled(false)` — nothing to fix. Only an argument that **selects a branch of behaviour** (`force`, `silent`, `recursive`, `override`, `replace`) qualifies.
- Two positionals of the same type in a row is a bug waiting to happen — `transfer(accountA, accountB)` reads fine until someone swaps them. Name them, or take a single object.
- Magic literals at a call site get a named constant, even when the signature is fine.
- **Three or more parameters is a signal**, not a violation. Ask whether they are really one concept.

## One union beats a constellation of booleans

`isLoading` + `isError` + `isEmpty` sitting side by side on your own type, state or props means impossible states are representable — loading *and* error at once, and now every reader has to work out which combinations are real.

```
status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'
```

The impossible states stop existing, and the exhaustiveness check does the reminding for you.

- Applies to the project's **own** domain types, state and props. Never to the shape a third-party library hands back — wrapping a library's return just to comply is worse than the flags.
- Carry the data on the variant that has it (`{ status: 'error', error }`) rather than in a parallel field that is meaningless in four states out of five.
- **Don't store what you can derive.** A field that is always `items.length === 0` is a second source of truth for the same fact.

## Shape of a function

- **Guard clauses first.** Handle the impossible cases up front and return; the happy path stays at one indent level instead of being buried three deep.
- **One level of abstraction per function.** Orchestrating steps and doing byte-level work in the same body is what makes a function hard to skim.
- **One job.** If describing what it does needs an "and", that's two functions.
- Prefer a short function whose name you can say out loud over a long one with section-banner comments inside it. Those banners are the extraction points.
- Fail fast and loudly. A swallowed error is a bug that surfaces somewhere else, at a worse time, without a stack trace.

## Where the code goes

- **Mirror the neighbours.** Find the closest existing thing of the same kind and match its directory, file naming, internal structure and registration. Consistency here is worth more than any layout you'd argue for in the abstract.
- **Don't invent a layer the project doesn't have.** A `services/` folder in a codebase with no services is a new convention, and introducing one is a decision to raise, not to make silently.
- **Dependencies point one way.** Whatever the project's direction is, don't be the first import that goes back up.
- New file or existing one — a file that has grown past what you can hold in your head is doing too many jobs. That's the signal to split, not the line count.
- A project with no layout of its own yet: levels and module boundaries are **`feod`**, file names inside a module are **`role-files`**, and the stack skill (**`frontend-mvvm`**, **`qt-mvvm`**) says how both look there.

## The base floor

SOLID, KISS, YAGNI, DRY, separation of concerns, Law of Demeter, composition over inheritance, fail fast, least astonishment, high cohesion / low coupling. Assume them; this file is not the place to re-teach them.

Two that get misapplied often enough to be worth a line each:

- **DRY is about knowledge, not characters.** Two blocks that look alike but change for different reasons are not duplication. Don't abstract on the first repeat — wait for the third, when the shape of the abstraction is actually visible.
- **YAGNI beats an extension point you're imagining.** An interface with one implementation and no second caller in sight is ceremony, not flexibility.

## What NOT to do

- ❌ Don't refactor surrounding code to match this file. You were asked to write a thing; write it.
- ❌ Don't add an abstraction, a config object, or a wrapper for a caller that doesn't exist yet.
- ❌ Don't rename existing symbols outside the scope you were given — other callers depend on them.
- ❌ Don't file findings. Noticing that neighbouring code breaks these rules is not this skill's output; it's a note in one line, at most.
- ❌ Don't apply any of this against the project's stated convention. Follow the project, say so in one line, move on.
