import { describe, expect, test } from "vite-plus/test";

import type { CareEntry, CareEntryChange, ExpenseSummary } from "@family-hub/contract";

import { type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

const now = "2026-10-04T09:00:00Z";
const vika = { id: 333, first_name: "Вика" };

const october = {
  from: Date.parse("2026-09-30T21:00:00Z"),
  to: Date.parse("2026-10-31T21:00:00Z"),
};

async function startWithBuick() {
  const worker = startWorker({ now });
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
  const { id } = await response.json<{ id: string }>();

  return Object.assign(worker, { buickId: id });
}

type Worker = Awaited<ReturnType<typeof startWithBuick>>;

function entryAt(iso: string, details: CareEntryChange["details"], note: string | null = null) {
  return { occurredAt: Date.parse(iso), note, details };
}

async function addEntry(worker: Worker, user: TelegramUserFixture, change: unknown) {
  return request(worker, user, {
    method: "POST",
    path: `/api/pets/${worker.buickId}/care-entries`,
    body: change,
  });
}

async function addedEntry(worker: Worker, user: TelegramUserFixture, change: unknown) {
  const response = await addEntry(worker, user, change);

  return response.json<CareEntry>();
}

async function journalOf(worker: Worker, user: TelegramUserFixture = denis) {
  const response = await request(worker, user, {
    path: `/api/pets/${worker.buickId}/care-entries`,
  });

  return response.json<CareEntry[]>();
}

async function expensesOf(worker: Worker, { from, to }: { from: number; to: number }) {
  const response = await request(worker, denis, {
    path: `/api/pets/${worker.buickId}/expenses?from=${from}&to=${to}`,
  });

  return response.json<ExpenseSummary>();
}

describe("the Care Entry journal", () => {
  test("keeps every Care Kind newest first with its author, backdated entries included", async () => {
    const worker = await startWithBuick();

    await addEntry(
      worker,
      asya,
      entryAt("2026-09-20T10:00:00Z", { kind: "weight", weightKg: 12.4 }),
    );
    await addEntry(
      worker,
      denis,
      entryAt(
        "2026-10-02T15:00:00Z",
        { kind: "vaccination", vaccine: "Нобивак DHPPi", cost: null, dueDate: "2027-10-02" },
        "Перенёс спокойно",
      ),
    );

    expect(await journalOf(worker, asya)).toEqual([
      {
        id: expect.any(String),
        petId: worker.buickId,
        occurredAt: Date.parse("2026-10-02T15:00:00Z"),
        note: "Перенёс спокойно",
        details: {
          kind: "vaccination",
          vaccine: "Нобивак DHPPi",
          cost: null,
          dueDate: "2027-10-02",
        },
        author: "Денис",
        photos: [],
      },
      expect.objectContaining({ details: { kind: "weight", weightKg: 12.4 }, author: "Ася" }),
    ]);
  });

  test.each([
    ["a weight without kilograms", { kind: "weight" }],
    ["a weight finer than 0.1 kg", { kind: "weight", weightKg: 12.45 }],
    ["an expense in kopecks", { kind: "expense", amount: 99.5, category: "food" }],
    ["an expense of an unknown category", { kind: "expense", amount: 900, category: "taxi" }],
    [
      "a vaccination without the vaccine",
      { kind: "vaccination", vaccine: " ", cost: null, dueDate: null },
    ],
    [
      "a visit cost filed as food",
      { kind: "vet_visit", reason: null, cost: { amount: 1500, category: "food" }, dueDate: null },
    ],
    ["an unknown Care Kind", { kind: "walk" }],
  ])("refuses %s", async (_case, details) => {
    const worker = await startWithBuick();

    const response = await addEntry(worker, denis, {
      occurredAt: Date.parse(now),
      note: null,
      details,
    });

    expect(response.status).toBe(400);
    expect(await journalOf(worker)).toEqual([]);
  });

  test("lets any Member correct and delete an entry, keeping its author", async () => {
    const worker = await startWithBuick();
    const entry = await addedEntry(
      worker,
      denis,
      entryAt("2026-10-01T09:00:00Z", { kind: "weight", weightKg: 12.4 }),
    );

    const corrected = await request(worker, asya, {
      method: "PUT",
      path: `/api/care-entries/${entry.id}`,
      body: entryAt("2026-10-01T09:00:00Z", { kind: "weight", weightKg: 12.8 }),
    });

    expect(await corrected.json()).toMatchObject({
      details: { kind: "weight", weightKg: 12.8 },
      author: "Денис",
    });

    const deleted = await request(worker, asya, {
      method: "DELETE",
      path: `/api/care-entries/${entry.id}`,
    });

    expect(await deleted.json()).toEqual({ status: "deleted" });
    expect(await journalOf(worker)).toEqual([]);
  });

  test("opens one entry with its Pet until it is deleted", async () => {
    const worker = await startWithBuick();
    const entry = await addedEntry(
      worker,
      denis,
      entryAt("2026-10-02T15:00:00Z", {
        kind: "vaccination",
        vaccine: "Нобивак DHPPi",
        cost: null,
        dueDate: "2027-10-02",
      }),
    );

    const opened = await request(worker, asya, { path: `/api/care-entries/${entry.id}` });

    expect(await opened.json()).toEqual(entry);

    await request(worker, denis, { method: "DELETE", path: `/api/care-entries/${entry.id}` });
    const gone = await request(worker, asya, { path: `/api/care-entries/${entry.id}` });

    expect(gone.status).toBe(404);
    expect(await gone.json()).toMatchObject({ code: "CARE_ENTRY_NOT_FOUND" });
  });

  test("stays out of other Families", async () => {
    const worker = await startWithBuick();

    await worker.addFamily({ name: "Соседи", owner: { telegramId: vika.id, name: "Вика" } });
    const entry = await addedEntry(worker, denis, entryAt(now, { kind: "note" }, "Чихает"));

    const listed = await request(worker, vika, {
      path: `/api/pets/${worker.buickId}/care-entries`,
    });
    const opened = await request(worker, vika, { path: `/api/care-entries/${entry.id}` });
    const added = await addEntry(worker, vika, entryAt(now, { kind: "note" }));
    const deleted = await request(worker, vika, {
      method: "DELETE",
      path: `/api/care-entries/${entry.id}`,
    });

    expect(await listed.json()).toEqual([]);
    expect(opened.status).toBe(404);
    expect(added.status).toBe(404);
    expect(deleted.status).toBe(404);
    expect(await journalOf(worker)).toHaveLength(1);
  });
});

describe("Pet Expenses", () => {
  test("sum expenses and the cost of vet care by category within the range", async () => {
    const worker = await startWithBuick();

    await addEntry(
      worker,
      denis,
      entryAt("2026-10-03T10:00:00Z", { kind: "expense", amount: 3200, category: "food" }),
    );
    await addEntry(
      worker,
      asya,
      entryAt("2026-10-10T10:00:00Z", { kind: "expense", amount: 800, category: "food" }),
    );
    await addEntry(
      worker,
      asya,
      entryAt("2026-10-12T10:00:00Z", {
        kind: "vet_visit",
        reason: "Хромает",
        cost: { amount: 2500, category: "vet" },
        dueDate: null,
      }),
    );
    await addEntry(
      worker,
      denis,
      entryAt("2026-10-15T10:00:00Z", {
        kind: "vaccination",
        vaccine: "Бешенство",
        cost: null,
        dueDate: null,
      }),
    );
    await addEntry(
      worker,
      denis,
      entryAt("2026-09-28T10:00:00Z", { kind: "expense", amount: 500, category: "toys" }),
    );

    const summary = await expensesOf(worker, october);

    expect(summary.total).toBe(6500);
    expect(summary.byCategory).toEqual([
      { category: "food", amount: 4000 },
      { category: "vet", amount: 2500 },
    ]);
    expect(summary.entries.map(({ kind }) => kind)).toEqual(["vet_visit", "expense", "expense"]);
  });

  test("follow an entry when its cost is corrected", async () => {
    const worker = await startWithBuick();
    const visit = await addedEntry(
      worker,
      denis,
      entryAt("2026-10-12T10:00:00Z", {
        kind: "vet_visit",
        reason: null,
        cost: { amount: 2500, category: "vet" },
        dueDate: null,
      }),
    );

    await request(worker, denis, {
      method: "PUT",
      path: `/api/care-entries/${visit.id}`,
      body: entryAt("2026-10-12T10:00:00Z", {
        kind: "vet_visit",
        reason: null,
        cost: { amount: 1800, category: "medicine" },
        dueDate: null,
      }),
    });

    const summary = await expensesOf(worker, october);

    expect(summary.byCategory).toEqual([{ category: "medicine", amount: 1800 }]);
  });
});
