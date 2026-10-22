import { beforeAll, describe, expect, test } from "vite-plus/test";

import type { FeedActivity, FeedPage, Goal, Pet, Photo, Plan } from "@family-hub/contract";

import { addTo, createAlbum, startWithFamily, uploaded, type Worker } from "./album-fixtures.ts";
import type { TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request } from "./worker-harness.ts";

async function feedOf(worker: Worker, user: TelegramUserFixture, before?: string) {
  const query = before === undefined ? "" : `?before=${encodeURIComponent(before)}`;
  const response = await request(worker, user, { path: `/api/feed${query}` });

  return response.json<FeedPage>();
}

async function pagesOf(worker: Worker, user: TelegramUserFixture): Promise<FeedActivity[][]> {
  const pages: FeedActivity[][] = [];
  let next: string | null | undefined;

  do {
    const page = await feedOf(worker, user, next ?? undefined);

    pages.push(page.activity);
    next = page.next;
  } while (next !== null);

  return pages;
}

async function addPlan(worker: Worker, user: TelegramUserFixture, change: Record<string, unknown>) {
  const response = await request(worker, user, {
    method: "POST",
    path: "/api/plans",
    body: {
      title: "Ремонт",
      note: null,
      dueDate: null,
      reminder: null,
      assigneeId: null,
      visibility: "shared",
      petId: null,
      ...change,
    },
  });

  return response.json<Plan>();
}

async function addGoal(worker: Worker, user: TelegramUserFixture, change: Record<string, unknown>) {
  const response = await request(worker, user, {
    method: "POST",
    path: "/api/goals",
    body: {
      title: "Отпуск",
      target: 100_000,
      deadline: null,
      icon: "palmtree",
      color: "teal",
      note: null,
      visibility: "shared",
      ...change,
    },
  });

  return response.json<Goal>();
}

async function contribute(worker: Worker, user: TelegramUserFixture, goalId: string) {
  await request(worker, user, {
    method: "POST",
    path: `/api/goals/${goalId}/movements`,
    body: { kind: "contribution", amount: 1000, date: "2026-10-04", comment: null },
  });
}

async function addBuick(worker: Worker) {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/pets",
    body: {
      name: "Бьюик",
      species: "dog",
      breed: null,
      sex: null,
      birthDate: null,
      chipNumber: null,
      notes: null,
    },
  });

  return response.json<Pet>();
}

async function addWeights(worker: Worker, { petId, count }: { petId: string; count: number }) {
  for (let index = 0; index < count; index += 1) {
    await request(worker, asya, {
      method: "POST",
      path: `/api/pets/${petId}/care-entries`,
      body: {
        occurredAt: worker.clock.now(),
        note: null,
        details: { kind: "weight", weightKg: 30 },
      },
    });
  }
}

async function completePlanWithSubplans(worker: Worker) {
  const plan = await addPlan(worker, denis, {});

  for (const title of ["Купить обои", "Поклеить"]) {
    await request(worker, denis, {
      method: "POST",
      path: `/api/plans/${plan.id}/subplans`,
      body: { title, dueDate: null, assigneeId: null, reminder: null },
    });
  }

  const listed = await request(worker, denis, { path: "/api/plans" });
  const [tree] = await listed.json<Plan[]>();
  const [first, last] = tree?.subplans ?? [];

  worker.clock.set("2026-10-04T10:05:00Z");
  await request(worker, asya, {
    method: "POST",
    path: `/api/plans/${plan.id}/subplans/${first?.id}/complete`,
  });
  worker.clock.set("2026-10-04T10:10:00Z");
  await request(worker, denis, {
    method: "POST",
    path: `/api/plans/${plan.id}/subplans/${last?.id}/complete`,
  });
}

async function addPrivateRecordsOfAsya(worker: Worker) {
  const surprise = await addPlan(worker, asya, { title: "Сюрприз", visibility: "private" });
  const gift = await addGoal(worker, asya, { title: "Подарок Денису", visibility: "private" });

  await request(worker, asya, { method: "POST", path: `/api/plans/${surprise.id}/complete` });
  await contribute(worker, asya, gift.id);
}

// Two joins, three Plan lines, three Goal lines, two Upload Batches and 59 Care Entries; the newer
// batch is the 30th line for Денис, with 29 newer and 39 older ones.
async function startWithHistory() {
  const worker = await startWithFamily();
  const buick = await addBuick(worker);
  const kazan = await createAlbum(worker, asya, "Казань");
  const vacation = await addGoal(worker, denis, {});

  await completePlanWithSubplans(worker);
  const food = await addPlan(worker, denis, { title: "Купить корм" });

  await request(worker, asya, { method: "POST", path: `/api/plans/${food.id}/complete` });
  await contribute(worker, denis, vacation.id);
  await contribute(worker, asya, vacation.id);
  await addTo(worker, kazan.id, [await uploaded(worker, { size: 1, takenAt: null })]);
  worker.clock.set("2026-10-04T10:20:00Z");
  await request(worker, denis, {
    method: "POST",
    path: `/api/goals/${vacation.id}/complete`,
    body: { outcome: "fulfilled" },
  });

  for (let minute = 30; minute < 44; minute += 1) {
    worker.clock.set(`2026-10-04T10:${minute}:00Z`);
    await addWeights(worker, { petId: buick.id, count: 2 });
  }

  worker.clock.set("2026-10-04T11:00:00Z");
  const boundary: Photo[] = [await uploaded(worker, { size: 2, takenAt: null })];

  await addTo(worker, kazan.id, boundary);
  worker.clock.set("2026-10-04T11:02:00Z");
  await addWeights(worker, { petId: buick.id, count: 2 });
  worker.clock.set("2026-10-04T11:05:00Z");
  boundary.push(await uploaded(worker, { size: 3, takenAt: null }));
  await addTo(worker, kazan.id, boundary.slice(1));

  for (let minute = 10; minute < 25; minute += 1) {
    worker.clock.set(`2026-10-04T11:${minute}:00Z`);
    await addWeights(worker, { petId: buick.id, count: minute === 24 ? 1 : 2 });
  }

  await addPrivateRecordsOfAsya(worker);

  return worker;
}

function isNewerThan(left: FeedActivity, right: FeedActivity): boolean {
  return left.at > right.at || (left.at === right.at && left.key > right.key);
}

function countOf(activity: FeedActivity[], kind: FeedActivity["kind"]): number {
  return activity.filter((item) => item.kind === kind).length;
}

function uploadCountsOf(page: FeedPage): number[] {
  return page.activity.flatMap((item) => (item.kind === "upload" ? [item.photoCount] : []));
}

describe("paging through a mixed Feed", () => {
  let denisPages: FeedActivity[][];
  let asyaPages: FeedActivity[][];

  beforeAll(async () => {
    const worker = await startWithHistory();

    denisPages = await pagesOf(worker, denis);
    asyaPages = await pagesOf(worker, asya);
  }, 120_000);

  test("fills every page but the last", () => {
    expect(denisPages.map((page) => page.length)).toEqual([30, 30, 9]);
  });

  test("shows each Activity once, newest first, with ties in a stable order", () => {
    const activity = denisPages.flat();

    expect(new Set(activity.map(({ key }) => key)).size).toBe(activity.length);
    expect(
      activity.every((item, index) => {
        const newer = activity[index - 1];

        return newer === undefined || isNewerThan(newer, item);
      }),
    ).toBe(true);
  });

  test("mixes every kind into one chronology", () => {
    const activity = denisPages.flat();

    expect({
      care: countOf(activity, "care"),
      plan: countOf(activity, "plan"),
      goal: countOf(activity, "goal"),
      upload: countOf(activity, "upload"),
      joined: countOf(activity, "joined"),
    }).toEqual({ care: 59, plan: 3, goal: 3, upload: 2, joined: 2 });
  });

  test("keeps an Upload Batch on the page boundary in one place", () => {
    expect(denisPages[0]?.at(-1)).toMatchObject({ kind: "upload", photoCount: 2 });
    expect(denisPages[1]?.some(({ kind }) => kind === "upload")).toBe(false);
  });

  test("hides another Member's Private Plan and Goal on every page", () => {
    const titles = denisPages.flat().map((item) => ("title" in item ? item.title : ""));
    const asyaTitles = asyaPages[0]?.map((item) => ("title" in item ? item.title : ""));

    expect(titles.filter((title) => /Сюрприз|Подарок/u.test(title))).toEqual([]);
    expect(asyaTitles?.filter((title) => /Сюрприз|Подарок/u.test(title))).toHaveLength(2);
  });
});

describe("an Upload Batch", () => {
  test("joins photos added within the gap and disappears with its last photo", async () => {
    const worker = await startWithFamily();
    const kazan = await createAlbum(worker, asya, "Казань");
    const morning = await uploaded(worker, { size: 1, takenAt: null });

    await addTo(worker, kazan.id, [morning]);
    worker.clock.set("2026-10-04T11:00:00Z");
    const evening = [
      await uploaded(worker, { size: 2, takenAt: null }),
      await uploaded(worker, { size: 3, takenAt: null }),
    ];

    await addTo(worker, kazan.id, evening.slice(0, 1));
    worker.clock.set("2026-10-04T11:09:00Z");
    await addTo(worker, kazan.id, evening.slice(1));

    const before = await feedOf(worker, denis);

    for (const photo of evening) {
      await request(worker, asya, {
        method: "DELETE",
        path: `/api/albums/${kazan.id}/photos/${photo.id}`,
      });
    }

    const after = await feedOf(worker, denis);

    expect(uploadCountsOf(before)).toEqual([2, 1]);
    expect(uploadCountsOf(after)).toEqual([1]);
  });
});
