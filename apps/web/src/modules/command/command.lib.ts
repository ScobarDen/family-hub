import type { CommandDraft, ReminderDraftField } from "@family-hub/contract";

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

function momentOf({ date, time }: CommandDraft): string {
  return [date === null ? undefined : dayOf(date), time ?? undefined]
    .filter((part) => part !== undefined)
    .join(", ");
}

function recipientsOf(draft: CommandDraft, people: Person[]): string {
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

export function previewOf(draft: CommandDraft, people: Person[]): DraftPreview {
  const question = questionOf(draft, people);

  return {
    text: draft.text ?? "…",
    details: [
      momentOf(draft),
      draft.recurrence === null ? "" : frequencyTitles[draft.recurrence.frequency],
      recipientsOf(draft, people),
    ].filter((detail) => detail !== ""),
    missing:
      draft.missing.length === 0
        ? undefined
        : `Не хватает: ${draft.missing.map((field) => fieldTitles[field]).join(", ")}`,
    question,
    canCreate: draft.missing.length === 0 && question === undefined,
  };
}
