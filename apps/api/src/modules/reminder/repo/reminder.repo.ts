import { and, asc, eq, inArray, notInArray, or, type SQL } from "drizzle-orm";

import { bindFirst } from "@/common/bind";
import { familyMembers, members, reminderRecipients, reminders, type Db } from "@/common/db";

export type ReminderRow = typeof reminders.$inferSelect;

export type Recipient = { id: string; name: string };

export type ReminderWithRecipients = { reminder: ReminderRow; recipients: Recipient[] };

type ReminderTarget = { familyId: string; reminderId: string };

function target({ familyId, reminderId }: ReminderTarget) {
  return and(eq(reminders.familyId, familyId), eq(reminders.id, reminderId));
}

async function familyMembersOf(db: Db, familyId: string): Promise<Recipient[]> {
  return db
    .select({ id: members.id, name: members.name })
    .from(familyMembers)
    .innerJoin(members, eq(members.id, familyMembers.memberId))
    .where(eq(familyMembers.familyId, familyId))
    .orderBy(asc(familyMembers.createdAt))
    .all();
}

// A Reminder for everyone reaches whoever is in the Family now, so its Recipients are read live.
async function recipientsOf(db: Db, row: ReminderRow): Promise<Recipient[]> {
  if (row.isForEveryone) {
    return familyMembersOf(db, row.familyId);
  }

  return db
    .select({ id: members.id, name: members.name })
    .from(reminderRecipients)
    .innerJoin(members, eq(members.id, reminderRecipients.memberId))
    .innerJoin(
      familyMembers,
      and(
        eq(familyMembers.memberId, reminderRecipients.memberId),
        eq(familyMembers.familyId, reminderRecipients.familyId),
      ),
    )
    .where(
      and(eq(reminderRecipients.familyId, row.familyId), eq(reminderRecipients.reminderId, row.id)),
    )
    .all();
}

async function withRecipients(db: Db, row: ReminderRow): Promise<ReminderWithRecipients> {
  return { reminder: row, recipients: await recipientsOf(db, row) };
}

// A Private Reminder exists only for its owner.
async function visibleRows(db: Db, familyId: string, memberId: string): Promise<ReminderRow[]> {
  return db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.familyId, familyId),
        or(eq(reminders.visibility, "shared"), eq(reminders.ownerMemberId, memberId)),
      ),
    )
    .orderBy(asc(reminders.startDate))
    .all();
}

async function listVisible(db: Db, familyId: string, memberId: string) {
  const rows = await visibleRows(db, familyId, memberId);

  return Promise.all(rows.map(async (row) => withRecipients(db, row)));
}

async function findWhere(db: Db, condition: SQL | undefined) {
  const row = await db.select().from(reminders).where(condition).get();

  return row && withRecipients(db, row);
}

type Saving = { row: typeof reminders.$inferInsert; isNew: boolean };

async function save(db: Db, { row, isNew }: Saving, recipientIds: string[]): Promise<void> {
  const { createdAt: _createdAt, createdBy: _createdBy, ...changed } = row;

  await db.batch([
    isNew
      ? db.insert(reminders).values(row)
      : db
          .update(reminders)
          .set(changed)
          .where(target({ familyId: row.familyId, reminderId: row.id })),
    db
      .delete(reminderRecipients)
      .where(
        and(
          eq(reminderRecipients.familyId, row.familyId),
          eq(reminderRecipients.reminderId, row.id),
        ),
      ),
    ...recipientIds.map((memberId) =>
      db
        .insert(reminderRecipients)
        .values({ reminderId: row.id, familyId: row.familyId, memberId }),
    ),
  ] as const);
}

async function areMembers(db: Db, familyId: string, memberIds: string[]): Promise<boolean> {
  const found = await db
    .select({ memberId: familyMembers.memberId })
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, familyId), inArray(familyMembers.memberId, memberIds)))
    .all();

  return found.length === new Set(memberIds).size;
}

async function removeDepartedRecipients(db: Db, familyId: string): Promise<void> {
  const stayed = db
    .select({ memberId: familyMembers.memberId })
    .from(familyMembers)
    .where(eq(familyMembers.familyId, familyId));

  await db
    .delete(reminderRecipients)
    .where(
      and(
        eq(reminderRecipients.familyId, familyId),
        notInArray(reminderRecipients.memberId, stayed),
      ),
    );
}

export function createReminderRepo(db: Db) {
  return {
    ...bindFirst(db, {
      familyMembersOf,
      listVisible,
      visibleRows,
      save,
      removeDepartedRecipients,
      areMembers,
    }),
    find: async (reminderTarget: ReminderTarget) => findWhere(db, target(reminderTarget)),

    async delete(reminderTarget: ReminderTarget): Promise<void> {
      await db.delete(reminders).where(target(reminderTarget));
    },
  };
}

export type ReminderRepo = ReturnType<typeof createReminderRepo>;
