import { describe, expect, test } from "vite-plus/test";

import type { FeedPage, Pet, Photo, Plan } from "@family-hub/contract";

import {
  addBuick,
  addTo,
  createAlbum,
  startWithFamily,
  uploaded,
  type Worker,
} from "./album-fixtures.ts";
import type { TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request } from "./worker-harness.ts";

async function feedOf(worker: Worker) {
  const response = await request(worker, denis, { path: "/api/feed" });

  return response.json<FeedPage>();
}

async function addPlan(
  worker: Worker,
  user: TelegramUserFixture,
  change: Partial<Plan> & { albumId: string | null; visibility?: string },
) {
  return request(worker, user, {
    method: "POST",
    path: "/api/plans",
    body: {
      title: "Поездка в Казань",
      note: null,
      dueDate: null,
      reminder: null,
      assigneeId: null,
      visibility: "shared",
      petId: null,
      ...change,
    },
  });
}

describe("a Plan's Album", () => {
  test("shows on the Plan as a strip of its first photos", async () => {
    const worker = await startWithFamily();
    const kazan = await createAlbum(worker, asya, "Казань");
    const photos = await Promise.all(
      [1, 2, 3].map(async (size) => uploaded(worker, { size, takenAt: null })),
    );

    await addTo(worker, kazan.id, photos);

    const response = await addPlan(worker, denis, { albumId: kazan.id });
    const plan = await response.json<Plan>();

    expect(plan.album).toMatchObject({ id: kazan.id, title: "Казань", photoCount: 3 });
    expect(plan.album?.photos).toHaveLength(3);
  });

  test("is one of the Family's Albums and drops off when the Album goes", async () => {
    const worker = await startWithFamily();
    const kazan = await createAlbum(worker, asya, "Казань");
    const foreign = await addPlan(worker, denis, { albumId: "not-an-album" });
    const created = await addPlan(worker, denis, { albumId: kazan.id });
    const plan = await created.json<Plan>();

    await request(worker, asya, { method: "DELETE", path: `/api/albums/${kazan.id}` });

    const listed = await request(worker, denis, { path: "/api/plans" });
    const [after] = await listed.json<Plan[]>();

    expect(foreign.status).toBe(400);
    expect(after).toMatchObject({ id: plan.id, album: null });
  });

  test("of a Private Plan stays with its owner", async () => {
    const worker = await startWithFamily();
    const kazan = await createAlbum(worker, asya, "Казань");

    await addPlan(worker, asya, { albumId: kazan.id, visibility: "private" });

    const listed = await request(worker, denis, { path: "/api/plans" });

    expect(await listed.json<Plan[]>()).toEqual([]);
  });
});

describe("uploads in the Feed", () => {
  test("make one line per Member, Album and burst with up to three thumbnails", async () => {
    const worker = await startWithFamily();
    const kazan = await createAlbum(worker, asya, "Казань");
    const burst: Photo[] = [];

    for (let minute = 0; minute < 5; minute += 1) {
      worker.clock.set(`2026-10-04T10:0${minute * 2}:00Z`);
      burst.push(await uploaded(worker, { size: minute + 1, takenAt: null }));
      await addTo(worker, kazan.id, [burst.at(-1) as Photo]);
    }

    worker.clock.set("2026-10-04T11:00:00Z");
    await addTo(worker, kazan.id, [await uploaded(worker, { size: 9, takenAt: null })]);

    const feed = await feedOf(worker);
    const uploads = feed.activity.filter(({ kind }) => kind === "upload");

    expect(
      uploads.map((item) =>
        item.kind === "upload" ? [item.photoCount, item.photos.length, item.memberName] : [],
      ),
    ).toEqual([
      [1, 1, "Ася"],
      [5, 3, "Ася"],
    ]);
  });

  test("shows a Care Entry's photos with it", async () => {
    const worker = await startWithFamily();
    const buick: Pet = await addBuick(worker);
    const photos = await Promise.all(
      [1, 2, 3, 4].map(async (size) => uploaded(worker, { size, takenAt: null })),
    );

    await request(worker, asya, {
      method: "POST",
      path: `/api/pets/${buick.id}/care-entries`,
      body: {
        occurredAt: worker.clock.now(),
        note: null,
        details: { kind: "note" },
        photoIds: photos.map(({ id }) => id),
      },
    });

    const feed = await feedOf(worker);
    const care = feed.activity.find(({ kind }) => kind === "care");

    expect(care).toMatchObject({ photoCount: 4, photos: [{}, {}, {}] });
  });
});
