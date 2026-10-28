import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { fakeDeviceStorage } from "@/common/telegram";

import {
  cleaning,
  fakeBackend,
  food,
  groups,
  loaded,
  settled,
  startTasks,
  taskOf,
  vaccination,
} from "./tasks.fixtures.ts";

beforeEach(() => {
  context.reset();
});

describe("the list of Tasks", () => {
  test("groups the Tasks by when they are due", async () => {
    const { model } = startTasks();

    await loaded(model);

    expect(model.screen()).toMatchObject({
      kind: "list",
      groups: {
        overdue: [{ title: "Прививка Бьюику", status: "overdue" }],
        today: [{ title: "Купить корм", hasReminder: true }],
        upcoming: [
          { kind: "task", title: "Ремонт" },
          { kind: "birthday", title: "День рождения: Бьюик, 4 года", when: "20 октября" },
        ],
        undated: [{ title: "Отпуск", date: undefined }],
        completed: [{ title: "Паспорт", status: "completed" }],
      },
      empty: undefined,
    });
  });

  test("folds the Completed Tasks until asked to show them", async () => {
    const { model } = startTasks();

    await loaded(model);

    expect(model.screen()).toMatchObject({ isCompletedShown: false });

    model.toggleCompleted();

    expect(model.screen()).toMatchObject({ isCompletedShown: true });
  });

  test("reads an Overdue row as Overdue, with its Pet and its Assignees", async () => {
    const { model } = startTasks();

    await loaded(model);

    expect(groups(model).overdue).toMatchObject([
      { subtitle: "Просрочено · 12 октября · Бьюик", assigneesLabel: "Исполнители: Ася" },
    ]);
  });

  test("never calls a past Task without Assignees Overdue", async () => {
    const { model } = startTasks(fakeBackend([{ ...vaccination, assignees: [] }]));

    await loaded(model);

    expect(groups(model).overdue).toEqual([]);
  });

  test("shows under «Мои» only the Tasks the Member does or is reminded of", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.showScope("mine");

    expect(groups(model)).toMatchObject({
      overdue: [],
      today: [{ title: "Купить корм" }],
      upcoming: [{ kind: "birthday" }],
      undated: [],
      completed: [],
    });

    model.showScope("all");

    expect(groups(model).overdue).toHaveLength(1);
  });

  test("invites a Family without Tasks to add the first one", async () => {
    const { model } = startTasks(fakeBackend([]), { pets: [] });

    await loaded(model);

    expect(model.screen()).toMatchObject({
      empty: { title: "Дел нет", hint: "Нажмите «Дело», чтобы добавить первое" },
    });
  });

  test("says «Ваших дел нет» under «Мои» when only others have Tasks", async () => {
    const { model } = startTasks(fakeBackend([vaccination]), { pets: [] });

    await loaded(model);
    model.showScope("mine");

    expect(model.screen()).toMatchObject({
      empty: { title: "Ваших дел нет", hint: "Дела всей семьи — во вкладке «Все»" },
    });
  });
});

describe("opening a Task by its id", () => {
  test("waits for the list and opens a recurring Task on its next open Occurrence", async () => {
    const { model, backend } = startTasks(fakeBackend([cleaning]));

    model.open("task-cleaning");
    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({ kind: "task", task: { occurrence: "2026-10-02" } });
    });

    model.toggleOpened();
    await settled(model);

    expect(backend.sent).toContainEqual({
      request: "POST /api/tasks/task-cleaning/complete",
      body: { occurrence: "2026-10-02" },
    });
  });
});

describe("a Task's Album", () => {
  test("shows the Album strip and opens the Album", async () => {
    const trip = taskOf({
      id: "task-trip",
      title: "Поездка в Казань",
      album: { id: "album-1", title: "Казань", photos: [], photoCount: 0 },
    });
    const { model, openedAlbums } = startTasks(fakeBackend([trip]));

    await loaded(model);
    model.open("task-trip");

    expect(model.screen()).toMatchObject({
      kind: "task",
      task: { album: { id: "album-1", title: "Казань" } },
    });

    model.openAlbum("album-1");

    expect(openedAlbums).toEqual(["album-1"]);
  });
});

async function loadedBefore() {
  const device = fakeDeviceStorage();

  await loaded(startTasks(fakeBackend([vaccination]), { device }).model);
  await settle();
  context.reset();

  return device;
}

describe("launching from the device cache", () => {
  test("shows the Tasks of the last launch until the fresh ones arrive", async () => {
    const device = await loadedBefore();
    let answer = noop;
    const { model } = startTasks(
      fakeBackend([food], {
        answered: new Promise((resolve) => {
          answer = resolve;
        }),
      }),
      { device },
    );

    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({
        groups: { overdue: [{ title: "Прививка Бьюику" }] },
      });
    });
    answer();
    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({
        groups: { overdue: [], today: [{ title: "Купить корм" }] },
      });
    });
  });

  test("keeps the cached Tasks when the refresh fails", async () => {
    const device = await loadedBefore();
    const { model, backend } = startTasks(fakeBackend([], { failing: "GET /api/tasks" }), {
      device,
    });

    await vi.waitFor(() => {
      expect(backend.sent).toContainEqual({ request: "GET /api/tasks", body: undefined });
    });
    await settle();

    expect(model.screen()).toMatchObject({
      groups: { overdue: [{ title: "Прививка Бьюику" }] },
    });
  });
});

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
