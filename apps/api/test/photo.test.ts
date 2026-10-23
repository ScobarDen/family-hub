import { describe, expect, test } from "vite-plus/test";

import type { CareEntry, Pet, Photo } from "@family-hub/contract";

import { type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker, tokenOf } from "./worker-harness.ts";

const channelId = -100_500;

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

async function addEntry(worker: Worker, photoIds: string[], petId = worker.buickId) {
  return request(worker, asya, {
    method: "POST",
    path: `/api/pets/${petId}/care-entries`,
    body: { occurredAt: worker.clock.now(), note: "Гуляли", details: { kind: "note" }, photoIds },
  });
}

async function addPet(worker: Worker, name: string) {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/pets",
    body: {
      name,
      species: "bird",
      breed: null,
      sex: null,
      birthDate: null,
      chipNumber: null,
      notes: null,
    },
  });

  return response.json<Pet>();
}

async function setAvatar(worker: Worker, photoId: string | null) {
  return request(worker, denis, {
    method: "PUT",
    path: `/api/pets/${worker.buickId}/avatar`,
    body: { photoId },
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

  test("is checked again when the edge cache already holds the photo", async () => {
    const worker = await startWithBuick();
    const photo = await uploaded(worker, asya);
    const warmed = await worker.request(photo.urls.full);
    const forged = await worker.request(photo.urls.full.replace(/sig=.+$/u, "sig=AAAA"));

    worker.clock.set("2026-10-05T11:00:01Z");

    const stale = await worker.request(photo.urls.full);

    expect([warmed.status, forged.status, stale.status]).toEqual([200, 403, 403]);
  });

  test("answers gone from a warmed cache once the photo is deleted or the channel disconnected", async () => {
    const worker = await startWithBuick();
    const deleted = await uploaded(worker, asya, 1);
    const kept = await uploaded(worker, asya, 2);

    await worker.request(deleted.urls.thumb);
    await worker.request(kept.urls.thumb);
    await request(worker, asya, { method: "DELETE", path: `/api/photos/${deleted.id}` });

    const afterDelete = await worker.request(deleted.urls.thumb);

    await worker.setPhotoChannel(worker.familyId, null);

    const afterDisconnect = await worker.request(kept.urls.thumb);

    expect([afterDelete.status, afterDisconnect.status]).toEqual([410, 410]);
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

  test("give the Pet its avatar, unless they are another Pet's", async () => {
    const worker = await startWithBuick();
    const photo = await uploaded(worker, asya);
    const kesha = await addPet(worker, "Кеша");
    const keshas = await uploaded(worker, asya, 7);

    await addEntry(worker, [photo.id]);
    await addEntry(worker, [keshas.id], kesha.id);

    const chosen = await setAvatar(worker, photo.id);
    const refused = await setAvatar(worker, keshas.id);

    const withAvatar = await chosen.json<Pet>();

    expect(withAvatar.avatar?.thumb).toMatch(/^\/photos\//u);
    expect(refused.status).toBe(400);
  });
});

describe("a Pet Avatar uploaded for the Pet alone", () => {
  test("becomes the avatar", async () => {
    const worker = await startWithBuick();
    const photo = await uploaded(worker, asya);

    const response = await setAvatar(worker, photo.id);
    const buick = await response.json<Pet>();

    expect(response.status).toBe(200);
    expect(buick.avatar?.medium).toMatch(/^\/photos\/.+\/medium/u);
  });

  test("is forgotten once replaced or removed, while a Care Entry photo stays", async () => {
    const worker = await startWithBuick();
    const first = await uploaded(worker, asya, 1);
    const second = await uploaded(worker, asya, 2);
    const walk = await uploaded(worker, asya, 3);

    await addEntry(worker, [walk.id]);
    await setAvatar(worker, first.id);
    await setAvatar(worker, second.id);
    await setAvatar(worker, walk.id);
    await setAvatar(worker, null);

    const links = await Promise.all(
      [first, second, walk].map(async ({ urls }) => worker.request(urls.thumb)),
    );

    expect(links.map(({ status }) => status)).toEqual([410, 410, 200]);
  });
});

describe("another Family's photo", () => {
  test("cannot be attached to a Care Entry, an avatar or an Album", async () => {
    const worker = await startWithBuick();
    const stranger = { id: 333, first_name: "Пётр" };
    const neighbours = await worker.addFamily({
      name: "Соседи",
      owner: { telegramId: stranger.id, name: "Пётр" },
    });

    await worker.setPhotoChannel(neighbours.familyId, -100_600);

    const foreign = await uploaded(worker, stranger, 9);
    const album = await request(worker, asya, {
      method: "POST",
      path: "/api/albums",
      body: { title: "Казань", description: null },
    });
    const { id: albumId } = await album.json<{ id: string }>();
    const responses = [
      await addEntry(worker, [foreign.id]),
      await request(worker, denis, {
        method: "PUT",
        path: `/api/pets/${worker.buickId}/avatar`,
        body: { photoId: foreign.id },
      }),
      await request(worker, asya, {
        method: "POST",
        path: `/api/albums/${albumId}/photos`,
        body: { photoIds: [foreign.id] },
      }),
    ];

    expect(responses.map(({ status }) => status)).toEqual([400, 400, 400]);
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
