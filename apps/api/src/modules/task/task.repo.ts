import { and, asc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { bindFirst } from "@/common/bind";
import {
  albumPhotos,
  albums,
  familyMembers,
  members,
  pets,
  photos,
  taskAssignees,
  taskCompletions,
  taskRecipients,
  tasks,
  type Db,
} from "@/common/db";
import { keyOf, newestFirstBy, olderThan, type KeysetPage } from "@/common/keyset";

export type TaskRow = typeof tasks.$inferSelect;

export type PersonRow = { id: string; name: string; profilePicture: string | null };

export type CompletionRow = { occurrence: string; at: number; by: string | null };

// A Task as stored with its people and completions, before it is shaped for one viewer.
export type TaskRecord = {
  row: TaskRow;
  assignees: PersonRow[];
  recipients: PersonRow[];
  completions: CompletionRow[];
};

export type TaskTree = { root: TaskRecord; subtasks: TaskRecord[] };

export type PetOfTask = {
  id: string;
  name: string;
  avatarPhotoId: string | null;
  archivedAt: number | null;
};

type Viewer = { familyId: string; memberId: string };

const completers = alias(members, "completers");
const roots = alias(tasks, "roots");

function inFamily(familyId: string, condition: SQL | undefined) {
  return and(eq(tasks.familyId, familyId), condition);
}

function isVisibleRoot(memberId: string) {
  return and(
    isNull(tasks.parentId),
    or(eq(tasks.visibility, "shared"), eq(tasks.ownerMemberId, memberId)),
  );
}

type PeopleTable = typeof taskAssignees | typeof taskRecipients;

async function peopleOf(
  db: Db,
  { familyId, ids, table }: { familyId: string; ids: SQL; table: PeopleTable },
) {
  return db
    .select({
      taskId: table.taskId,
      id: members.id,
      name: members.name,
      profilePicture: members.profilePicture,
    })
    .from(table)
    .innerJoin(members, eq(members.id, table.memberId))
    .where(and(eq(table.familyId, familyId), inArray(table.taskId, ids)))
    .orderBy(asc(members.name))
    .all();
}

// Children are picked by a subquery, not by the ids read before: D1 binds at most 100 parameters.
async function recordsWhere(db: Db, familyId: string, condition: SQL | undefined) {
  const rows = await db
    .select()
    .from(tasks)
    .where(inFamily(familyId, condition))
    .orderBy(asc(tasks.createdAt), asc(sql`${tasks}.rowid`))
    .all();

  if (rows.length === 0) {
    return [];
  }

  const ids = sql`(select ${tasks.id} from ${tasks} where ${inFamily(familyId, condition)})`;
  const [assignees, recipients, completions] = await Promise.all([
    peopleOf(db, { familyId, ids, table: taskAssignees }),
    peopleOf(db, { familyId, ids, table: taskRecipients }),
    db
      .select({
        taskId: taskCompletions.taskId,
        occurrence: taskCompletions.occurrence,
        at: taskCompletions.completedAt,
        by: completers.name,
      })
      .from(taskCompletions)
      .leftJoin(completers, eq(completers.id, taskCompletions.completedBy))
      .where(and(eq(taskCompletions.familyId, familyId), inArray(taskCompletions.taskId, ids)))
      .orderBy(asc(taskCompletions.occurrence))
      .all(),
  ]);

  return rows.map((row): TaskRecord => ({
    row,
    assignees: assignees.filter(({ taskId }) => taskId === row.id),
    recipients: recipients.filter(({ taskId }) => taskId === row.id),
    completions: completions.filter(({ taskId }) => taskId === row.id),
  }));
}

function treesOf(records: TaskRecord[]): TaskTree[] {
  return records
    .filter(({ row }) => row.parentId === null)
    .map((root) => ({
      root,
      subtasks: records.filter(({ row }) => row.parentId === root.row.id),
    }));
}

// A Private Task exists only for its owner, its Subtasks included.
async function listVisible(db: Db, familyId: string, memberId: string): Promise<TaskTree[]> {
  const visibleRoots = db
    .select({ id: roots.id })
    .from(roots)
    .where(
      and(
        eq(roots.familyId, familyId),
        isNull(roots.parentId),
        or(eq(roots.visibility, "shared"), eq(roots.ownerMemberId, memberId)),
      ),
    );
  const records = await recordsWhere(
    db,
    familyId,
    or(isVisibleRoot(memberId), inArray(tasks.parentId, visibleRoots)),
  );

  return treesOf(records);
}

async function findTree(db: Db, familyId: string, taskId: string): Promise<TaskTree | undefined> {
  const records = await recordsWhere(
    db,
    familyId,
    or(and(eq(tasks.id, taskId), isNull(tasks.parentId)), eq(tasks.parentId, taskId)),
  );

  return treesOf(records)[0];
}

async function parentOf(db: Db, familyId: string, taskId: string): Promise<string | undefined> {
  const row = await db
    .select({ parentId: tasks.parentId })
    .from(tasks)
    .where(inFamily(familyId, eq(tasks.id, taskId)))
    .get();

  return row?.parentId ?? undefined;
}

async function areMembers(db: Db, familyId: string, memberIds: string[]): Promise<boolean> {
  if (memberIds.length === 0) {
    return true;
  }

  const found = await db
    .select({ memberId: familyMembers.memberId })
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, familyId), inArray(familyMembers.memberId, memberIds)))
    .all();

  return found.length === new Set(memberIds).size;
}

async function petOf(db: Db, familyId: string, petId: string): Promise<PetOfTask | undefined> {
  return db
    .select({
      id: pets.id,
      name: pets.name,
      avatarPhotoId: pets.avatarPhotoId,
      archivedAt: pets.archivedAt,
    })
    .from(pets)
    .where(and(eq(pets.familyId, familyId), eq(pets.id, petId)))
    .get();
}

type TaskAlbumRow = { id: string; title: string; photos: Array<typeof photos.$inferSelect> };

async function albumOf(
  db: Db,
  { familyId, albumId }: { familyId: string; albumId: string },
): Promise<TaskAlbumRow | undefined> {
  const album = await db
    .select({ id: albums.id, title: albums.title })
    .from(albums)
    .where(and(eq(albums.familyId, familyId), eq(albums.id, albumId)))
    .get();

  if (!album) {
    return undefined;
  }

  const rows = await db
    .select({ photo: photos })
    .from(albumPhotos)
    .innerJoin(photos, eq(photos.id, albumPhotos.photoId))
    .where(and(eq(albumPhotos.familyId, familyId), eq(albumPhotos.albumId, albumId)))
    .all();

  return { ...album, photos: rows.map(({ photo }) => photo) };
}

type Saving = {
  row: typeof tasks.$inferInsert;
  isNew: boolean;
  assigneeIds: string[];
  recipientIds: string[];
};

function peopleRows(table: PeopleTable, row: Saving["row"], memberIds: string[]) {
  return [...new Set(memberIds)].map((memberId) => ({
    table,
    values: { taskId: row.id, familyId: row.familyId, memberId },
  }));
}

function ofTask(table: PeopleTable, { familyId, id }: { familyId: string; id: string }) {
  return and(eq(table.familyId, familyId), eq(table.taskId, id));
}

// The Task, its Assignees and its Recipients are written as one batch.
async function save(db: Db, { row, isNew, assigneeIds, recipientIds }: Saving): Promise<void> {
  const { createdAt: _createdAt, createdBy: _createdBy, ...changed } = row;
  const inserts = [
    ...peopleRows(taskAssignees, row, assigneeIds),
    ...peopleRows(taskRecipients, row, recipientIds),
  ].map(({ table, values }) => db.insert(table).values(values));

  await db.batch([
    isNew
      ? db.insert(tasks).values(row)
      : db
          .update(tasks)
          .set(changed)
          .where(inFamily(row.familyId, eq(tasks.id, row.id))),
    db.delete(taskAssignees).where(ofTask(taskAssignees, row)),
    db.delete(taskRecipients).where(ofTask(taskRecipients, row)),
    ...inserts,
  ]);
}

type Completing = {
  familyId: string;
  taskIds: string[];
  occurrence: string;
  memberId: string;
  now: number;
};

async function complete(
  db: Db,
  { familyId, taskIds, occurrence, memberId, now }: Completing,
): Promise<void> {
  if (taskIds.length > 0) {
    await db
      .insert(taskCompletions)
      .values(
        taskIds.map((taskId) => ({
          taskId,
          familyId,
          occurrence,
          completedAt: now,
          completedBy: memberId,
        })),
      )
      .onConflictDoNothing();
  }
}

async function reopen(
  db: Db,
  { familyId, taskId, occurrence }: { familyId: string; taskId: string; occurrence: string },
): Promise<void> {
  await db
    .delete(taskCompletions)
    .where(
      and(
        eq(taskCompletions.familyId, familyId),
        eq(taskCompletions.taskId, taskId),
        eq(taskCompletions.occurrence, occurrence),
      ),
    );
}

const parentCompletions = alias(taskCompletions, "parent_completions");
const keyed = {
  at: taskCompletions.completedAt,
  key: keyOf("task", sql`${taskCompletions.taskId} || '-' || ${taskCompletions.occurrence}`),
};

// A Subtask is as Private as its root.
function isVisibleCompletion(memberId: string) {
  return or(
    eq(sql`coalesce(${roots.visibility}, ${tasks.visibility})`, "shared"),
    eq(sql`coalesce(${roots.ownerMemberId}, ${tasks.ownerMemberId})`, memberId),
  );
}

// One Activity per Completed Occurrence; the last Subtask completing its Task at the same moment is
// told by the Task's own line.
async function activityBefore(
  db: Db,
  { familyId, memberId }: Viewer,
  { keyset, limit }: KeysetPage,
) {
  return db
    .select({
      key: keyed.key,
      taskId: tasks.id,
      title: tasks.title,
      rootId: roots.id,
      rootTitle: roots.title,
      completedAt: taskCompletions.completedAt,
      memberName: completers.name,
      memberPicture: completers.profilePicture,
    })
    .from(taskCompletions)
    .innerJoin(tasks, eq(tasks.id, taskCompletions.taskId))
    .leftJoin(roots, eq(roots.id, tasks.parentId))
    .leftJoin(
      parentCompletions,
      and(
        eq(parentCompletions.taskId, tasks.parentId),
        eq(parentCompletions.completedAt, taskCompletions.completedAt),
      ),
    )
    .leftJoin(completers, eq(completers.id, taskCompletions.completedBy))
    .where(
      and(
        eq(taskCompletions.familyId, familyId),
        isVisibleCompletion(memberId),
        isNull(parentCompletions.taskId),
        olderThan(keyed, keyset),
      ),
    )
    .orderBy(...newestFirstBy(keyed))
    .limit(limit)
    .all();
}

export function createTaskRepo(db: Db) {
  return {
    ...bindFirst(db, {
      listVisible,
      findTree,
      parentOf,
      areMembers,
      petOf,
      albumOf,
      save,
      complete,
      reopen,
      activityBefore,
    }),

    async update(
      familyId: string,
      taskId: string,
      values: Partial<typeof tasks.$inferInsert>,
    ): Promise<void> {
      await db
        .update(tasks)
        .set(values)
        .where(inFamily(familyId, eq(tasks.id, taskId)));
    },

    async delete(familyId: string, taskId: string): Promise<void> {
      await db.delete(tasks).where(inFamily(familyId, eq(tasks.id, taskId)));
    },
  };
}

export type TaskRepo = ReturnType<typeof createTaskRepo>;
