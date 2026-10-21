import { describe, expect, test } from "vite-plus/test";

import type { Album, FeedPage, Pet, Photo, Plan } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };

async function tokenOf(worker: ReturnType<typeof startWorker>, user: TelegramUserFixture) {
  const session = await worker.request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: signInitData({
        botToken: worker.env.BOT_TOKEN,
        user,
        authDate: worker.clock.iso(),
      }),
    }),
  });
  const { token = "" } = await session.json<{ token?: string }>();

  return token;
}

async function request(
  worker: ReturnType<typeof startWorker>,
  user: TelegramUserFixture,
  { method = "GET", path, body }: { method?: string; path: string; body?: unknown },
) {
  return worker.request(path, {
    method,
    headers: {
      authorization: `Bearer ${await tokenOf(worker, user)}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-04T09:00:00Z" });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
  await worker.setPhotoChannel(familyId, -100_500);

  return worker;
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

async function uploaded(
  worker: Worker,
  { size, takenAt }: { size: number; takenAt: string | null },
): Promise<Photo> {
  const form = new FormData();

  form.append("file", new Blob([new Uint8Array(size)]), "photo.jpg");

  if (takenAt !== null) {
    form.append("takenAt", String(Date.parse(takenAt)));
  }

  const response = await worker.request("/api/photos", {
    method: "POST",
    headers: { authorization: `Bearer ${await tokenOf(worker, asya)}` },
    body: form,
  });

  return response.json<Photo>();
}

async function createAlbum(worker: Worker, user: TelegramUserFixture, title: string) {
  const response = await request(worker, user, {
    method: "POST",
    path: "/api/albums",
    body: { title, description: null },
  });

  return response.json<Album>();
}

async function addTo(worker: Worker, albumId: string, photos: Photo[]) {
  const response = await request(worker, asya, {
    method: "POST",
    path: `/api/albums/${albumId}/photos`,
    body: { photoIds: photos.map(({ id }) => id) },
  });

  return response.json<Album>();
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
