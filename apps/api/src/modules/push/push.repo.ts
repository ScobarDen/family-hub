import { and, eq, getTableColumns, gt } from "drizzle-orm";

import { devices, pushSubscriptions, type Db } from "@/modules/db";

export type SubscriptionRow = typeof pushSubscriptions.$inferSelect;

// A subscription belongs to a Member's Device, not to a Family, so it is addressed by memberId.
export function createPushRepo(db: Db) {
  return {
    ...endpointsOf(db),
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
        .select(getTableColumns(pushSubscriptions))
        .from(pushSubscriptions)
        .innerJoin(devices, eq(devices.id, pushSubscriptions.deviceId))
        .where(and(eq(pushSubscriptions.memberId, memberId), gt(devices.lastUsedAt, usedSince)))
        .all(),
  };
}

function endpointsOf(db: Db) {
  return {
    async endpointOf(memberId: string, deviceId: string): Promise<string | null> {
      const row = await db
        .select({ endpoint: pushSubscriptions.endpoint })
        .from(pushSubscriptions)
        .where(
          and(eq(pushSubscriptions.deviceId, deviceId), eq(pushSubscriptions.memberId, memberId)),
        )
        .get();

      return row?.endpoint ?? null;
    },

    // The old endpoint names the row: the service worker that asks has no session (ADR 0016).
    async rotate(
      oldEndpoint: string,
      next: Pick<SubscriptionRow, "endpoint" | "p256dh" | "auth" | "createdAt">,
    ): Promise<boolean> {
      const rotated = await db
        .update(pushSubscriptions)
        .set(next)
        .where(eq(pushSubscriptions.endpoint, oldEndpoint))
        .returning({ deviceId: pushSubscriptions.deviceId });

      return rotated.length > 0;
    },
  };
}

export type PushRepo = ReturnType<typeof createPushRepo>;
