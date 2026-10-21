import { z } from "zod";

import {
  careEntryDraftField,
  commandAnswer,
  eventDraftField,
  reminderDraftField,
  type CareEntryDraft,
  type CareEntryDraftField,
  type CommandAnswer,
  type DraftAmbiguity,
  type CommandDraft,
  type EventDraft,
  type EventDraftField,
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

// The model writes the input side: blank optional texts become null only when parsed.
const answerSchema = z.toJSONSchema(commandAnswer, { io: "input" });
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

function missingEventFields(draft: Omit<EventDraft, "kind">): EventDraftField[] {
  return eventDraftField.options.filter(
    (field) => draft[field] === null || draft.missing.includes(field),
  );
}

// An Event refers to nobody, so it has nothing to be ambiguous about.
function eventDraftOf(answer: Extract<CommandAnswer, { outcome: "event" }>): CommandResult {
  const { outcome: _outcome, ...fields } = answer;
  const hasEnd = fields.endDate !== null;

  return {
    status: "draft",
    draft: {
      kind: "event",
      ...fields,
      endTime: hasEnd && fields.time !== null ? fields.endTime : null,
      ambiguities: [],
      missing: missingEventFields(fields),
    },
  };
}

// One Pet in care needs no name; several without one are offered as candidates.
function petChoiceOf(
  fields: Omit<CareEntryDraft, "kind">,
  context: CommandContext,
): { petId: string | null; ambiguities: DraftAmbiguity[] } {
  const ambiguities = fields.ambiguities.filter(({ field }) => field === "pet");
  const [onlyPet, ...others] = context.pets;

  if (fields.petId !== null || ambiguities.length > 0) {
    return { petId: fields.petId, ambiguities };
  }

  if (onlyPet !== undefined && others.length === 0) {
    return { petId: onlyPet.id, ambiguities: [] };
  }

  return {
    petId: null,
    ambiguities:
      others.length === 0
        ? []
        : [{ field: "pet", mention: "", candidateIds: context.pets.map(({ id }) => id) }],
  };
}

function careDraftOf(
  answer: Extract<CommandAnswer, { outcome: "care_entry" }>,
  context: CommandContext,
): CommandResult {
  const { outcome: _outcome, ...fields } = answer;
  const known = new Set(context.pets.map(({ id }) => id));
  const mentioned = [
    ...(fields.petId === null ? [] : [fields.petId]),
    ...fields.ambiguities
      .filter(({ field }) => field === "pet")
      .flatMap(({ candidateIds }) => candidateIds),
  ];

  if (mentioned.some((id) => !known.has(id))) {
    return { status: "unrecognized" };
  }

  const choice = petChoiceOf(fields, context);
  const missing: CareEntryDraftField[] = careEntryDraftField.options.filter((field) =>
    field === "pet"
      ? choice.petId === null && choice.ambiguities.length === 0
      : fields.details === null,
  );

  return { status: "draft", draft: { kind: "care_entry", ...fields, ...choice, missing } };
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

function resultOf(
  answer: Exclude<CommandAnswer, { outcome: "unrecognized" }>,
  context: CommandContext,
): CommandResult {
  if (answer.outcome === "unsupported") {
    return { status: "unsupported" };
  }

  if (answer.outcome === "care_entry") {
    return careDraftOf(answer, context);
  }

  return answer.outcome === "event" ? eventDraftOf(answer) : draftOf(answer, context);
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

  return resultOf(answer.data, context);
}
