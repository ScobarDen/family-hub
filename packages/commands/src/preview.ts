import type {
  CareEntryDraftField,
  CommandDraft,
  CommandKind,
  DraftAmbiguity,
  EventDraft,
  EventDraftField,
  ReminderDraft,
  ReminderDraftField,
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

const reminderFieldTitles: Record<ReminderDraftField, string> = {
  text: "что напомнить",
  date: "дату",
  time: "время",
};

const eventFieldTitles: Record<EventDraftField, string> = {
  title: "что за событие",
  date: "дату",
};

const careFieldTitles: Record<CareEntryDraftField, string> = {
  pet: "питомца",
  details: "что записать",
};

const frequencyTitles = { weekly: "каждую неделю", monthly: "каждый месяц", yearly: "каждый год" };

const photoHint = "Фото можно приложить в «Изменить».";

function repeatOf({ recurrence }: ReminderDraft | EventDraft): string {
  return recurrence === null ? "" : frequencyTitles[recurrence.frequency];
}

function recipientsOf(draft: ReminderDraft, members: FamilyPerson[]): string {
  if (draft.visibility === "private") {
    return "только мне";
  }

  const chosen =
    draft.recipientIds === null
      ? members
      : members.filter(({ id }) => draft.recipientIds?.includes(id) === true);

  return chosen.map(({ name }) => name).join(", ");
}

// «сб 17 окт, 12:00 – 14:00», «сб 17 окт, весь день», «пн 1 дек – ср 3 дек».
function eventMomentOf(draft: EventDraft): string {
  if (draft.date === null) {
    return "";
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

function eventDetailsOf(draft: EventDraft): string[] {
  return [
    eventMomentOf(draft),
    repeatOf(draft),
    draft.reminderOffsets.length === 0
      ? ""
      : `напомнить ${draft.reminderOffsets.map((offset) => offsetTitles[offset]).join(", ")}`,
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
  reminder: {
    title: ({ text }) => text ?? "…",
    details: (draft, { members }) => [
      momentOf(draft),
      repeatOf(draft),
      recipientsOf(draft, members),
    ],
    missing: ({ missing }) => missing.map((field) => reminderFieldTitles[field]),
    hint: undefined,
  },
  event: {
    title: ({ title }) => title ?? "…",
    details: eventDetailsOf,
    missing: ({ missing }) => missing.map((field) => eventFieldTitles[field]),
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
    ? "Для какого питомца запись?"
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
