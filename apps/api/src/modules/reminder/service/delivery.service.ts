import { BotApiError } from "@/common/telegram";

import { latenessLimitMs } from "../reminder.lib.ts";
import type { ReminderDependencies, Source } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { fireAfter, zoneOf } from "./schedule.service.ts";
import { sourceOfRow } from "./source.service.ts";

const batchSize = 50;
const rateLimitedStatus = 429;
const blockedStatus = 403;

type Sent = { chatId: number; messageId: number };

type Delivery =
  | { status: "sent"; sent: Sent }
  | { status: "skipped" }
  | { status: "departed" }
  | { status: "rate-limited" };

type Sending = { row: DispatchRow; source: Source; telegramId: number; timeZone: string };

async function send(
  { bot, memberships, clock }: ReminderDependencies,
  { row, source, telegramId, timeZone }: Sending,
): Promise<Delivery> {
  const occurrence = row.occurrence ?? "";
  const text =
    source.compose === undefined
      ? `${source.emoji} ${source.title(occurrence, timeZone)}`
      : await source.compose(occurrence, timeZone);

  if (text === undefined) {
    return { status: "skipped" };
  }

  try {
    const message = await bot.call("sendMessage", {
      chat_id: telegramId,
      text,
      reply_markup: source.buttons(row.id),
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

// A Reminder more than 12 hours late moves on without a stale message, except a Due Date.
async function attempt(
  dependencies: ReminderDependencies,
  {
    row,
    source,
    now,
    timeZone,
  }: { row: DispatchRow; source: Source; now: number; timeZone: string },
): Promise<Delivery> {
  const isLate = now - (row.nextFireAt ?? now) > latenessLimitMs;
  const recipient = await dependencies.memberships.findByMemberId(row.memberId);

  if (recipient?.family.id !== row.familyId) {
    return { status: "departed" };
  }

  if ((isLate && source.isSkippedWhenLate) || !recipient.member.canMessage) {
    return { status: "skipped" };
  }

  return send(dependencies, { row, source, telegramId: recipient.member.telegramId, timeZone });
}

// Sent or not, the row moves on to the next Occurrence; the message it sent stays answerable.
async function advance(
  { dispatch, clock }: ReminderDependencies,
  {
    row,
    next,
    delivery,
  }: { row: DispatchRow; next: ReturnType<typeof fireAfter>; delivery: Delivery },
): Promise<void> {
  const sentColumns =
    delivery.status === "sent"
      ? { sentOccurrence: row.occurrence, ...delivery.sent, doneAt: null, doneBy: null }
      : {};

  await dispatch.update(row.familyId, row.id, {
    occurrence: next?.occurrence ?? null,
    nextFireAt: next?.fireAt ?? null,
    lockedUntil: null,
    updatedAt: clock.now(),
    ...sentColumns,
  });
}

async function deliver(dependencies: ReminderDependencies, row: DispatchRow, now: number) {
  const source = await sourceOfRow(dependencies, row);
  const timeZone = await zoneOf(dependencies, { memberId: row.memberId, source });
  const delivery: Delivery =
    source === undefined || row.occurrence === null
      ? { status: "skipped" }
      : await attempt(dependencies, { row, source, now, timeZone });

  // A Recipient who left without the Family telling us still has rows there; they go now.
  if (delivery.status === "departed") {
    await dependencies.dispatch.removeDeparted(row.familyId);
  } else if (delivery.status !== "rate-limited") {
    const next =
      source === undefined || row.occurrence === null
        ? undefined
        : fireAfter(source, { occurrence: row.occurrence, timeZone });

    await advance(dependencies, { row, next, delivery });
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
