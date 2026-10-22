import { and, eq } from "drizzle-orm";

import { families, members, type Db } from "@/common/db";

export type ChannelRow = {
  familyId: string;
  familyName: string;
  ownerTelegramId: number;
  channelId: number | null;
  channelTitle: string | null;
  isConnected: boolean | null;
};

type Connection = { familyId: string; channelId: number; channelTitle: string; now: number };

const channelColumns = {
  familyId: families.id,
  familyName: families.name,
  ownerTelegramId: members.telegramId,
  channelId: families.photoChannelId,
  channelTitle: families.photoChannelTitle,
  isConnected: families.isPhotoChannelConnected,
};

function selectChannels(db: Db) {
  return db
    .select(channelColumns)
    .from(families)
    .innerJoin(members, eq(members.id, families.ownerMemberId));
}

export async function storageChannelOf(db: Db, familyId: string): Promise<ChannelRow | undefined> {
  return selectChannels(db).where(eq(families.id, familyId)).get();
}

export function createPhotoStorageRepo(db: Db) {
  return {
    channelOf: async (familyId: string) => storageChannelOf(db, familyId),

    // A channel event names no Family, so the Family is found by the channel it holds.
    connectedTo: async (channelId: number): Promise<ChannelRow | undefined> =>
      selectChannels(db)
        .where(
          and(eq(families.photoChannelId, channelId), eq(families.isPhotoChannelConnected, true)),
        )
        .get(),

    async connect({ familyId, channelId, channelTitle, now }: Connection): Promise<void> {
      await db
        .update(families)
        .set({
          photoChannelId: channelId,
          photoChannelTitle: channelTitle,
          isPhotoChannelConnected: true,
          updatedAt: now,
        })
        .where(eq(families.id, familyId));
    },

    async disconnect(familyId: string, now: number): Promise<void> {
      await db
        .update(families)
        .set({ isPhotoChannelConnected: false, updatedAt: now })
        .where(eq(families.id, familyId));
    },
  };
}

export type PhotoStorageRepo = ReturnType<typeof createPhotoStorageRepo>;
