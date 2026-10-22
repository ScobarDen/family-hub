import { describe, expect, test } from "vite-plus/test";

import type { CareDetails, DueDateItem, Pet } from "@family-hub/contract";

import { type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

async function startWithBuick() {
  const worker = startWorker({ now: "2026-10-04T09:00:00Z" });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
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
  const { id } = await response.json<Pet>();

  return Object.assign(worker, { buickId: id });
}

type Worker = Awaited<ReturnType<typeof startWithBuick>>;

async function record(worker: Worker, { at, details }: { at: string; details: CareDetails }) {
  return request(worker, denis, {
    method: "POST",
    path: `/api/pets/${worker.buickId}/care-entries`,
    body: { occurredAt: Date.parse(at), note: null, details },
  });
}

async function dueDatesOf(worker: Worker, user: TelegramUserFixture = denis) {
  const response = await request(worker, user, { path: `/api/pets/${worker.buickId}/due-dates` });

  return response.json<DueDateItem[]>();
}

function vaccination(vaccine: string, dueDate: string | null): CareDetails {
  return { kind: "vaccination", vaccine, cost: null, dueDate };
}

describe("Due Dates", () => {
  test("come from vaccinations, treatments and vet visits, soonest first", async () => {
    const worker = await startWithBuick();

    await record(worker, {
      at: "2026-09-01T10:00:00Z",
      details: vaccination("Бешенство", "2027-09-01"),
    });
    await record(worker, {
      at: "2026-09-10T10:00:00Z",
      details: {
        kind: "treatment",
        target: "Клещи",
        product: "Бравекто",
        cost: null,
        dueDate: "2026-12-10",
      },
    });
    await record(worker, {
      at: "2026-09-20T10:00:00Z",
      details: { kind: "vet_visit", reason: null, cost: null, dueDate: "2027-03-20" },
    });

    expect(await dueDatesOf(worker, asya)).toEqual([
      {
        entryId: expect.any(String),
        kind: "treatment",
        label: "Обработка: Клещи",
        title: "Обработка: Клещи — Бьюик",
        dueDate: "2026-12-10",
        isOverdue: false,
      },
      {
        entryId: expect.any(String),
        kind: "vet_visit",
        label: "Визит к ветеринару",
        title: "Визит к ветеринару — Бьюик",
        dueDate: "2027-03-20",
        isOverdue: false,
      },
      {
        entryId: expect.any(String),
        kind: "vaccination",
        label: "Прививка: Бешенство",
        title: "Прививка: Бешенство — Бьюик",
        dueDate: "2027-09-01",
        isOverdue: false,
      },
    ]);
  });

  test("close when a new entry of the same vaccine arrives, whatever its letter case", async () => {
    const worker = await startWithBuick();

    await record(worker, {
      at: "2025-10-01T10:00:00Z",
      details: vaccination("Нобивак", "2026-10-01"),
    });
    await record(worker, {
      at: "2026-10-03T10:00:00Z",
      details: vaccination("НОБИВАК", "2027-10-03"),
    });

    expect(await dueDatesOf(worker)).toEqual([
      expect.objectContaining({ label: "Прививка: НОБИВАК", dueDate: "2027-10-03" }),
    ]);
  });

  test("close for good when the new entry sets no next date", async () => {
    const worker = await startWithBuick();

    await record(worker, {
      at: "2025-10-01T10:00:00Z",
      details: vaccination("Нобивак", "2026-10-01"),
    });
    await record(worker, { at: "2026-10-03T10:00:00Z", details: vaccination("Нобивак", null) });

    expect(await dueDatesOf(worker)).toEqual([]);
  });

  test("stay open for another vaccine", async () => {
    const worker = await startWithBuick();

    await record(worker, {
      at: "2025-10-01T10:00:00Z",
      details: vaccination("Нобивак", "2026-11-01"),
    });
    await record(worker, {
      at: "2026-10-03T10:00:00Z",
      details: vaccination("Бешенство", "2027-10-03"),
    });

    expect(await dueDatesOf(worker)).toHaveLength(2);
  });

  test("turn overdue once the day has passed in the Member's own zone", async () => {
    const worker = await startWithBuick();

    await record(worker, {
      at: "2026-09-01T10:00:00Z",
      details: vaccination("Бешенство", "2026-10-05"),
    });
    await request(worker, denis, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Asia/Vladivostok", isAuto: false },
    });

    worker.clock.set("2026-10-05T13:00:00Z");
    const onTheDay = await dueDatesOf(worker);

    worker.clock.set("2026-10-05T15:00:00Z");
    const nextMorningInVladivostok = await dueDatesOf(worker);

    expect(onTheDay[0]?.isOverdue).toBe(false);
    expect(nextMorningInVladivostok[0]?.isOverdue).toBe(true);
  });
});

describe("archiving a Pet", () => {
  test("keeps it and its journal readable but refuses changes until it is unarchived", async () => {
    const worker = await startWithBuick();

    await record(worker, { at: "2026-10-01T10:00:00Z", details: { kind: "note" } });
    const archived = await request(worker, asya, {
      method: "POST",
      path: `/api/pets/${worker.buickId}/archive`,
    });
    const refusedEntry = await record(worker, {
      at: "2026-10-02T10:00:00Z",
      details: { kind: "note" },
    });
    const refusedMemo = await request(worker, denis, {
      method: "PUT",
      path: `/api/pets/${worker.buickId}/memo`,
      body: { food: "Acana", clinic: null, important: null },
    });
    const journal = await request(worker, denis, {
      path: `/api/pets/${worker.buickId}/care-entries`,
    });

    expect(await archived.json()).toMatchObject({ archivedAt: Date.parse("2026-10-04T09:00:00Z") });
    expect(refusedEntry.status).toBe(409);
    expect(refusedMemo.status).toBe(409);
    expect(await journal.json()).toHaveLength(1);

    const unarchived = await request(worker, asya, {
      method: "POST",
      path: `/api/pets/${worker.buickId}/unarchive`,
    });
    const accepted = await record(worker, {
      at: "2026-10-02T10:00:00Z",
      details: { kind: "note" },
    });

    expect(await unarchived.json()).toMatchObject({ archivedAt: null });
    expect(accepted.status).toBe(201);
  });

  test("leaves it no open Due Dates until it is unarchived", async () => {
    const worker = await startWithBuick();

    await record(worker, {
      at: "2026-09-01T10:00:00Z",
      details: vaccination("Бешенство", "2026-10-20"),
    });
    await request(worker, asya, { method: "POST", path: `/api/pets/${worker.buickId}/archive` });
    const whileArchived = await dueDatesOf(worker);

    await request(worker, asya, { method: "POST", path: `/api/pets/${worker.buickId}/unarchive` });

    expect(whileArchived).toEqual([]);
    expect(await dueDatesOf(worker)).toMatchObject([{ label: "Прививка: Бешенство" }]);
  });
});

describe("deleting a Pet", () => {
  test("is the Family Owner's, after typing its name, and takes its journal with it", async () => {
    const worker = await startWithBuick();

    await record(worker, { at: "2026-10-01T10:00:00Z", details: { kind: "note" } });
    const byMember = await request(worker, asya, {
      method: "DELETE",
      path: `/api/pets/${worker.buickId}`,
      body: { petName: "Бьюик" },
    });
    const misspelt = await request(worker, denis, {
      method: "DELETE",
      path: `/api/pets/${worker.buickId}`,
      body: { petName: "Бьюи" },
    });
    const deleted = await request(worker, denis, {
      method: "DELETE",
      path: `/api/pets/${worker.buickId}`,
      body: { petName: " Бьюик " },
    });
    const pets = await request(worker, asya, { path: "/api/pets" });
    const journal = await request(worker, asya, {
      path: `/api/pets/${worker.buickId}/care-entries`,
    });

    expect(byMember.status).toBe(403);
    expect(misspelt.status).toBe(400);
    expect(await deleted.json()).toEqual({ status: "deleted" });
    expect(await pets.json()).toEqual([]);
    expect(await journal.json()).toEqual([]);
  });
});
