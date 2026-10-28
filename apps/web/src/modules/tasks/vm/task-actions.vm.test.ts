import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { Task } from "@family-hub/contract";

import {
  cleaning,
  doneAt,
  fakeBackend,
  fakeTelegram,
  groups,
  loaded,
  rowOf,
  startTasks,
  vacation,
  vaccination,
} from "./tasks.fixtures.ts";

const failure = "Не получилось сохранить. Попробуйте ещё раз.";

beforeEach(() => {
  context.reset();
});

type Model = ReturnType<typeof startTasks>["model"];

function sentOf(backend: ReturnType<typeof fakeBackend>) {
  return backend.sent.map(({ request }) => request);
}

function stepsOf(model: Model) {
  const screen = model.screen();

  return screen.kind === "task" ? screen.task.stepsTitle : screen.kind;
}

const steps: Task["subtasks"] = [
  { id: "sub-1", title: "Билеты", date: null, assignees: [], completed: null },
  { id: "sub-2", title: "Отель", date: null, assignees: [], completed: null },
];

type Write = {
  name: string;
  tasks?: Task[];
  confirmed?: boolean;
  pattern: string;
  act: (model: Model) => void;
  observe: (model: Model) => unknown;
  before: unknown;
  after: unknown;
  felt: string[];
};

const writes: Write[] = [
  {
    name: "completing an Occurrence",
    pattern: "POST /api/tasks/:id/complete",
    act: (model) => {
      model.toggle(rowOf(model, "Отпуск"));
    },
    observe: (model) => rowOf(model, "Отпуск").status,
    before: "open",
    after: "completed",
    felt: ["success"],
  },
  {
    name: "un-completing an Occurrence",
    pattern: "POST /api/tasks/:id/reopen",
    act: (model) => {
      model.toggle(rowOf(model, "Паспорт"));
    },
    observe: (model) => rowOf(model, "Паспорт").status,
    before: "completed",
    after: "open",
    felt: ["select"],
  },
  {
    name: "skipping an Occurrence",
    tasks: [cleaning],
    confirmed: true,
    pattern: "POST /api/tasks/:id/skip",
    act: (model) => {
      model.openRow(rowOf(model, "Уборка", "2026-10-09"));
      model.skipOccurrence();
    },
    observe: (model) =>
      model.screen().kind === "list" ? groups(model).overdue.map((row) => row.key) : "details",
    before: ["task-cleaning-2026-10-02", "task-cleaning-2026-10-09"],
    after: ["task-cleaning-2026-10-02"],
    felt: ["warning", "select"],
  },
  {
    name: "deleting a Task",
    confirmed: true,
    pattern: "DELETE /api/tasks/:id",
    act: (model) => {
      model.open("task-vacation");
      model.removeTask();
    },
    observe: (model) =>
      model.screen().kind === "list"
        ? Object.values(groups(model))
            .flat()
            .some((row) => row.title === "Отпуск")
        : "details",
    before: true,
    after: false,
    felt: ["warning"],
  },
  {
    name: "completing a Subtask",
    tasks: [{ ...vacation, subtasks: steps }],
    pattern: "POST /api/tasks/:id/subtasks/:sub/complete",
    act: (model) => {
      model.open("task-vacation");
      model.toggleSubtask("sub-1");
    },
    observe: stepsOf,
    before: "Шаги · 0 из 2",
    after: "Шаги · 1 из 2",
    felt: ["success"],
  },
  {
    name: "un-completing a Subtask",
    tasks: [
      {
        ...vacation,
        subtasks: steps.map((step, index) =>
          index === 0 ? { ...step, completed: { at: doneAt, by: "Ася" } } : step,
        ),
      },
    ],
    pattern: "POST /api/tasks/:id/subtasks/:sub/reopen",
    act: (model) => {
      model.open("task-vacation");
      model.toggleSubtask("sub-1");
    },
    observe: stepsOf,
    before: "Шаги · 1 из 2",
    after: "Шаги · 0 из 2",
    felt: ["select"],
  },
  {
    name: "deleting a Subtask",
    tasks: [{ ...vacation, subtasks: steps }],
    confirmed: true,
    pattern: "DELETE /api/tasks/:id/subtasks/:sub",
    act: (model) => {
      model.open("task-vacation");
      model.removeSubtask("sub-1");
    },
    observe: stepsOf,
    before: "Шаги · 0 из 2",
    after: "Шаги · 0 из 1",
    felt: ["warning"],
  },
];

function startWrite(write: Write, options: Parameters<typeof fakeBackend>[1]) {
  return startTasks(fakeBackend(write.tasks, options), {
    telegram: fakeTelegram(write.confirmed === true ? ["confirm"] : []),
  });
}

describe.each(writes)("$name", (write) => {
  test("shows the change before the server answers, with one pulse", async () => {
    let answer = noop;
    const written = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const { model, backend, felt } = startWrite(write, { written });

    await loaded(model);
    write.act(model);
    await vi.waitFor(() => {
      expect(write.observe(model)).toEqual(write.after);
    });

    expect(sentOf(backend)).toContainEqual(expect.stringMatching(/^(POST|DELETE) /u));
    expect(model.failure()).toBeUndefined();
    expect(felt).toEqual(write.felt);
    answer();
  });

  test.each([
    { cause: "the server refuses it", option: "failing", said: failure },
    {
      cause: "there is no network",
      option: "unreachable",
      said: "Нет связи — не сохранилось. Проверьте интернет и повторите.",
    },
  ])("rolls back with the failure bar and an error pulse when $cause", async ({ option, said }) => {
    const { model, felt } = startWrite(write, { [option]: write.pattern });

    await loaded(model);
    write.act(model);
    await vi.waitFor(() => {
      expect(model.failure()).toBe(said);
    });

    expect(write.observe(model)).toEqual(write.before);
    expect(felt).toEqual([...write.felt, "error"]);
  });
});

describe("completing a Task", () => {
  test("completes with one tap and takes it back from the undo bar", async () => {
    const { model, backend, felt } = startTasks();

    await loaded(model);
    model.toggle(rowOf(model, "Отпуск"));
    await vi.waitFor(() => {
      expect(model.undo()).toMatchObject({
        taskId: "task-vacation",
        title: "Отпуск",
        petId: undefined,
      });
    });

    expect(groups(model).completed.map(({ title }) => title)).toContain("Отпуск");

    model.undoCompletion();

    expect(groups(model).undated).toMatchObject([{ title: "Отпуск" }]);
    expect(model.undo()).toBeUndefined();
    expect(felt).toEqual(["success", "select"]);
    await vi.waitFor(() => {
      expect(sentOf(backend)).toContain("POST /api/tasks/task-vacation/reopen");
    });
  });

  test("offers to record a Pet's Task in its journal from the undo bar", async () => {
    const { model, recorded } = startTasks();

    await loaded(model);
    model.toggle(rowOf(model, "Прививка Бьюику"));
    await vi.waitFor(() => {
      expect(model.undo()).toMatchObject({ petId: "pet-1" });
    });

    model.recordCareEntry();

    expect(recorded).toEqual([{ petId: "pet-1", title: "Прививка Бьюику" }]);
    expect(model.undo()).toBeUndefined();
  });

  test("completes one Occurrence of a recurring Task on its own", async () => {
    const { model, backend } = startTasks(fakeBackend([cleaning]));

    await loaded(model);

    expect(groups(model)).toMatchObject({
      overdue: [{ occurrence: "2026-10-02" }, { occurrence: "2026-10-09" }],
      today: [{ occurrence: "2026-10-16" }],
      upcoming: [{ kind: "birthday" }, { occurrence: "2026-10-23" }],
    });

    model.toggle(rowOf(model, "Уборка", "2026-10-16"));

    expect(groups(model)).toMatchObject({
      overdue: [{ occurrence: "2026-10-02" }, { occurrence: "2026-10-09" }],
      today: [],
      completed: [{ occurrence: "2026-10-16" }],
    });
    await vi.waitFor(() => {
      expect(backend.sent).toContainEqual({
        request: "POST /api/tasks/task-cleaning/complete",
        body: { occurrence: "2026-10-16" },
      });
    });
  });

  test("rolls back only its own change when another tap came meanwhile", async () => {
    const { model } = startTasks(
      fakeBackend(undefined, { unreachable: "POST /api/tasks/:id/reopen" }),
    );

    await loaded(model);
    model.toggle(rowOf(model, "Паспорт"));
    model.toggle(rowOf(model, "Отпуск"));
    await vi.waitFor(() => {
      expect(rowOf(model, "Паспорт").status).toBe("completed");
    });

    expect(rowOf(model, "Отпуск").status).toBe("completed");
  });

  test("hides the failure bar when dismissed", async () => {
    const { model } = startTasks(
      fakeBackend(undefined, { failing: "POST /api/tasks/:id/complete" }),
    );

    await loaded(model);
    model.toggle(rowOf(model, "Отпуск"));
    await vi.waitFor(() => {
      expect(model.failure()).toBe(failure);
    });

    model.dismissFailure();

    expect(model.failure()).toBeUndefined();
  });

  test("keeps a completion made while the list was refetching", async () => {
    const backend = fakeBackend();
    let release = noop;
    let isHolding = false;
    const held = {
      ...backend,
      fetch: async (url: URL, init: RequestInit) => {
        const answer = backend.fetch(url, init);

        if (isHolding && url.pathname === "/api/tasks" && init.method === undefined) {
          isHolding = false;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }

        return answer;
      },
    };
    const { model } = startTasks(held);

    await loaded(model);
    isHolding = true;
    model.reload();
    model.toggle(rowOf(model, "Отпуск"));
    await vi.waitFor(() => {
      expect(model.undo()).toMatchObject({ title: "Отпуск" });
    });
    release();

    await vi.waitFor(() => {
      expect(groups(model).undated).toEqual([]);
    });
    expect(groups(model).completed.map(({ title }) => title)).toContain("Отпуск");
  });
});

describe("the bot's «Записать»", () => {
  test("completes the Occurrence quietly and opens the Pet's journal", async () => {
    const { model, backend, recorded } = startTasks();

    model.recordOccurrence({ taskId: "task-vaccination", occurrence: "2026-10-12" });
    await vi.waitFor(() => {
      expect(recorded).toEqual([{ petId: "pet-1", title: "Прививка Бьюику" }]);
    });

    expect(sentOf(backend)).toContain("POST /api/tasks/task-vaccination/complete");
    expect(model.undo()).toBeUndefined();
  });

  test("opens the journal without completing an Occurrence already Completed", async () => {
    const done: Task = {
      ...vaccination,
      completions: [{ occurrence: "2026-10-12", at: doneAt, by: "Ася" }],
    };
    const { model, backend, recorded } = startTasks(fakeBackend([done]));

    model.recordOccurrence({ taskId: "task-vaccination", occurrence: "2026-10-12" });
    await vi.waitFor(() => {
      expect(recorded).toEqual([{ petId: "pet-1", title: "Прививка Бьюику" }]);
    });

    expect(sentOf(backend)).toEqual(["GET /api/tasks"]);
  });

  test("does nothing for a Task without a Pet", async () => {
    const { model, backend, recorded } = startTasks();

    model.recordOccurrence({ taskId: "task-repair", occurrence: "2026-10-20" });
    await loaded(model);

    expect(sentOf(backend)).toEqual(["GET /api/tasks"]);
    expect(recorded).toEqual([]);
  });

  test("says so when it cannot complete the Occurrence", async () => {
    const { model, recorded } = startTasks(
      fakeBackend(undefined, { failing: "POST /api/tasks/:id/complete" }),
    );

    model.recordOccurrence({ taskId: "task-vaccination", occurrence: "2026-10-12" });
    await vi.waitFor(() => {
      expect(model.failure()).toBe(failure);
    });

    expect(recorded).toEqual([]);
  });

  test("stops waiting when the list cannot load", async () => {
    const { model, recorded } = startTasks(fakeBackend(undefined, { failing: "GET /api/tasks" }));

    model.recordOccurrence({ taskId: "task-vaccination", occurrence: "2026-10-12" });
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("failed");
    });

    expect(recorded).toEqual([]);
  });
});

describe("Subtasks", () => {
  test("adds a Subtask to an open Task and counts the steps", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.open("task-vacation");
    model.addSubtask();
    model.subtaskForm.form.fields.title.set("Купить билеты");
    model.subtaskForm.save();

    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({
        kind: "task",
        task: { stepsTitle: "Шаги · 0 из 1", subtasks: [{ title: "Купить билеты" }] },
      });
    });
  });

  test("completes the Task once its last Subtask is completed, with one pulse per tap", async () => {
    const { model, felt } = startTasks(fakeBackend([{ ...vacation, subtasks: steps }]));

    await loaded(model);
    model.open("task-vacation");
    model.toggleSubtask("sub-1");

    expect(model.screen()).toMatchObject({
      task: { stepsTitle: "Шаги · 1 из 2", completed: undefined },
    });

    model.toggleSubtask("sub-2");
    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({
        task: { stepsTitle: "Шаги · 2 из 2", completed: expect.stringContaining("Выполнено") },
      });
    });
    expect(felt).toEqual(["success", "success"]);
  });

  test("offers no Subtasks on a recurring Task", async () => {
    const { model } = startTasks(fakeBackend([cleaning]));

    await loaded(model);
    model.open("task-cleaning");

    expect(model.screen()).toMatchObject({ kind: "task", task: { canAddSubtask: false } });
  });
});
