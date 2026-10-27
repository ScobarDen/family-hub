import type {
  CareEntryDraftField,
  CommandDraft,
  CommandKind,
  DraftAmbiguity,
  TaskDraft,
  TaskDraftField,
} from "@family-hub/contract";

import { careDetailsOf, careTitleOf } from "./care-preview.ts";
import { dayOf, momentOf, offsetTitles } from "./wording.ts";

export type FamilyPerson = { id: string; name: string };

// Who a draft may refer to: the Members by name and the Pets in care.
export type FamilyNames = { members: FamilyPerson[]; pets: FamilyPerson[] };

export type Candidate = { index: number; name: string };

// One reading of a draft for the bot and the Mini App alike; the bot adds its emoji on top.
export type DraftPreview = {
  title: string;
  details: string[];
  missing: string | undefined;
  question: { title: string; candidates: Candidate[] } | undefined;
  hint: string | undefined;
  canCreate: boolean;
};

const taskFieldTitles: Record<TaskDraftField, string> = { title: "что за дело" };

const careFieldTitles: Record<CareEntryDraftField, string> = {
  pet: "питомца",
  details: "что записать",
};

const frequencyTitles = { weekly: "каждую неделю", monthly: "каждый месяц", yearly: "каждый год" };

const photoHint = "Фото можно приложить в «Изменить».";

function repeatOf({ recurrence }: TaskDraft): string {
  return recurrence === null ? "" : frequencyTitles[recurrence.frequency];
}

// A Task from a phrase has no Assignees, so its default Recipient is the speaker.
function recipientsOf(draft: TaskDraft, members: FamilyPerson[]): string {
  if (draft.reminderOffsets.length === 0) {
    return "";
  }

  if (draft.visibility === "private" || draft.recipientIds === null) {
    return "напомнить мне";
  }

  const chosen = members.filter(({ id }) => draft.recipientIds?.includes(id) === true);

  return `напомнить: ${chosen.map(({ name }) => name).join(", ")}`;
}

// «сб 17 окт, 12:00 – 14:00», «сб 17 окт, весь день», «пн 1 дек – ср 3 дек».
function whenOf(draft: TaskDraft): string {
  if (draft.date === null) {
    return "без срока";
  }

  const start = draft.time === null ? `${dayOf(draft.date)}, весь день` : momentOf(draft);

  if (draft.endDate === null || (draft.endDate === draft.date && draft.endTime === null)) {
    return start;
  }

  const end =
    draft.endDate === draft.date
      ? (draft.endTime ?? "")
      : momentOf({ date: draft.endDate, time: draft.endTime });

  return `${start} – ${end}`;
}

function taskDetailsOf(draft: TaskDraft, { members, pets }: FamilyNames): string[] {
  return [
    whenOf(draft),
    repeatOf(draft),
    draft.reminderOffsets.map((offset) => offsetTitles[offset]).join(", "),
    recipientsOf(draft, members),
    pets.find(({ id }) => id === draft.petId)?.name ?? "",
    draft.visibility === "private" ? "только мне" : "",
  ];
}

type KindPreview<Draft> = {
  title(draft: Draft): string;
  details(draft: Draft, names: FamilyNames): string[];
  missing(draft: Draft): string[];
  hint: string | undefined;
};

type DraftOf<Kind extends CommandKind> = Extract<CommandDraft, { kind: Kind }>;

const kindPreviews: { [Kind in CommandKind]: KindPreview<DraftOf<Kind>> } = {
  task: {
    title: ({ title }) => title ?? "…",
    details: taskDetailsOf,
    missing: ({ missing }) => missing.map((field) => taskFieldTitles[field]),
    hint: undefined,
  },
  care_entry: {
    title: ({ details }) => careTitleOf(details),
    details: (draft, { pets }) => careDetailsOf(draft, pets),
    missing: ({ missing }) => missing.map((field) => careFieldTitles[field]),
    hint: photoHint,
  },
};

function kindPreviewOf<Kind extends CommandKind>(draft: DraftOf<Kind>): KindPreview<DraftOf<Kind>> {
  return kindPreviews[draft.kind];
}

function questionTitleOf({ field, mention }: DraftAmbiguity): string {
  if (field === "recipients") {
    return `Кого вы имели в виду под «${mention}»?`;
  }

  return mention === ""
    ? "Для какого питомца?"
    : `Какого питомца вы имели в виду под «${mention}»?`;
}

function questionOf(draft: CommandDraft, names: FamilyNames): DraftPreview["question"] {
  const ambiguity = draft.ambiguities[0];

  if (ambiguity === undefined) {
    return undefined;
  }

  const people = ambiguity.field === "pet" ? names.pets : names.members;

  return {
    title: questionTitleOf(ambiguity),
    candidates: ambiguity.candidateIds.map((id, index) => ({
      index,
      name: people.find((person) => person.id === id)?.name ?? "…",
    })),
  };
}

export function previewOf(draft: CommandDraft, names: FamilyNames): DraftPreview {
  const kind = kindPreviewOf(draft);
  const question = questionOf(draft, names);
  const missing = kind.missing(draft);

  return {
    title: kind.title(draft),
    details: kind.details(draft, names).filter((detail) => detail !== ""),
    missing: missing.length === 0 ? undefined : `Не хватает: ${missing.join(", ")}`,
    question,
    hint: kind.hint,
    canCreate: missing.length === 0 && question === undefined,
  };
}
