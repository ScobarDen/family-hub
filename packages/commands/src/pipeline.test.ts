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
    expect(messages.at(-1)).toEqual({
      role: "user",
      content: "напомни в пятницу в 19:00 оплатить интернет",
    });
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
