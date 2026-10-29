import { and, eq, gt } from "drizzle-orm";

import { devices, pushSubscriptions, type Db } from "@/modules/db";

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

    // An expired Device keeps its row until it signs in again, so its subscription is skipped here.
    listOf: async (memberId: string, usedSince: number): Promise<SubscriptionRow[]> =>
      db
        .select({
          deviceId: pushSubscriptions.deviceId,
          memberId: pushSubscriptions.memberId,
          endpoint: pushSubscriptions.endpoint,
          p256dh: pushSubscriptions.p256dh,
          auth: pushSubscriptions.auth,
          createdAt: pushSubscriptions.createdAt,
        })
        .from(pushSubscriptions)
        .innerJoin(devices, eq(devices.id, pushSubscriptions.deviceId))
        .where(and(eq(pushSubscriptions.memberId, memberId), gt(devices.lastUsedAt, usedSince)))
        .all(),
  };
}

export type PushRepo = ReturnType<typeof createPushRepo>;
