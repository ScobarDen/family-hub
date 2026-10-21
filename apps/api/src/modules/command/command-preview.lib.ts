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

import type { FamilyNames, FamilyPerson } from "./command.repo.ts";

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

const rubles = new Intl.NumberFormat("ru-RU");

// «пт 16 окт» the way the preview in the spec reads, without Intl's commas and dots.
function partOf(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value.replaceAll(".", "") ?? "";
}

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

function eventLines(draft: EventDraft): string[] {
  return [
    `📅 ${draft.title ?? "…"}`,
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
    return "🐾 Запись";
  }

  if (details.kind === "vaccination") {
    return `💉 Прививка «${details.vaccine}»`;
  }

  if (details.kind === "treatment") {
    return `💊 Обработка «${details.target}»`;
  }

  if (details.kind === "vet_visit") {
    return `🩺 ${visitTitleOf(details.reason)}`;
  }

  if (details.kind === "weight") {
    return `⚖️ Вес ${String(details.weightKg).replace(".", ",")} кг`;
  }

  return details.kind === "expense"
    ? `💸 Трата ${rubles.format(details.amount)} ₽ · ${categoryTitles[details.category]}`
    : "📝 Заметка";
}

function careMedicalOf(details: CareDetails | null): string[] {
  if (details === null || !("dueDate" in details)) {
    return [];
  }

  return [
    details.cost === null ? "" : `${rubles.format(details.cost.amount)} ₽`,
    details.dueDate === null ? "" : `следующий срок ${dayOf(details.dueDate)}`,
  ];
}

function careLines(draft: CareEntryDraft, pets: FamilyPerson[]): string[] {
  return [
    careTitleOf(draft.details),
    pets.find(({ id }) => id === draft.petId)?.name ?? "",
    draft.date === null ? "сейчас" : momentOf(draft),
    ...careMedicalOf(draft.details),
  ];
}

function linesOf(draft: CommandDraft, { members, pets }: FamilyNames): string[] {
  if (draft.kind === "care_entry") {
    return careLines(draft, pets);
  }

  return draft.kind === "event"
    ? eventLines(draft)
    : [`⏰ ${draft.text ?? "…"}`, momentOf(draft), repeatOf(draft), recipientsOf(draft, members)];
}

function missingTitlesOf(draft: CommandDraft): string[] {
  if (draft.kind === "care_entry") {
    return draft.missing.map((field) => careFieldTitles[field]);
  }

  return draft.kind === "event"
    ? draft.missing.map((field) => eventFieldTitles[field])
    : draft.missing.map((field) => fieldTitles[field]);
}

export function questionOf({ field, mention }: DraftAmbiguity): string {
  if (field === "recipients") {
    return `Кого вы имели в виду под «${mention}»?`;
  }

  return mention === ""
    ? "Для какого питомца запись?"
    : `Какого питомца вы имели в виду под «${mention}»?`;
}

// «⏰ Оплатить интернет · пт 16 окт, 19:00 · каждый месяц · Денис, Ася»
export function previewText(draft: CommandDraft, names: FamilyNames): string {
  const line = linesOf(draft, names)
    .filter((part) => part !== "")
    .join(" · ");
  const missing =
    draft.missing.length === 0
      ? undefined
      : `Не хватает: ${missingTitlesOf(draft).join(", ")}. Допишите в «Изменить» или скажите команду заново целиком.`;
  const ambiguity = draft.ambiguities[0];
  const question = ambiguity === undefined ? undefined : questionOf(ambiguity);
  const hint = draft.kind === "care_entry" ? photoHint : undefined;

  return [line, missing, question, hint].filter((part) => part !== undefined).join("\n\n");
}
