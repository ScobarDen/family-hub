import type {
  CareDetails,
  CareEntryDraft,
  CareEntryDraftField,
  CommandDraft,
  DraftAmbiguity,
  EventDraft,
  EventDraftField,
  EventReminderOffset,
  ExpenseCategory,
  ReminderDraft,
  ReminderDraftField,
} from "@family-hub/contract";

import { formatRubles } from "@/common/format-money";

export type Person = { id: string; name: string };

// Who a draft may refer to: the Members by name and the Pets in care.
export type FamilyNames = { members: Person[]; pets: Person[] };

export type Candidate = { index: number; name: string };

// What the sheet shows of a draft: the same reading of it as the bot's preview.
export type DraftPreview = {
  text: string;
  details: string[];
  missing: string | undefined;
  question: { title: string; candidates: Candidate[] } | undefined;
  hint: string | undefined;
  canCreate: boolean;
};

const fieldTitles: Record<ReminderDraftField, string> = {
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

const offsetTitles: Record<EventReminderOffset, string> = {
  "at-start": "в момент начала",
  "15m": "за 15 минут",
  "1h": "за час",
  "1d": "за день",
  "1w": "за неделю",
};

const categoryTitles: Record<ExpenseCategory, string> = {
  food: "корм",
  vet: "ветеринар",
  medicine: "лекарства",
  grooming: "груминг",
  toys: "игрушки",
  other: "другое",
};

const frequencyTitles = { weekly: "каждую неделю", monthly: "каждый месяц", yearly: "каждый год" };

const photoHint = "Фото можно приложить в «Изменить».";

const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function partOf(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value.replaceAll(".", "") ?? "";
}

// «пт 16 окт», without Intl's commas and dots.
function dayOf(date: string): string {
  const parts = dayFormat.formatToParts(new Date(`${date}T12:00:00Z`));

  return `${partOf(parts, "weekday")} ${partOf(parts, "day")} ${partOf(parts, "month")}`;
}

function momentOf({ date, time }: { date: string | null; time: string | null }): string {
  return [date === null ? undefined : dayOf(date), time ?? undefined]
    .filter((part) => part !== undefined)
    .join(", ");
}

function repeatOf({ recurrence }: ReminderDraft | EventDraft): string {
  return recurrence === null ? "" : frequencyTitles[recurrence.frequency];
}

function recipientsOf(draft: ReminderDraft, members: Person[]): string {
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
  const start = draft.time === null ? `${momentOf(draft)}, весь день` : momentOf(draft);

  if (draft.date === null) {
    return "";
  }

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

function visitTitleOf(reason: string | null): string {
  return reason === null ? "Визит к ветеринару" : `Визит к ветеринару: ${reason}`;
}

function careTitleOf(details: CareDetails | null): string {
  if (details === null) {
    return "Запись";
  }

  if (details.kind === "vaccination") {
    return `Прививка «${details.vaccine}»`;
  }

  if (details.kind === "treatment") {
    return `Обработка «${details.target}»`;
  }

  if (details.kind === "vet_visit") {
    return visitTitleOf(details.reason);
  }

  if (details.kind === "weight") {
    return `Вес ${String(details.weightKg).replace(".", ",")} кг`;
  }

  return details.kind === "expense"
    ? `Трата ${formatRubles(details.amount)} · ${categoryTitles[details.category]}`
    : "Заметка";
}

function careMedicalOf(details: CareDetails | null): string[] {
  if (details === null || !("dueDate" in details)) {
    return [];
  }

  return [
    details.cost === null ? "" : formatRubles(details.cost.amount),
    details.dueDate === null ? "" : `следующий срок ${dayOf(details.dueDate)}`,
  ];
}

function careDetailsOf(draft: CareEntryDraft, pets: Person[]): string[] {
  return [
    pets.find(({ id }) => id === draft.petId)?.name ?? "",
    draft.date === null ? "сейчас" : momentOf(draft),
    ...careMedicalOf(draft.details),
  ];
}

function detailsOf(draft: CommandDraft, { members, pets }: FamilyNames): string[] {
  if (draft.kind === "care_entry") {
    return careDetailsOf(draft, pets);
  }

  return draft.kind === "event"
    ? eventDetailsOf(draft)
    : [momentOf(draft), repeatOf(draft), recipientsOf(draft, members)];
}

function textOf(draft: CommandDraft): string {
  if (draft.kind === "care_entry") {
    return careTitleOf(draft.details);
  }

  return (draft.kind === "event" ? draft.title : draft.text) ?? "…";
}

function missingTitlesOf(draft: CommandDraft): string[] {
  if (draft.kind === "care_entry") {
    return draft.missing.map((field) => careFieldTitles[field]);
  }

  return draft.kind === "event"
    ? draft.missing.map((field) => eventFieldTitles[field])
    : draft.missing.map((field) => fieldTitles[field]);
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
  const people = ambiguity?.field === "pet" ? names.pets : names.members;

  return (
    ambiguity && {
      title: questionTitleOf(ambiguity),
      candidates: ambiguity.candidateIds.map((id, index) => ({
        index,
        name: people.find((person) => person.id === id)?.name ?? "…",
      })),
    }
  );
}

export function previewOf(draft: CommandDraft, names: FamilyNames): DraftPreview {
  const question = questionOf(draft, names);
  const missing = missingTitlesOf(draft);

  return {
    text: textOf(draft),
    details: detailsOf(draft, names).filter((detail) => detail !== ""),
    missing: missing.length === 0 ? undefined : `Не хватает: ${missing.join(", ")}`,
    question,
    hint: draft.kind === "care_entry" ? photoHint : undefined,
    canCreate: draft.missing.length === 0 && question === undefined,
  };
}
