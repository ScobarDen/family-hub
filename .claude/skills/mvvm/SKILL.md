---
name: mvvm
description: MVVM as separation of responsibility — Model owns the domain, ViewModel owns screen state and user intent and hands the View only UI-shaped data (facade), View binds and decides nothing, and whoever sits above wires parts through arguments (mediator, composition root). Load when writing or reviewing a screen with logic, deciding which role owns a mapping, a handler, a piece of state or an error, a god component or god ViewModel, backend shapes leaking into the UI, modules importing each other, or making a screen testable without a backend or a window. Stack-neutral; levels are feod, file names are role-files, stack wiring is frontend-mvvm or qt-mvvm.
---

# MVVM

Write a feature as three roles. The ViewModel is a **role**, not a library or a base class.

## Provenance and precedence

- Roles, facade and mediator: [MVVM for React](https://www.youtube.com/watch?v=H0pKvQ8P3UI) (separation of concerns, not reactivity history).
- Error handling, injected clock, composition order and test seams: a Qt Quick teaching project (2026-09-03) built, tested and reviewed end to end. They hold on any stack.
- **Project conventions win.** If the repo maps in its API clients or has no ViewModel at all, follow the repo and mention the divergence in one line.
- Stack wiring is `frontend-mvvm` (hooks, Vue, Reatom; MobX through `mobx-mvvm`) and `qt-mvvm` (QObject, QML). Choosing a state library is `frontend-state-stack`.

## When this applies

A feature that fetches, maps and handles user intent: a table with filters, a dashboard, a form that orchestrates more than one source. A static presentational piece (an icon, layout chrome, a UI-kit button) has no ViewModel.

## 1. Roles

| Role | Owns | Does not own |
| --- | --- | --- |
| **Model** | domain types, domain rules, domain state, transport and the backend → domain adapter, storage | UI shapes, handlers, markup |
| **ViewModel** | screen state, commands, the screen's error state, wiring its collaborators, data shaped for this UI | backend shapes, markup, knowing how the screen looks |
| **View** | binding ViewModel output to the UI kit, forwarding user actions to commands | fetching, mapping, domain conditions, use-case flow |

Start the analysis from **state**, then bind the View. Starting from the widget tree and sprinkling fetches into whoever needs a field is how a god component is born.

## 2. Where state lives: by lifetime

Delete the screen. State still needed afterwards (the cart, the signed-in user, an order draft that survives steps) is domain state in the Model. State that dies with the screen (an open tab, an input draft, a selected row) lives in the ViewModel. State one screen uses and that names no domain concept stays in its ViewModel until a second consumer appears.

A set of values is a closed list or open data. Can the user add a value at runtime? Yes → data behind a repository. No → an enum in the Model.

## 3. Facade: the View never sees a backend shape

The ViewModel, or the Model it calls, turns backend shapes into what the UI kit consumes: `{ label, value }[]` for a select, column definitions for a table, rows and roles for a list widget. The View binds those. It does not map.

- **One mapping site.** A DTO that enters a parent, travels down as props and gets mapped in a child and again in a grandchild makes "which fields of this endpoint do we use?" a tree walk.
- A backend shape may cross into a child only as an opaque id, so the child's own ViewModel can load its own Model. Never to render it.
- Where mapping sits is a size call: a tiny app maps in the ViewModel; a real domain maps in the Model, next to transport, and the ViewModel composes. Never in the View.
- A **list adapter** (Qt's `QAbstractListModel`, a table's column config) is ViewModel output, whatever the framework calls it. It receives rows; it never fetches.

## 4. Mediator and composition root

**Parts that must not know each other are wired by whoever sits above them, through arguments.** The same idea on three scales:

| Scale | Mediator | Wires |
| --- | --- | --- |
| inside a module | the ViewModel | its stores, services and storage: passes functions and values, so a service never imports a storage and two services sharing an id never import each other |
| between modules, one screen | the page | module A's output into module B's input |
| between modules, app-wide | `app` | "something happened in A, B reacts", plus errors collected from every module into one status |

```ts
class TableStore {
  constructor(
    private getTasks: (params: TaskQuery) => Promise<Task[]>,
    private params: () => TaskQuery,
  ) {}
}

this.tableStore = new TableStore(taskService.getTasks, () => ({
  ...this.filterStore.query,
  ...this.paginationStore.params,
}))
```

- A module never constructs another module and never imports another module's internals. It receives what it needs.
- A mediator owns no data: references to the parts it wires, a status, nothing else. It is not a god object.
- An app-level mediator collecting errors is updated with every new module, or that module's errors silently never reach the UI. It reports success only after errors are collected; the other order overwrites an error with "done".

The **composition root** is the one place that constructs the object graph: per module (the module assembling itself) and once for the app. Inject what varies: services, transport, storage and **the clock** ("last 30 days" is untestable against a real clock). Order is correctness: the first data load happens after the mediator subscribed to errors, or the first failure is emitted into nothing.

## 5. Compose by UI domain

Split a big ViewModel along the **UI domains of the feature** (filters, stats, table, pagination), each bound to a passive widget. Not by line count.

A nested feature that is its own business value gets **its own ViewModel**. The parent passes in what it needs (ids, callbacks, a pre-built widget) and does not absorb the child's use case.

## 6. Commands and action configs

Click, submit and search handlers are ViewModel commands. When a row of buttons is data (label, style, icon, handler, loading), the ViewModel exposes an array of configs and the View is one generic component that renders it. Assembling that array in markup is the logic leak this role exists to kill.

## 7. View rules

- **Bindings down, actions up.** The View reads ViewModel state and calls commands. Feed a value back on the user-action event (`edited`, `activated`), not on the value-changed event, or the binding feeds itself into a loop.
- **No domain conditions in the View.** A View comparing a payment-method key or checking an amount holds logic that escaped from the Model or the ViewModel.
- **The View receives its ViewModel** from whoever mounts it. It does not reach for a global app object.
- **Granular updates** come from binding a widget to its own slice of state, never from moving a fetch into the widget.

## 8. Errors

- A failed load **keeps the previous data** and sets an error state. An empty result and a failed query often look alike; wiping the list on error reads as data loss.
- A command that can fail returns its outcome. A dialog or form closes **only after** the command succeeded, so rejected input is not lost.

## 9. Tests prove the roles exist

MVVM that cannot be tested without a backend and without a window exists only on paper.

- Model rules test with no UI and no network.
- A ViewModel tests against a fake transport or repository and a fixed clock, through the arguments it already takes. Needing to mock an import to test it means a dependency was imported instead of injected.
- A test touching two modules is an integration test and lives at project level.

## Review smells

- Fetch, query or backend field access inside a View.
- The same backend type in a widget's props or properties.
- Select options or column configs assembled in markup from a raw enum or DTO.
- A service importing both storage and transport.
- Stores or ViewModels of one feature importing each other instead of taking arguments.
- A parent View re-implementing a child feature instead of mounting the child's ViewModel.
- "We put the query in the row so the table does not re-render."
- A list cleared on error; a success message that overwrote an error.
- `now()` or `new Date()` called inside a ViewModel.

## Related skills

| Need | Load |
| --- | --- |
| Which level and who may import it | `feod` |
| File names and folders per role | `role-files` |
| React / Vue / Reatom wiring | `frontend-mvvm` |
| MobX wiring | `mobx-mvvm` |
| Qt Quick wiring | `qt-mvvm` |
| Which state library | `frontend-state-stack` |
| What a test should assert | `test-craft` |
