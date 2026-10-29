import { httpStatus } from "@/common/errors.lib.ts";
import { BotApiError } from "@/modules/telegram";

import { latenessLimitMs } from "../reminder.lib.ts";
import type { ReminderDependencies, Source } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { fireAfter, upcoming, zoneOf } from "./schedule.service.ts";
import { sourceOfRow } from "./source.service.ts";

const batchSize = 50;

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
      reply_markup: source.buttons(row.id, occurrence),
    });

    return { status: "sent", sent: { chatId: telegramId, messageId: message.message_id } };
  } catch (error) {
    if (!(error instanceof BotApiError)) {
      throw error;
    }

    if (error.errorCode === httpStatus.tooManyRequests) {
      return { status: "rate-limited" };
    }

    if (error.errorCode === httpStatus.forbidden) {
      await memberships.setCanMessage(row.memberId, false, clock.now());
    } else {
      console.error("Reminder not sent", { dispatchId: row.id, error: error.message });
    }

    return { status: "skipped" };
  }
}

// A Reminder more than 12 hours late moves on without a stale message.
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

// A row with a fire time but no Occurrence was written by a data migration, which cannot tell a
// Recipient's zone: it is planned now instead of sent.
async function plan(
  dependencies: ReminderDependencies,
  { row, source, timeZone }: { row: DispatchRow; source: Source | undefined; timeZone: string },
): Promise<Delivery> {
  const fire = source && upcoming(source, { timeZone, now: dependencies.clock.now() });

  await dependencies.dispatch.update(row.familyId, row.id, {
    occurrence: fire?.occurrence ?? null,
    nextFireAt: fire?.fireAt ?? null,
    lockedUntil: null,
    updatedAt: dependencies.clock.now(),
  });

  return { status: "skipped" };
}

async function deliver(dependencies: ReminderDependencies, row: DispatchRow, now: number) {
  const source = await sourceOfRow(dependencies, row);
  const timeZone = await zoneOf(dependencies, { memberId: row.memberId, source });

  if (row.occurrence === null) {
    return plan(dependencies, { row, source, timeZone });
  }

  const delivery: Delivery =
    source === undefined
      ? { status: "skipped" }
      : await attempt(dependencies, { row, source, now, timeZone });

  // A Recipient who left without the Family telling us still has rows there; they go now.
  if (delivery.status === "departed") {
    await dependencies.dispatch.removeDeparted(row.familyId);
  } else if (delivery.status !== "rate-limited") {
    const next =
      source === undefined
        ? undefined
        : fireAfter(source, { occurrence: row.occurrence, timeZone });

    await advance(dependencies, { row, next, delivery });
  }

  return delivery;
}

// A row that fails for any other reason stays locked until its lock runs out and is tried again
// then, while the rows after it go on.
async function deliverOrLog(
  dependencies: ReminderDependencies,
  row: DispatchRow,
  now: number,
): Promise<Delivery | undefined> {
  try {
    return await deliver(dependencies, row, now);
  } catch (error) {
    console.error("Reminder delivery failed", { dispatchId: row.id, error });

    return undefined;
  }
}

// A 429 stops the tick: this row and the rest are released for the next one.
export async function deliverDue(dependencies: ReminderDependencies): Promise<void> {
  const now = dependencies.clock.now();
  const rows = await dependencies.dispatch.claimDue({ now, limit: batchSize });

  for (const [index, row] of rows.entries()) {
    const delivery = await deliverOrLog(dependencies, row, now);

    if (delivery?.status === "rate-limited") {
      await dependencies.dispatch.release(rows.slice(index).map(({ id }) => id));

      return;
    }
  }
}
