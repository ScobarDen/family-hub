import type { InlineKeyboardMarkup } from "@grammyjs/types";

import { draftRefusalTexts } from "@family-hub/commands";
import type { CommandDraft, DraftCreated, DraftRefusal } from "@family-hub/contract";
import type { Phrase } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";
import { ignoringBotErrors } from "@/common/telegram";

import { previewText } from "../command-preview.lib.ts";
import { createdText, dismissedText, picked, previewButtons } from "../command.lib.ts";
import type { CommandDraftRow } from "../command.repo.ts";
import type { CommandDependencies } from "../command.types.ts";
import { createRecord } from "../draft-kind.lib.ts";
import { editLinkOf, namesOf, speakerZoneOf } from "./draft.service.ts";

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

async function showDraft(
  dependencies: CommandDependencies,
  { row, draft, note }: { row: CommandDraftRow; draft: CommandDraft; note?: string },
) {
  const names = await namesOf(dependencies, row.familyId);
  const preview = previewText(draft, names);

  await edit(dependencies, {
    row,
    text: note === undefined ? preview : `${preview}\n\n${note}`,
    markup: previewButtons(
      { draft, draftId: row.id, editLink: await editLinkOf(dependencies, row.id) },
      names,
    ),
  });
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

// A draft kept from before zones were stored falls back to the speaker's zone now.
export async function phraseOf(
  dependencies: CommandDependencies,
  { row, membership }: Press,
): Promise<Phrase> {
  return {
    saidAt: row.createdAt,
    timeZone: row.timeZone ?? (await speakerZoneOf(dependencies, membership)),
  };
}

// Also when the Member fixed the draft in the ordinary form, which created the record itself.
export async function markCreated(dependencies: CommandDependencies, { row, draft }: Press) {
  await dependencies.drafts.update(row.id, {
    status: "created",
    updatedAt: dependencies.clock.now(),
  });
  await edit(dependencies, {
    row,
    text: `${createdText}: ${previewText(draft, await namesOf(dependencies, row.familyId))}`,
  });
}

async function createClaimed(dependencies: CommandDependencies, press: Press) {
  try {
    return await createRecord(dependencies, {
      membership: press.membership,
      draft: press.draft,
      phrase: await phraseOf(dependencies, press),
    });
  } catch (error) {
    await reopen(dependencies, press);
    throw error;
  }
}

async function reopen({ drafts, clock }: CommandDependencies, { row }: Press) {
  await drafts.update(row.id, { status: "pending", updatedAt: clock.now() });
}

// A refused draft stays pending, so «Изменить» can still fix what the use case objected to; a
// draft already being created by another press is stale.
export async function create(
  dependencies: CommandDependencies,
  press: Press,
): Promise<DraftCreated | DraftRefusal | "stale"> {
  const { row, draft } = press;

  const claimed = await dependencies.drafts.claimForCreation(row.id, dependencies.clock.now());

  if (claimed === undefined) {
    return "stale";
  }

  const creation = await createClaimed(dependencies, press);

  if (creation.status === "refused") {
    await reopen(dependencies, press);
    await showDraft(dependencies, { row, draft, note: draftRefusalTexts[creation.refusal] });

    return creation.refusal;
  }

  await markCreated(dependencies, press);

  return { kind: draft.kind, id: creation.id };
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

  await dependencies.drafts.update(row.id, { payload: next, updatedAt: dependencies.clock.now() });
  await showDraft(dependencies, { row, draft: next });

  return next;
}

export async function dismiss(dependencies: CommandDependencies, { row }: Press): Promise<void> {
  await dependencies.drafts.update(row.id, {
    status: "dismissed",
    updatedAt: dependencies.clock.now(),
  });
  await edit(dependencies, { row, text: dismissedText });
}
