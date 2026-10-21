import { z } from "zod";

import {
  commandAnswer,
  reminderDraftField,
  type CommandAnswer,
  type CommandDraft,
  type ReminderDraft,
  type ReminderDraftField,
} from "@family-hub/contract";

import { promptOf, type CommandContext } from "./prompt.ts";

// The model sits behind this interface; the package knows nothing of Workers AI.
export type CommandModel = { run(model: string, input: Record<string, unknown>): Promise<unknown> };

export type CommandModels = { primary: string; fallback: string };

export type CommandResult =
  | { status: "draft"; draft: CommandDraft }
  | { status: "unrecognized" }
  | { status: "unsupported" };

const answerSchema = z.toJSONSchema(commandAnswer);
const missingModelPattern = /model.*(not found|does not exist|no such)|no such model|5007/iu;

function isModelMissing(error: unknown): boolean {
  return error instanceof Error && missingModelPattern.test(error.message);
}

// The primary model answers through JSON mode; the fallback through guided JSON, its own dialect.
async function answerOf(
  { model, models }: { model: CommandModel; models: CommandModels },
  messages: ReturnType<typeof promptOf>,
): Promise<unknown> {
  try {
    return await model.run(models.primary, {
      messages,
      response_format: { type: "json_schema", json_schema: answerSchema },
    });
  } catch (error) {
    if (!isModelMissing(error)) {
      throw error;
    }

    return model.run(models.fallback, { messages, guided_json: answerSchema });
  }
}

function jsonOf(raw: unknown): unknown {
  const response =
    typeof raw === "object" && raw !== null && "response" in raw ? raw.response : raw;

  if (typeof response !== "string") {
    return response;
  }

  try {
    return JSON.parse(response);
  } catch {
    return undefined;
  }
}

function missingOf(draft: Omit<ReminderDraft, "kind">): ReminderDraftField[] {
  const absent: ReminderDraftField[] = [];

  for (const field of reminderDraftField.options) {
    if (draft[field] === null || draft.missing.includes(field)) {
      absent.push(field);
    }
  }

  return absent;
}

// Only ids from the Family's list count; a private Reminder goes to its speaker alone.
function draftOf(
  answer: Extract<CommandAnswer, { outcome: "reminder" }>,
  context: CommandContext,
): CommandResult {
  const { outcome: _outcome, ...fields } = answer;
  const known = new Set(context.members.map(({ id }) => id));
  const mentioned = [
    ...(fields.recipientIds ?? []),
    ...fields.ambiguities.flatMap(({ candidateIds }) => candidateIds),
  ];

  if (mentioned.some((id) => !known.has(id))) {
    return { status: "unrecognized" };
  }

  return {
    status: "draft",
    draft: {
      kind: "reminder",
      ...fields,
      recipientIds: fields.visibility === "private" ? [context.speaker.id] : fields.recipientIds,
      ambiguities: fields.visibility === "private" ? [] : fields.ambiguities,
      missing: missingOf(fields),
    },
  };
}

export async function parseCommand(
  dependencies: { model: CommandModel; models: CommandModels },
  { text, context }: { text: string; context: CommandContext },
): Promise<CommandResult> {
  let raw: unknown;

  try {
    raw = await answerOf(dependencies, promptOf(context, text));
  } catch (error) {
    // «JSON Mode couldn't be met» is the model failing at the phrase, not the service failing.
    if (error instanceof Error && /json mode/iu.test(error.message)) {
      return { status: "unrecognized" };
    }

    throw error;
  }

  const answer = commandAnswer.safeParse(jsonOf(raw));

  if (!answer.success || answer.data.outcome === "unrecognized") {
    return { status: "unrecognized" };
  }

  return answer.data.outcome === "unsupported"
    ? { status: "unsupported" }
    : draftOf(answer.data, context);
}
