import type { CommandOutcome, DraftCreated } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import { failureTexts } from "../command.lib.ts";
import type { CommandDependencies } from "../command.types.ts";
import { create, dismiss, markCreated, pick, pressOf, type Press } from "./decision.service.ts";
import { isOverQuota, outcomeOf, record, type Outcome } from "./draft.service.ts";
import { listen, type Audio } from "./voice.service.ts";

export type DraftRefusal = "not-found";

function outcomeFor(
  outcome: Outcome,
  { draftId, heard }: { draftId: string; heard: string | null },
): CommandOutcome {
  return outcome.status === "draft"
    ? { status: "draft", draftId, heard, draft: outcome.draft }
    : { status: outcome.status, heard, message: failureTexts[outcome.status] };
}

// The microphone in the tab bar: the same pipeline as a voice message to the bot.
export async function commandFromAudio(
  dependencies: CommandDependencies,
  membership: Membership,
  audio: Audio,
): Promise<CommandOutcome> {
  if (await isOverQuota(dependencies, membership)) {
    return { status: "quota", heard: null, message: failureTexts.quota };
  }

  const heard = await listen(dependencies, audio);
  const outcome =
    heard.status === "heard"
      ? await outcomeOf(dependencies, { membership, text: heard.text })
      : heard;
  const draftId = await record(dependencies, {
    membership,
    chatId: null,
    source: "mini_app",
    outcome,
  });

  return outcomeFor(outcome, { draftId, heard: heard.status === "heard" ? heard.text : null });
}

// Someone else's draft is as unknown to the Mini App as one that never existed.
async function pressFor(
  dependencies: CommandDependencies,
  { membership, draftId }: { membership: Membership; draftId: string },
): Promise<Press | undefined> {
  const press = await pressOf(dependencies, { draftId, membership });

  return typeof press === "string" ? undefined : press;
}

export function createMiniAppCommands(dependencies: CommandDependencies) {
  async function withPress<Result>(
    membership: Membership,
    draftId: string,
    act: (press: Press) => Promise<Result>,
  ): Promise<Result | DraftRefusal> {
    const press = await pressFor(dependencies, { membership, draftId });

    return press === undefined ? "not-found" : act(press);
  }

  return {
    botChat: async () => {
      // oxlint-disable-next-line unicorn/no-useless-undefined -- BotApi.call always takes params; getMe has none
      const { username } = await dependencies.bot.call("getMe", undefined);

      return { url: `https://t.me/${username}` };
    },
    fromAudio: async (membership: Membership, audio: Audio) =>
      commandFromAudio(dependencies, membership, audio),
    open: async (membership: Membership, draftId: string) =>
      withPress(membership, draftId, async ({ draft }) =>
        outcomeFor({ status: "draft", draft }, { draftId, heard: null }),
      ),
    create: async (membership: Membership, draftId: string) =>
      withPress(membership, draftId, async (press): Promise<DraftCreated | "failed"> => {
        const created = await create(dependencies, press);

        return created ?? "failed";
      }),
    pick: async (membership: Membership, { draftId, index }: { draftId: string; index: number }) =>
      withPress(membership, draftId, async (press) => {
        const draft = await pick(dependencies, press, index);

        return draft === undefined
          ? "not-found"
          : outcomeFor({ status: "draft", draft }, { draftId, heard: null });
      }),
    dismiss: async (membership: Membership, draftId: string) =>
      withPress(membership, draftId, async (press) => dismiss(dependencies, press)),
    markCreated: async (membership: Membership, draftId: string) =>
      withPress(membership, draftId, async (press) => markCreated(dependencies, press)),
  };
}

export type MiniAppCommands = ReturnType<typeof createMiniAppCommands>;
