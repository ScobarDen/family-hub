import { ignoringBotErrors } from "@/modules/telegram";

import {
  recipientReminder,
  type MessageEdit,
  type RecipientReminder,
} from "../lib/recipient-reminder.lib.ts";
import type { ReminderDependencies, ReminderSource } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { zoneOf } from "./schedule.service.ts";

// A row read for one Occurrence on its Recipient's clock.
export async function reminderOfRow(
  dependencies: ReminderDependencies,
  {
    row,
    occurrence,
    source,
  }: { row: DispatchRow; occurrence: string | null; source: ReminderSource },
): Promise<RecipientReminder> {
  return recipientReminder({
    row,
    source,
    occurrence,
    timeZone: await zoneOf(dependencies, { memberId: row.memberId, schedule: source.schedule }),
    now: dependencies.clock.now(),
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
