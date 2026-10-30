import { encodeDeepLink } from "@family-hub/contract";

import { httpStatus } from "@/common/errors.lib.ts";
import type { Membership } from "@/modules/auth";
import { BotApiError } from "@/modules/telegram";

import { latenessLimitMs } from "../reminder.lib.ts";
import type { PushText, ReminderDependencies, Source } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { fireAfter, upcoming, zoneOf } from "./schedule.service.ts";
import { sourceOfRow } from "./source.service.ts";

const batchSize = 50;

type Sent = { chatId: number; messageId: number };

type Delivery =
  | { status: "sent"; sent: Sent }
  | { status: "pushed" }
  | { status: "skipped" }
  | { status: "departed" }
  | { status: "rate-limited" };

type Composed = { occurrence: string; timeZone: string; body: string | undefined };

type Sending = {
  row: DispatchRow;
  source: Source;
  recipient: Membership;
  text: string;
  pushText: PushText;
};

async function sendToBot(
  { bot, memberships, clock }: ReminderDependencies,
  { row, source, recipient, text }: Sending,
): Promise<Delivery> {
  const telegramId = recipient.member.telegramId;

  if (!recipient.member.canMessage) {
    return { status: "skipped" };
  }

  try {
    const message = await bot.call("sendMessage", {
      chat_id: telegramId,
      text,
      reply_markup: source.buttons(row.id, row.occurrence ?? ""),
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

// A Push that fails never holds back the row, which the bot may already have delivered. The row's
// id tags it, so the Reminder coming again replaces its earlier Push.
async function pushToDevices(
  { push }: ReminderDependencies,
  { row, source, recipient, pushText }: Sending,
): Promise<number> {
  try {
    return await push.sendTo(recipient.member.id, {
      message: {
        ...pushText,
        text: pushText.title,
        tag: row.id,
        ...(source.deepLink === undefined ? {} : { startParam: encodeDeepLink(source.deepLink) }),
      },
      ...(source.isPressable ? { press: { dispatchId: row.id, occurrence: row.occurrence } } : {}),
    });
  } catch (error) {
    console.error("Push failed", { memberId: recipient.member.id, error });

    return 0;
  }
}

// Under «both» a bot that fails outright still lets the Push through; the row is retried only
// when nothing reached the Member.
async function sendToBotThenPush(
  dependencies: ReminderDependencies,
  sending: Sending,
): Promise<Delivery> {
  let delivery: Delivery;

  try {
    delivery = await sendToBot(dependencies, sending);
  } catch (error) {
    if ((await pushToDevices(dependencies, sending)) > 0) {
      return { status: "pushed" };
    }

    throw error;
  }

  if (delivery.status === "rate-limited") {
    return delivery;
  }

  const pushed = await pushToDevices(dependencies, sending);

  return delivery.status === "skipped" && pushed > 0 ? { status: "pushed" } : delivery;
}

// The bot goes first, so a 429 releases the row before anything was pushed twice; under «push»
// alone the bot stands in when no Device took the Push.
async function send(dependencies: ReminderDependencies, sending: Sending): Promise<Delivery> {
  const channel = sending.recipient.member.reminderChannel;

  if (channel === "push") {
    return (await pushToDevices(dependencies, sending)) > 0
      ? { status: "pushed" }
      : sendToBot(dependencies, sending);
  }

  return channel === "both"
    ? sendToBotThenPush(dependencies, sending)
    : sendToBot(dependencies, sending);
}

function headlineOf(source: Source, { occurrence, timeZone }: Omit<Composed, "body">): string {
  return `${source.emoji} ${source.title(occurrence, timeZone)}`;
}

function textOf(source: Source, composed: Composed): string {
  const headline = headlineOf(source, composed);

  return composed.body === undefined ? headline : `${headline}\n\n${composed.body}`;
}

function pushTextOf(source: Source, composed: Composed): PushText {
  return (
    source.pushOf?.(composed.occurrence, composed.timeZone) ?? {
      title: headlineOf(source, composed),
      body: composed.body ?? "",
    }
  );
}

async function composedOf(
  source: Source,
  { occurrence, timeZone }: Omit<Composed, "body">,
): Promise<Composed | undefined> {
  if (source.compose === undefined) {
    return { occurrence, timeZone, body: undefined };
  }

  const body = await source.compose(occurrence, timeZone);

  return body === undefined ? undefined : { occurrence, timeZone, body };
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

  if (isLate && source.isSkippedWhenLate) {
    return { status: "skipped" };
  }

  const composed = await composedOf(source, { occurrence: row.occurrence ?? "", timeZone });

  return composed === undefined
    ? { status: "skipped" }
    : send(dependencies, {
        row,
        source,
        recipient,
        text: textOf(source, composed),
        pushText: pushTextOf(source, composed),
      });
}

// A pushed Occurrence is remembered like a sent one, so «Готово» elsewhere marks it done and a
// later «Отложить» on the Push cannot bring it back; it has no bot message to edit.
function sentColumnsOf(row: DispatchRow, delivery: Delivery) {
  if (delivery.status === "sent") {
    return { sentOccurrence: row.occurrence, ...delivery.sent, doneAt: null, doneBy: null };
  }

  return delivery.status === "pushed"
    ? { sentOccurrence: row.occurrence, chatId: null, messageId: null, doneAt: null, doneBy: null }
    : {};
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
  const sentColumns = sentColumnsOf(row, delivery);

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
