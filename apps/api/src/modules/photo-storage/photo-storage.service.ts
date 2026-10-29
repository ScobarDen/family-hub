import type { ChatMemberUpdated } from "@grammyjs/types";

import type { PhotoStorage } from "@family-hub/contract";

import type { Clock } from "@/common/clock.lib.ts";
import type { Membership, MembershipRepo } from "@/modules/auth";
import { ignoringBotErrors, type BotApi } from "@/modules/telegram";

import {
  cannotPostText,
  channelChangeOf,
  connectedText,
  disconnectedText,
  storageOf,
  type ChannelChange,
} from "./photo-storage.lib.ts";
import type { PhotoStorageRepo } from "./photo-storage.repo.ts";

type PhotoStorageDependencies = {
  storage: PhotoStorageRepo;
  memberships: MembershipRepo;
  bot: BotApi;
  clock: Clock;
};

async function tell({ bot }: PhotoStorageDependencies, chatId: number, text: string) {
  await ignoringBotErrors(bot.call("sendMessage", { chat_id: chatId, text }));
}

// Only the Family Owner's own act of adding the bot links a channel; anyone else's is ignored.
async function connect(
  dependencies: PhotoStorageDependencies,
  { from }: ChatMemberUpdated,
  change: Extract<ChannelChange, { kind: "admin" }>,
): Promise<void> {
  const membership = await dependencies.memberships.findByTelegramId(from.id);

  if (membership?.isFamilyOwner !== true) {
    return;
  }

  if (!change.canPost) {
    await tell(dependencies, from.id, cannotPostText(change.channelTitle));

    return;
  }

  await dependencies.storage.connect({
    familyId: membership.family.id,
    channelId: change.channelId,
    channelTitle: change.channelTitle,
    now: dependencies.clock.now(),
  });
  await tell(
    dependencies,
    from.id,
    connectedText({ channelTitle: change.channelTitle, familyName: membership.family.name }),
  );
}

async function disconnect(dependencies: PhotoStorageDependencies, channelId: number) {
  const channel = await dependencies.storage.connectedTo(channelId);

  if (!channel) {
    return;
  }

  await dependencies.storage.disconnect(channel.familyId, dependencies.clock.now());
  await tell(
    dependencies,
    channel.ownerTelegramId,
    disconnectedText({ channelTitle: channel.channelTitle ?? "", familyName: channel.familyName }),
  );
}

export function createPhotoStorageService(dependencies: PhotoStorageDependencies) {
  return {
    async status({ family }: Membership): Promise<PhotoStorage> {
      return storageOf(await dependencies.storage.channelOf(family.id));
    },

    async handleChatMember(update: ChatMemberUpdated): Promise<void> {
      const change = channelChangeOf(update);

      if (change?.kind === "admin") {
        await connect(dependencies, update, change);
      } else if (change?.kind === "gone") {
        await disconnect(dependencies, change.channelId);
      }
    },
  };
}

export type PhotoStorageService = ReturnType<typeof createPhotoStorageService>;
