import type { InlineKeyboardMarkup } from "@grammyjs/types";

import {
  encodeDeepLink,
  type CommandDraft,
  type CommandFailure,
  type EventDraft,
  type EventDraftField,
  type EventReminderOffset,
  type ReminderDraft,
  type ReminderDraftField,
} from "@family-hub/contract";

import type { FamilyPerson } from "./command.repo.ts";

export const commandCallbackPrefix = "cd";

const commandActions = ["create", "dismiss", "pick"] as const;

export type CommandAction = (typeof commandActions)[number];

const callbackPattern = new RegExp(
  `^${commandCallbackPrefix}:(create|dismiss|pick):([^:]+)(?::(\\d+))?$`,
  "u",
);

export const strangerText =
  "Family Hub работает по приглашениям: попросите приглашение у своей семьи.";
export const quotaText =
  "На сегодня команды кончились. Создайте напоминание вручную в приложении — завтра снова можно будет просто написать.";
export const unrecognizedText = [
  "Не понял 🤔 Попробуйте так:",
  "• напомни в пятницу в 19:00 оплатить интернет",
  "• напомни мне завтра в 9 позвонить врачу",
  "• каждый месяц 5-го в 10:00 напоминай про квартплату",
  "• в субботу в 12 груминг Бьюика",
].join("\n");
export const unsupportedText =
  "Такое голосом и текстом не умею — только создать напоминание или событие.";
export const tooLongText = "Слишком длинно — уложитесь в 30 секунд.";
export const unheardText = "Не расслышал, попробуйте ещё раз.";
export const failureTexts: Record<CommandFailure, string> = {
  quota: quotaText,
  unheard: unheardText,
  unrecognized: unrecognizedText,
  unsupported: unsupportedText,
  too_long: tooLongText,
};
export const notYoursText = "Это не ваш черновик";
export const staleText = "Черновик устарел";
export const createdText = "✅ Создано";
export const dismissedText = "Отменено";
export const failedText = "Не получилось создать. Попробуйте в приложении через «Изменить».";

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

export function heardText(phrase: string): string {
  return `🎙 «${phrase}»`;
}

export function parseCallback(data: string | undefined) {
  const match = callbackPattern.exec(data ?? "");
  const [, raw, draftId, index] = match ?? [];
  const action = commandActions.find((each) => each === raw);

  return action === undefined || draftId === undefined
    ? undefined
    : { action, draftId, index: index === undefined ? undefined : Number(index) };
}

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

function recipientsOf(draft: ReminderDraft, people: FamilyPerson[]): string {
  if (draft.visibility === "private") {
    return "только мне";
  }

  const chosen =
    draft.recipientIds === null
      ? people
      : people.filter(({ id }) => draft.recipientIds?.includes(id) === true);

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

function offsetsOf({ reminderOffsets }: EventDraft): string {
  return reminderOffsets.length === 0
    ? ""
    : `напомнить ${reminderOffsets.map((offset) => offsetTitles[offset]).join(", ")}`;
}

function linesOf(draft: CommandDraft, people: FamilyPerson[]): string[] {
  const repeat = draft.recurrence === null ? "" : frequencyTitles[draft.recurrence.frequency];

  return draft.kind === "event"
    ? [
        `📅 ${draft.title ?? "…"}`,
        eventMomentOf(draft),
        repeat,
        offsetsOf(draft),
        draft.visibility === "private" ? "только мне" : "",
      ]
    : [`⏰ ${draft.text ?? "…"}`, momentOf(draft), repeat, recipientsOf(draft, people)];
}

function missingTitlesOf(draft: CommandDraft): string[] {
  return draft.kind === "event"
    ? draft.missing.map((field) => eventFieldTitles[field])
    : draft.missing.map((field) => fieldTitles[field]);
}

// «⏰ Оплатить интернет · пт 16 окт, 19:00 · каждый месяц · Денис, Ася»
export function previewText(draft: CommandDraft, people: FamilyPerson[]): string {
  const line = linesOf(draft, people)
    .filter((part) => part !== "")
    .join(" · ");
  const missing =
    draft.missing.length === 0
      ? undefined
      : `Не хватает: ${missingTitlesOf(draft).join(", ")}. Допишите в «Изменить» или скажите команду заново целиком.`;
  const ambiguity = draft.ambiguities[0];
  const question =
    ambiguity === undefined ? undefined : `Кого вы имели в виду под «${ambiguity.mention}»?`;

  return [line, missing, question].filter((part) => part !== undefined).join("\n\n");
}

// The bot's Main Mini App opens from t.me/<bot>, so the link needs no app short name.
export function editLink(botUsername: string, draftId: string): string {
  const link = new URL(`https://t.me/${botUsername}`);

  link.searchParams.set("startapp", encodeDeepLink({ kind: "cmd", id: draftId }));

  return link.toString();
}

export function previewButtons(
  { draft, draftId, editLink: link }: { draft: CommandDraft; draftId: string; editLink: string },
  people: FamilyPerson[],
): InlineKeyboardMarkup {
  const dismiss = { text: "×", callback_data: `${commandCallbackPrefix}:dismiss:${draftId}` };
  const change = { text: "Изменить", url: link };
  const ambiguity = draft.ambiguities[0];

  if (ambiguity !== undefined) {
    return {
      inline_keyboard: [
        ...ambiguity.candidateIds.map((id, index) => [
          {
            text: people.find((person) => person.id === id)?.name ?? id,
            callback_data: `${commandCallbackPrefix}:pick:${draftId}:${index}`,
          },
        ]),
        [change, dismiss],
      ],
    };
  }

  const create = { text: "Создать", callback_data: `${commandCallbackPrefix}:create:${draftId}` };

  return {
    inline_keyboard: [draft.missing.length > 0 ? [change, dismiss] : [create, change, dismiss]],
  };
}

// Picking a candidate settles one ambiguity: that Member joins the Recipients.
export function picked(draft: CommandDraft, index: number): CommandDraft | undefined {
  if (draft.kind !== "reminder") {
    return undefined;
  }

  const [ambiguity, ...rest] = draft.ambiguities;
  const memberId = ambiguity?.candidateIds[index];

  return memberId === undefined
    ? undefined
    : { ...draft, ambiguities: rest, recipientIds: [...(draft.recipientIds ?? []), memberId] };
}
