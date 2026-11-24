---
name: code-craft
description: SOLID and OOP, naming, signatures, state shape, function shape and file placement, decided while writing code. Load when naming something, designing or extending a signature, a second boolean argument or a third flag for one state appears, a function outgrows a screen, reaching for a base class, an interface or a `switch` on kind, business logic needs storage, network or the clock, choosing where new code goes, or asked "what should I call this" / "is this signature ok". Not for judging code that already exists — that is refactor-advice.
---

# Code craft

The handful of decisions that decide whether this code is readable in six months. All of them are made **while writing**, and none of them get cheaper afterwards.

**Done when:** every new name, signature, state shape, function, type and file placement in your change has been checked against the sections below.

## When it doesn't

- Judging code that already exists → **`refactor-advice`**.

## The project wins

Read how the neighbours in this repo already do it and follow that. A convention you'd have chosen differently, applied consistently, beats a better idea applied in one file. Everything below is the default for where the project has no opinion. Where the project's stated convention disagrees with this file, follow the project and say so in one line. The language's own idioms count as the project's convention: Go's `ctx` first, Ruby's `active?`, Rust's `match`.

Below the project, the order is: SOLID, then OOP, then every other rule in this file. When two collide, the higher one wins.

## Pairs with ponytail

When [`ponytail`](https://github.com/DietrichGebert/ponytail) is installed (`npx skills add DietrichGebert/ponytail`), load it too: it decides **how much** code to write — the smallest complete change, at its default `full` level — and this file decides **the shape** of what remains. Its `shortcut: <limit>, <when to upgrade>` marker is a legitimate why-comment. `ponytail` sizes the change inside SOLID: a seam a test substitutes, or a new variant at an existing variation point, is part of the complete change.

## SOLID

Stated for functions, types and files; a class is one case of them.

- **S — Single responsibility.** A function, type, module or file has one reason to change. If describing it needs an "and", it is two.
- **O — Open/closed.** At an existing variation point — a second variant of behaviour, a `switch` on kind repeated in more than one place — a new variant arrives as new code: a new union member with its handler, a new implementation, a new table entry. The existing branches stay as they are. With one variant, write it directly; the variation point appears with the second. One exhaustive `switch` over a closed union is the plain form; the second place that branches on the same kind makes it a variation point.
- **L — Liskov substitution.** Every implementation of a contract — subtype, interface implementation, test fake — works wherever the contract is expected, with no caller checking which one it got: it accepts at least what the contract accepts, returns everything it promises, and fails only in the ways the contract names. A fake honours the same contract as the real thing.
- **I — Interface segregation.** A consumer depends on exactly what it uses. A parameter type narrows to the members the function reads; a contract that several consumers each use in part splits along those consumers.
- **D — Dependency inversion.** Business logic receives its I/O — storage, network, clock, randomness — from outside, as a parameter or a constructor argument typed by what it needs. The contract belongs to the code that uses it. That is the seam a test passes a fake through. Each consumer declares its own contract, narrowed to the calls it makes; identical contracts merge into one on the third repeat, as DRY says. Real implementations are constructed in a composition root — the one place where the object graph of a module or of the app is built and dependencies are injected — and passed in from there (`mvvm` places it).

The examples are TypeScript; the rule is the part outside the syntax.

| Instead of | Write |
| --- | --- |
| a third `case 'crypto':` added to three `switch (method)` blocks | `paymentHandlers: Record<Method, PaymentHandler>` and one new entry |
| `sendReceipt(user: User)` that reads only `user.email` | `sendReceipt(to: { email: string })` |
| `new Date()` and `fetch` inside `applyDiscount` | `applyDiscount(order, { now, prices })` |

## OOP

Applies where the code models types with behaviour — classes, structs with methods, `impl` blocks, objects carrying methods. A file of plain functions and data keeps that style; the neighbours decide it. With no neighbours yet, a type that holds an invariant gets its own operations; everything else is plain functions over plain data.

- **Encapsulation.** A type that holds an invariant — a balance that stays non-negative, an order paid once — changes only through its own operations. Callers tell it what to do (`order.pay(payment)`) instead of reading its fields, deciding, and writing them back. Data with no invariant stays plain data with open fields.
- **Inheritance.** Reuse comes from composition: hold the collaborator and delegate to it. Extend only a true is-a, where the subtype passes L.
- **Polymorphism.** At a variation point, each variant carries its own behaviour, and the caller invokes it without asking which variant it holds. Adding a variant is O.
- **Abstraction.** A type exposes what it does, named as in the names table; how it does it stays inside. Which abstractions earn a contract is D and YAGNI.

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
- One concept, one word, across the whole codebase. `fetch`, `load`, `get` and `retrieve` meaning the same thing in four files is four times the reading cost. Different meanings keep different words; where the project and its stack skill have none yet: `get` reads what is already in memory, `fetch` crosses an I/O boundary and returns the result, `load` fetches into state the caller then reads.
- A helper generic over the operation is named for what it adds: `retry(operation, policy)`. `fetchWithRetry` is the name only when it fetches.
- Spell words out; abbreviate only what the domain already abbreviates. `usr`, `cnt`, `mgr` save four characters and cost a lookup.

## Signatures make the argument's meaning visible

The rule bites where the parameter's name is **invisible at the call site** — positional arguments. Named forms are already fine: keyword arguments, object fields, template props, builders. Nothing to fix there. The examples below are TypeScript; "options object" means whatever named form the language has: an object literal, keyword arguments, a struct or record literal, a builder.

| Call site | The problem | Write instead |
| --- | --- | --- |
| `setContent(node, true, false)` | two flags, zero names, and you can't tell which is which | `setContent(node, { override: true, silent: false })` |
| `setContent(node, true)` | one flag that switches behaviour | a `'replace' \| 'append'` mode, or two functions — `replaceContent` / `appendContent` |
| `retry(3, 500, true)` | magic literals with no names in sight | `retry({ attempts: 3, delayMs: 500, jitter: true })` |
| `createUser(name, email, true, null, 2)` | five positionals is a struct wearing a trench coat | one options object, or a builder |

- **Mode value or two functions.** Two functions when each call site always takes the same branch; a mode value when the choice is data that travels — from config, user input or a stored record.
- **A boolean that *is* the data is fine.** `setVisible(true)`, `checked: true`, `setEnabled(false)` — nothing to fix. Only an argument that **selects a branch of behaviour** (`force`, `silent`, `recursive`, `override`, `replace`) qualifies.
- Two positionals of the same type in a row is a bug waiting to happen — `transfer(accountA, accountB)` reads fine until someone swaps them. Name them, or take a single object.
- Magic literals at a call site get a named constant, even when the signature is fine.
- Dependencies travel last, as one object, apart from the data: `applyDiscount(order, { now, prices })`.
- **Three or more parameters is a signal**, not a violation. Ask whether they are really one concept.
- A **structural prop** — a prop that shows, hides, replaces or rearranges a part of a UI component (`showFooter`, `renderHeader`) — is the same flag at the component level: split the component into a compound (a root plus flat named parts the caller assembles), as `frontend-mvvm` §7 shows on the web (`npx skills add ScobarDen/scobar-skills --skill frontend-mvvm`). A slot that takes the caller's content (`children`, a named slot) is that composition already, not a structural prop.

## One union beats a constellation of booleans

`isLoading` + `isError` + `isEmpty` sitting side by side on your own type, state or props means impossible states are representable — loading *and* error at once, and now every reader has to work out which combinations are real.

```
status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'
```

The impossible states stop existing, and the exhaustiveness check does the reminding for you.

Spell it as the language's closed set of variants, data on each: a literal or discriminated union in TypeScript, a sealed class in Kotlin and Java, an enum with payloads in Rust and Swift, a union of dataclasses tagged by a `Literal` field in Python. Where the compiler has no exhaustiveness check (Go: a typed constant set or an interface with one type per variant), every `switch` over it gets a `default` that fails loudly. Where the check needs a trick, use it: in TypeScript the `default` assigns the value to `never`.

- Applies to the project's **own** domain types, state and props. Never to the shape a third-party library hands back — wrapping a library's return just to comply is worse than the flags.
- Carry the data on the variant that has it (`{ status: 'error', error }`) rather than in a parallel field that is meaningless in four states out of five.
- **Don't store what you can derive.** A field that is always `items.length === 0` is a second source of truth for the same fact. The `empty` variant above is such a case: store the loaded items, and derive `empty` where you build the state its reader gets.

## Shape of a function

- **Guard clauses first.** Handle the impossible cases up front and return; the happy path stays at one indent level instead of being buried three deep.
- **One level of abstraction per function.** Orchestrating steps and doing byte-level work in the same body is what makes a function hard to skim.
- Prefer a short function whose name you can say out loud over a long one with section-banner comments inside it. Those banners are the extraction points.
- Fail fast and loudly. A swallowed error is a bug that surfaces somewhere else, at a worse time, without a stack trace.

## Where the code goes

- **Mirror the neighbours.** Find the closest existing thing of the same kind and match its directory, file naming, internal structure and registration. Consistency here is worth more than any layout you'd argue for in the abstract.
- **A new kind of folder is the user's call.** A `services/` folder in a codebase with no services is a new convention: raise it, and put the code where the existing kinds of folder say until the user answers.
- **Dependencies point one way.** Whatever the project's direction is, don't be the first import that goes back up.
- A file that has grown past what you can hold in your head breaks S — split it; the line count is not the signal.
- A project with no layout of its own yet: **levels** (the five top-level folders `app`, `pages`, `modules`, `common`, `global`) and **modules** (a folder on the `modules` level holding one product responsibility, used from outside only through its public API — the contract it exposes; everything else in it is internal) are **`feod`** with **`feod-preset`**, what each file inside a module owns is **`mvvm`** (a project with no UI gets a delivery — HTTP endpoints, a command, a queue consumer — where a screen would be), file names are **`role-files`**. A stack skill spells all of it for its stack (**`frontend-mvvm`** on the web); with none, `feod-preset`'s Stack spelling says how to spell it in the language's own idiom. Prerequisites: `npx skills add Sdju/feod`, and `npx skills add ScobarDen/scobar-skills --skill <name>` for `feod-preset`, `mvvm`, `role-files` and, on the web, `frontend-mvvm`. When any of them is missing from your skill list, stop before laying out files: give the user the install lines for the missing ones and wait for their answer. On the user's no, lay the files flat in one source folder, one file per responsibility, each named for its subject; a further folder waits for the user, as above.

## Two principles that get misapplied

- **DRY is about knowledge, not characters.** Two blocks that look alike but change for different reasons are not duplication. Abstract on the third repeat, when the shape of the abstraction is actually visible.
- **YAGNI beats an extension point you're imagining.** An interface earns its place with a second consumer, and a test that substitutes the dependency is one. An interface nothing substitutes, in production or in tests, is ceremony.

## Scope

- Rename only symbols inside the scope you were given — other callers depend on the rest.
- Neighbouring code that breaks these rules gets one line in your final message, at most.
