import { describe, expect, test } from "vite-plus/test";

import type { CareEntry, Pet, Photo } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };
const channelId = -100_500;

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

async function startWithBuick() {
  const worker = startWorker({ now: "2026-10-04T09:00:00Z" });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
  await worker.setPhotoChannel(familyId, channelId);

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
  const buick = await response.json<Pet>();

  return Object.assign(worker, { familyId, buickId: buick.id });
}

type Worker = Awaited<ReturnType<typeof startWithBuick>>;

async function upload(worker: Worker, user: TelegramUserFixture, size = 1000) {
  const form = new FormData();

  form.append("file", new Blob([new Uint8Array(size)], { type: "image/jpeg" }), "buick.jpg");
  form.append("takenAt", String(Date.parse("2026-08-01T12:00:00Z")));

  return worker.request("/api/photos", {
    method: "POST",
    headers: { authorization: `Bearer ${await tokenOf(worker, user)}` },
    body: form,
  });
}

async function uploaded(worker: Worker, user: TelegramUserFixture, size = 1000) {
  const response = await upload(worker, user, size);

  return response.json<Photo>();
}

async function addEntry(worker: Worker, photoIds: string[]) {
  return request(worker, asya, {
    method: "POST",
    path: `/api/pets/${worker.buickId}/care-entries`,
    body: { occurredAt: worker.clock.now(), note: "Гуляли", details: { kind: "note" }, photoIds },
  });
}

describe("uploading a photo", () => {
  test("sends it to the Family's channel and keeps its three variants", async () => {
    const worker = await startWithBuick();
    const response = await upload(worker, asya);
    const photo = await response.json<Photo>();

    expect(response.status).toBe(201);
    expect(worker.bot.sentPhotos()).toEqual([expect.objectContaining({ chat_id: channelId })]);
    expect(photo).toMatchObject({
      takenAt: Date.parse("2026-08-01T12:00:00Z"),
      canDelete: true,
      urls: { thumb: expect.stringMatching(/^\/photos\/.+\/thumb\?exp=\d+&sig=/u) },
    });
  });

  test("keeps one photo for the same picture sent twice", async () => {
    const worker = await startWithBuick();
    const first = await uploaded(worker, asya);
    const second = await uploaded(worker, denis);

    expect(second.id).toBe(first.id);
    expect(second.canDelete).toBe(true);
  });

  test("needs a connected Photo Storage and at most 10 MB", async () => {
    const worker = await startWithBuick();
    const tooLarge = await upload(worker, asya, 10_485_761);

    await worker.setPhotoChannel(worker.familyId, null);

    const disconnected = await upload(worker, asya);

    expect(tooLarge.status).toBe(400);
    expect(disconnected.status).toBe(409);
    expect(worker.bot.sentPhotos()).toEqual([]);
  });
});

describe("a signed photo link", () => {
  test("streams the file without handing out the bot token", async () => {
    const worker = await startWithBuick();
    const photo = await uploaded(worker, asya);
    const response = await worker.request(photo.urls.medium);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    expect(await response.text()).toMatch(/^jpeg:photos\/file-1280-/u);
    expect(photo.urls.medium).not.toContain(worker.env.BOT_TOKEN);
  });

  test("is refused once a day has passed or when tampered with", async () => {
    const worker = await startWithBuick();
    const photo = await uploaded(worker, asya);
    const forged = photo.urls.full.replace(/sig=.+$/u, "sig=AAAA");
    const otherVariant = photo.urls.full.replace("/full?", "/thumb?");

    const forgedResponse = await worker.request(forged);
    const swappedResponse = await worker.request(otherVariant);

    worker.clock.set("2026-10-05T11:00:01Z");

    const staleResponse = await worker.request(photo.urls.full);

    expect([forgedResponse.status, swappedResponse.status, staleResponse.status]).toEqual([
      403, 403, 403,
    ]);
  });

  test("answers gone once the channel is disconnected", async () => {
    const worker = await startWithBuick();
    const photo = await uploaded(worker, asya);

    await worker.setPhotoChannel(worker.familyId, null);

    const response = await worker.request(photo.urls.thumb);

    expect(response.status).toBe(410);
  });
});

describe("a Care Entry's photos", () => {
  test("come with the entry, at most five", async () => {
    const worker = await startWithBuick();
    const photos = [await uploaded(worker, asya, 1), await uploaded(worker, asya, 2)];
    const response = await addEntry(
      worker,
      photos.map(({ id }) => id),
    );
    const entry = await response.json<CareEntry>();
    const tooMany = await addEntry(worker, ["a", "b", "c", "d", "e", "f"]);
    const foreign = await addEntry(worker, ["not-a-photo"]);

    expect(entry.photos.map(({ id }) => id)).toEqual(photos.map(({ id }) => id));
    expect(tooMany.status).toBe(400);
    expect(foreign.status).toBe(400);
  });

  test("give the Pet its avatar", async () => {
    const worker = await startWithBuick();
    const photo = await uploaded(worker, asya);
    const stranger = await uploaded(worker, asya, 7);

    await addEntry(worker, [photo.id]);

    const chosen = await request(worker, denis, {
      method: "PUT",
      path: `/api/pets/${worker.buickId}/avatar`,
      body: { photoId: photo.id },
    });
    const refused = await request(worker, denis, {
      method: "PUT",
      path: `/api/pets/${worker.buickId}/avatar`,
      body: { photoId: stranger.id },
    });

    const withAvatar = await chosen.json<Pet>();

    expect(withAvatar.avatar?.thumb).toMatch(/^\/photos\//u);
    expect(refused.status).toBe(400);
  });
});

describe("deleting a photo", () => {
  test("is for its uploader or the Family Owner and forgets it everywhere", async () => {
    const worker = await startWithBuick();
    const mine = await uploaded(worker, asya, 1);
    const hers = await uploaded(worker, asya, 2);

    await addEntry(worker, [mine.id]);

    const byDenis = await request(worker, denis, {
      method: "DELETE",
      path: `/api/photos/${hers.id}`,
    });
    const byAsya = await request(worker, asya, {
      method: "DELETE",
      path: `/api/photos/${mine.id}`,
    });
    const journal = await request(worker, asya, {
      path: `/api/pets/${worker.buickId}/care-entries`,
    });
    const [entry] = await journal.json<CareEntry[]>();
    const link = await worker.request(mine.urls.thumb);

    expect([byDenis.status, byAsya.status]).toEqual([200, 200]);
    expect(entry?.photos).toEqual([]);
    expect(link.status).toBe(410);
  });

  test("is refused to another Member", async () => {
    const worker = await startWithBuick();
    const photo = await uploaded(worker, denis);
    const response = await request(worker, asya, {
      method: "DELETE",
      path: `/api/photos/${photo.id}`,
    });

    expect(response.status).toBe(403);
  });
});
