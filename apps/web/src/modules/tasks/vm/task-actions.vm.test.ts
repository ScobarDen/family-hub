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
  settled,
  startTasks,
  vacation,
  vaccination,
} from "./tasks.fixtures.ts";

const failure = "Не получилось сохранить. Попробуйте ещё раз.";

beforeEach(() => {
  context.reset();
});

describe("completing a Task", () => {
  test("completes with one tap and takes it back from the undo bar", async () => {
    const { model, backend } = startTasks();

    await loaded(model);
    model.toggle(rowOf(model, "Отпуск"));
    await settled(model);

    expect(groups(model).completed.map(({ title }) => title)).toContain("Отпуск");
    expect(model.undo()).toMatchObject({
      taskId: "task-vacation",
      title: "Отпуск",
      petId: undefined,
    });

    model.undoCompletion();
    await settled(model);

    expect(backend.sent.map(({ request }) => request)).toContain(
      "POST /api/tasks/task-vacation/reopen",
    );
    expect(groups(model).undated).toMatchObject([{ title: "Отпуск" }]);
    expect(model.undo()).toBeUndefined();
  });

  test("offers to record a Pet's Task in its journal from the undo bar", async () => {
    const { model, recorded } = startTasks();

    await loaded(model);
    model.toggle(rowOf(model, "Прививка Бьюику"));
    await settled(model);

    expect(model.undo()).toMatchObject({ petId: "pet-1" });

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
    await settled(model);

    expect(backend.sent).toContainEqual({
      request: "POST /api/tasks/task-cleaning/complete",
      body: { occurrence: "2026-10-16" },
    });
    expect(groups(model)).toMatchObject({
      overdue: [{ occurrence: "2026-10-02" }, { occurrence: "2026-10-09" }],
      today: [],
      completed: [{ occurrence: "2026-10-16" }],
    });
  });

  test("keeps the row open and offers no undo when the completion fails", async () => {
    const { model } = startTasks(
      fakeBackend(undefined, { failing: "POST /api/tasks/:id/complete" }),
    );

    await loaded(model);
    model.toggle(rowOf(model, "Отпуск"));
    await settled(model);

    expect(model.failure()).toBe(failure);
    expect(rowOf(model, "Отпуск").status).toBe("open");
    expect(model.undo()).toBeUndefined();
  });

  test("keeps a Completed row Completed when reopening it fails", async () => {
    const { model } = startTasks(fakeBackend(undefined, { failing: "POST /api/tasks/:id/reopen" }));

    await loaded(model);
    model.toggle(rowOf(model, "Паспорт"));
    await settled(model);

    expect(model.failure()).toBe(failure);
    expect(rowOf(model, "Паспорт").status).toBe("completed");
    expect(model.undo()).toBeUndefined();
  });

  test("skips one Occurrence of a recurring Task after asking", async () => {
    const { model, backend } = startTasks(fakeBackend([cleaning]), {
      telegram: fakeTelegram(["confirm"]),
    });

    await loaded(model);
    model.openRow(rowOf(model, "Уборка", "2026-10-09"));

    expect(model.screen()).toMatchObject({ kind: "task", task: { isRecurring: true } });

    model.skipOccurrence();
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("list");
    });

    expect(backend.sent).toContainEqual({
      request: "POST /api/tasks/task-cleaning/skip",
      body: { date: "2026-10-09" },
    });
    expect(groups(model).overdue).toMatchObject([{ occurrence: "2026-10-02" }]);
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
    await settled(model);
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

    expect(backend.sent.map(({ request }) => request)).toContain(
      "POST /api/tasks/task-vaccination/complete",
    );
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

    expect(backend.sent.map(({ request }) => request)).toEqual(["GET /api/tasks"]);
  });

  test("does nothing for a Task without a Pet", async () => {
    const { model, backend, recorded } = startTasks();

    model.recordOccurrence({ taskId: "task-repair", occurrence: "2026-10-20" });
    await settled(model);

    expect(backend.sent.map(({ request }) => request)).toEqual(["GET /api/tasks"]);
    expect(recorded).toEqual([]);
  });

  test("says so when it cannot complete the Occurrence", async () => {
    const { model, recorded } = startTasks(
      fakeBackend(undefined, { failing: "POST /api/tasks/:id/complete" }),
    );

    model.recordOccurrence({ taskId: "task-vaccination", occurrence: "2026-10-12" });
    await settled(model);

    expect(model.failure()).toBe(failure);
    expect(recorded).toEqual([]);
  });

  test("stops waiting when the list cannot load", async () => {
    const { model, recorded } = startTasks(fakeBackend(undefined, { failing: "GET /api/tasks" }));

    model.recordOccurrence({ taskId: "task-vaccination", occurrence: "2026-10-12" });
    await settled(model);

    expect(model.screen().kind).toBe("failed");
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

  test("completes the Task once its last Subtask is completed", async () => {
    const steps: Task["subtasks"] = [
      { id: "sub-1", title: "Билеты", date: null, assignees: [], completed: null },
      { id: "sub-2", title: "Отель", date: null, assignees: [], completed: null },
    ];
    const { model } = startTasks(fakeBackend([{ ...vacation, subtasks: steps }]));

    await loaded(model);
    model.open("task-vacation");
    model.toggleSubtask("sub-1");
    await settled(model);

    expect(model.screen()).toMatchObject({
      task: { stepsTitle: "Шаги · 1 из 2", completed: undefined },
    });

    model.toggleSubtask("sub-2");
    await settled(model);

    expect(model.screen()).toMatchObject({
      task: { stepsTitle: "Шаги · 2 из 2", completed: expect.stringContaining("Выполнено") },
    });
  });

  test("offers no Subtasks on a recurring Task", async () => {
    const { model } = startTasks(fakeBackend([cleaning]));

    await loaded(model);
    model.open("task-cleaning");

    expect(model.screen()).toMatchObject({ kind: "task", task: { canAddSubtask: false } });
  });
});
