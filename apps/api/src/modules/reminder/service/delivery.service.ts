import { httpStatus } from "@/common/errors.lib.ts";
import type { Membership } from "@/modules/auth";
import { BotApiError } from "@/modules/telegram";

import type { Delivered, Due } from "../lib/recipient-reminder.lib.ts";
import type { ReminderDependencies } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { reminderOfRow } from "./recipient-reminder.service.ts";
import { rowReplanned } from "./schedule.service.ts";
import { sourceOfRow } from "./source.service.ts";

const batchSize = 50;

type Delivery = Delivered | { status: "departed" } | { status: "rate-limited" };

type Sending = {
  row: DispatchRow;
  recipient: Membership;
  due: Extract<Due, { status: "send" }>;
};

async function sendToBot(
  { bot, memberships, clock }: ReminderDependencies,
  { row, recipient, due }: Sending,
): Promise<Delivery> {
  const telegramId = recipient.member.telegramId;

  if (!recipient.member.canMessage) {
    return { status: "skipped" };
  }

  try {
    const message = await bot.call("sendMessage", {
      chat_id: telegramId,
      text: due.bot.text,
      reply_markup: due.bot.buttons,
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
  { recipient, due }: Sending,
): Promise<number> {
  try {
    return await push.sendTo(recipient.member.id, due.push);
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

// A Recipient who left without the Family telling us still has rows there; they go now.
async function deliverRow(
  dependencies: ReminderDependencies,
  row: DispatchRow & { occurrence: string },
): Promise<Delivery> {
  const source = await sourceOfRow(dependencies, row);

  if (source === undefined) {
    await dependencies.dispatch.update(row.familyId, row.id, {
      occurrence: null,
      nextFireAt: null,
      lockedUntil: null,
      updatedAt: dependencies.clock.now(),
    });

    return { status: "skipped" };
  }

  const recipient = await dependencies.memberships.findByMemberId(row.memberId);

  if (recipient?.family.id !== row.familyId) {
    await dependencies.dispatch.removeDeparted(row.familyId);

    return { status: "departed" };
  }

  const reminder = await reminderOfRow(dependencies, { row, occurrence: row.occurrence, source });
  const due = await reminder.due();
  const delivery: Delivery =
    due.status === "send"
      ? await send(dependencies, { row, recipient, due })
      : { status: "skipped" };

  if (delivery.status !== "rate-limited" && delivery.status !== "departed") {
    await dependencies.dispatch.update(row.familyId, row.id, reminder.advanced(delivery));
  }

  return delivery;
}

async function deliver(dependencies: ReminderDependencies, row: DispatchRow): Promise<Delivery> {
  const { occurrence } = row;

  if (occurrence === null) {
    await rowReplanned(dependencies, row);

    return { status: "skipped" };
  }

  return deliverRow(dependencies, { ...row, occurrence });
}

// A row that fails for any other reason stays locked until its lock runs out and is tried again
// then, while the rows after it go on.
async function deliverOrLog(
  dependencies: ReminderDependencies,
  row: DispatchRow,
): Promise<Delivery | undefined> {
  try {
    return await deliver(dependencies, row);
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
    const delivery = await deliverOrLog(dependencies, row);

    if (delivery?.status === "rate-limited") {
      await dependencies.dispatch.release(rows.slice(index).map(({ id }) => id));

      return;
    }
  }
}
