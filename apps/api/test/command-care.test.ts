import { describe, expect, test } from "vite-plus/test";

import type { CareEntryList, DueDateList, ExpenseSummary } from "@family-hub/contract";

import {
  buttonsOf,
  dataOf,
  denis,
  lastTo,
  press,
  request,
  say,
  startWithFamily,
  type Worker,
} from "./command-fixtures.ts";

const october = {
  from: Date.parse("2026-10-01T00:00:00Z"),
  to: Date.parse("2026-11-01T00:00:00Z"),
};

async function addPet(worker: Worker, name: string) {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/pets",
    body: {
      name,
      species: "dog",
      breed: null,
      sex: null,
      birthDate: null,
      chipNumber: null,
      notes: null,
    },
  });
  const { id } = await response.json<{ id: string }>();

  return id;
}

function rabiesFor(petId: string | null, dueDate = "2027-10-13") {
  return {
    outcome: "care_entry",
    petId,
    date: null,
    time: null,
    note: null,
    details: {
      kind: "vaccination",
      vaccine: "Бешенство",
      cost: { amount: 1800, category: "vet" },
      dueDate,
    },
    missing: [],
    ambiguities: [],
  };
}

async function journalOf(worker: Worker, petId: string) {
  const response = await request(worker, denis, { path: `/api/pets/${petId}/care-entries` });

  return response.json<CareEntryList>();
}

async function dueDatesOf(worker: Worker, petId: string) {
  const response = await request(worker, denis, { path: `/api/pets/${petId}/due-dates` });

  return response.json<DueDateList>();
}

async function expensesOf(worker: Worker, petId: string) {
  const response = await request(worker, denis, {
    path: `/api/pets/${petId}/expenses?from=${october.from}&to=${october.to}`,
  });

  return response.json<ExpenseSummary>();
}

describe("a Care Entry command to the bot", () => {
  test("records a vaccination with its cost and Due Date in the journal, the expenses and «Скоро»", async () => {
    const worker = await startWithFamily();
    const buickId = await addPet(worker, "Бьюик");

    worker.ai.answer({ response: rabiesFor(null) });
    await say(
      worker,
      denis,
      "Бьюику сделали прививку от бешенства, 1800 рублей, следующая через год",
    );

    const preview = lastTo(worker, denis);

    expect(preview?.text).toMatch(
      /^💉 Прививка «Бешенство» · Бьюик · сейчас · 1\s800\s₽ · следующий срок ср 13 окт/u,
    );
    expect(preview?.text).toContain("Фото можно приложить в «Изменить».");

    await press(worker, denis, dataOf(preview, "Создать"));

    expect(await journalOf(worker, buickId)).toMatchObject([
      {
        occurredAt: worker.clock.now(),
        details: { kind: "vaccination", vaccine: "Бешенство", dueDate: "2027-10-13" },
      },
    ]);
    const expenses = await expensesOf(worker, buickId);

    expect(expenses.byCategory).toEqual([{ category: "vet", amount: 1800 }]);
    expect(await dueDatesOf(worker, buickId)).toMatchObject([
      { label: "Прививка: Бешенство", dueDate: "2027-10-13" },
    ]);
  });

  test("closes the earlier Due Date of the same vaccine", async () => {
    const worker = await startWithFamily();
    const buickId = await addPet(worker, "Бьюик");

    await request(worker, denis, {
      method: "POST",
      path: `/api/pets/${buickId}/care-entries`,
      body: {
        occurredAt: Date.parse("2025-10-13T09:00:00Z"),
        note: null,
        details: { kind: "vaccination", vaccine: "Бешенство", cost: null, dueDate: "2026-10-20" },
      },
    });
    worker.ai.answer({ response: rabiesFor(buickId) });
    await say(worker, denis, "Бьюику сделали прививку от бешенства, следующая через год");
    await press(worker, denis, dataOf(lastTo(worker, denis), "Создать"));

    expect(await dueDatesOf(worker, buickId)).toMatchObject([{ dueDate: "2027-10-13" }]);
  });

  test("asks which Pet when there are two and no name, then offers «Создать»", async () => {
    const worker = await startWithFamily();
    const buickId = await addPet(worker, "Бьюик");
    const murkaId = await addPet(worker, "Мурка");

    worker.ai.answer({
      response: { ...rabiesFor(null), details: { kind: "weight", weightKg: 12.4 } },
    });
    await say(worker, denis, "весит 12,4");

    const preview = lastTo(worker, denis);

    expect(preview?.text).toContain("Для какого питомца запись?");
    expect(buttonsOf(preview).map(({ text }) => text)).toEqual(["Бьюик", "Мурка", "Изменить", "×"]);

    await press(worker, denis, dataOf(preview, "Мурка"));

    const edited = worker.bot.editedMessages().at(-1);

    expect(edited?.text).toMatch(/^⚖️ Вес 12,4 кг · Мурка/u);
    expect(edited?.reply_markup?.inline_keyboard.flat().map(({ text }) => text)).toEqual([
      "Создать",
      "Изменить",
      "×",
    ]);

    await press(worker, denis, dataOf(preview, "×"));

    expect(await journalOf(worker, buickId)).toEqual([]);
    expect(await journalOf(worker, murkaId)).toEqual([]);
  });

  test("dates «вчера» to yesterday at the time it was said", async () => {
    const worker = await startWithFamily();
    const buickId = await addPet(worker, "Бьюик");

    worker.ai.answer({
      response: {
        ...rabiesFor(buickId),
        date: "2026-10-12",
        details: { kind: "expense", amount: 3200, category: "food" },
      },
    });
    await say(worker, denis, "вчера купили корм за 3200");
    await press(worker, denis, dataOf(lastTo(worker, denis), "Создать"));

    expect(await journalOf(worker, buickId)).toMatchObject([
      {
        occurredAt: Date.parse("2026-10-12T09:00:00Z"),
        details: { kind: "expense", amount: 3200 },
      },
    ]);
  });
});

describe("a Care Entry confirmed hours after the phrase", () => {
  test("happens at the moment the phrase was said, not when «Создать» was pressed", async () => {
    const worker = await startWithFamily();
    const buickId = await addPet(worker, "Бьюик");
    const saidAt = worker.clock.now();

    worker.ai.answer({ response: rabiesFor(buickId) });
    await say(worker, denis, "Бьюику сделали прививку от бешенства");
    worker.clock.set("2026-10-13T19:00:01Z");
    await press(worker, denis, dataOf(lastTo(worker, denis), "Создать"));

    expect(await journalOf(worker, buickId)).toMatchObject([{ occurredAt: saidAt }]);
  });

  test("dates «вчера» to yesterday at the time of day the phrase was said", async () => {
    const worker = await startWithFamily();
    const buickId = await addPet(worker, "Бьюик");

    worker.ai.answer({ response: { ...rabiesFor(buickId), date: "2026-10-12" } });
    await say(worker, denis, "вчера кормили Бьюика новым кормом");
    worker.clock.set("2026-10-13T19:00:01Z");
    await press(worker, denis, dataOf(lastTo(worker, denis), "Создать"));

    expect(await journalOf(worker, buickId)).toMatchObject([
      { occurredAt: Date.parse("2026-10-12T09:00:00Z") },
    ]);
  });

  test("keeps the zone the phrase was said in when the Member changes zone before «Создать»", async () => {
    const worker = await startWithFamily();
    const buickId = await addPet(worker, "Бьюик");

    worker.ai.answer({ response: { ...rabiesFor(buickId), date: "2026-10-12" } });
    await say(worker, denis, "вчера кормили Бьюика новым кормом");
    worker.clock.set("2026-10-13T19:00:01Z");
    await request(worker, denis, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Asia/Vladivostok", isAuto: true },
    });
    await press(worker, denis, dataOf(lastTo(worker, denis), "Создать"));

    expect(await journalOf(worker, buickId)).toMatchObject([
      { occurredAt: Date.parse("2026-10-12T09:00:00Z") },
    ]);
  });

  test("says the Pet is archived and keeps the draft to change", async () => {
    const worker = await startWithFamily();
    const buickId = await addPet(worker, "Бьюик");

    worker.ai.answer({ response: rabiesFor(buickId) });
    await say(worker, denis, "Бьюику сделали прививку от бешенства");
    await request(worker, denis, { method: "POST", path: `/api/pets/${buickId}/archive` });
    await press(worker, denis, dataOf(lastTo(worker, denis), "Создать"));

    const edited = worker.bot.editedMessages().at(-1);

    expect(edited?.text).toMatch(
      /\n\nНе получилось создать: питомец в архиве, его журнал только для чтения\.$/u,
    );
    expect(edited?.reply_markup?.inline_keyboard.flat().map(({ text }) => text)).toEqual([
      "Создать",
      "Изменить",
      "×",
    ]);
    expect(await journalOf(worker, buickId)).toEqual([]);
  });
});
