import { and, eq, inArray, isNull, ne, notInArray } from "drizzle-orm";

import {
  albumPhotos,
  albums,
  careEntries,
  careEntryPhotos,
  pets,
  photos,
  type Db,
} from "@/common/db";

export type AlbumRow = typeof albums.$inferSelect;
export type PhotoRow = typeof photos.$inferSelect;
export type PetRow = { id: string; name: string };

type AlbumTarget = { familyId: string; albumId: string };

// «Только альбом» keeps every photo; «альбом и его фото» also deletes those shown nowhere else.
export type AlbumDeletion = "album-only" | "with-photos";

type Adding = AlbumTarget & { photoIds: string[]; memberId: string; now: number };

async function albumPhotosOf(db: Db, familyId: string) {
  return db
    .select({ albumId: albumPhotos.albumId, photo: photos })
    .from(albumPhotos)
    .innerJoin(photos, eq(photos.id, albumPhotos.photoId))
    .where(eq(albumPhotos.familyId, familyId))
    .all();
}

// A Pet's automatic Album holds the photos of its Care Entries.
async function petPhotosOf(db: Db, familyId: string) {
  return db
    .selectDistinct({ petId: careEntries.petId, photo: photos })
    .from(careEntryPhotos)
    .innerJoin(careEntries, eq(careEntries.id, careEntryPhotos.careEntryId))
    .innerJoin(photos, eq(photos.id, careEntryPhotos.photoId))
    .where(eq(careEntryPhotos.familyId, familyId))
    .all();
}

async function addPhotos(db: Db, { familyId, albumId, photoIds, memberId, now }: Adding) {
  await db
    .insert(albumPhotos)
    .values(
      photoIds.map((photoId) => ({ albumId, photoId, familyId, addedAt: now, addedBy: memberId })),
    )
    .onConflictDoNothing();
}

// Deleting an Album with its photos keeps those another Album or a Care Entry still shows.
async function deleteOwnPhotos(db: Db, { familyId, albumId }: AlbumTarget): Promise<void> {
  const elsewhere = db
    .select({ photoId: albumPhotos.photoId })
    .from(albumPhotos)
    .where(and(eq(albumPhotos.familyId, familyId), ne(albumPhotos.albumId, albumId)));
  const inEntries = db
    .select({ photoId: careEntryPhotos.photoId })
    .from(careEntryPhotos)
    .where(eq(careEntryPhotos.familyId, familyId));
  const own = db
    .select({ photoId: albumPhotos.photoId })
    .from(albumPhotos)
    .where(and(eq(albumPhotos.familyId, familyId), eq(albumPhotos.albumId, albumId)));

  await db
    .delete(photos)
    .where(
      and(
        eq(photos.familyId, familyId),
        inArray(photos.id, own),
        notInArray(photos.id, elsewhere),
        notInArray(photos.id, inEntries),
      ),
    );
}

async function knownPhotoIds(db: Db, familyId: string, photoIds: string[]): Promise<string[]> {
  const rows = await db
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.familyId, familyId), inArray(photos.id, photoIds)))
    .all();

  return rows.map(({ id }) => id);
}

async function removePhoto(
  db: Db,
  { familyId, albumId, photoId }: AlbumTarget & { photoId: string },
): Promise<void> {
  await db
    .delete(albumPhotos)
    .where(
      and(
        eq(albumPhotos.familyId, familyId),
        eq(albumPhotos.albumId, albumId),
        eq(albumPhotos.photoId, photoId),
      ),
    );
}

function ofAlbum({ familyId, albumId }: AlbumTarget) {
  return and(eq(albums.familyId, familyId), eq(albums.id, albumId));
}

async function deleteAlbum(db: Db, target: AlbumTarget, scope: AlbumDeletion): Promise<void> {
  if (scope === "with-photos") {
    await deleteOwnPhotos(db, target);
  }

  await db.delete(albums).where(ofAlbum(target));
}

export function createAlbumRepo(db: Db) {
  return {
    albumsOf: async (familyId: string) =>
      db.select().from(albums).where(eq(albums.familyId, familyId)).all(),
    find: async (target: AlbumTarget) => db.select().from(albums).where(ofAlbum(target)).get(),
    albumPhotosOf: async (familyId: string) => albumPhotosOf(db, familyId),
    petPhotosOf: async (familyId: string) => petPhotosOf(db, familyId),
    petsOf: async (familyId: string): Promise<PetRow[]> =>
      db
        .select({ id: pets.id, name: pets.name })
        .from(pets)
        .where(and(eq(pets.familyId, familyId), isNull(pets.archivedAt)))
        .all(),
    allPhotos: async (familyId: string) =>
      db.select().from(photos).where(eq(photos.familyId, familyId)).all(),
    knownPhotoIds: async (familyId: string, photoIds: string[]) =>
      knownPhotoIds(db, familyId, photoIds),

    async add(row: typeof albums.$inferInsert): Promise<void> {
      await db.insert(albums).values(row);
    },
    async update(target: AlbumTarget, values: Partial<typeof albums.$inferInsert>): Promise<void> {
      await db.update(albums).set(values).where(ofAlbum(target));
    },
    delete: async (target: AlbumTarget, scope: AlbumDeletion) => deleteAlbum(db, target, scope),
    addPhotos: async (adding: Adding) => addPhotos(db, adding),
    removePhoto: async (target: AlbumTarget & { photoId: string }) => removePhoto(db, target),
  };
}

export type AlbumRepo = ReturnType<typeof createAlbumRepo>;
