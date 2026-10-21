import { BotApiError } from "@/common/telegram";

import { fireAfter, latenessLimitMs, reminderButtons, reminderText } from "../reminder.lib.ts";
import type { ReminderDependencies } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import type { ReminderRow } from "../repo/reminder.repo.ts";

const batchSize = 50;
const rateLimitedStatus = 429;
const blockedStatus = 403;

type Sent = { chatId: number; messageId: number };

type Delivery = { status: "sent"; sent: Sent } | { status: "skipped" } | { status: "rate-limited" };

async function send(
  { bot, memberships, clock }: ReminderDependencies,
  { row, reminder, telegramId }: { row: DispatchRow; reminder: ReminderRow; telegramId: number },
): Promise<Delivery> {
  try {
    const message = await bot.call("sendMessage", {
      chat_id: telegramId,
      text: reminderText(reminder.text),
      reply_markup: reminderButtons(row.id),
    });

    return { status: "sent", sent: { chatId: telegramId, messageId: message.message_id } };
  } catch (error) {
    if (!(error instanceof BotApiError)) {
      throw error;
    }

    if (error.errorCode === rateLimitedStatus) {
      return { status: "rate-limited" };
    }

    if (error.errorCode === blockedStatus) {
      await memberships.setCanMessage(row.memberId, false, clock.now());
    }

    return { status: "skipped" };
  }
}

async function attempt(
  dependencies: ReminderDependencies,
  { row, reminder, now }: { row: DispatchRow; reminder: ReminderRow; now: number },
): Promise<Delivery> {
  const isLate = now - (row.nextFireAt ?? now) > latenessLimitMs;
  const recipient = await dependencies.memberships.findByMemberId(row.memberId);

  if (isLate || recipient?.member.canMessage !== true) {
    return { status: "skipped" };
  }

  return send(dependencies, { row, reminder, telegramId: recipient.member.telegramId });
}

// Sent or not, the row moves on to the next Occurrence; the message it sent stays answerable.
async function advance(
  { dispatch, clock }: ReminderDependencies,
  {
    row,
    reminder,
    delivery,
  }: { row: DispatchRow; reminder: ReminderRow | undefined; delivery: Delivery },
): Promise<void> {
  const next =
    reminder === undefined || row.occurrence === null
      ? undefined
      : fireAfter(reminder, row.occurrence);
  const sentColumns =
    delivery.status === "sent"
      ? { sentOccurrence: row.occurrence, ...delivery.sent, doneAt: null, doneBy: null }
      : {};

  await dispatch.update(row.id, {
    occurrence: next?.occurrence ?? null,
    nextFireAt: next?.fireAt ?? null,
    lockedUntil: null,
    updatedAt: clock.now(),
    ...sentColumns,
  });
}

async function deliver(dependencies: ReminderDependencies, row: DispatchRow, now: number) {
  const entry = await dependencies.reminders.findById(row.sourceId);
  const delivery: Delivery =
    entry === undefined
      ? { status: "skipped" }
      : await attempt(dependencies, { row, reminder: entry.reminder, now });

  if (delivery.status !== "rate-limited") {
    await advance(dependencies, { row, reminder: entry?.reminder, delivery });
  }

  return delivery;
}

// A 429 stops the tick: this row and the rest are released for the next one.
export async function deliverDue(dependencies: ReminderDependencies): Promise<void> {
  const now = dependencies.clock.now();
  const rows = await dependencies.dispatch.claimDue({ now, limit: batchSize });

  for (const [index, row] of rows.entries()) {
    const delivery = await deliver(dependencies, row, now);

    if (delivery.status === "rate-limited") {
      await dependencies.dispatch.release(rows.slice(index).map(({ id }) => id));

      return;
    }
  }
}
