import { and, asc, desc, eq, exists, gte, inArray, isNull, ne, not, notInArray } from "drizzle-orm";

import { bindFirst } from "@/common/bind";
import {
  albumPhotos,
  albumUploadBatches,
  albums,
  careEntries,
  careEntryPhotos,
  members,
  pets,
  photos,
  recipePhotos,
  type Db,
} from "@/common/db";
import { keyOf, newestFirstBy, olderThan, type KeysetPage } from "@/common/keyset";
import { knownPhotoIds } from "@/modules/photo";

export type AlbumRow = typeof albums.$inferSelect;
export type PhotoRow = typeof photos.$inferSelect;
export type PetRow = { id: string; name: string };

type AlbumTarget = { familyId: string; albumId: string };

// «Только альбом» keeps every photo; «альбом и его фото» also deletes those shown nowhere else.
export type AlbumDeletion = "album-only" | "with-photos";

type Adding = AlbumTarget & { photoIds: string[]; memberId: string; batchId: string; now: number };

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

async function latestBatchOf(
  db: Db,
  { familyId, albumId, memberId }: AlbumTarget & { memberId: string },
) {
  return db
    .select({ id: albumUploadBatches.id, lastAddedAt: albumUploadBatches.lastAddedAt })
    .from(albumUploadBatches)
    .where(
      and(
        eq(albumUploadBatches.familyId, familyId),
        eq(albumUploadBatches.albumId, albumId),
        eq(albumUploadBatches.createdBy, memberId),
      ),
    )
    .orderBy(desc(albumUploadBatches.lastAddedAt))
    .get();
}

async function photosNotIn(db: Db, { familyId, albumId, photoIds }: Adding): Promise<string[]> {
  const present = await db
    .select({ photoId: albumPhotos.photoId })
    .from(albumPhotos)
    .where(
      and(
        eq(albumPhotos.familyId, familyId),
        eq(albumPhotos.albumId, albumId),
        inArray(albumPhotos.photoId, photoIds),
      ),
    )
    .all();

  return photoIds.filter((photoId) => !present.some((row) => row.photoId === photoId));
}

// Photos already in the Album stay where they are and leave their batch in place.
async function addPhotos(db: Db, adding: Adding) {
  const { familyId, albumId, memberId, batchId, now } = adding;
  const fresh = await photosNotIn(db, adding);

  if (fresh.length === 0) {
    return;
  }

  await db.batch([
    db
      .insert(albumUploadBatches)
      .values({
        id: batchId,
        familyId,
        albumId,
        lastAddedAt: now,
        createdAt: now,
        createdBy: memberId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: albumUploadBatches.id,
        set: { lastAddedAt: now, updatedAt: now },
      }),
    db
      .insert(albumPhotos)
      .values(
        fresh.map((photoId) => ({
          albumId,
          photoId,
          familyId,
          addedAt: now,
          addedBy: memberId,
          batchId,
        })),
      )
      .onConflictDoNothing(),
  ]);
}

function hasPhotos(db: Db) {
  return exists(
    db
      .select({ batchId: albumPhotos.batchId })
      .from(albumPhotos)
      .where(
        and(
          eq(albumPhotos.familyId, albumUploadBatches.familyId),
          eq(albumPhotos.batchId, albumUploadBatches.id),
        ),
      ),
  );
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

// The Upload Batch goes with its last photo.
async function removePhoto(
  db: Db,
  { familyId, albumId, photoId }: AlbumTarget & { photoId: string },
): Promise<void> {
  const ofPhoto = and(
    eq(albumPhotos.familyId, familyId),
    eq(albumPhotos.albumId, albumId),
    eq(albumPhotos.photoId, photoId),
  );
  const row = await db
    .select({ batchId: albumPhotos.batchId })
    .from(albumPhotos)
    .where(ofPhoto)
    .get();
  const removal = db.delete(albumPhotos).where(ofPhoto);

  if (row?.batchId === undefined || row.batchId === null) {
    await removal;

    return;
  }

  await db.batch([
    removal,
    db
      .delete(albumUploadBatches)
      .where(
        and(
          eq(albumUploadBatches.familyId, familyId),
          eq(albumUploadBatches.id, row.batchId),
          not(hasPhotos(db)),
        ),
      ),
  ]);
}

const batchKeyed = {
  at: albumUploadBatches.lastAddedAt,
  key: keyOf("upload", albumUploadBatches.id),
};

// A batch whose photos were all deleted elsewhere keeps its row and stays out of the Feed.
async function batchesBefore(db: Db, familyId: string, { keyset, limit }: KeysetPage) {
  return db
    .select({
      id: albumUploadBatches.id,
      key: batchKeyed.key,
      albumId: albumUploadBatches.albumId,
      albumTitle: albums.title,
      memberName: members.name,
      lastAddedAt: albumUploadBatches.lastAddedAt,
    })
    .from(albumUploadBatches)
    .innerJoin(albums, eq(albums.id, albumUploadBatches.albumId))
    .innerJoin(members, eq(members.id, albumUploadBatches.createdBy))
    .where(
      and(eq(albumUploadBatches.familyId, familyId), hasPhotos(db), olderThan(batchKeyed, keyset)),
    )
    .orderBy(...newestFirstBy(batchKeyed))
    .limit(limit)
    .all();
}

// shortcut: reads every photo of the page's batches to count them; count in SQL once batches grow
// to hundreds of photos.
async function batchPhotosOf(db: Db, familyId: string, batchIds: string[]) {
  if (batchIds.length === 0) {
    return [];
  }

  return db
    .select({ batchId: albumPhotos.batchId, photo: photos })
    .from(albumPhotos)
    .innerJoin(photos, eq(photos.id, albumPhotos.photoId))
    .where(and(eq(albumPhotos.familyId, familyId), inArray(albumPhotos.batchId, batchIds)))
    .orderBy(asc(albumPhotos.addedAt))
    .all();
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

// A Recipe's photos belong to the Recipe and stay out of «Все фото».
function isAlbumPhoto(db: Db, familyId: string) {
  return and(
    eq(photos.familyId, familyId),
    notInArray(
      photos.id,
      db
        .select({ photoId: recipePhotos.photoId })
        .from(recipePhotos)
        .where(eq(recipePhotos.familyId, familyId)),
    ),
  );
}

async function allPhotosOf(db: Db, familyId: string): Promise<PhotoRow[]> {
  return db.select().from(photos).where(isAlbumPhoto(db, familyId)).all();
}

async function countPhotosSince(db: Db, familyId: string, since: number): Promise<number> {
  return db.$count(photos, and(isAlbumPhoto(db, familyId), gte(photos.createdAt, since)));
}

export function createAlbumRepo(db: Db) {
  return {
    ...bindFirst(db, {
      albumPhotosOf,
      petPhotosOf,
      allPhotos: allPhotosOf,
      countPhotosSince,
      knownPhotoIds,
      delete: deleteAlbum,
      addPhotos,
      removePhoto,
      latestBatchOf,
      batchesBefore,
      batchPhotosOf,
    }),
    albumsOf: async (familyId: string) =>
      db.select().from(albums).where(eq(albums.familyId, familyId)).all(),
    find: async (target: AlbumTarget) => db.select().from(albums).where(ofAlbum(target)).get(),
    petsOf: async (familyId: string): Promise<PetRow[]> =>
      db
        .select({ id: pets.id, name: pets.name })
        .from(pets)
        .where(and(eq(pets.familyId, familyId), isNull(pets.archivedAt)))
        .all(),

    async add(row: typeof albums.$inferInsert): Promise<void> {
      await db.insert(albums).values(row);
    },
    async update(target: AlbumTarget, values: Partial<typeof albums.$inferInsert>): Promise<void> {
      await db.update(albums).set(values).where(ofAlbum(target));
    },
  };
}

export type AlbumRepo = ReturnType<typeof createAlbumRepo>;
