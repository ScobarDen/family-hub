import type {
  CommandDraft,
  EventDraft,
  EventDraftField,
  EventReminderOffset,
  ReminderDraft,
  ReminderDraftField,
} from "@family-hub/contract";

export type Person = { id: string; name: string };

export type Candidate = { index: number; name: string };

// What the sheet shows of a draft: the same reading of it as the bot's preview.
export type DraftPreview = {
  text: string;
  details: string[];
  missing: string | undefined;
  question: { title: string; candidates: Candidate[] } | undefined;
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

const offsetTitles: Record<EventReminderOffset, string> = {
  "at-start": "в момент начала",
  "15m": "за 15 минут",
  "1h": "за час",
  "1d": "за день",
  "1w": "за неделю",
};

const frequencyTitles = { weekly: "каждую неделю", monthly: "каждый месяц", yearly: "каждый год" };

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

function recipientsOf(draft: ReminderDraft, people: Person[]): string {
  if (draft.visibility === "private") {
    return "только мне";
  }

  const chosen =
    draft.recipientIds === null
      ? people
      : people.filter(({ id }) => draft.recipientIds?.includes(id) === true);

  return chosen.map(({ name }) => name).join(", ");
}

function questionOf(draft: CommandDraft, people: Person[]): DraftPreview["question"] {
  const ambiguity = draft.ambiguities[0];

  return (
    ambiguity && {
      title: `Кого вы имели в виду под «${ambiguity.mention}»?`,
      candidates: ambiguity.candidateIds.map((id, index) => ({
        index,
        name: people.find((person) => person.id === id)?.name ?? "…",
      })),
    }
  );
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
    draft.recurrence === null ? "" : frequencyTitles[draft.recurrence.frequency],
    draft.reminderOffsets.length === 0
      ? ""
      : `напомнить ${draft.reminderOffsets.map((offset) => offsetTitles[offset]).join(", ")}`,
    draft.visibility === "private" ? "только мне" : "",
  ];
}

function reminderDetailsOf(draft: ReminderDraft, people: Person[]): string[] {
  return [
    momentOf(draft),
    draft.recurrence === null ? "" : frequencyTitles[draft.recurrence.frequency],
    recipientsOf(draft, people),
  ];
}

function missingOf(draft: CommandDraft): string | undefined {
  const titles =
    draft.kind === "event"
      ? draft.missing.map((field) => eventFieldTitles[field])
      : draft.missing.map((field) => fieldTitles[field]);

  return titles.length === 0 ? undefined : `Не хватает: ${titles.join(", ")}`;
}

export function previewOf(draft: CommandDraft, people: Person[]): DraftPreview {
  const question = questionOf(draft, people);
  const details = draft.kind === "event" ? eventDetailsOf(draft) : reminderDetailsOf(draft, people);

  return {
    text: (draft.kind === "event" ? draft.title : draft.text) ?? "…",
    details: details.filter((detail) => detail !== ""),
    missing: missingOf(draft),
    question,
    canCreate: draft.missing.length === 0 && question === undefined,
  };
}
