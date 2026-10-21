import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { FeedPage, Photo, Plan } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

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

const firstPage: FeedPage = {
  overdue: [
    {
      kind: "plan",
      key: "plan-sub-1",
      title: "Ремонт: Купить обои",
      date: "2026-10-12",
      planId: "plan-1",
      subplanId: "sub-1",
    },
  ],
  upcoming: [
    {
      kind: "event",
      key: "event-1-2026-10-16",
      title: "Созвон",
      date: "2026-10-16",
      time: "19:00",
      eventId: "event-1",
    },
    {
      kind: "due",
      key: "due-entry-1",
      title: "Прививка: Бешенство — Бьюик",
      date: "2026-10-20",
      petId: "pet-1",
      entryId: "entry-1",
    },
  ],
  activity: [
    {
      kind: "care",
      key: "care-entry-2",
      at: Date.parse("2026-10-14T07:00:00Z"),
      memberName: "Ася",
      title: "Вес: 30 кг — Бьюик",
      petId: "pet-1",
      entryId: "entry-2",
      photos: [walk],
      photoCount: 4,
    },
    {
      kind: "plan",
      key: "plan-plan-2",
      at: Date.parse("2026-10-13T15:00:00Z"),
      memberName: "Денис",
      title: "Купить диван",
      planId: "plan-2",
    },
  ],
  next: "1760367600000.plan-plan-2",
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
    },
  ],
  next: null,
};

const bedroom: Plan = {
  id: "plan-1",
  title: "Ремонт",
  note: null,
  pet: null,
  album: null,
  dueDate: null,
  reminder: null,
  assignee: null,
  visibility: "shared",
  isOwn: true,
  completed: null,
  subplans: [],
};

function startFeed() {
  const requests: string[] = [];
  const opened: FeedTarget[] = [];
  const recorded: string[] = [];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}${url.search}`;

    requests.push(request);

    if (url.searchParams.has("before")) {
      return Response.json(olderPage);
    }

    return Response.json(url.pathname === "/api/feed" ? firstPage : bedroom);
  }

  const model = reatomFeed({
    api: createFeedApi(createHttpClient({ baseUrl: "https://api.family-hub.test", fetch })),
    today: () => "2026-10-14",
    timeZone: () => "Europe/Moscow",
    onOpen: (target) => {
      opened.push(target);
    },
    onRecord: ({ entryId }) => {
      recorded.push(entryId);
    },
    telegram: { showPopup: async () => noChoice },
  });

  model.blocks.subscribe(noop);

  return { model, requests, opened, recorded };
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
      ["Просрочено", ["Ремонт: Купить обои"]],
      ["Предстоит", ["Созвон", "Прививка: Бешенство — Бьюик"]],
      ["Сегодня", ["Вес: 30 кг — Бьюик"]],
      ["Вчера", ["Купить диван"]],
    ]);
    expect(model.blocks()[2]?.rows[0]?.subtitle).toBe("Ася · 10:00");
  });

  test("narrows to one module by its chip", async () => {
    const { model } = startFeed();

    await loaded(model);
    model.choose("pet");

    expect(shape(model)).toEqual([
      ["Предстоит", ["Прививка: Бешенство — Бьюик"]],
      ["Сегодня", ["Вес: 30 кг — Бьюик"]],
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
    expect(requests).toContain("GET /api/feed?before=1760367600000.plan-plan-2");
    expect(model.blocks().at(-1)).toMatchObject({
      title: "1 октября 2026 г.",
      rows: [{ title: "Ася теперь в семье" }],
    });
  });

  test("completes a step right from the Feed", async () => {
    const { model, requests } = startFeed();

    await loaded(model);
    model.complete("plan-sub-1");
    await vi.waitFor(() => {
      expect(model.blocks()[0]?.title).toBe("Предстоит");
    });

    expect(requests).toContain("POST /api/plans/plan-1/subplans/sub-1/complete");
  });

  test("records a Due Date and opens what is tapped", async () => {
    const { model, opened, recorded } = startFeed();

    await loaded(model);
    model.record("due-entry-1");
    model.open("event-1-2026-10-16");
    model.open("plan-plan-2");

    expect(recorded).toEqual(["entry-1"]);
    expect(opened).toEqual([
      { kind: "event", eventId: "event-1" },
      { kind: "plan", planId: "plan-2" },
    ]);
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
