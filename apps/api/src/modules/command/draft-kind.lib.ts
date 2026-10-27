import { z } from "zod";

import {
  careEntryChange,
  taskChange,
  type CareDetails,
  type CommandDraft,
  type CommandKind,
  type DraftRefusal,
} from "@family-hub/contract";
import { momentOfPhrase, type Phrase } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";

import type { CommandDependencies } from "./command.types.ts";

type Creation = { status: "created"; id: string } | { status: "refused"; refusal: DraftRefusal };

type CommandRecords = Pick<CommandDependencies, "tasks" | "careEntries">;

type Confirmation<Draft> = { membership: Membership; draft: Draft; phrase: Phrase };

type DraftOf<Kind extends CommandKind> = Extract<CommandDraft, { kind: Kind }>;

type DraftKind<Draft> = {
  emoji: (draft: Draft) => string;
  withCandidate: (draft: Draft, chosenId: string) => Draft | undefined;
  create: (records: CommandRecords, confirmation: Confirmation<Draft>) => Promise<Creation>;
};

type Saved<Refusal extends string> = { status: "ok"; id: string } | { status: Refusal };

type DraftKindParts<Draft, Change, Refusal extends string> = {
  emoji: (draft: Draft) => string;
  withCandidate?: (draft: Draft, chosenId: string) => Draft;
  changeOf: (draft: Draft, phrase: Phrase) => z.ZodSafeParseResult<Change>;
  save: (
    records: CommandRecords,
    request: { membership: Membership; change: Change },
  ) => Promise<Saved<Refusal>>;
  // A status the use case no longer has fails to compile here; one not named is INVALID_REQUEST.
  refusals: Partial<Record<NoInfer<Refusal>, DraftRefusal>>;
};

const careEmoji: Record<CareDetails["kind"], string> = {
  vaccination: "💉",
  treatment: "💊",
  vet_visit: "🩺",
  weight: "⚖️",
  expense: "💸",
  note: "📝",
};

// The Care Entry use case also creates the follow-up Task a repeat date asks for.
const careEntryCreation = z.object({ petId: z.string(), change: careEntryChange });

// «Создать» goes through the same use case as the Mini App form of the draft's kind.
function draftKind<Draft, Change, Refusal extends string>(
  parts: DraftKindParts<Draft, Change, Refusal>,
): DraftKind<Draft> {
  return {
    emoji: parts.emoji,
    withCandidate: (draft, chosenId) => parts.withCandidate?.(draft, chosenId),
    create: async (records, { membership, draft, phrase }) => {
      const change = parts.changeOf(draft, phrase);

      if (!change.success) {
        return { status: "refused", refusal: "INVALID_REQUEST" };
      }

      const saved = await parts.save(records, { membership, change: change.data });

      return "id" in saved
        ? { status: "created", id: saved.id }
        : { status: "refused", refusal: parts.refusals[saved.status] ?? "INVALID_REQUEST" };
    },
  };
}

// Picking a candidate settles one ambiguity: a Member joins the Recipients, a Pet becomes the one.
const draftKinds: { [Kind in CommandKind]: DraftKind<DraftOf<Kind>> } = {
  task: draftKind({
    emoji: (draft) => (draft.reminderOffsets.length > 0 ? "⏰" : "📌"),
    withCandidate: (draft, chosenId) =>
      draft.ambiguities[0]?.field === "pet"
        ? { ...draft, petId: chosenId }
        : { ...draft, recipientIds: [...(draft.recipientIds ?? []), chosenId] },
    // No time keeps a floating date; a time is a moment in the phrase's zone.
    changeOf: (draft, { timeZone }) =>
      taskChange.safeParse({
        title: draft.title,
        note: draft.note,
        when:
          draft.date === null
            ? null
            : {
                date: draft.date,
                time: draft.time,
                timeZone: draft.time === null ? null : timeZone,
                endDate: draft.endDate,
                endTime: draft.endTime,
              },
        recurrence: draft.recurrence,
        recipients: draft.recipientIds ?? "default",
        reminderOffsets: draft.reminderOffsets,
        visibility: draft.visibility,
        petId: draft.petId,
      }),
    save: async ({ tasks }, { membership, change }) => {
      const result = await tasks.create(membership, change);

      return result.status === "ok" ? { status: "ok", id: result.task.id } : result;
    },
    refusals: {
      "recipients-not-allowed": "RECIPIENTS_NOT_ALLOWED",
      "pet-not-found": "PET_NOT_FOUND",
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
          repeatOn: draft.repeatOn,
          note: draft.note,
          details: draft.details,
          photoIds: [],
        },
      }),
    save: async ({ careEntries }, { membership, change: { petId, change } }) => {
      const result = await careEntries.create(membership, petId, change);

      return result.status === "ok" ? { status: "ok", id: result.entry.id } : result;
    },
    refusals: { "pet-not-found": "PET_NOT_FOUND", archived: "PET_ARCHIVED" },
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
