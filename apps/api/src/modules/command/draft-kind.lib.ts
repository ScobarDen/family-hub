import { z } from "zod";

import {
  careEntryChange,
  eventChange,
  reminderChange,
  type CareDetails,
  type CommandDraft,
  type CommandKind,
  type DraftRefusal,
} from "@family-hub/contract";
import { momentOfPhrase, type Phrase } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";

import type { CommandDependencies } from "./command.types.ts";

export type Creation =
  | { status: "created"; id: string }
  | { status: "refused"; refusal: DraftRefusal };

export type CommandRecords = Pick<CommandDependencies, "reminders" | "events" | "careEntries">;

type Confirmation<Draft> = { membership: Membership; draft: Draft; phrase: Phrase };

type DraftOf<Kind extends CommandKind> = Extract<CommandDraft, { kind: Kind }>;

type DraftKind<Draft> = {
  emoji: (draft: Draft) => string;
  withCandidate: (draft: Draft, chosenId: string) => Draft | undefined;
  create: (records: CommandRecords, confirmation: Confirmation<Draft>) => Promise<Creation>;
};

type Saved = { status: string; id: string | undefined };

type DraftKindParts<Draft, Change> = {
  emoji: (draft: Draft) => string;
  withCandidate?: (draft: Draft, chosenId: string) => Draft;
  changeOf: (draft: Draft, phrase: Phrase) => z.ZodSafeParseResult<Change>;
  save: (
    records: CommandRecords,
    request: { membership: Membership; change: Change },
  ) => Promise<Saved>;
};

const refusalsByStatus: Partial<Record<string, DraftRefusal>> = {
  "recipients-not-allowed": "RECIPIENTS_NOT_ALLOWED",
  "pet-not-found": "PET_NOT_FOUND",
  archived: "PET_ARCHIVED",
};

const careEmoji: Record<CareDetails["kind"], string> = {
  vaccination: "💉",
  treatment: "💊",
  vet_visit: "🩺",
  weight: "⚖️",
  expense: "💸",
  note: "📝",
};

// The Care Entry use case also derives the Due Date's key, so the entry closes the one before.
const careEntryCreation = z.object({ petId: z.string(), change: careEntryChange });

// «Создать» goes through the same use case as the Mini App form of the draft's kind.
function draftKind<Draft, Change>(parts: DraftKindParts<Draft, Change>): DraftKind<Draft> {
  return {
    emoji: parts.emoji,
    withCandidate: (draft, chosenId) => parts.withCandidate?.(draft, chosenId),
    create: async (records, { membership, draft, phrase }) => {
      const change = parts.changeOf(draft, phrase);

      if (!change.success) {
        return { status: "refused", refusal: "INVALID_REQUEST" };
      }

      const { status, id } = await parts.save(records, { membership, change: change.data });

      return status === "ok" && id !== undefined
        ? { status: "created", id }
        : { status: "refused", refusal: refusalsByStatus[status] ?? "INVALID_REQUEST" };
    },
  };
}

// Picking a candidate settles one ambiguity: a Member joins the Recipients, a Pet becomes the one;
// an Event refers to nobody, so it has no candidates.
const draftKinds: { [Kind in CommandKind]: DraftKind<DraftOf<Kind>> } = {
  reminder: draftKind({
    emoji: () => "⏰",
    withCandidate: (draft, chosenId) => ({
      ...draft,
      recipientIds: [...(draft.recipientIds ?? []), chosenId],
    }),
    changeOf: (draft, { timeZone }) =>
      reminderChange.safeParse({
        text: draft.text,
        start: { date: draft.date, time: draft.time, timeZone },
        recurrence: draft.recurrence,
        visibility: draft.visibility,
        recipientIds: draft.recipientIds,
      }),
    save: async ({ reminders }, { membership, change }) => {
      const result = await reminders.create(membership, change);

      return { status: result.status, id: result.reminder?.id };
    },
  }),
  event: draftKind({
    emoji: () => "📅",
    // An all-day Event keeps a floating date; a timed one is a moment in the phrase's zone.
    changeOf: (draft, { timeZone }) =>
      eventChange.safeParse({
        title: draft.title,
        note: draft.note,
        start: {
          date: draft.date,
          time: draft.time,
          timeZone: draft.time === null ? null : timeZone,
        },
        end: draft.endDate === null ? null : { date: draft.endDate, time: draft.endTime },
        recurrence: draft.recurrence,
        visibility: draft.visibility,
        reminderOffsets: draft.reminderOffsets,
      }),
    save: async ({ events }, { membership, change }) => {
      const result = await events.create(membership, change);

      return { status: result.status, id: result.event?.id };
    },
  }),
  care_entry: draftKind({
    emoji: ({ details }) => (details === null ? "🐾" : careEmoji[details.kind]),
    withCandidate: (draft, chosenId) => ({ ...draft, petId: chosenId }),
    changeOf: (draft, phrase) =>
      careEntryCreation.safeParse({
        petId: draft.petId,
        change: {
          occurredAt: momentOfPhrase(draft, phrase),
          note: draft.note,
          details: draft.details,
          photoIds: [],
        },
      }),
    save: async ({ careEntries }, { membership, change: { petId, change } }) => {
      const result = await careEntries.create(membership, petId, change);

      return { status: result.status, id: result.entry?.id };
    },
  }),
};

function kindOf<Kind extends CommandKind>(draft: DraftOf<Kind>): DraftKind<DraftOf<Kind>> {
  return draftKinds[draft.kind];
}

export function emojiOf(draft: CommandDraft): string {
  return kindOf(draft).emoji(draft);
}

export function withCandidate(draft: CommandDraft, chosenId: string): CommandDraft | undefined {
  return kindOf(draft).withCandidate(draft, chosenId);
}

export async function createRecord(
  records: CommandRecords,
  confirmation: Confirmation<CommandDraft>,
): Promise<Creation> {
  return kindOf(confirmation.draft).create(records, confirmation);
}
