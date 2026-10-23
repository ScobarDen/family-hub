import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";

import { parseCommand, type CommandModel } from "./pipeline.ts";
import type { CommandContext } from "./prompt.ts";

const context: CommandContext = {
  today: "2026-10-13",
  weekday: "вторник",
  timeZone: "Europe/Moscow",
  speaker: { id: "member-denis", name: "Денис" },
  members: [
    { id: "member-denis", name: "Денис" },
    { id: "member-asya", name: "Ася" },
    { id: "member-asya-mom", name: "Ася (мама)" },
  ],
  pets: [{ id: "pet-buick", name: "Бьюик", species: "dog" }],
};

const models = { primary: "primary-model", fallback: "fallback-model" };

const internet = {
  outcome: "reminder",
  text: "Оплатить интернет",
  date: "2026-10-16",
  time: "19:00",
  recurrence: { frequency: "monthly", until: null },
  visibility: "shared",
  recipientIds: null,
  missing: [],
  ambiguities: [],
};

function modelAnswering(...answers: unknown[]) {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  const model: CommandModel = {
    async run(name, input) {
      calls.push({ model: name, input });

      const answer = answers.shift();

      if (answer instanceof Error) {
        throw answer;
      }

      return answer;
    },
  };

  return { model, calls };
}

async function parsed(...answers: unknown[]) {
  const { model } = modelAnswering(...answers);

  return parseCommand({ model, models }, { text: "напомни", context });
}

async function parsedWith(pets: CommandContext["pets"], answer: unknown) {
  const { model } = modelAnswering(answer);

  return parseCommand({ model, models }, { text: "Бьюик", context: { ...context, pets } });
}

describe("a command", () => {
  test("becomes a Reminder draft from a valid answer, given as an object or a string", async () => {
    const asObject = await parsed({ response: internet });
    const asString = await parsed({ response: JSON.stringify(internet) });

    expect(asObject).toEqual({
      status: "draft",
      draft: {
        kind: "reminder",
        text: "Оплатить интернет",
        date: "2026-10-16",
        time: "19:00",
        recurrence: { frequency: "monthly", until: null },
        visibility: "shared",
        recipientIds: null,
        missing: [],
        ambiguities: [],
      },
    });
    expect(asString).toEqual(asObject);
  });

  test("lists what is missing even when the model forgets to", async () => {
    const result = await parsed({ response: { ...internet, time: null } });

    expect(result).toMatchObject({ status: "draft", draft: { missing: ["time"] } });
  });

  test("keeps two Asyas as an ambiguity for the Member to pick from", async () => {
    const ambiguity = {
      field: "recipients",
      mention: "Ася",
      candidateIds: ["member-asya", "member-asya-mom"],
    };
    const result = await parsed({ response: { ...internet, ambiguities: [ambiguity] } });

    expect(result).toMatchObject({ status: "draft", draft: { ambiguities: [ambiguity] } });
  });

  test("gives a private Reminder to its speaker alone", async () => {
    const result = await parsed({
      response: { ...internet, visibility: "private", recipientIds: ["member-asya"] },
    });

    expect(result).toMatchObject({
      draft: { visibility: "private", recipientIds: ["member-denis"] },
    });
  });

  test.each([
    [
      "a Recipient from outside the Family",
      { response: { ...internet, recipientIds: ["stranger"] } },
    ],
    ["broken JSON", { response: "{ text: oops" }],
    ["an answer the schema rejects", { response: { ...internet, date: "в пятницу" } }],
    ["the model giving up", { response: { outcome: "unrecognized" } }],
    ["JSON mode failing", new Error("AiError: JSON Mode couldn't be met")],
  ])("is not understood with %s", async (_case, answer) => {
    expect(await parsed(answer)).toEqual({ status: "unrecognized" });
  });

  test("refuses what it may not do", async () => {
    expect(await parsed({ response: { outcome: "unsupported" } })).toEqual({
      status: "unsupported",
    });
  });
});

const grooming = {
  outcome: "event",
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

describe("an Event command", () => {
  test("becomes an Event draft at a moment", async () => {
    expect(await parsed({ response: grooming })).toEqual({
      status: "draft",
      draft: {
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
      },
    });
  });

  test("lasts all day without a time and repeats yearly, like a birthday", async () => {
    const result = await parsed({
      response: {
        ...grooming,
        title: "День рождения мамы",
        date: "2027-03-03",
        time: null,
        endTime: "18:00",
        recurrence: { frequency: "yearly", until: null },
      },
    });

    expect(result).toMatchObject({
      draft: {
        kind: "event",
        time: null,
        endTime: null,
        recurrence: { frequency: "yearly", until: null },
      },
    });
  });

  test("keeps the Reminder a day before that «напомни за день до» asks for", async () => {
    const result = await parsed({ response: { ...grooming, reminderOffsets: ["1d"] } });

    expect(result).toMatchObject({ draft: { kind: "event", reminderOffsets: ["1d"] } });
  });

  test("lists a missing date and has nothing to be ambiguous about", async () => {
    const result = await parsed({
      response: {
        ...grooming,
        date: null,
        ambiguities: [{ field: "recipients", mention: "Ася", candidateIds: ["a", "b"] }],
      },
    });

    expect(result).toMatchObject({ draft: { missing: ["date"], ambiguities: [] } });
  });

  test("is told apart from a Reminder by the model, whose answer decides the kind", async () => {
    expect(await parsed({ response: internet })).toMatchObject({ draft: { kind: "reminder" } });
    expect(await parsed({ response: grooming })).toMatchObject({ draft: { kind: "event" } });
  });

  test("is not understood with more than three Reminders", async () => {
    const result = await parsed({
      response: { ...grooming, reminderOffsets: ["at-start", "15m", "1h", "1d"] },
    });

    expect(result).toEqual({ status: "unrecognized" });
  });
});

const rabies = {
  outcome: "care_entry",
  petId: "pet-buick",
  date: null,
  time: null,
  note: null,
  details: {
    kind: "vaccination",
    vaccine: "Бешенство",
    cost: { amount: 1800, category: "vet" },
    dueDate: "2027-10-13",
  },
  missing: [],
  ambiguities: [],
};

const cat = { id: "pet-cat", name: "Мурка", species: "cat" };

describe("a Care Entry command", () => {
  test("becomes a vaccination with its cost and the next Due Date", async () => {
    expect(await parsed({ response: rabies })).toEqual({
      status: "draft",
      draft: {
        kind: "care_entry",
        petId: "pet-buick",
        date: null,
        time: null,
        note: null,
        details: {
          kind: "vaccination",
          vaccine: "Бешенство",
          cost: { amount: 1800, category: "vet" },
          dueDate: "2027-10-13",
        },
        missing: [],
        ambiguities: [],
      },
    });
  });

  test.each([
    ["a weight", { kind: "weight", weightKg: 12.4 }],
    ["an expense with its category", { kind: "expense", amount: 3200, category: "food" }],
  ])("becomes %s", async (_case, details) => {
    expect(await parsed({ response: { ...rabies, details } })).toMatchObject({
      draft: { kind: "care_entry", details },
    });
  });

  test("keeps «вчера» as yesterday's date", async () => {
    const result = await parsed({ response: { ...rabies, date: "2026-10-12" } });

    expect(result).toMatchObject({ draft: { date: "2026-10-12", time: null } });
  });

  test("puts the only Pet in when no name was said", async () => {
    const result = await parsed({ response: { ...rabies, petId: null } });

    expect(result).toMatchObject({ draft: { petId: "pet-buick", ambiguities: [], missing: [] } });
  });

  test("offers every Pet when there are several and no name", async () => {
    const result = await parsedWith([...context.pets, cat], {
      response: { ...rabies, petId: null },
    });

    expect(result).toMatchObject({
      draft: {
        petId: null,
        ambiguities: [{ field: "pet", mention: "", candidateIds: ["pet-buick", "pet-cat"] }],
        missing: [],
      },
    });
  });

  test("keeps two Pets of one name as candidates", async () => {
    const twin = { id: "pet-buick-2", name: "Бьюик", species: "cat" };
    const ambiguity = {
      field: "pet",
      mention: "Бьюик",
      candidateIds: ["pet-buick", "pet-buick-2"],
    };
    const result = await parsedWith([...context.pets, twin], {
      response: { ...rabies, petId: null, ambiguities: [ambiguity] },
    });

    expect(result).toMatchObject({ draft: { petId: null, ambiguities: [ambiguity] } });
  });

  test("lists the details as missing when the kind is unclear", async () => {
    const result = await parsed({ response: { ...rabies, details: null } });

    expect(result).toMatchObject({ draft: { details: null, missing: ["details"] } });
  });

  test.each([
    ["an unknown Pet", { ...rabies, petId: "pet-stranger" }],
    ["a weight off the 0.1 kg step", { ...rabies, details: { kind: "weight", weightKg: 12.45 } }],
    [
      "a cost in kopecks",
      { ...rabies, details: { ...rabies.details, cost: { amount: 18.5, category: "vet" } } },
    ],
    [
      "an unknown expense category",
      { ...rabies, details: { kind: "expense", amount: 300, category: "taxi" } },
    ],
  ])("is not understood with %s", async (_case, response) => {
    expect(await parsed({ response })).toEqual({ status: "unrecognized" });
  });
});

describe("the prompt", () => {
  test("carries today, the zone, the speaker and the Members", async () => {
    const { model, calls } = modelAnswering({ response: internet });

    await parseCommand(
      { model, models },
      { text: "напомни в пятницу в 19:00 оплатить интернет", context },
    );

    const messages = z
      .array(z.object({ role: z.string(), content: z.string() }))
      .parse(calls[0]?.input.messages);
    const facts = messages.map(({ content }) => content).join("\n");

    expect(calls[0]?.input.response_format).toMatchObject({ type: "json_schema" });
    expect(facts).toContain("Сегодня 2026-10-13 (вторник), часовой пояс Europe/Moscow.");
    expect(facts).toContain("Говорит: Денис (member-denis).");
    expect(facts).toContain("- Ася (мама): member-asya-mom");
    expect(facts).toContain("- Бьюик (dog): pet-buick");
    expect(messages.at(-1)).toEqual({
      role: "user",
      content: "напомни в пятницу в 19:00 оплатить интернет",
    });
  });

  test("asks for the outcome before any other field", async () => {
    const { model, calls } = modelAnswering({ response: internet });

    await parseCommand({ model, models }, { text: "напомни", context });

    const schema = z
      .object({
        json_schema: z.object({
          oneOf: z.array(z.object({ properties: z.record(z.string(), z.unknown()) })),
        }),
      })
      .parse(calls[0]?.input.response_format);

    expect(schema.json_schema.oneOf.map(({ properties }) => Object.keys(properties)[0])).toEqual([
      "outcome",
      "outcome",
      "outcome",
      "outcome",
      "outcome",
    ]);
  });
});

describe("the models", () => {
  test("fall back to the second one when the first is gone from the catalogue", async () => {
    const { model, calls } = modelAnswering(new Error("5007: No such model primary-model"), {
      response: internet,
    });
    const result = await parseCommand({ model, models }, { text: "напомни", context });

    expect(result.status).toBe("draft");
    expect(calls.map(({ model: name }) => name)).toEqual(["primary-model", "fallback-model"]);
    expect(calls[1]?.input).toHaveProperty("guided_json");
  });

  test("pass any other failure on", async () => {
    const { model } = modelAnswering(new Error("4006: daily free allocation exceeded"));

    await expect(parseCommand({ model, models }, { text: "напомни", context })).rejects.toThrow(
      "4006",
    );
  });
});
