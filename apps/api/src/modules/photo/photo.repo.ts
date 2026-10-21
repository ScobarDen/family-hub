import { and, eq } from "drizzle-orm";

import { families, photos, type Db } from "@/common/db";

export type PhotoRow = typeof photos.$inferSelect;

type PhotoTarget = { familyId: string; photoId: string };

export function createPhotoRepo(db: Db) {
  return {
    async channelOf(familyId: string): Promise<number | undefined> {
      const row = await db
        .select({
          channelId: families.photoChannelId,
          isConnected: families.isPhotoChannelConnected,
        })
        .from(families)
        .where(eq(families.id, familyId))
        .get();

      return row?.isConnected === true && row.channelId !== null ? row.channelId : undefined;
    },
    findByUnique: async (familyId: string, fileUniqueId: string) =>
      db
        .select()
        .from(photos)
        .where(and(eq(photos.familyId, familyId), eq(photos.fileUniqueId, fileUniqueId)))
        .get(),
    find: async ({ familyId, photoId }: PhotoTarget): Promise<PhotoRow | undefined> =>
      db
        .select()
        .from(photos)
        .where(and(eq(photos.familyId, familyId), eq(photos.id, photoId)))
        .get(),
    // A signed link names the photo alone; the signature already proves who handed it out.
    findById: async (photoId: string): Promise<PhotoRow | undefined> =>
      db.select().from(photos).where(eq(photos.id, photoId)).get(),

    async add(photo: typeof photos.$inferInsert): Promise<void> {
      await db.insert(photos).values(photo);
    },
    async delete({ familyId, photoId }: PhotoTarget): Promise<void> {
      await db.delete(photos).where(and(eq(photos.familyId, familyId), eq(photos.id, photoId)));
    },
  };
}

export type PhotoRepo = ReturnType<typeof createPhotoRepo>;
