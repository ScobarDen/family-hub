# Web modules join the app through per-consumer tables

An architecture review proposed two deepenings for how a web module joins the app: one app-facing contract per module, `{ module, screen, back, open? }`, registered as a list that the navigation, the opener and the prefetch read; and one shared module for "list → record → form over it" navigation, exposing `canGoBack`, `isFormOpen`, `back`, `open` and `screenKey`. We take neither. Each consumer keeps its own table keyed by the module, and the compiler and the `form` module guard what the review was worried about.

## Decisions

- **No module registry.** The navigation reads a module's nested Back, the prefetch its screen, the opener its "open by id" and "add" commands: three consumers, each using a different part. One contract they all read would make each depend on what it does not use. What they share is only the set of keys, and the compiler holds it: `nestedBack` is `Record<SlotModule | "profile", NestedBack>`, like the prefetch's screens, so a slot module missing from either fails to compile.
- **The opener stays in `app/`.** Its targets cross modules — a Care Entry for a Pet picked first, a Task for a Pet, a contribution to a Goal that must load — so it is the app's mediator, not a sum of per-module parts.
- **No shared screen navigation.** The modules' layers differ: a Recipe's tags screen that is not a form, «Все фото» in Albums, a Task opened as an Occurrence rather than an id, a Pet's card at the app's own address, Care stacked over the Pet's card. A shared module would take a configuration of layers as large as the code it replaces.
- **A nested Back is built only by `modules/form`.** `NestedBack` is a nominal type: `reatomNestedBack` wraps a module's step back in the question about unsaved input, and `firstNestedBack` stacks two (the Pet tab). A module can no longer hand the navigation a Back that skips the question. Its `closesInPlace` tells the navigation to close a drawer without a slide.

## Considered Options

- **A thin registry of the nested Back and the prefetch screen only** — moves two typed tables into one list and adds a lookup; the compiler already catches a forgotten module.
- **A registry where each module owns its open targets** — the targets that matter cross modules and would come back to the app anyway.
- **A shared `open(id)` with the forward slide** — about five lines per module, not worth a dependency every screen ViewModel shares.
