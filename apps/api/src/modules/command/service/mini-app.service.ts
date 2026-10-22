import type { CommandOutcome } from "@family-hub/contract";
import type { Phrase } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";

import { failureTexts } from "../command.lib.ts";
import type { CommandDependencies } from "../command.types.ts";
import {
  create,
  dismiss,
  markCreated,
  phraseOf,
  pick,
  pressOf,
  type Press,
} from "./decision.service.ts";
import { outcomeOf, record, reserve, type Outcome } from "./draft.service.ts";
import { listen, type Audio } from "./voice.service.ts";

export type DraftRefusal = "not-found";

function outcomeFor(
  outcome: Outcome,
  { draftId, heard, phrase }: { draftId: string; heard: string | null; phrase: Phrase },
): CommandOutcome {
  return outcome.status === "draft"
    ? { status: "draft", draftId, heard, draft: outcome.draft, phrase }
    : { status: outcome.status, heard, message: failureTexts[outcome.status] };
}

// The microphone in the tab bar: the same pipeline as a voice message to the bot.
export async function commandFromAudio(
  dependencies: CommandDependencies,
  membership: Membership,
  audio: Audio,
): Promise<CommandOutcome> {
  const reservation = await reserve(dependencies, { membership, chatId: null, source: "mini_app" });

  if (reservation === undefined) {
    return { status: "quota", heard: null, message: failureTexts.quota };
  }

  const heard = await listen(dependencies, audio);
  const outcome =
    heard.status === "heard"
      ? await outcomeOf(dependencies, { membership, text: heard.text })
      : heard;

  await record(dependencies, { reservation, outcome });

  return outcomeFor(outcome, {
    ...reservation,
    heard: heard.status === "heard" ? heard.text : null,
  });
}

// Someone else's draft is as unknown to the Mini App as one that never existed.
async function pressFor(
  dependencies: CommandDependencies,
  { membership, draftId }: { membership: Membership; draftId: string },
): Promise<Press | undefined> {
  const press = await pressOf(dependencies, { draftId, membership });

  return typeof press === "string" ? undefined : press;
}

async function createFromApp(dependencies: CommandDependencies, press: Press) {
  const created = await create(dependencies, press);

  return created === "stale" ? "not-found" : created;
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
    botChat: async () => ({ url: await dependencies.appLinks.chatLink() }),
    fromAudio: async (membership: Membership, audio: Audio) =>
      commandFromAudio(dependencies, membership, audio),
    open: async (membership: Membership, draftId: string) =>
      withPress(membership, draftId, async (press) =>
        outcomeFor(
          { status: "draft", draft: press.draft },
          { draftId, heard: null, phrase: await phraseOf(dependencies, press) },
        ),
      ),
    create: async (membership: Membership, draftId: string) =>
      withPress(membership, draftId, async (press) => createFromApp(dependencies, press)),
    pick: async (membership: Membership, { draftId, index }: { draftId: string; index: number }) =>
      withPress(membership, draftId, async (press) => {
        const draft = await pick(dependencies, press, index);

        return draft === undefined
          ? "not-found"
          : outcomeFor(
              { status: "draft", draft },
              { draftId, heard: null, phrase: await phraseOf(dependencies, press) },
            );
      }),
    dismiss: async (membership: Membership, draftId: string) =>
      withPress(membership, draftId, async (press) => dismiss(dependencies, press)),
    markCreated: async (membership: Membership, draftId: string) =>
      withPress(membership, draftId, async (press) => markCreated(dependencies, press)),
  };
}

export type MiniAppCommands = ReturnType<typeof createMiniAppCommands>;
