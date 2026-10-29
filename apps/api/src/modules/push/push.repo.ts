import { and, eq } from "drizzle-orm";

import { pushSubscriptions, type Db } from "@/modules/db";

export type SubscriptionRow = typeof pushSubscriptions.$inferSelect;

// A subscription belongs to a Member's Device, not to a Family, so it is addressed by memberId.
export function createPushRepo(db: Db) {
  return {
    async save(row: SubscriptionRow): Promise<void> {
      await db
        .insert(pushSubscriptions)
        .values(row)
        .onConflictDoUpdate({
          target: pushSubscriptions.deviceId,
          set: {
            endpoint: row.endpoint,
            p256dh: row.p256dh,
            auth: row.auth,
            createdAt: row.createdAt,
          },
        });
    },

    async remove(memberId: string, deviceId: string): Promise<void> {
      await db
        .delete(pushSubscriptions)
        .where(
          and(eq(pushSubscriptions.deviceId, deviceId), eq(pushSubscriptions.memberId, memberId)),
        );
    },

    listOf: async (memberId: string): Promise<SubscriptionRow[]> =>
      db.select().from(pushSubscriptions).where(eq(pushSubscriptions.memberId, memberId)).all(),
  };
}

export type PushRepo = ReturnType<typeof createPushRepo>;
