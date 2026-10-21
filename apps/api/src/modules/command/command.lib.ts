import type { InlineKeyboardMarkup } from "@grammyjs/types";

import type { CommandDraft, ReminderDraftField } from "@family-hub/contract";

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
].join("\n");
export const unsupportedText = "Такое голосом и текстом не умею — только создать напоминание.";
export const notYoursText = "Это не ваш черновик";
export const staleText = "Черновик устарел";
export const createdText = "✅ Создано";
export const dismissedText = "Отменено";
export const failedText = "Не получилось создать напоминание. Попробуйте в приложении.";

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

function momentOf({ date, time }: CommandDraft): string | undefined {
  const parts = [date === null ? undefined : dayOf(date), time ?? undefined];

  return parts.filter((part) => part !== undefined).join(", ") || undefined;
}

function recipientsOf(draft: CommandDraft, people: FamilyPerson[]): string {
  if (draft.visibility === "private") {
    return "только мне";
  }

  const chosen =
    draft.recipientIds === null
      ? people
      : people.filter(({ id }) => draft.recipientIds?.includes(id) === true);

  return chosen.map(({ name }) => name).join(", ");
}

// «⏰ Оплатить интернет · пт 16 окт, 19:00 · каждый месяц · Денис, Ася»
export function previewText(draft: CommandDraft, people: FamilyPerson[]): string {
  const line = [
    `⏰ ${draft.text ?? "…"}`,
    momentOf(draft),
    draft.recurrence === null ? undefined : frequencyTitles[draft.recurrence.frequency],
    recipientsOf(draft, people),
  ]
    .filter((part) => part !== undefined && part !== "")
    .join(" · ");
  const missing =
    draft.missing.length === 0
      ? undefined
      : `Не хватает: ${draft.missing.map((field) => fieldTitles[field]).join(", ")}. Напишите команду заново целиком.`;
  const ambiguity = draft.ambiguities[0];
  const question =
    ambiguity === undefined ? undefined : `Кого вы имели в виду под «${ambiguity.mention}»?`;

  return [line, missing, question].filter((part) => part !== undefined).join("\n\n");
}

export function previewButtons(
  { draft, draftId }: { draft: CommandDraft; draftId: string },
  people: FamilyPerson[],
): InlineKeyboardMarkup {
  const dismiss = { text: "×", callback_data: `${commandCallbackPrefix}:dismiss:${draftId}` };
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
        [dismiss],
      ],
    };
  }

  return draft.missing.length > 0
    ? { inline_keyboard: [[dismiss]] }
    : {
        inline_keyboard: [
          [
            { text: "Создать", callback_data: `${commandCallbackPrefix}:create:${draftId}` },
            dismiss,
          ],
        ],
      };
}

// Picking a candidate settles one ambiguity: that Member joins the Recipients.
export function picked(draft: CommandDraft, index: number): CommandDraft | undefined {
  const [ambiguity, ...rest] = draft.ambiguities;
  const memberId = ambiguity?.candidateIds[index];

  return memberId === undefined
    ? undefined
    : { ...draft, ambiguities: rest, recipientIds: [...(draft.recipientIds ?? []), memberId] };
}
