import { z } from "zod";

import {
  careEntryDraftField,
  commandAnswer,
  taskDraftField,
  type CareEntryDraft,
  type CareEntryDraftField,
  type CommandAnswer,
  type CommandDraft,
  type CommandKind,
  type DraftAmbiguity,
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

type AnswerOf<Kind extends CommandKind> = Extract<CommandAnswer, { outcome: Kind }>;

// The model may fill a field it also lists as missing; the listing wins.
function absentFieldsOf<Field extends string>(
  fields: Record<Field, unknown> & { missing: Field[] },
  options: readonly Field[],
): Field[] {
  return options.filter((field) => fields[field] === null || fields.missing.includes(field));
}

// Only ids from the Family's list count; a private Task reminds its speaker alone, and an end time
// means nothing without a start time.
function taskDraftOf(answer: AnswerOf<"task">, context: CommandContext): CommandResult {
  const { outcome: _outcome, ...fields } = answer;
  const knownMembers = new Set(context.members.map(({ id }) => id));
  const knownPets = new Set(context.pets.map(({ id }) => id));
  const mentioned = [
    ...(fields.recipientIds ?? []).map((id) => knownMembers.has(id)),
    ...(fields.petId === null ? [] : [knownPets.has(fields.petId)]),
    ...fields.ambiguities.flatMap(({ field, candidateIds }) =>
      candidateIds.map((id) => (field === "pet" ? knownPets : knownMembers).has(id)),
    ),
  ];

  if (mentioned.includes(false)) {
    return { status: "unrecognized" };
  }

  const isPrivate = fields.visibility === "private";

  return {
    status: "draft",
    draft: {
      kind: "task",
      ...fields,
      endTime: fields.endDate !== null && fields.time !== null ? fields.endTime : null,
      recipientIds: isPrivate ? [context.speaker.id] : fields.recipientIds,
      ambiguities: isPrivate
        ? fields.ambiguities.filter(({ field }) => field === "pet")
        : fields.ambiguities,
      missing: absentFieldsOf(fields, taskDraftField.options),
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

function careDraftOf(answer: AnswerOf<"care_entry">, context: CommandContext): CommandResult {
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

type KindReading<Answer> = (answer: Answer, context: CommandContext) => CommandResult;

const kindReadings: { [Kind in CommandKind]: KindReading<AnswerOf<Kind>> } = {
  task: taskDraftOf,
  care_entry: careDraftOf,
};

function kindReadingOf<Kind extends CommandKind>(kind: Kind): KindReading<AnswerOf<Kind>> {
  return kindReadings[kind];
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

  if (answer.data.outcome === "unsupported") {
    return { status: "unsupported" };
  }

  return kindReadingOf(answer.data.outcome)(answer.data, context);
}
