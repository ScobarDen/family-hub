import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";

import {
  albumPhotos,
  albums,
  careEntries,
  careEntryPhotos,
  events,
  familyMembers,
  goalMovements,
  goals,
  members,
  pets,
  photos,
  plans,
  recipeCooks,
  recipePhotos,
  recipes,
  reminders,
  type Db,
} from "@/common/db";

export type FeedEventRow = typeof events.$inferSelect;
export type FeedReminderRow = typeof reminders.$inferSelect;
export type FeedPetRow = typeof pets.$inferSelect;
export type FeedPlanRow = typeof plans.$inferSelect & { completedByName: string | null };
export type FeedDueRow = Pick<
  typeof careEntries.$inferSelect,
  "id" | "petId" | "details" | "dueDate" | "dueKey" | "occurredAt"
>;
export type FeedCareRow = Pick<
  typeof careEntries.$inferSelect,
  "id" | "petId" | "details" | "createdAt"
> & { memberName: string };
export type FeedGoalRow = typeof goals.$inferSelect & { completedByName: string | null };
export type FeedMovementRow = Pick<
  typeof goalMovements.$inferSelect,
  "id" | "goalId" | "kind" | "amount" | "createdAt"
> & { memberName: string };
export type FeedPhotoRow = typeof photos.$inferSelect;
export type FeedEntryPhotoRow = { careEntryId: string; photo: FeedPhotoRow };
export type FeedUploadRow = {
  albumId: string;
  albumTitle: string;
  addedBy: string;
  memberName: string;
  addedAt: number;
  photo: FeedPhotoRow;
};
export type FeedCookRow = {
  id: string;
  recipeId: string;
  title: string;
  cookedAt: number;
  memberName: string;
};
export type FeedRecipePhotoRow = { recipeId: string; photo: FeedPhotoRow };
export type FeedJoinRow = { memberId: string; memberName: string; createdAt: number };

type Viewer = { familyId: string; memberId: string };

function isVisible(table: typeof events | typeof reminders, { familyId, memberId }: Viewer) {
  return and(
    eq(table.familyId, familyId),
    or(eq(table.visibility, "shared"), eq(table.ownerMemberId, memberId)),
  );
}

// Subplans carry no visibility of their own; the feed filters them by their root.
async function plansOf(db: Db, familyId: string): Promise<FeedPlanRow[]> {
  const rows = await db
    .select({ plan: plans, completedByName: members.name })
    .from(plans)
    .leftJoin(members, eq(members.id, plans.completedBy))
    .where(eq(plans.familyId, familyId))
    .all();

  return rows.map(({ plan, completedByName }) => ({ ...plan, completedByName }));
}

async function careBefore(
  db: Db,
  { familyId, before, limit }: { familyId: string; before: number; limit: number },
): Promise<FeedCareRow[]> {
  return db
    .select({
      id: careEntries.id,
      petId: careEntries.petId,
      details: careEntries.details,
      createdAt: careEntries.createdAt,
      memberName: members.name,
    })
    .from(careEntries)
    .innerJoin(members, eq(members.id, careEntries.createdBy))
    .where(and(eq(careEntries.familyId, familyId), lte(careEntries.createdAt, before)))
    .orderBy(desc(careEntries.createdAt), desc(careEntries.id))
    .limit(limit)
    .all();
}

async function duesOf(db: Db, familyId: string): Promise<FeedDueRow[]> {
  return db
    .select({
      id: careEntries.id,
      petId: careEntries.petId,
      details: careEntries.details,
      dueDate: careEntries.dueDate,
      dueKey: careEntries.dueKey,
      occurredAt: careEntries.occurredAt,
    })
    .from(careEntries)
    .where(and(eq(careEntries.familyId, familyId), isNotNull(careEntries.dueKey)))
    .orderBy(desc(careEntries.occurredAt))
    .all();
}

async function joinsOf(db: Db, familyId: string): Promise<FeedJoinRow[]> {
  return db
    .select({
      memberId: familyMembers.memberId,
      memberName: members.name,
      createdAt: familyMembers.createdAt,
    })
    .from(familyMembers)
    .innerJoin(members, eq(members.id, familyMembers.memberId))
    .where(eq(familyMembers.familyId, familyId))
    .all();
}

async function goalsOf(db: Db, familyId: string): Promise<FeedGoalRow[]> {
  const rows = await db
    .select({ goal: goals, completedByName: members.name })
    .from(goals)
    .leftJoin(members, eq(members.id, goals.completedBy))
    .where(eq(goals.familyId, familyId))
    .all();

  return rows.map(({ goal, completedByName }) => ({ ...goal, completedByName }));
}

async function movementsOf(db: Db, familyId: string): Promise<FeedMovementRow[]> {
  return db
    .select({
      id: goalMovements.id,
      goalId: goalMovements.goalId,
      kind: goalMovements.kind,
      amount: goalMovements.amount,
      createdAt: goalMovements.createdAt,
      memberName: members.name,
    })
    .from(goalMovements)
    .innerJoin(members, eq(members.id, goalMovements.memberId))
    .where(eq(goalMovements.familyId, familyId))
    .all();
}

async function entryPhotosOf(
  db: Db,
  familyId: string,
  entryIds: string[],
): Promise<FeedEntryPhotoRow[]> {
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

async function uploadsOf(db: Db, familyId: string): Promise<FeedUploadRow[]> {
  return db
    .select({
      albumId: albumPhotos.albumId,
      albumTitle: albums.title,
      addedBy: albumPhotos.addedBy,
      memberName: members.name,
      addedAt: albumPhotos.addedAt,
      photo: photos,
    })
    .from(albumPhotos)
    .innerJoin(albums, eq(albums.id, albumPhotos.albumId))
    .innerJoin(members, eq(members.id, albumPhotos.addedBy))
    .innerJoin(photos, eq(photos.id, albumPhotos.photoId))
    .where(eq(albumPhotos.familyId, familyId))
    .orderBy(asc(albumPhotos.addedAt))
    .all();
}

async function cooksOf(db: Db, familyId: string): Promise<FeedCookRow[]> {
  return db
    .select({
      id: recipeCooks.id,
      recipeId: recipeCooks.recipeId,
      title: recipes.title,
      cookedAt: recipeCooks.cookedAt,
      memberName: members.name,
    })
    .from(recipeCooks)
    .innerJoin(recipes, eq(recipes.id, recipeCooks.recipeId))
    .innerJoin(members, eq(members.id, recipeCooks.createdBy))
    .where(eq(recipeCooks.familyId, familyId))
    .all();
}

async function recipePhotosOf(db: Db, familyId: string): Promise<FeedRecipePhotoRow[]> {
  return db
    .select({ recipeId: recipePhotos.recipeId, photo: photos })
    .from(recipePhotos)
    .innerJoin(photos, eq(photos.id, recipePhotos.photoId))
    .where(eq(recipePhotos.familyId, familyId))
    .orderBy(asc(recipePhotos.position))
    .all();
}

export function createFeedRepo(db: Db) {
  return {
    events: async (viewer: Viewer) =>
      db.select().from(events).where(isVisible(events, viewer)).all(),
    reminders: async (viewer: Viewer) =>
      db.select().from(reminders).where(isVisible(reminders, viewer)).all(),
    petsInCare: async (familyId: string) =>
      db
        .select()
        .from(pets)
        .where(and(eq(pets.familyId, familyId), isNull(pets.archivedAt)))
        .all(),
    petsOf: async (familyId: string) =>
      db.select().from(pets).where(eq(pets.familyId, familyId)).all(),
    plans: async (familyId: string) => plansOf(db, familyId),
    dues: async (familyId: string) => duesOf(db, familyId),
    careBefore: async (query: { familyId: string; before: number; limit: number }) =>
      careBefore(db, query),
    joins: async (familyId: string) => joinsOf(db, familyId),
    goals: async (familyId: string) => goalsOf(db, familyId),
    entryPhotosOf: async (familyId: string, entryIds: string[]) =>
      entryPhotosOf(db, familyId, entryIds),
    uploadsOf: async (familyId: string) => uploadsOf(db, familyId),
    cooksOf: async (familyId: string) => cooksOf(db, familyId),
    recipePhotosOf: async (familyId: string) => recipePhotosOf(db, familyId),
    movements: async (familyId: string) => movementsOf(db, familyId),

    async timeZoneOf(memberId: string): Promise<string | null> {
      const row = await db
        .select({ timeZone: members.timeZone })
        .from(members)
        .where(eq(members.id, memberId))
        .get();

      return row?.timeZone ?? null;
    },
  };
}

export type FeedRepo = ReturnType<typeof createFeedRepo>;
