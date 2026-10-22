import type { Album, Pet, Photo } from "@family-hub/contract";

import type { TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker, tokenOf } from "./worker-harness.ts";

export async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-04T09:00:00Z" });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
  await worker.setPhotoChannel(familyId, -100_500);

  return worker;
}

export type Worker = Awaited<ReturnType<typeof startWithFamily>>;

export async function uploaded(
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

export async function createAlbum(worker: Worker, user: TelegramUserFixture, title: string) {
  const response = await request(worker, user, {
    method: "POST",
    path: "/api/albums",
    body: { title, description: null },
  });

  return response.json<Album>();
}

export async function addTo(worker: Worker, albumId: string, photos: Photo[]) {
  const response = await request(worker, asya, {
    method: "POST",
    path: `/api/albums/${albumId}/photos`,
    body: { photoIds: photos.map(({ id }) => id) },
  });

  return response.json<Album>();
}

export async function addBuick(worker: Worker) {
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
