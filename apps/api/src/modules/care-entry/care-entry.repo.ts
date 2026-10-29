import { and, asc, desc, eq, gte, inArray, isNotNull, lt, sql, type SQL } from "drizzle-orm";

import { bindFirst } from "@/common/bind.lib.ts";
import { keyOf, newestFirstBy, olderThan, type KeysetPage } from "@/common/keyset.lib.ts";
import { careEntries, careEntryPhotos, members, pets, photos, type Db } from "@/modules/db";
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

async function petsOf(db: Db, familyId: string) {
  return db
    .select({
      id: pets.id,
      name: pets.name,
      archivedAt: pets.archivedAt,
      avatarPhotoId: pets.avatarPhotoId,
      birthDate: pets.birthDate,
    })
    .from(pets)
    .where(eq(pets.familyId, familyId))
    .all();
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

const keyed = { at: careEntries.createdAt, key: keyOf("care", careEntries.id) };

async function activityBefore(db: Db, familyId: string, { keyset, limit }: KeysetPage) {
  return db
    .select({
      id: careEntries.id,
      key: keyed.key,
      petId: careEntries.petId,
      details: careEntries.details,
      createdAt: careEntries.createdAt,
      memberName: members.name,
      memberPicture: members.profilePicture,
      petName: pets.name,
    })
    .from(careEntries)
    .innerJoin(members, eq(members.id, careEntries.createdBy))
    .innerJoin(pets, eq(pets.id, careEntries.petId))
    .where(and(eq(careEntries.familyId, familyId), olderThan(keyed, keyset)))
    .orderBy(...newestFirstBy(keyed))
    .limit(limit)
    .all();
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
    ...bindFirst(db, {
      find,
      petOf,
      expenses,
      photosOf,
      knownPhotoIds,
      setPhotos,
      activityBefore,
    }),
    petsOf: async (familyId: string) => petsOf(db, familyId),
    list: async (familyId: string, petId: string) =>
      selectWhere(db, and(eq(careEntries.familyId, familyId), eq(careEntries.petId, petId))),

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
