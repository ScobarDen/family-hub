import type { InlineKeyboardMarkup } from "@grammyjs/types";

import type { CommandDraft, DraftCreated } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import { ignoringBotErrors } from "@/common/telegram";

import {
  createdText,
  dismissedText,
  failedText,
  picked,
  previewButtons,
  previewText,
} from "../command.lib.ts";
import type { CommandDraftRow } from "../command.repo.ts";
import type { CommandDependencies } from "../command.types.ts";
import { createRecord } from "./creation.service.ts";
import { editLinkOf } from "./draft.service.ts";

export type Press = { row: CommandDraftRow; draft: CommandDraft; membership: Membership };

// A draft decided in the Mini App still has its preview in the bot chat, which follows suit.
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

// Only the Member who said it may act on a draft, and only while it is fresh and undecided.
export async function pressOf(
  dependencies: CommandDependencies,
  { draftId, membership }: { draftId: string; membership: Membership | undefined },
): Promise<Press | "not-yours" | "stale"> {
  const row = await dependencies.drafts.find(draftId);

  if (row === undefined || membership === undefined) {
    return "stale";
  }

  if (row.memberId !== membership.member.id) {
    return "not-yours";
  }

  const isFresh = row.status === "pending" && row.expiresAt > dependencies.clock.now();

  return isFresh && row.payload !== null ? { row, draft: row.payload, membership } : "stale";
}

async function settleCreated(dependencies: CommandDependencies, { row, draft }: Press) {
  await dependencies.drafts.update(row.id, {
    status: "created",
    updatedAt: dependencies.clock.now(),
  });
  await edit(dependencies, {
    row,
    text: `${createdText}: ${previewText(draft, await dependencies.drafts.membersOf(row.familyId))}`,
  });
}

export async function create(
  dependencies: CommandDependencies,
  press: Press,
): Promise<DraftCreated | undefined> {
  const { row, draft } = press;
  const id = await createRecord(dependencies, press);

  if (id === undefined) {
    await dependencies.drafts.update(row.id, {
      status: "failed",
      updatedAt: dependencies.clock.now(),
    });
    await edit(dependencies, { row, text: failedText });

    return undefined;
  }

  await settleCreated(dependencies, press);

  return { kind: draft.kind, id };
}

// The Member fixed the draft in the ordinary form, which created the record itself.
export async function markCreated(dependencies: CommandDependencies, press: Press): Promise<void> {
  await settleCreated(dependencies, press);
}

export async function pick(
  dependencies: CommandDependencies,
  { row, draft }: Press,
  index: number,
): Promise<CommandDraft | undefined> {
  const next = picked(draft, index);

  if (next === undefined) {
    return undefined;
  }

  const people = await dependencies.drafts.membersOf(row.familyId);

  await dependencies.drafts.update(row.id, { payload: next, updatedAt: dependencies.clock.now() });
  await edit(dependencies, {
    row,
    text: previewText(next, people),
    markup: previewButtons(
      { draft: next, draftId: row.id, editLink: await editLinkOf(dependencies, row.id) },
      people,
    ),
  });

  return next;
}

export async function dismiss(dependencies: CommandDependencies, { row }: Press): Promise<void> {
  await dependencies.drafts.update(row.id, {
    status: "dismissed",
    updatedAt: dependencies.clock.now(),
  });
  await edit(dependencies, { row, text: dismissedText });
}
