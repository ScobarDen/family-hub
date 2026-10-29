import type { CallbackQuery } from "@grammyjs/types";

import { ignoringBotErrors } from "@/modules/telegram";

import { notYoursText, parseCallback, staleText, type CommandAction } from "../command.lib.ts";
import type { CommandDependencies } from "../command.types.ts";
import { create, dismiss, pick, pressOf, type Press } from "./decision.service.ts";

async function answer(
  { bot }: CommandDependencies,
  { query, text }: { query: CallbackQuery; text?: string },
) {
  await ignoringBotErrors(bot.call("answerCallbackQuery", { callback_query_id: query.id, text }));
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
    await dismiss(dependencies, press);
  }
}

export async function handleCommandCallback(
  dependencies: CommandDependencies,
  query: CallbackQuery,
): Promise<void> {
  const parsed = parseCallback(query.data);
  const membership = await dependencies.memberships.findByTelegramId(query.from.id);
  const press = parsed && (await pressOf(dependencies, { draftId: parsed.draftId, membership }));

  if (parsed === undefined || press === undefined || typeof press === "string") {
    await answer(dependencies, { query, text: press === "not-yours" ? notYoursText : staleText });

    return;
  }

  await act(dependencies, { press, action: parsed.action, index: parsed.index ?? 0 });

  await answer(dependencies, { query });
}
