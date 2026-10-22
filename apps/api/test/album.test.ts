import { describe, expect, test } from "vite-plus/test";

import type { AlbumSummary, CareEntry, Photo } from "@family-hub/contract";

import {
  addBuick,
  addTo,
  createAlbum,
  startWithFamily,
  uploaded,
  type Worker,
} from "./album-fixtures.ts";
import { asya, denis, request, tokenOf } from "./worker-harness.ts";

async function albumsOf(worker: Worker) {
  const response = await request(worker, denis, { path: "/api/albums" });

  return response.json<AlbumSummary[]>();
}

describe("an Album", () => {
  test("shows its photos by when they were taken, with their date span and a cover", async () => {
    const worker = await startWithFamily();
    const kazan = await createAlbum(worker, asya, "Казань");
    const late = await uploaded(worker, { size: 1, takenAt: "2026-08-03T10:00:00Z" });
    const early = await uploaded(worker, { size: 2, takenAt: "2026-08-01T10:00:00Z" });
    const saved = await addTo(worker, kazan.id, [late, early]);

    expect(saved.photos.map(({ id }) => id)).toEqual([early.id, late.id]);
    expect(saved).toMatchObject({
      kind: "album",
      photoCount: 2,
      from: Date.parse("2026-08-01T10:00:00Z"),
      to: Date.parse("2026-08-03T10:00:00Z"),
      cover: { thumb: expect.stringMatching(/^\/photos\//u) },
    });
  });

  test("shares a photo with other Albums, and «Все фото» shows every photo once", async () => {
    const worker = await startWithFamily();
    const kazan = await createAlbum(worker, asya, "Казань");
    const summer = await createAlbum(worker, denis, "Лето");
    const photo = await uploaded(worker, { size: 1, takenAt: null });

    await addTo(worker, kazan.id, [photo]);
    await addTo(worker, summer.id, [photo]);

    const all = await request(worker, denis, { path: "/api/photos" });

    const summaries = await albumsOf(worker);
    const every = await all.json<Photo[]>();

    expect(summaries.map(({ title, photoCount }) => [title, photoCount])).toEqual([
      ["Казань", 1],
      ["Лето", 1],
    ]);
    expect(every.map(({ id }) => id)).toEqual([photo.id]);
  });
});

describe("a Pet's automatic Album", () => {
  test("collects the photos of its Care Entries and takes new ones as a «Заметка»", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);
    const walk = await uploaded(worker, { size: 1, takenAt: null });
    const more = await Promise.all(
      [2, 3, 4, 5, 6, 7].map(async (size) => uploaded(worker, { size, takenAt: null })),
    );

    await request(worker, asya, {
      method: "POST",
      path: `/api/pets/${buick.id}/care-entries`,
      body: {
        occurredAt: worker.clock.now(),
        note: null,
        details: { kind: "note" },
        photoIds: [walk.id],
      },
    });

    const saved = await addTo(worker, `pet-${buick.id}`, more);
    const journal = await request(worker, asya, { path: `/api/pets/${buick.id}/care-entries` });
    const entries = await journal.json<CareEntry[]>();

    expect(saved).toMatchObject({ kind: "pet", title: "Бьюик", photoCount: 7, canDelete: false });
    expect(entries.map(({ details, photos }) => [details.kind, photos.length])).toEqual([
      ["note", 1],
      ["note", 5],
      ["note", 1],
    ]);
  });

  test("is neither renamed nor deleted", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);
    const path = `/api/albums/pet-${buick.id}`;

    const renamed = await request(worker, denis, {
      method: "PUT",
      path,
      body: { title: "Пёс", description: null },
    });
    const deleted = await request(worker, denis, { method: "DELETE", path });

    expect([renamed.status, deleted.status]).toEqual([409, 409]);
  });
});

describe("deleting an Album", () => {
  test("«только альбом» keeps its photos", async () => {
    const worker = await startWithFamily();
    const kazan = await createAlbum(worker, asya, "Казань");
    const photo = await uploaded(worker, { size: 1, takenAt: null });

    await addTo(worker, kazan.id, [photo]);

    const response = await request(worker, asya, {
      method: "DELETE",
      path: `/api/albums/${kazan.id}`,
    });
    const all = await request(worker, asya, { path: "/api/photos" });

    expect(response.status).toBe(200);
    const kept = await all.json<Photo[]>();

    expect(kept).toHaveLength(1);
  });

  test("«альбом и его фото» keeps the photos another Album or a Care Entry still shows", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);
    const kazan = await createAlbum(worker, asya, "Казань");
    const summer = await createAlbum(worker, asya, "Лето");
    const [own, shared, ofBuick] = [
      await uploaded(worker, { size: 1, takenAt: null }),
      await uploaded(worker, { size: 2, takenAt: null }),
      await uploaded(worker, { size: 3, takenAt: null }),
    ];

    await addTo(worker, kazan.id, [own, shared, ofBuick]);
    await addTo(worker, summer.id, [shared]);
    await addTo(worker, `pet-${buick.id}`, [ofBuick]);
    await request(worker, asya, {
      method: "DELETE",
      path: `/api/albums/${kazan.id}?withPhotos=true`,
    });

    const all = await request(worker, asya, { path: "/api/photos" });
    const left = await all.json<Photo[]>();

    expect(left.map(({ id }) => id).toSorted()).toEqual([shared.id, ofBuick.id].toSorted());
  });

  test("is for the Member who made it or the Family Owner", async () => {
    const worker = await startWithFamily();
    const mine = await createAlbum(worker, denis, "Рыбалка");
    const hers = await createAlbum(worker, asya, "Казань");

    const byAsya = await request(worker, asya, {
      method: "DELETE",
      path: `/api/albums/${mine.id}`,
    });
    const byOwner = await request(worker, denis, {
      method: "DELETE",
      path: `/api/albums/${hers.id}`,
    });

    expect([byAsya.status, byOwner.status]).toEqual([403, 200]);
  });
});

describe("uploading in a burst", () => {
  test("passes Telegram's wait on to the Mini App", async () => {
    const worker = await startWithFamily();

    worker.bot.rateLimitNextCall(7, "sendPhoto");

    const form = new FormData();

    form.append("file", new Blob([new Uint8Array(1)]), "photo.jpg");

    const response = await worker.request("/api/photos", {
      method: "POST",
      headers: { authorization: `Bearer ${await tokenOf(worker, asya)}` },
      body: form,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("7");
  });
});
