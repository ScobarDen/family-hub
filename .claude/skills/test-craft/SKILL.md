---
name: test-craft
description: Tests that assert the promise instead of the machinery — where a unit's contract ends, why a behaviour-preserving refactor must never turn a test red, mocking only at the boundary of code you don't own, one behaviour per test instead of a Cartesian product, and the antipatterns that make a suite fight every change. Load when writing a test, when a test goes red after a refactor that changed no behaviour, when reviewing tests in a diff, or when deciding how many tests a thing needs and at which level. Not about choosing a runner or a framework's assertion API — that belongs to the stack's own testing skill. Stack-agnostic, and the project's existing test culture outranks everything in it.
---

# Test craft

**A test asserts a promise, not a mechanism.** If a refactor that changed no behaviour turns a test red, the test was pointed at the wrong thing — and the cost is paid again every time anyone touches that code.

Deliberately short. It loads at a decision point — which assert to write, which mock to reach for, how many cases are enough — not for the duration of a task.

## When this fires

- Writing a test, or adding a case to an existing one.
- A test went red after a refactor that changed no behaviour.
- Reviewing tests in a diff: are these asserting anything, or restating the code?
- Deciding how many tests a thing needs, and at which level.
- Reaching for a mock, a spy, a snapshot, or a `sleep`.
- Asked outright — is this test worth keeping, what should it assert.

## When it doesn't

- Runner setup, config, a framework's assertion API → the stack's own testing skill.
- Chasing why production is broken → a debugging skill, not this one.
- QA process artefacts — test plans, manual cases, exploratory charters.
- Anything the project's own testing rules already answer.

## The project wins

Read the nearest existing test for the same kind of subject and continue it. Naming, grouping, fixtures, factories, setup style, how doubles are built — a convention you'd have chosen differently, applied consistently, beats a better idea applied in one file.

If neighbouring tests deliberately assert infrastructure interactions, keep doing that; don't convert a suite to a different philosophy while adding coverage. Everything below is the default for where the project has no opinion.

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
| a timer was scheduled | advance the clock, then assert the effect |
| calling a private method directly | drive it through the public entry point |
| a snapshot of the whole output | the specific text, role, or field the consumer relies on |
| the cache's internal map | call twice, assert one request went out |
| that the steps ran in order | the end state those steps were supposed to produce |

The exception that keeps this honest: when an interaction **is** the promise and has no observable substitute — money charged, audit row written, email queued — asserting the call is correct. Assert the fields that carry meaning, not the whole argument list.

## Two questions before every assert

1. **Would this assert survive rewriting the implementation with the behaviour unchanged?** No → it is pinned to machinery. Move it to the observable result.
2. **Could the implementation break in a way a consumer notices while this test stays green?** Yes → the promise is not covered yet.

The first question kills over-specified tests. The second kills tests that assert nothing. A test that only breaks when someone edits the test itself is dead weight — delete it, or point it at the promise.

## Mocks live on the boundary

Replace the world you don't own: network, clock, random, filesystem, environment, id generation, third-party SDKs.

Do not replace your own modules. A mock of your own collaborator freezes today's call graph into the test: move that logic one layer up or down and the test fails while the behaviour is intact. That is the exact failure this file exists to prevent.

- **Prefer a fake to a mock.** One in-memory repository or stub transport shared by many tests beats six call assertions that re-describe the implementation.
- **Prefer the real thing when it is fast and deterministic.** A pure function, a value object, a small mapper — replacing it buys nothing and costs a lie.
- **A mock returning a mock returning a mock** means the unit reaches through a chain it should not know about. That is a design finding, not a testing problem.
- **Freeze time and randomness, then assert exact values.** A matcher that accepts any date is a real uncertainty painted green.

## How many tests, and where

- **One behaviour per test.** If you cannot name it without an "and", it is two tests.
- **Name the promise, not the mechanism.** `keeps the draft when saving fails`, not `calls saveDraft twice`.
- **Independent dimensions separately.** Hold one representative value while varying another; add a combined case only when the interaction produces its own behaviour. Every combination is a Cartesian product nobody will maintain.
- **The lowest level that actually proves it, and only one level.** Business rules as units, wiring as integration, the one flow that must never break end-to-end. The same rule asserted at three levels is three tests to update per change and no extra confidence.
- **Coverage informs the review; it does not define completeness.** A defensive branch no caller can reach does not need a test written to satisfy a percentage.
- **Add a case only when it comes from** public behaviour, a real reachable branch, an explicit requirement, or a bug that actually happened. Not because it is possible.
- **Every fixed bug gets one test, at the level where the bug was observed.** Those are the tests that justify the suite.

## Antipatterns

| Smell | Why it hurts | Instead |
| --- | --- | --- |
| Snapshot as the only assertion | Passes through broken behaviour; reviewers accept the diff blindly | Assert the few things that must hold; keep snapshots for genuinely stable large output |
| Test mirrors the implementation — `expect(sum(2, 2)).toBe(2 + 2)` | Restates the code, so it can never disagree with it | Hardcode the expected value a human worked out |
| Testing a private method directly | Locks in an internal that has no consumers | Reach it through the public entry point, or admit it wants to be its own unit |
| Asserting call order between internal parts | Order is machinery; reordering is a legal refactor | Assert the end state |
| Selectors on CSS classes or DOM nesting | Restyling breaks the test; broken semantics does not | Role, label, accessible name, or an explicit test id treated as API |
| `sleep` or a fixed timeout | Flaky on a slow machine, slow on a fast one | Wait for the condition, or control the clock |
| Assertions hidden in shared setup | Failures point at the wrong test and cannot be read locally | Assert inside the case that owns the promise |
| Shared mutable state across cases | Order-dependent green; one case poisons the next | Build fresh state per case through a factory |
| Conditionals or loops deciding the expectation | The test now has branches, so it needs tests of its own | Table-driven cases with explicit expected values |
| One case asserting a dozen unrelated things | The first failure hides the rest, and the name cannot describe it | Split by behaviour |
| A test with no failing mode | Costs maintenance, proves nothing | Break the implementation on purpose; if it stays green, fix the test or drop it |

## What NOT to do

- ❌ Don't rewrite existing tests to match this file. You were asked to cover a behaviour; cover it.
- ❌ Don't delete a test you think is wrong without asking. It may be the only record of a regression.
- ❌ Don't chase a coverage number, and don't add cases whose only justification is completeness.
- ❌ Don't introduce a new testing style, helper layer, or factory convention into a suite that already has one.
- ❌ Don't file findings about neighbouring tests. A note in one line, at most.
- ❌ Don't disable, skip, or loosen an assertion to get to green. A red test is information.
