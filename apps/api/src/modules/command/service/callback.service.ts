import type { CallbackQuery, InlineKeyboardMarkup } from "@grammyjs/types";

import { reminderChange, type CommandDraft } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import { ignoringBotErrors } from "@/common/telegram";

import {
  createdText,
  dismissedText,
  failedText,
  notYoursText,
  parseCallback,
  picked,
  previewButtons,
  previewText,
  staleText,
  type CommandAction,
} from "../command.lib.ts";
import type { CommandDraftRow } from "../command.repo.ts";
import type { CommandDependencies } from "../command.types.ts";

type Press = { row: CommandDraftRow; draft: CommandDraft; membership: Membership };

const fallbackTimeZone = "UTC";

async function answer(
  { bot }: CommandDependencies,
  { query, text }: { query: CallbackQuery; text?: string },
) {
  await ignoringBotErrors(bot.call("answerCallbackQuery", { callback_query_id: query.id, text }));
}

async function edit(
  { bot }: CommandDependencies,
  { row, text, markup }: { row: CommandDraftRow; text: string; markup?: InlineKeyboardMarkup },
) {
  if (row.chatId !== null && row.messageId !== null) {
    await ignoringBotErrors(
      bot.call("editMessageText", {
        chat_id: row.chatId,
        message_id: row.messageId,
        text,
        reply_markup: markup,
      }),
    );
  }
}

async function create(dependencies: CommandDependencies, { row, draft, membership }: Press) {
  const timeZone = (await dependencies.drafts.timeZoneOf(membership.member.id)) ?? fallbackTimeZone;
  const change = reminderChange.safeParse({
    text: draft.text,
    start: { date: draft.date, time: draft.time, timeZone },
    recurrence: draft.recurrence,
    visibility: draft.visibility,
    recipientIds: draft.recipientIds,
  });
  const result = change.success
    ? await dependencies.reminders.create(membership, change.data)
    : { status: "invalid" };
  const now = dependencies.clock.now();

  await dependencies.drafts.update(row.id, {
    status: result.status === "ok" ? "created" : "failed",
    updatedAt: now,
  });
  await edit(dependencies, {
    row,
    text:
      result.status === "ok"
        ? `${createdText}: ${previewText(draft, await dependencies.drafts.membersOf(row.familyId))}`
        : failedText,
  });
}

async function pick(dependencies: CommandDependencies, { row, draft }: Press, index: number) {
  const next = picked(draft, index);

  if (next === undefined) {
    return;
  }

  const people = await dependencies.drafts.membersOf(row.familyId);

  await dependencies.drafts.update(row.id, { payload: next, updatedAt: dependencies.clock.now() });
  await edit(dependencies, {
    row,
    text: previewText(next, people),
    markup: previewButtons({ draft: next, draftId: row.id }, people),
  });
}

// Only the Member who said it may act on a draft, and only while it is fresh and undecided.
async function pressOf(
  dependencies: CommandDependencies,
  { draftId, telegramId }: { draftId: string; telegramId: number },
): Promise<Press | "not-yours" | "stale"> {
  const row = await dependencies.drafts.find(draftId);
  const membership = await dependencies.memberships.findByTelegramId(telegramId);

  if (row === undefined || membership === undefined) {
    return "stale";
  }

  if (row.memberId !== membership.member.id) {
    return "not-yours";
  }

  const isFresh = row.status === "pending" && row.expiresAt > dependencies.clock.now();

  return isFresh && row.payload !== null ? { row, draft: row.payload, membership } : "stale";
}

async function act(
  dependencies: CommandDependencies,
  { press, action, index }: { press: Press; action: CommandAction; index: number },
): Promise<void> {
  if (action === "create") {
    await create(dependencies, press);
  } else if (action === "pick") {
    await pick(dependencies, press, index);
  } else {
    await dependencies.drafts.update(press.row.id, {
      status: "dismissed",
      updatedAt: dependencies.clock.now(),
    });
    await edit(dependencies, { row: press.row, text: dismissedText });
  }
}

export async function handleCommandCallback(
  dependencies: CommandDependencies,
  query: CallbackQuery,
): Promise<void> {
  const parsed = parseCallback(query.data);
  const press =
    parsed && (await pressOf(dependencies, { draftId: parsed.draftId, telegramId: query.from.id }));

  if (parsed === undefined || press === undefined || typeof press === "string") {
    await answer(dependencies, { query, text: press === "not-yours" ? notYoursText : staleText });

    return;
  }

  await act(dependencies, { press, action: parsed.action, index: parsed.index ?? 0 });

  await answer(dependencies, { query });
}
