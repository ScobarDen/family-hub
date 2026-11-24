---
name: test-craft
description: Assertions, test doubles and case count, decided while writing a test. Load when writing or extending a test, a test goes red after a refactor that changed no behaviour, reviewing tests in a diff, deciding how many tests and at which level, reaching for a mock, spy, snapshot or sleep, or asked whether a test is worth keeping. Not for runner setup or a framework's assertion API — that is the stack's testing skill.
---

# Test craft

**A test asserts a promise, not the machinery.** If a refactor that changed no behaviour turns a test red, the test was pointed at the wrong thing — and the cost is paid again every time anyone touches that code.

**Done when:** every assert, double and case in your change passes the two questions, the boundary rule and one of the four sources of a case, and every new or re-aimed test has been seen red once — written before the fix, or run against the implementation broken on purpose.

The rules hold in any language and test runner; code in the examples is pseudocode.

## When it doesn't

- Runner setup, config, a framework's assertion API → the stack's own testing skill. With neither a runner in the project nor a stack testing skill, take the language's standard runner and name it in your final message.

## The project wins

Read the nearest existing test for the same kind of subject and continue it. Naming, grouping, fixtures, factories, setup style, how doubles are built — a convention you'd have chosen differently, applied consistently, beats a better idea applied in one file.

When neighbouring tests deliberately assert calls on a boundary they replace, keep asserting that way. A mock of the project's own code is never such a convention. Everything below is the default for where the project has no opinion.

A project with no tests yet takes the file layout and naming its runner documents as the default.

## The contract is the promise

The contract is what a caller is allowed to rely on:

- what comes back — return value, rendered output, emitted event, response body;
- observable state after the call;
- effects that cross a real boundary — a request sent, a row written, a message queued;
- errors raised, and their type or code;
- cleanup guarantees — after cancel or teardown, nothing else happens.

The machinery is everything else: private helpers, which internal function did the work, the order internal collaborators were called in, the shape of intermediate state, how many times something recomputed, which listeners and timers got registered.

| Instead of | Assert |
| --- | --- |
| a spy on your own internal helper | the value or state that helper produced |
| a listener was registered | fire the event, then assert what happened |
| an internal `isFetching` flag flipped | the loading state the caller actually observes |
| a timer was scheduled | advance the clock to one tick before the deadline and assert nothing happened, then to the deadline and assert the effect |
| calling a private method directly | drive it through the public entry point |
| the cache's internal map | call twice, assert one request went out |
| that the steps ran in order | the end state those steps were supposed to produce |

The exception that keeps this honest: when an interaction **is** the promise and has no observable substitute — money charged, audit row written, email queued — asserting the call is correct. Assert the fields that carry meaning, not the whole argument list.

## Two questions before every assert

1. **Would this assert survive rewriting the implementation with the behaviour unchanged?** No → it is pinned to machinery. Move it to the observable result.
2. **Could the implementation break in a way a consumer notices while this test stays green?** Yes → the promise is not covered yet.

The first question kills over-specified tests. The second kills tests that assert nothing.

## Mocks live on the boundary

Replace the world you don't own: network, clock, random, filesystem, environment, id generation, third-party SDKs.

Use your own code as it is. A mock of your own collaborator freezes today's call graph into the test: move that logic one layer up or down and the test fails while the behaviour is intact.

- **Prefer a fake to a mock.** One in-memory repository or stub transport shared by many tests beats six call assertions that re-describe the implementation. A fake lives in a test-support file next to the tests, one per boundary, named for what it replaces.
- **Prefer the real thing when it is fast and deterministic.** A pure function, a value object, a small mapper — replacing it buys nothing and costs a lie.
- **A mock returning a mock returning a mock** means the unit reaches through a chain it should not know about. Test through the outer boundary and name the chain in one line of your final message.
- **Freeze time and randomness, then assert exact values.** A matcher that accepts any date is a real uncertainty painted green.

## How many tests, and where

- **One behaviour per test.** If you cannot name it without an "and", it is two tests.
- **Name the promise, not the mechanism.** `keeps the draft when saving fails`, not `calls saveDraft twice`.
- **Independent dimensions separately.** Hold one representative value while varying another; add a combined case only when the interaction produces its own behaviour. Every combination is a Cartesian product nobody will maintain.
- **The lowest level that actually proves it, and only one level.** Business rules as units, wiring as integration, the one flow that must never break end-to-end. The same rule asserted at three levels is three tests to update per change and no extra confidence.
- **Coverage informs the review; it does not define completeness.** A defensive branch no caller can reach does not need a test written to satisfy a percentage.
- **Add a case only when it comes from** public behaviour, a real reachable branch, an explicit requirement, or a bug that actually happened. Not because it is possible.
- **Every fixed bug gets one test, at the level where the bug was observed** — or, when that is unknown, the lowest level that reproduces it. Write it before the fix and watch it go red. Those are the tests that justify the suite.

## Antipatterns

| Smell | Why it hurts | Instead |
| --- | --- | --- |
| Snapshot as the only assertion | Passes through broken behaviour; reviewers accept the diff blindly | Assert the few things that must hold; keep snapshots for genuinely stable large output |
| Test mirrors the implementation — `assert sum(2, 2) == 2 + 2` | Restates the code, so it can never disagree with it | Hardcode the expected value a human worked out |
| UI queried by styling or layout — CSS classes, DOM nesting, widget tree paths | Restyling breaks the test; broken semantics does not | Role, label, accessible name, or an explicit test id treated as API, in the attribute the UI framework's testing library queries by default |
| `sleep` or a fixed timeout | Flaky on a slow machine, slow on a fast one | Wait for the condition, or control the clock |
| Assertions hidden in shared setup | Failures point at the wrong test and cannot be read locally | Assert inside the case that owns the promise |
| Shared mutable state across cases | Order-dependent green; one case poisons the next | Build fresh state per case through a factory |
| Conditionals or loops deciding the expectation | The test now has branches, so it needs tests of its own | Table-driven cases with explicit expected values |
| A test with no failing mode | Costs maintenance, proves nothing | Break the implementation on purpose; if it stays green, fix the test, or ask the user before dropping it |

## Scope

- Change existing tests only where your task broke them or asks for them. A test red after a refactor gets its assert re-aimed at the promise, keeping its name and intent.
- Ask the user before deleting a test: it may be the only record of a regression.
- Tests outside your task's diff that break these rules get one line in your final message, at most.
- A bug in the code under test that your task does not cover gets one line in your final message, with the input that triggers it; fix it only when the user asks.
- A red test is information: fix the code or re-aim the assert at the same strictness. Skipping, disabling or loosening it is the user's call.
