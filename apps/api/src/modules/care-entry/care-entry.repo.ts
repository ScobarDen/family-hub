import { and, asc, desc, eq, gte, inArray, isNotNull, lt, sql, type SQL } from "drizzle-orm";

import { careEntries, careEntryPhotos, members, pets, photos, type Db } from "@/common/db";
import { knownPhotoIds } from "@/modules/photo";

export type CareEntryRow = typeof careEntries.$inferSelect & { authorName: string | null };

type EntryPhotoRow = { careEntryId: string; photo: typeof photos.$inferSelect };

type PhotoLinks = { familyId: string; entryId: string; photoIds: string[] };

type ExpenseQuery = { familyId: string; petId: string; from: number; to: number };

async function selectWhere(db: Db, condition: SQL | undefined): Promise<CareEntryRow[]> {
  const rows = await db
    .select({ entry: careEntries, authorName: members.name })
    .from(careEntries)
    .leftJoin(members, eq(members.id, careEntries.createdBy))
    .where(condition)
    .orderBy(desc(careEntries.occurredAt), desc(sql`${careEntries}.rowid`))
    .all();

  return rows.map(({ entry, authorName }) => ({ ...entry, authorName }));
}

function inFamily(familyId: string, entryId: string) {
  return and(eq(careEntries.familyId, familyId), eq(careEntries.id, entryId));
}

async function find(db: Db, familyId: string, entryId: string) {
  const [row] = await selectWhere(db, inFamily(familyId, entryId));

  return row;
}

async function petOf(db: Db, familyId: string, petId: string) {
  return db
    .select({ id: pets.id, name: pets.name, archivedAt: pets.archivedAt })
    .from(pets)
    .where(and(eq(pets.familyId, familyId), eq(pets.id, petId)))
    .get();
}

async function dueCandidates(db: Db, familyId: string, petId: string) {
  return selectWhere(
    db,
    and(
      eq(careEntries.familyId, familyId),
      eq(careEntries.petId, petId),
      isNotNull(careEntries.dueKey),
    ),
  );
}

async function expenses(db: Db, { familyId, petId, from, to }: ExpenseQuery) {
  return selectWhere(
    db,
    and(
      eq(careEntries.familyId, familyId),
      eq(careEntries.petId, petId),
      isNotNull(careEntries.expenseAmount),
      gte(careEntries.occurredAt, from),
      lt(careEntries.occurredAt, to),
    ),
  );
}

async function photosOf(db: Db, familyId: string, entryIds: string[]): Promise<EntryPhotoRow[]> {
  if (entryIds.length === 0) {
    return [];
  }

  return db
    .select({ careEntryId: careEntryPhotos.careEntryId, photo: photos })
    .from(careEntryPhotos)
    .innerJoin(photos, eq(photos.id, careEntryPhotos.photoId))
    .where(
      and(eq(careEntryPhotos.familyId, familyId), inArray(careEntryPhotos.careEntryId, entryIds)),
    )
    .orderBy(asc(careEntryPhotos.position))
    .all();
}

async function setPhotos(db: Db, { familyId, entryId, photoIds }: PhotoLinks): Promise<void> {
  await db.batch([
    db
      .delete(careEntryPhotos)
      .where(and(eq(careEntryPhotos.familyId, familyId), eq(careEntryPhotos.careEntryId, entryId))),
    ...photoIds.map((photoId, position) =>
      db.insert(careEntryPhotos).values({ careEntryId: entryId, photoId, familyId, position }),
    ),
  ]);
}

export function createCareEntryRepo(db: Db) {
  return {
    list: async (familyId: string, petId: string) =>
      selectWhere(db, and(eq(careEntries.familyId, familyId), eq(careEntries.petId, petId))),
    find: async (familyId: string, entryId: string) => find(db, familyId, entryId),
    petOf: async (familyId: string, petId: string) => petOf(db, familyId, petId),
    dueCandidates: async (familyId: string, petId: string) => dueCandidates(db, familyId, petId),
    expenses: async (query: ExpenseQuery) => expenses(db, query),
    photosOf: async (familyId: string, entryIds: string[]) => photosOf(db, familyId, entryIds),
    knownPhotoIds: async (familyId: string, photoIds: string[]) =>
      knownPhotoIds(db, familyId, photoIds),
    setPhotos: async (links: PhotoLinks) => setPhotos(db, links),

    async add(entry: typeof careEntries.$inferInsert): Promise<void> {
      await db.insert(careEntries).values(entry);
    },

    async update(
      familyId: string,
      entryId: string,
      values: Partial<typeof careEntries.$inferInsert>,
    ): Promise<void> {
      await db.update(careEntries).set(values).where(inFamily(familyId, entryId));
    },

    async delete(familyId: string, entryId: string): Promise<void> {
      await db.delete(careEntries).where(inFamily(familyId, entryId));
    },
  };
}

export type CareEntryRepo = ReturnType<typeof createCareEntryRepo>;
