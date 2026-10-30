import { and, eq, getTableColumns, gt, ne } from "drizzle-orm";

import { devices, pushSubscriptions, type Db } from "@/modules/db";

export type SubscriptionRow = typeof pushSubscriptions.$inferSelect;

type Keys = Pick<SubscriptionRow, "endpoint" | "p256dh" | "auth" | "createdAt">;

// A subscription belongs to a Member's Device, not to a Family, so it is addressed by memberId.
export function createPushRepo(db: Db) {
  return {
    ...writesOf(db),
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

// One browser is one endpoint: a Device that signs in again in the same browser takes the
// endpoint over, so the browser never gets the same Push twice.
function othersWith(db: Db, { endpoint, deviceId }: { endpoint: string; deviceId: string }) {
  return db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), ne(pushSubscriptions.deviceId, deviceId)));
}

function writesOf(db: Db) {
  return {
    async save(row: SubscriptionRow): Promise<void> {
      const { endpoint, p256dh, auth, createdAt } = row;

      await db.batch([
        othersWith(db, { endpoint, deviceId: row.deviceId }),
        db.insert(pushSubscriptions).values(row).onConflictDoUpdate({
          target: pushSubscriptions.deviceId,
          set: { endpoint, p256dh, auth, createdAt },
        }),
      ]);
    },

    // The old endpoint names the row: the service worker that asks has no session (ADR 0016).
    async rotate(oldEndpoint: string, next: Keys): Promise<boolean> {
      const row = await db
        .select({ deviceId: pushSubscriptions.deviceId })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, oldEndpoint))
        .get();

      if (row === undefined) {
        return false;
      }

      await db.batch([
        othersWith(db, { endpoint: next.endpoint, deviceId: row.deviceId }),
        db.update(pushSubscriptions).set(next).where(eq(pushSubscriptions.deviceId, row.deviceId)),
      ]);

      return true;
    },
  };
}

export type PushRepo = ReturnType<typeof createPushRepo>;
