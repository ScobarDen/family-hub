import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { FeedUpcoming, Task, Today } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client.api.ts";
import { reatomDeviceCache } from "@/modules/device-cache";
import { fakeDeviceStorage, fakeHaptics, type FakeDeviceStorage } from "@/modules/telegram";

import { createTodayApi } from "../today.api.ts";
import { reatomToday, type TodayTarget } from "./today.vm.ts";

const quiet: Today["tiles"] = {
  tasks: { open: 0, overdue: 0, week: 0 },
  pet: { activeCount: 0, only: null },
  goals: { nearest: null },
  albums: { photos: 0 },
  recipes: { count: 0 },
};

function taskDue(index: number, date: string): Extract<FeedUpcoming, { kind: "task" }> {
  return {
    kind: "task",
    key: `task-${index}-${date}`,
    title: `Дело ${index}`,
    date,
    time: null,
    taskId: `task-${index}`,
    occurrence: date,
    subtaskId: null,
    petId: null,
    petPicture: null,
    assignees: [],
  };
}

const birthday: FeedUpcoming = {
  kind: "birthday",
  key: "birthday-pet-1",
  title: "День рождения Бьюика",
  date: "2026-10-16",
  petId: "pet-1",
  petPicture: null,
};

const chore: Task = {
  id: "task-1",
  title: "Дело 1",
  note: null,
  when: null,
  recurrence: null,
  skippedDates: [],
  assignees: [],
  recipients: "default",
  reminderOffsets: [],
  visibility: "shared",
  isOwn: true,
  pet: null,
  album: null,
  completions: [],
  subtasks: [],
};

function answerOf(
  path: string,
  { payload, failing }: { payload: Today; failing: string | undefined },
) {
  if (path === failing) {
    return Response.json({ code: "internal", message: "D1 is down" }, { status: 500 });
  }

  return Response.json(path === "/api/today" ? payload : chore);
}

type Launch = {
  failing?: string;
  unreachable?: string;
  device?: FakeDeviceStorage;
  today?: string;
  isOffline?: boolean;
};

function startToday(
  answer: Partial<Today> = {},
  {
    failing,
    unreachable,
    device = fakeDeviceStorage(),
    today = "2026-10-16",
    isOffline = false,
  }: Launch = {},
) {
  const calls: string[] = [];
  const payload: Today = { due: [], next: [], tiles: quiet, ...answer };
  const client = createHttpClient({
    baseUrl: "https://api.family-hub.test",
    fetch: async (input, init) => {
      const path = new URL(String(input)).pathname;

      calls.push(
        [`${init?.method ?? "GET"} ${path}`, init?.body]
          .filter((part) => typeof part === "string")
          .join(" "),
      );

      if (path === unreachable) {
        throw new TypeError("Failed to fetch");
      }

      return isOffline ? new Promise<Response>(noop) : answerOf(path, { payload, failing });
    },
  });
  const opened: Array<TodayTarget | string> = [];
  const haptics = fakeHaptics();
  const model = reatomToday({
    api: createTodayApi(client),
    deviceCache: reatomDeviceCache(device.deviceStorage),
    today: () => today,
    telegram: { haptics },
    onOpen: (target) => {
      opened.push(target);
    },
    onOpenSection: (module) => {
      opened.push(`section ${module}`);
    },
    onOpenFeed: () => {
      opened.push("feed");
    },
  });

  // What the View subscribes to, so a reload refetches as it does on screen.
  model.rows.subscribe(noop);

  return { model, calls, opened, felt: haptics.felt };
}

beforeEach(() => {
  context.reset();
});

describe("the header", () => {
  test.each([
    { count: 0, header: "День свободен" },
    { count: 2, header: "2 дела" },
    { count: 10, header: "10 дел" },
  ])("says $header for $count items", async ({ count, header }) => {
    const { model } = startToday({
      due: Array.from({ length: count }, (_, index) => taskDue(index, "2026-10-16")),
    });

    await vi.waitFor(() => {
      expect(model.header()).toBe(header);
    });
  });
});

describe("«Сделать сегодня»", () => {
  test("shows at most three rows and a «Ещё N» for the rest", async () => {
    const { model } = startToday({
      due: [
        taskDue(1, "2026-10-12"),
        { ...taskDue(2, "2026-10-16"), time: "19:00" },
        birthday,
        taskDue(3, "2026-10-16"),
      ],
    });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(3);
    });
    expect(model.rows()).toEqual([
      expect.objectContaining({
        title: "Дело 1",
        when: "Просрочено · 12 октября",
        isOverdue: true,
        canComplete: true,
      }),
      expect.objectContaining({ title: "Дело 2", when: "Сегодня, 19:00", isOverdue: false }),
      expect.objectContaining({ title: "День рождения Бьюика", canComplete: false }),
    ]);
    expect(model.more()).toBe("Ещё 1 дело");
  });

  test("opens a Task line as its Task and a birthday as its Pet", async () => {
    const { model, opened } = startToday({ due: [taskDue(1, "2026-10-16"), birthday] });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(2);
    });
    model.openItem("task-1-2026-10-16");
    model.openItem("birthday-pet-1");

    expect(opened).toEqual([
      { kind: "task", taskId: "task-1" },
      { kind: "pet", petId: "pet-1" },
    ]);
  });

  test("opens the Feed from «Ещё N»", async () => {
    const { model, opened } = startToday();

    model.openFeed();

    expect(opened).toEqual(["feed"]);
  });

  test("completes an Occurrence with one tap and keeps the undo until it is dismissed", async () => {
    const { model, calls, felt } = startToday({ due: [taskDue(1, "2026-10-12")] });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.complete("task-1-2026-10-12");

    expect(felt).toEqual(["success"]);
    expect(model.rows()).toEqual([expect.objectContaining({ title: "Дело 1", isDone: true })]);
    expect(model.header()).toBe("День свободен");
    expect(model.undo()).toEqual({ title: "Дело 1", hasPet: false });
    await vi.waitFor(() => {
      expect(calls).toContain('POST /api/tasks/task-1/complete {"occurrence":"2026-10-12"}');
    });

    await vi.waitFor(() => {
      expect(calls.filter((call) => call === "GET /api/today")).toHaveLength(2);
    });
    expect(model.undo()).toEqual({ title: "Дело 1", hasPet: false });

    model.dismissUndo();

    expect(model.undo()).toBeUndefined();
    expect(model.rows()).toEqual([expect.objectContaining({ title: "Дело 1", isDone: true })]);
  });

  test("offers to record a Pet's Task in its journal from the undo bar", async () => {
    const { model, opened } = startToday({
      due: [{ ...taskDue(1, "2026-10-16"), title: "Прививка: бешенство", petId: "pet-1" }],
    });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.complete("task-1-2026-10-16");

    expect(model.undo()).toEqual({ title: "Прививка: бешенство", hasPet: true });

    model.recordCareEntry();

    expect(opened).toEqual([
      { kind: "care-entry-for-pet", petId: "pet-1", title: "Прививка: бешенство" },
    ]);
    expect(model.undo()).toBeUndefined();
  });

  test("completes a dated Subtask as the Subtask", async () => {
    const { model, calls } = startToday({
      due: [{ ...taskDue(1, "2026-10-16"), subtaskId: "sub-1" }],
    });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.complete("task-1-2026-10-16");

    await vi.waitFor(() => {
      expect(calls).toContain("POST /api/tasks/task-1/subtasks/sub-1/complete");
    });
  });

  test("reopens the Subtask when the undo of its completion is tapped", async () => {
    const { model, calls } = startToday({
      due: [{ ...taskDue(1, "2026-10-16"), subtaskId: "sub-1" }],
    });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.complete("task-1-2026-10-16");
    model.revert();

    await vi.waitFor(() => {
      expect(calls).toContain("POST /api/tasks/task-1/subtasks/sub-1/reopen");
    });
    expect(model.rows()).toEqual([expect.objectContaining({ isDone: false })]);
  });

  test("reopens the Occurrence after its completion when the undo is tapped", async () => {
    const { model, calls, felt } = startToday({ due: [taskDue(1, "2026-10-12")] });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.complete("task-1-2026-10-12");
    model.revert();

    expect(felt).toEqual(["success", "select"]);
    expect(model.rows()).toEqual([expect.objectContaining({ isDone: false })]);
    expect(model.undo()).toBeUndefined();
    await vi.waitFor(() => {
      expect(calls).toContain('POST /api/tasks/task-1/reopen {"occurrence":"2026-10-12"}');
    });
    expect(calls.findIndex((call) => call.includes("/complete"))).toBeLessThan(
      calls.findIndex((call) => call.includes("/reopen")),
    );
  });

  test("brings the row back and says so when the Occurrence cannot be completed", async () => {
    const { model } = startToday(
      { due: [taskDue(1, "2026-10-12")] },
      { failing: "/api/tasks/task-1/complete" },
    );

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.complete("task-1-2026-10-12");

    await vi.waitFor(() => {
      expect(model.completionFailure()).toBe(
        "Не получилось отметить «Дело 1». Попробуйте ещё раз.",
      );
    });
    expect(model.rows()).toEqual([expect.objectContaining({ title: "Дело 1", isDone: false })]);
    expect(model.undo()).toBeUndefined();
  });

  test("brings the row back and says there is no network when the request never arrives", async () => {
    const { model, felt } = startToday(
      { due: [taskDue(1, "2026-10-12")] },
      { unreachable: "/api/tasks/task-1/complete" },
    );

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.complete("task-1-2026-10-12");

    expect(model.rows()).toEqual([expect.objectContaining({ title: "Дело 1", isDone: true })]);
    await vi.waitFor(() => {
      expect(model.completionFailure()).toBe(
        "Нет связи — не сохранилось. Проверьте интернет и повторите.",
      );
    });
    expect(model.rows()).toEqual([expect.objectContaining({ title: "Дело 1", isDone: false })]);
    expect(felt).toEqual(["success", "error"]);

    model.dismissFailure();

    expect(model.completionFailure()).toBeUndefined();
  });

  test("does not complete a birthday", async () => {
    const { model, calls } = startToday({ due: [birthday, taskDue(1, "2026-10-16")] });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(2);
    });
    model.complete("birthday-pet-1");
    model.complete("task-1-2026-10-16");

    await vi.waitFor(() => {
      expect(calls).toContain('POST /api/tasks/task-1/complete {"occurrence":"2026-10-16"}');
    });
    expect(calls.filter((call) => call.startsWith("POST"))).toEqual([
      'POST /api/tasks/task-1/complete {"occurrence":"2026-10-16"}',
    ]);
    expect(model.rows().map(({ title, isDone }) => ({ title, isDone }))).toEqual([
      { title: "День рождения Бьюика", isDone: false },
      { title: "Дело 1", isDone: true },
    ]);
  });
});

describe("«Впереди»", () => {
  test("shows the day and the time of each Upcoming", async () => {
    const { model, opened } = startToday({
      next: [{ ...taskDue(1, "2026-10-16"), time: "19:00" }, taskDue(4, "2026-10-17")],
    });

    await vi.waitFor(() => {
      expect(model.next()).toEqual([
        { key: "task-1-2026-10-16", title: "Дело 1", when: "Сегодня, 19:00" },
        { key: "task-4-2026-10-17", title: "Дело 4", when: "Завтра" },
      ]);
    });
    model.openItem("task-1-2026-10-16");

    expect(opened).toEqual([{ kind: "task", taskId: "task-1" }]);
  });
});

describe("the section tiles", () => {
  test("keep all five sections in a fixed order, with only the caption when nothing counts", async () => {
    const { model } = startToday();

    await vi.waitFor(() => {
      expect(model.tiles()).toHaveLength(5);
    });
    expect(model.tiles()).toEqual([
      { module: "tasks", title: "Дела", value: undefined, note: undefined, isAlert: false },
      {
        module: "pet",
        title: "Питомцы",
        value: undefined,
        note: "Добавить питомца",
        isAlert: false,
      },
      { module: "goals", title: "Цели", value: undefined, note: undefined, isAlert: false },
      { module: "albums", title: "Альбомы", value: undefined, note: undefined, isAlert: false },
      { module: "recipes", title: "Рецепты", value: undefined, note: undefined, isAlert: false },
    ]);
  });

  test("show live numbers with the Overdue Tasks in red", async () => {
    const { model } = startToday({
      tiles: {
        tasks: { open: 5, overdue: 2, week: 3 },
        pet: { activeCount: 2, only: null },
        goals: { nearest: { goalId: "goal-1", title: "Диван", percent: 25 } },
        albums: { photos: 4 },
        recipes: { count: 12 },
      },
    });

    await vi.waitFor(() => {
      expect(model.tiles()[0]?.value).toBe("5");
    });
    expect(model.tiles()).toEqual([
      { module: "tasks", title: "Дела", value: "5", note: "2 просрочено", isAlert: true },
      { module: "pet", title: "Питомцы", value: "2", note: undefined, isAlert: false },
      { module: "goals", title: "Цели", value: "25%", note: "Диван", isAlert: false },
      { module: "albums", title: "Альбомы", value: "4", note: "фото за неделю", isAlert: false },
      { module: "recipes", title: "Рецепты", value: "12", note: undefined, isAlert: false },
    ]);
  });

  test("count the week's Tasks when none is Overdue", async () => {
    const { model } = startToday({ tiles: { ...quiet, tasks: { open: 4, overdue: 0, week: 3 } } });

    await vi.waitFor(() => {
      expect(model.tiles()[0]).toMatchObject({ value: "4", note: "3 на неделе", isAlert: false });
    });
  });

  test("show the only Pet's avatar and age on its tile and its avatar on its birthday", async () => {
    const { model } = startToday({
      due: [{ ...birthday, petPicture: "/photos/avatar/thumb" }],
      tiles: {
        ...quiet,
        pet: {
          activeCount: 1,
          only: {
            petId: "pet-1",
            name: "Бьюик",
            picture: "/photos/avatar/thumb",
            birthDate: "2022-05-14",
          },
        },
      },
    });

    await vi.waitFor(() => {
      expect(model.tiles()[1]).toMatchObject({
        title: "Бьюик",
        value: "4\u00A0г 5\u00A0м",
        valueLabel: "4 года 5 месяцев",
        picture: "https://api.family-hub.test/photos/avatar/thumb",
      });
    });
    expect(model.rows()[0]?.picture).toBe("https://api.family-hub.test/photos/avatar/thumb");
  });

  test.each([
    {
      pet: {
        activeCount: 1,
        only: { petId: "pet-1", name: "Бьюик", picture: null, birthDate: null },
      },
      opened: { kind: "pet", petId: "pet-1" },
    },
    { pet: { activeCount: 0, only: null }, opened: { kind: "new-pet" } },
    { pet: { activeCount: 2, only: null }, opened: "section pet" },
  ])("open the Pets tile for $pet.activeCount active Pets", async ({ pet, opened: target }) => {
    const { model, opened } = startToday({ tiles: { ...quiet, pet } });

    await vi.waitFor(() => {
      expect(model.tiles()).toHaveLength(5);
    });
    model.openTile("pet");

    expect(opened).toEqual([target]);
  });
});

describe("launching from the device cache", () => {
  const due = [taskDue(1, "2026-10-15")];
  const next = [taskDue(2, "2026-10-20")];

  async function loadedOn(today: string) {
    const device = fakeDeviceStorage();
    const { model } = startToday({ due, next }, { device, today });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    await vi.waitFor(() => {
      expect(device.items.has("today")).toBe(true);
    });
    context.reset();

    return device;
  }

  test("shows the Today of the last launch while the new one loads", async () => {
    const device = await loadedOn("2026-10-16");
    const { model } = startToday({}, { device, isOffline: true });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    expect(model.isDueOutdated()).toBe(false);
    expect(model.header()).toBe("1 дело");
  });

  test("hides yesterday's «Сделать сегодня» but keeps «Впереди» and the tiles", async () => {
    const device = await loadedOn("2026-10-15");
    const { model } = startToday({}, { device, isOffline: true });

    await vi.waitFor(() => {
      expect(model.next()).toHaveLength(1);
    });
    expect(model.isDueOutdated()).toBe(true);
    expect(model.rows()).toEqual([]);
    expect(model.header()).toBeUndefined();
    expect(model.tiles()).toHaveLength(5);
  });

  test("shows «Сделать сегодня» again once today's Today arrives", async () => {
    const device = await loadedOn("2026-10-15");
    const { model } = startToday({ due: [taskDue(3, "2026-10-16")] }, { device });

    await vi.waitFor(() => {
      expect(model.rows().map(({ title }) => title)).toEqual(["Дело 3"]);
    });
    expect(model.isDueOutdated()).toBe(false);
  });
});
