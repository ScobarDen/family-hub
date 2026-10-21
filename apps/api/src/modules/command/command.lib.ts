import type { InlineKeyboardMarkup } from "@grammyjs/types";

import type { CommandDraft, CommandFailure, DraftAmbiguity } from "@family-hub/contract";

import type { FamilyNames } from "./command.repo.ts";

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
  "• Бьюик весит 12,4",
].join("\n");
export const unsupportedText =
  "Такое голосом и текстом не умею — только создать напоминание, событие или запись питомца.";
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

function candidateNameOf({ field }: DraftAmbiguity, id: string, names: FamilyNames): string {
  const people = field === "pet" ? names.pets : names.members;

  return people.find((person) => person.id === id)?.name ?? id;
}

export function previewButtons(
  { draft, draftId, editLink: link }: { draft: CommandDraft; draftId: string; editLink: string },
  names: FamilyNames,
): InlineKeyboardMarkup {
  const dismiss = { text: "×", callback_data: `${commandCallbackPrefix}:dismiss:${draftId}` };
  const change = { text: "Изменить", url: link };
  const ambiguity = draft.ambiguities[0];

  if (ambiguity !== undefined) {
    return {
      inline_keyboard: [
        ...ambiguity.candidateIds.map((id, index) => [
          {
            text: candidateNameOf(ambiguity, id, names),
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

// Picking a candidate settles one ambiguity: a Member joins the Recipients, a Pet becomes the one.
export function picked(draft: CommandDraft, index: number): CommandDraft | undefined {
  const [ambiguity, ...rest] = draft.ambiguities;
  const chosenId = ambiguity?.candidateIds[index];

  if (chosenId === undefined || draft.kind === "event") {
    return undefined;
  }

  return draft.kind === "care_entry"
    ? { ...draft, ambiguities: rest, petId: chosenId }
    : { ...draft, ambiguities: rest, recipientIds: [...(draft.recipientIds ?? []), chosenId] };
}
