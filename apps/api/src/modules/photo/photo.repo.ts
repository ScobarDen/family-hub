import { and, eq, inArray, notInArray } from "drizzle-orm";

import { albumPhotos, careEntryPhotos, pets, photos, recipePhotos, type Db } from "@/modules/db";
import { storageChannelOf } from "@/modules/photo-storage";

export type PhotoRow = typeof photos.$inferSelect;

type PhotoTarget = { familyId: string; photoId: string };

// The ones among the given ids that are the Family's photos; Albums, Care Entries and Recipes link only those.
export async function knownPhotoIds(
  db: Db,
  familyId: string,
  photoIds: string[],
): Promise<string[]> {
  if (photoIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.familyId, familyId), inArray(photos.id, photoIds)))
    .all();

  return rows.map(({ id }) => id);
}

// A Pet Avatar uploaded for the Pet alone goes once nothing shows it; a shared photo stays.
export async function forgetUnheldPhoto(db: Db, { familyId, photoId }: PhotoTarget): Promise<void> {
  const holders = [
    db
      .select({ id: careEntryPhotos.photoId })
      .from(careEntryPhotos)
      .where(and(eq(careEntryPhotos.familyId, familyId), eq(careEntryPhotos.photoId, photoId))),
    db
      .select({ id: albumPhotos.photoId })
      .from(albumPhotos)
      .where(and(eq(albumPhotos.familyId, familyId), eq(albumPhotos.photoId, photoId))),
    db
      .select({ id: recipePhotos.photoId })
      .from(recipePhotos)
      .where(and(eq(recipePhotos.familyId, familyId), eq(recipePhotos.photoId, photoId))),
    db
      .select({ id: pets.avatarPhotoId })
      .from(pets)
      .where(and(eq(pets.familyId, familyId), eq(pets.avatarPhotoId, photoId))),
  ];

  await db
    .delete(photos)
    .where(
      and(
        eq(photos.familyId, familyId),
        eq(photos.id, photoId),
        ...holders.map((holder) => notInArray(photos.id, holder)),
      ),
    );
}

export function createPhotoRepo(db: Db) {
  return {
    async channelOf(familyId: string): Promise<number | undefined> {
      const row = await storageChannelOf(db, familyId);

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
      await db.insert(photos).values(photo).onConflictDoNothing();
    },
    async delete({ familyId, photoId }: PhotoTarget): Promise<void> {
      await db.delete(photos).where(and(eq(photos.familyId, familyId), eq(photos.id, photoId)));
    },
  };
}

export type PhotoRepo = ReturnType<typeof createPhotoRepo>;
