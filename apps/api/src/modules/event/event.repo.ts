import { and, asc, eq, or } from "drizzle-orm";

import { events, type Db } from "@/common/db";

export type EventRow = typeof events.$inferSelect;

type EventTarget = { familyId: string; eventId: string };

function target({ familyId, eventId }: EventTarget) {
  return and(eq(events.familyId, familyId), eq(events.id, eventId));
}

export function createEventRepo(db: Db) {
  return {
    // A Private Event exists only for its owner.
    listVisible: async (familyId: string, memberId: string): Promise<EventRow[]> =>
      db
        .select()
        .from(events)
        .where(
          and(
            eq(events.familyId, familyId),
            or(eq(events.visibility, "shared"), eq(events.ownerMemberId, memberId)),
          ),
        )
        .orderBy(asc(events.startDate))
        .all(),

    find: async (eventTarget: EventTarget): Promise<EventRow | undefined> =>
      db.select().from(events).where(target(eventTarget)).get(),

    async add(event: typeof events.$inferInsert): Promise<void> {
      await db.insert(events).values(event);
    },

    async update(
      eventTarget: EventTarget,
      values: Partial<typeof events.$inferInsert>,
    ): Promise<void> {
      await db.update(events).set(values).where(target(eventTarget));
    },

    async delete(eventTarget: EventTarget): Promise<void> {
      await db.delete(events).where(target(eventTarget));
    },
  };
}

export type EventRepo = ReturnType<typeof createEventRepo>;
