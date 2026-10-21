import { describe, expect, test } from "vite-plus/test";

import type { CareEntryDraft, EventDraft, ReminderDraft } from "@family-hub/contract";

import { previewOf, type FamilyNames } from "./preview.ts";

const names: FamilyNames = {
  members: [
    { id: "member-denis", name: "Денис" },
    { id: "member-asya", name: "Ася" },
    { id: "member-asya-mom", name: "Ася" },
  ],
  pets: [
    { id: "pet-buick", name: "Бьюик" },
    { id: "pet-murka", name: "Мурка" },
  ],
};

const internet: ReminderDraft = {
  kind: "reminder",
  text: "Оплатить интернет",
  date: "2026-10-16",
  time: "19:00",
  recurrence: { frequency: "monthly", until: null },
  visibility: "shared",
  recipientIds: null,
  missing: [],
  ambiguities: [],
};

const grooming: EventDraft = {
  kind: "event",
  title: "Груминг Бьюика",
  note: null,
  date: "2026-10-17",
  time: "12:00",
  endDate: null,
  endTime: null,
  recurrence: null,
  visibility: "shared",
  reminderOffsets: [],
  missing: [],
  ambiguities: [],
};

const weighing: CareEntryDraft = {
  kind: "care_entry",
  petId: "pet-buick",
  date: null,
  time: null,
  note: null,
  details: { kind: "weight", weightKg: 12.4 },
  missing: [],
  ambiguities: [],
};

describe("a Reminder draft's preview", () => {
  test("reads its text, moment, repeat and everyone it reaches", () => {
    expect(previewOf(internet, names)).toEqual({
      title: "Оплатить интернет",
      details: ["пт 16 окт, 19:00", "каждый месяц", "Денис, Ася, Ася"],
      missing: undefined,
      question: undefined,
      hint: undefined,
      canCreate: true,
    });
  });

  test("names only the chosen Recipients, or the speaker alone when private", () => {
    expect(previewOf({ ...internet, recipientIds: ["member-asya"] }, names).details).toEqual([
      "пт 16 окт, 19:00",
      "каждый месяц",
      "Ася",
    ]);
    expect(previewOf({ ...internet, visibility: "private" }, names).details).toContain(
      "только мне",
    );
  });

  test("lists what is missing and takes «Создать» away", () => {
    const preview = previewOf(
      { ...internet, text: null, time: null, recurrence: null, missing: ["text", "time"] },
      names,
    );

    expect(preview).toMatchObject({
      title: "…",
      details: ["пт 16 окт", "Денис, Ася, Ася"],
      missing: "Не хватает: что напомнить, время",
      canCreate: false,
    });
  });

  test("asks which Member a name meant and offers each by name", () => {
    const preview = previewOf(
      {
        ...internet,
        ambiguities: [
          { field: "recipients", mention: "Ася", candidateIds: ["member-asya", "member-asya-mom"] },
        ],
      },
      names,
    );

    expect(preview).toMatchObject({
      question: {
        title: "Кого вы имели в виду под «Ася»?",
        candidates: [
          { index: 0, name: "Ася" },
          { index: 1, name: "Ася" },
        ],
      },
      canCreate: false,
    });
  });
});

describe("an Event draft's preview", () => {
  test("reads a timed start with its end, repeat, Reminders and privacy", () => {
    expect(
      previewOf(
        {
          ...grooming,
          endDate: "2026-10-17",
          endTime: "14:00",
          recurrence: { frequency: "weekly", until: null },
          reminderOffsets: ["at-start", "15m", "1w"],
          visibility: "private",
        },
        names,
      ).details,
    ).toEqual([
      "сб 17 окт, 12:00 – 14:00",
      "каждую неделю",
      "напомнить в момент начала, за 15 минут, за неделю",
      "только мне",
    ]);
  });

  test("reads an all-day Event and one spanning several days", () => {
    expect(previewOf({ ...grooming, time: null }, names).details).toEqual(["сб 17 окт, весь день"]);
    expect(previewOf({ ...grooming, time: null, endDate: "2026-10-19" }, names).details).toEqual([
      "сб 17 окт, весь день – пн 19 окт",
    ]);
  });

  test("lists a missing title and date", () => {
    expect(
      previewOf({ ...grooming, title: null, date: null, missing: ["title", "date"] }, names),
    ).toMatchObject({ title: "…", details: [], missing: "Не хватает: что за событие, дату" });
  });
});

function titleOf(details: CareEntryDraft["details"]): string {
  return previewOf({ ...weighing, details }, names).title;
}

describe("a Care Entry draft's preview", () => {
  test("titles each Care Kind by what was done", () => {
    expect(titleOf({ kind: "weight", weightKg: 12.4 })).toBe("Вес 12,4 кг");
    expect(titleOf({ kind: "vaccination", vaccine: "Бешенство", cost: null, dueDate: null })).toBe(
      "Прививка «Бешенство»",
    );
    expect(
      titleOf({ kind: "treatment", target: "Клещи", product: null, cost: null, dueDate: null }),
    ).toBe("Обработка «Клещи»");
    expect(titleOf({ kind: "vet_visit", reason: "хромает", cost: null, dueDate: null })).toBe(
      "Визит к ветеринару: хромает",
    );
    expect(titleOf({ kind: "vet_visit", reason: null, cost: null, dueDate: null })).toBe(
      "Визит к ветеринару",
    );
    expect(titleOf({ kind: "expense", amount: 3200, category: "food" })).toMatch(
      /^Трата 3\s200\s₽ · корм$/u,
    );
    expect(titleOf({ kind: "note" })).toBe("Заметка");
    expect(titleOf(null)).toBe("Запись");
  });

  test("reads its Pet, «сейчас» without a date, the cost and the Due Date", () => {
    const preview = previewOf(
      {
        ...weighing,
        details: {
          kind: "vaccination",
          vaccine: "Бешенство",
          cost: { amount: 1800, category: "vet" },
          dueDate: "2027-10-13",
        },
      },
      names,
    );

    expect(preview).toMatchObject({
      details: [
        "Бьюик",
        "сейчас",
        expect.stringMatching(/^1\s800\s₽$/u),
        "следующий срок ср 13 окт",
      ],
      hint: "Фото можно приложить в «Изменить».",
      canCreate: true,
    });
  });

  test("reads a date it was said for", () => {
    expect(previewOf({ ...weighing, date: "2026-10-12" }, names).details).toEqual([
      "Бьюик",
      "пн 12 окт",
    ]);
  });

  test("asks which Pet in care when none was named", () => {
    expect(
      previewOf(
        {
          ...weighing,
          petId: null,
          ambiguities: [{ field: "pet", mention: "", candidateIds: ["pet-buick", "pet-murka"] }],
        },
        names,
      ),
    ).toMatchObject({
      question: {
        title: "Для какого питомца запись?",
        candidates: [
          { index: 0, name: "Бьюик" },
          { index: 1, name: "Мурка" },
        ],
      },
      canCreate: false,
    });
  });

  test("lists a missing Pet and what to record", () => {
    expect(
      previewOf({ ...weighing, petId: null, details: null, missing: ["pet", "details"] }, names)
        .missing,
    ).toBe("Не хватает: питомца, что записать");
  });
});
