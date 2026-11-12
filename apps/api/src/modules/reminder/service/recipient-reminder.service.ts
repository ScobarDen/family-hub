import { ignoringBotErrors } from "@/modules/telegram";

import {
  recipientReminder,
  type MessageEdit,
  type RecipientReminder,
} from "../lib/recipient-reminder.lib.ts";
import type { ReminderDependencies, ReminderSource } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { zoneOf } from "./schedule.service.ts";

export async function reminderOfRow(
  dependencies: ReminderDependencies,
  reading: { row: DispatchRow; source: ReminderSource; occurrence: string | null; now: number },
): Promise<RecipientReminder> {
  const { row, source } = reading;

  return recipientReminder({
    ...reading,
    timeZone: await zoneOf(dependencies, { memberId: row.memberId, schedule: source.schedule }),
  });
}

export async function editMessage({ bot }: ReminderDependencies, edit: MessageEdit) {
  await ignoringBotErrors(
    bot.call("editMessageText", {
      chat_id: edit.chatId,
      message_id: edit.messageId,
      text: edit.text,
    }),
  );
}
