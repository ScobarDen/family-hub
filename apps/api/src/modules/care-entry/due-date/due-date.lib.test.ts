import { describe, expect, test } from "vite-plus/test";

import type { CareDetails } from "@family-hub/contract";

import { dueKeyOf, openDueDates, type DueEntry, type DuePet } from "./due-date.lib.ts";

const buick: DuePet = { id: "buick", name: "Бьюик", archivedAt: null };

function entry({
  id,
  details,
  occurredAt,
  petId = buick.id,
}: {
  id: string;
  details: CareDetails;
  occurredAt: number;
  petId?: string;
}): DueEntry {
  return {
    id,
    petId,
    details,
    dueDate: "dueDate" in details ? details.dueDate : null,
    dueKey: dueKeyOf(details),
    occurredAt,
  };
}

function vaccination(vaccine: string, dueDate: string | null): CareDetails {
  return { kind: "vaccination", vaccine, cost: null, dueDate };
}

describe("open Due Dates", () => {
  test("are held by the newest entry of each vaccine, treatment target or vet visit", () => {
    const older = entry({
      id: "older",
      details: vaccination("Бешенство", "2026-10-01"),
      occurredAt: 1,
    });
    const newer = entry({
      id: "newer",
      details: vaccination("бешенство", "2027-10-01"),
      occurredAt: 2,
    });

    expect(openDueDates({ pets: [buick], entries: [older, newer] })).toEqual([
      expect.objectContaining({ entryId: "newer", dueDate: "2027-10-01" }),
    ]);
  });

  test("close for good when the newest entry of the key has no date", () => {
    const entries = [
      entry({ id: "undated", details: vaccination("Бешенство", null), occurredAt: 2 }),
      entry({ id: "dated", details: vaccination("Бешенство", "2026-10-01"), occurredAt: 1 }),
    ];

    expect(openDueDates({ pets: [buick], entries })).toEqual([]);
  });

  test("come soonest first, named alone and with their Pet", () => {
    const entries = [
      entry({ id: "rabies", details: vaccination("Бешенство", "2027-09-01"), occurredAt: 1 }),
      entry({
        id: "ticks",
        details: {
          kind: "treatment",
          target: "Клещи",
          product: null,
          cost: null,
          dueDate: "2026-12-10",
        },
        occurredAt: 2,
      }),
      entry({
        id: "vet",
        details: { kind: "vet_visit", reason: "Хромает", cost: null, dueDate: "2027-03-20" },
        occurredAt: 3,
      }),
    ];

    expect(
      openDueDates({ pets: [buick], entries }).map(({ kind, name, title, dueDate }) => [
        kind,
        name,
        title,
        dueDate,
      ]),
    ).toEqual([
      ["treatment", "Клещи", "Обработка: Клещи — Бьюик", "2026-12-10"],
      ["vet_visit", "Визит к ветеринару", "Визит к ветеринару — Бьюик", "2027-03-20"],
      ["vaccination", "Бешенство", "Прививка: Бешенство — Бьюик", "2027-09-01"],
    ]);
  });

  test("are kept apart for each Pet", () => {
    const harley: DuePet = { id: "harley", name: "Харли", archivedAt: null };
    const entries = [
      entry({ id: "buick", details: vaccination("Бешенство", "2026-10-01"), occurredAt: 1 }),
      entry({
        id: "harley",
        details: vaccination("Бешенство", "2026-11-01"),
        occurredAt: 2,
        petId: harley.id,
      }),
    ];

    expect(openDueDates({ pets: [buick, harley], entries }).map(({ title }) => title)).toEqual([
      "Прививка: Бешенство — Бьюик",
      "Прививка: Бешенство — Харли",
    ]);
  });

  test("are none for an archived Pet or one not given", () => {
    const entries = [
      entry({ id: "rabies", details: vaccination("Бешенство", "2026-10-01"), occurredAt: 1 }),
    ];

    expect(openDueDates({ pets: [{ ...buick, archivedAt: 5 }], entries })).toEqual([]);
    expect(openDueDates({ pets: [], entries })).toEqual([]);
  });
});
