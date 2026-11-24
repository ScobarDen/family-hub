---
name: mvvm
description: MVVM roles — which of Model, ViewModel and View owns a piece of state, a mapping, a handler or an error, and how parts are wired. Load when writing or reviewing a screen with logic, a god component or god ViewModel, a backend shape reaching the UI, modules importing each other, a screen that cannot be tested without a backend or a window, or a backend endpoint or command that parses, decides and stores in one place.
---

# MVVM

Write a screen as three roles. The ViewModel is a **role**, not a library or a base class.

**Project conventions win.** If the repo maps in its API clients or has no ViewModel at all, follow the repo and mention the divergence in one line. Every other rule below holds for the code you add or move. Name any rule you could not satisfy and why.

## When this applies

A screen that fetches, maps and handles user intent: a table with filters, a dashboard, a form that orchestrates more than one source. A static presentational piece (an icon, layout chrome, a UI-kit button) has no ViewModel. A backend, a CLI or a worker has the same three roles; §10 says how each rule reads there.

## 1. Roles

| Role | Owns | Does not own |
| --- | --- | --- |
| **Model** | domain types, domain rules, domain state, transport and the backend → domain adapter, storage | UI shapes, handlers, markup |
| **ViewModel** | screen state, commands, the screen's error state, wiring its collaborators, data shaped for this UI | backend shapes, markup, knowing how the screen looks |
| **View** | binding ViewModel output to the UI kit, forwarding user actions to commands | fetching, mapping, domain conditions, use-case flow |

Start the analysis from **state**, then bind the View. Starting from the widget tree and sprinkling fetches into whoever needs a field is how a **god component** is born: a component that fetches, maps and decides on its own instead of binding ViewModel output.

## 2. Where state lives: by lifetime

Delete the screen. State still needed afterwards (the cart, the signed-in user, an order draft that survives steps) is domain state in the Model. State that dies with the screen (an open tab, an input draft, a selected row) lives in the ViewModel. State one screen uses and that names no domain concept stays in its ViewModel until a second consumer appears. Screen state several sub-ViewModels (§5) read belongs to the one that loads it; the others receive a getter as an argument.

A set of values is a closed list or open data. Can the user add a value at runtime? Yes → data behind a repository. No → an enum in the Model.

## 3. Facade: the View never sees a backend shape

The ViewModel, or the Model it calls, turns backend shapes into what the UI kit consumes: `{ label, value }[]` for a select, column definitions for a table, rows and roles for a list widget. The View binds those. It does not map.

- **One mapping site.** A DTO that enters a parent, travels down as props and gets mapped in a child and again in a grandchild makes "which fields of this endpoint do we use?" a tree walk.
- A backend shape may cross into a child only as an opaque id, so the child's own ViewModel can load its own Model. Never to render it.
- Backend → domain mapping sits in the Model, next to transport, and the ViewModel composes domain data into UI shapes. Never in the View.
- A backend value the adapter does not recognise fails the whole load as an error. A row dropped in silence reads as data that does not exist.
- A **list adapter** (Qt's `QAbstractListModel`, a table's column config) is ViewModel output, whatever the framework calls it. It receives rows; it never fetches.

## 4. Mediator and composition root

A **module** is a folder holding one product responsibility, used from outside only through its public API.

**Parts that must not know each other are wired by whoever sits above them, through arguments.** The same idea on three scales:

| Scale | Mediator | Wires |
| --- | --- | --- |
| inside a module | the ViewModel | its sub-ViewModels (§5) and its Model parts (transport, repositories, storage): passes functions and values, so a repository never imports a storage and two parts sharing an id never import each other |
| between modules, one screen | the page | module A's output into module B's input |
| between modules, app-wide | the app root (the `app` level under FEOD) | "something happened in A, B reacts", plus errors from every module that no screen shows, collected into one status; the status appears with the first such error |

```ts
class TableViewModel {
  constructor(
    private getTasks: (params: TaskQuery) => Promise<Task[]>,
    private params: () => TaskQuery,
  ) {}
}

this.table = new TableViewModel(taskRepository.getTasks, () => ({
  ...this.filters.query,
  ...this.pagination.params,
}))
```

- A module never constructs another module and never imports another module's internals. From another module's public API it imports domain types and pure domain functions; anything with state or a lifecycle (a repository, a data source, another module's ViewModel) it receives as an argument. This is FEOD's IoC made the default for every stateful collaborator, where `feod` reserves it for strong coupling.
- A module announces "something happened" through a callback it receives as an argument (`onTaskCompleted`); a sub-ViewModel that reacts to another's change receives a subscribe function the same way. The event carries domain data, never UI text; the mediator turns it into the receiving module's input.
- Two sub-ViewModels that read each other get a third signal from the mediator instead (`tasksLoaded`); construct the readers before the owner.
- A mediator owns no data: references to the parts it wires, a status, nothing else. It is not a god object.
- An app-level mediator collecting errors is updated with every new module, or that module's errors silently never reach the UI. It reports success only after errors are collected; the other order overwrites an error with "done".

The **composition root** is the one place that constructs the object graph: per module and once for the app. A module's is its **root**: the one export consumers mount, named after the domain (`Checkout`). It takes the module's dependencies as arguments, constructs the ViewModel from them, starts the first load and hands the ViewModel to the passive Views. Inject what varies: repositories, transport, storage and **the clock** ("last 30 days" is untestable against a real clock). Order is correctness: the first data load happens after the mediator subscribed to errors, or the first failure is emitted into nothing. The composition root calls the first load; a passive View never does.

## 5. Compose by UI domain

Split a big ViewModel along the **UI domains of the screen** (filters, stats, table, pagination), each bound to a passive widget. Not by line count.

A nested part that is its own business value is its own module with **its own ViewModel**. The parent passes in what it needs (ids, callbacks, a pre-built widget) and does not absorb the child's use case.

## 6. Commands and action configs

Click, submit and search handlers are ViewModel commands. When a row of buttons is data (label, style, icon, handler, loading), the ViewModel exposes an array of configs and the View is one generic component that renders it. Assembling that array in markup is the logic leak this role exists to kill.

## 7. View rules

- **Bindings down, actions up.** The View reads ViewModel state and calls commands. Feed a value back on the user-action event (`edited`, `activated`), not on the value-changed event, or the binding feeds itself into a loop.
- **No domain conditions in the View.** A View comparing a payment-method key or checking an amount holds logic that escaped from the Model or the ViewModel.
- **The View receives its ViewModel** from the module root (§4). It does not reach for a global app object.
- **Granular updates** come from binding a widget to its own slice of state, never from moving a fetch into the widget.

## 8. Errors

- A failed load **keeps the previous data** and sets an error state. An empty result and a failed query often look alike; wiping the list on error reads as data loss.
- A command that can fail returns its outcome, leaves the data as it was on failure and sets the screen's error state. A dialog or form closes **only after** the command succeeded, so rejected input is not lost.
- A response to a load that a newer load has superseded is dropped.
- Each error is shown in one place. A mounted screen shows its own load and command errors; the module reports to the app status only errors with no screen to land on.

## 9. Tests prove the roles exist

MVVM that cannot be tested without a backend and without a window exists only on paper.

- Model rules test with no UI and no network.
- A ViewModel tests against a fake transport or repository and a fixed clock, through the arguments it already takes. Needing to mock an import to test it means a dependency was imported instead of injected.
- A test touching two modules tests the wiring, so it sits beside the mediator that wires them (§4) and repeats its name: the page's View, the mediator on `app`, or the parent module's ViewModel.
- End-to-end tests drive the built app, not one file, and live outside the source tree: in the folder the toolchain reserves for them (Flutter's `integration_test/`), otherwise in `e2e/`.

## 10. Without a screen

A backend, a CLI or a worker keeps the three roles. Read *screen* as one **delivery**: a group of HTTP endpoints, a command, a queue consumer.

| Role | Without a screen |
| --- | --- |
| **View** | the delivery binding: parses the input into a command's arguments, calls the command, renders its outcome in the transport's terms (a status code, an exit code). It decides nothing. |
| **ViewModel** | the use case: commands, and the outcome shaped for this delivery. It holds no state between calls. |
| **Model** | unchanged. |

- §2: state that outlives one call is domain state behind a repository; the ViewModel keeps none.
- §4: the module root is a factory that takes the dependencies and returns the binding, ready to mount (`checkout_endpoints(...)`). A module with several deliveries, endpoints and an event handler, exports one root per delivery over one Model. The page is the route declaration that mounts it under a path. Errors no response carries, a failed reaction to an event among them, go from the app mediator to the log.
- §8: a command returns its outcome and the binding maps a failure to the transport's error. The rules about previous data and superseded loads hold only for state kept between calls: a cache, a stream.

## Review smells

- Fetch, query or backend field access inside a View.
- The same backend type in a widget's props or properties.
- Select options or column configs assembled in markup from a raw enum or DTO.
- A Model part importing both storage and transport.
- Sub-ViewModels of one module importing each other instead of taking arguments.
- A parent View re-implementing a child module instead of mounting the child's ViewModel.
- "We put the query in the row so the table does not re-render."
- A list cleared on error; a success message that overwrote an error.
- The system clock read inside a ViewModel instead of an injected one.

## Related skills

| Need | Load |
| --- | --- |
| Which level and who may import it | `feod` (`npx skills add Sdju/feod`), `feod-preset` |
| File names and folders per role | `role-files` |
| React / Vue / Reatom wiring | `frontend-mvvm` |
| What a test should assert | `test-craft` |

Each but `feod` installs with `npx skills add ScobarDen/scobar-skills --skill <name>`.
