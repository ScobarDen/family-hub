import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { FeedPage, FeedUpcoming, Photo, Task } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client.api.ts";
import { reatomDeviceCache } from "@/modules/device-cache";
import {
  fakeDeviceStorage,
  fakeHaptics,
  type FakeDeviceStorage,
  fakeWindow,
} from "@/modules/telegram";

import { createFeedApi } from "../feed.api.ts";
import { reatomFeed, type FeedTarget } from "./feed.vm.ts";

// A popup the Member closes without choosing anything.
const noChoice: string | undefined = undefined;

const walk: Photo = {
  id: "photo-1",
  takenAt: null,
  urls: {
    thumb: "/photos/photo-1/thumb",
    medium: "/photos/photo-1/medium",
    full: "/photos/photo-1/full",
  },
  canDelete: true,
};

const occurrence = {
  kind: "task" as const,
  time: null,
  subtaskId: null,
  petId: null,
  petPicture: null,
  assignees: [],
};

const wallpaper: FeedUpcoming = {
  ...occurrence,
  key: "task-1-2026-10-12",
  title: "Купить обои",
  date: "2026-10-12",
  taskId: "task-1",
  occurrence: "2026-10-12",
};

const firstPage: FeedPage = {
  overdue: [wallpaper],
  upcoming: [
    {
      ...occurrence,
      key: "task-3-2026-10-16",
      title: "Созвон",
      date: "2026-10-16",
      time: "19:00",
      taskId: "task-3",
      occurrence: "2026-10-16",
    },
    {
      ...occurrence,
      key: "task-4-2026-10-20",
      title: "Прививка от бешенства — Бьюик",
      date: "2026-10-20",
      taskId: "task-4",
      occurrence: "2026-10-20",
      petId: "pet-1",
    },
    {
      kind: "birthday",
      key: "birthday-pet-1",
      title: "День рождения Бьюика",
      date: "2026-10-21",
      petId: "pet-1",
      petPicture: null,
    },
  ],
  activity: [
    {
      kind: "care",
      key: "care-entry-2",
      at: Date.parse("2026-10-14T07:00:00Z"),
      memberName: "Ася",
      memberPicture: "https://t.me/i/userpic/320/asya.jpg",
      title: "Вес: 30 кг — Бьюик",
      petId: "pet-1",
      entryId: "entry-2",
      photos: [walk],
      photoCount: 4,
    },
    {
      kind: "task",
      key: "task-2-2026-10-13",
      at: Date.parse("2026-10-13T15:00:00Z"),
      memberName: "Денис",
      memberPicture: null,
      title: "Купить диван",
      taskId: "task-2",
    },
  ],
  next: "1760367600000.task-2-2026-10-13",
};

const olderPage: FeedPage = {
  overdue: [],
  upcoming: [],
  activity: [
    {
      kind: "joined",
      key: "joined-member-2",
      at: Date.parse("2026-10-01T09:00:00Z"),
      memberName: "Ася",
      memberPicture: null,
    },
  ],
  next: null,
};

const wallpaperTask: Task = {
  id: "task-1",
  title: "Купить обои",
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

type Launch = {
  device?: FakeDeviceStorage;
  page?: FeedPage;
  answered?: Promise<void>;
  completion?: "refused" | "unreachable" | Promise<void>;
};

function startFeed({
  device = fakeDeviceStorage(),
  page = firstPage,
  answered = Promise.resolve(),
  completion = Promise.resolve(),
}: Launch = {}) {
  const requests: string[] = [];
  const opened: FeedTarget[] = [];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = [`${init.method ?? "GET"} ${url.pathname}${url.search}`, init.body]
      .filter((part) => typeof part === "string")
      .join(" ");

    requests.push(request);

    if (url.searchParams.has("before")) {
      return Response.json(olderPage);
    }

    if (url.pathname === "/api/feed") {
      await answered;

      return Response.json(page);
    }

    if (completion === "unreachable") {
      throw new TypeError("Failed to fetch");
    }

    if (completion === "refused") {
      return Response.json({ code: "INTERNAL", message: "" }, { status: 500 });
    }

    await completion;

    return Response.json(wallpaperTask);
  }

  const haptics = fakeHaptics();
  const model = reatomFeed({
    api: createFeedApi(createHttpClient({ baseUrl: "https://api.family-hub.test", fetch })),
    today: () => "2026-10-14",
    timeZone: () => "Europe/Moscow",
    onOpen: (target) => {
      opened.push(target);
    },
    telegram: { ...fakeWindow(), showPopup: async () => noChoice, showAlert: noop, haptics },
    deviceCache: reatomDeviceCache(device.deviceStorage),
  });

  model.blocks.subscribe(noop);

  return { model, requests, opened, felt: haptics.felt };
}

type Model = ReturnType<typeof startFeed>["model"];

async function loaded(model: Model) {
  await vi.waitFor(() => {
    expect(model.blocks()).not.toEqual([]);
  });
}

function shape(model: Model) {
  return model.blocks().map(({ title, rows }) => [title, rows.map((row) => row.title)]);
}

beforeEach(() => {
  context.reset();
});

describe("the Feed", () => {
  test("goes overdue, upcoming, today, yesterday", async () => {
    const { model } = startFeed();

    await loaded(model);

    expect(shape(model)).toEqual([
      ["Просрочено", ["Купить обои"]],
      ["Предстоит", ["Созвон", "Прививка от бешенства — Бьюик", "День рождения Бьюика"]],
      ["Сегодня", ["Вес: 30 кг — Бьюик"]],
      ["Вчера", ["Купить диван"]],
    ]);
    expect(model.blocks()[2]?.rows[0]?.subtitle).toBe("Ася · 10:00");
  });

  test("says in words that a Task is Overdue, not by colour alone", async () => {
    const { model } = startFeed();

    await loaded(model);

    expect(model.blocks()[0]?.rows[0]).toMatchObject({
      subtitle: "Просрочено · 12 октября",
      isOverdue: true,
      canComplete: true,
    });
  });

  test("sums up what is overdue under the title and names who did each thing", async () => {
    const { model } = startFeed();

    await loaded(model);

    expect(model.summary()).toBe("Просрочено: 1");
    expect(model.blocks()[2]?.rows[0]?.author).toEqual({
      name: "Ася",
      profilePicture: "https://t.me/i/userpic/320/asya.jpg",
    });
  });

  test("narrows to one module by its chip, with a selection tick", async () => {
    const { model, felt } = startFeed();

    await loaded(model);
    model.choose("pet");

    expect(felt).toEqual(["select"]);
    expect(shape(model)).toEqual([
      ["Предстоит", ["День рождения Бьюика"]],
      ["Сегодня", ["Вес: 30 кг — Бьюик"]],
    ]);
  });

  test("gathers every Task line, ahead and done, under «Дела»", async () => {
    const { model } = startFeed();

    await loaded(model);
    model.choose("tasks");

    expect(shape(model)).toEqual([
      ["Просрочено", ["Купить обои"]],
      ["Предстоит", ["Созвон", "Прививка от бешенства — Бьюик"]],
      ["Вчера", ["Купить диван"]],
    ]);
  });

  test("loads older Activity until there is no more", async () => {
    const { model, requests } = startFeed();

    await loaded(model);
    model.loadMore();
    await vi.waitFor(() => {
      expect(model.blocks()).toHaveLength(5);
    });

    expect(model.canLoadMore()).toBe(false);
    expect(requests).toContain("GET /api/feed?before=1760367600000.task-2-2026-10-13");
    expect(model.blocks().at(-1)).toMatchObject({
      title: "1 октября",
      rows: [{ title: "Ася теперь в семье" }],
    });
  });

  test("starts over from the first page on a reload", async () => {
    const { model } = startFeed();

    await loaded(model);
    model.loadMore();
    await vi.waitFor(() => {
      expect(model.blocks()).toHaveLength(5);
    });
    model.reload();
    await vi.waitFor(() => {
      expect(model.blocks()).toHaveLength(4);
    });

    expect(model.canLoadMore()).toBe(true);
  });

  test("completes an Occurrence right from the Feed", async () => {
    const { model, requests } = startFeed();

    await loaded(model);
    model.complete("task-1-2026-10-12");
    await vi.waitFor(() => {
      expect(model.blocks()[0]?.title).toBe("Предстоит");
    });

    expect(requests).toContain('POST /api/tasks/task-1/complete {"occurrence":"2026-10-12"}');
  });

  test("takes a completed line away before the server answers, with a success pulse", async () => {
    const { model, felt } = startFeed({ completion: new Promise(noop) });

    await loaded(model);
    model.complete("task-1-2026-10-12");

    expect(model.blocks()[0]?.title).toBe("Предстоит");
    expect(model.failure()).toBeUndefined();
    expect(felt).toEqual(["success"]);
  });

  test.each([
    { completion: "refused" as const, said: "Не получилось отметить. Попробуйте ещё раз." },
    {
      completion: "unreachable" as const,
      said: "Нет связи — не сохранилось. Проверьте интернет и повторите.",
    },
  ])("brings the line back with the failure bar when $completion", async ({ completion, said }) => {
    const { model, felt } = startFeed({ completion });

    await loaded(model);
    const before = shape(model);

    model.complete("task-1-2026-10-12");
    await vi.waitFor(() => {
      expect(model.failure()).toBe(said);
    });

    expect(shape(model)).toEqual(before);
    expect(felt).toEqual(["success", "error"]);
  });

  test("opens the Task of a line ahead and of a completed one, and a birthday's Pet", async () => {
    const { model, opened } = startFeed();

    await loaded(model);
    model.open("task-3-2026-10-16");
    model.open("task-2-2026-10-13");
    model.open("birthday-pet-1");

    expect(opened).toEqual([
      { kind: "task", taskId: "task-3" },
      { kind: "task", taskId: "task-2" },
      { kind: "pet", petId: "pet-1" },
    ]);
  });

  test("opens a Care Entry tapped in the Activity, not only its Pet", async () => {
    const { model, opened } = startFeed();

    await loaded(model);
    model.open("care-entry-2");

    expect(opened).toEqual([{ kind: "care-entry", petId: "pet-1", entryId: "entry-2" }]);
  });
});

describe("an Activity with photos", () => {
  test("shows up to three thumbnails with «+N» and opens them full screen", async () => {
    const { model } = startFeed();

    await loaded(model);

    const row = model.blocks().find(({ title }) => title === "Сегодня")?.rows[0];

    expect(row).toMatchObject({
      morePhotos: 3,
      photos: [{ urls: { thumb: "https://api.family-hub.test/photos/photo-1/thumb" } }],
    });

    model.viewer.open(row?.photos ?? [], "photo-1");

    expect(model.viewer.current()?.position).toBe("1 / 1");
  });

  test("narrows to Albums by its chip", async () => {
    const { model } = startFeed();

    await loaded(model);
    model.choose("albums");

    expect(model.blocks()).toEqual([]);
  });
});

describe("launching from the device cache", () => {
  test("shows the first page of the last launch until the fresh one arrives", async () => {
    const device = fakeDeviceStorage();
    const first = startFeed({ device });

    await loaded(first.model);
    const before = shape(first.model);

    await vi.waitFor(() => {
      expect(device.items.has("feed")).toBe(true);
    });
    context.reset();
    let answer = noop;
    const { model } = startFeed({
      device,
      page: olderPage,
      answered: new Promise((resolve) => {
        answer = resolve;
      }),
    });

    await vi.waitFor(() => {
      expect(shape(model)).toEqual(before);
    });
    answer();
    await vi.waitFor(() => {
      expect(shape(model)).not.toEqual(before);
    });
  });
});
