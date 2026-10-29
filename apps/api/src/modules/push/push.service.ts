import type { PushMessage, PushSubscriptionChange } from "@family-hub/contract";

import { bindFirst } from "@/common/bind.lib.ts";
import type { Clock } from "@/common/clock.lib.ts";
import { deviceLifetimeMs, type Membership } from "@/modules/auth";

import type { PushRepo, SubscriptionRow } from "./push.repo.ts";
import type { PushTransport } from "./push.types.ts";

// Devices are the auth module's; the app wires in its check of a Member's unexpired Device.
type DevicePort = {
  isLive(memberId: string, deviceId: string, usedSince: number): Promise<boolean>;
};

type PushServiceDependencies = {
  subscriptions: PushRepo;
  devices: DevicePort;
  transport: PushTransport;
  clock: Clock;
  publicKey: string;
};

// A push service that fails is logged and counted out; it never stops the other Devices or the bot.
async function isDeliveredTo(
  { transport, subscriptions }: PushServiceDependencies,
  { row, payload }: { row: SubscriptionRow; payload: string },
): Promise<boolean> {
  try {
    const outcome = await transport.send(row, payload);

    if (outcome === "gone") {
      await subscriptions.remove(row.memberId, row.deviceId);
    } else if (outcome === "refused") {
      console.error("Push refused", { deviceId: row.deviceId });
    }

    return outcome === "accepted";
  } catch (error) {
    console.error("Push not sent", { deviceId: row.deviceId, error });

    return false;
  }
}

async function subscribe(
  { devices, subscriptions, clock }: PushServiceDependencies,
  { member }: Membership,
  { deviceId, subscription }: { deviceId: string; subscription: PushSubscriptionChange },
): Promise<"subscribed" | "device-not-found"> {
  if (!(await devices.isLive(member.id, deviceId, clock.now() - deviceLifetimeMs))) {
    return "device-not-found";
  }

  await subscriptions.save({
    deviceId,
    memberId: member.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    createdAt: clock.now(),
  });

  return "subscribed";
}

async function unsubscribe(
  { subscriptions }: PushServiceDependencies,
  { member }: Membership,
  deviceId: string,
): Promise<void> {
  await subscriptions.remove(member.id, deviceId);
}

// Pushes to every Device of the Member and answers how many push services took it.
async function sendTo(
  dependencies: PushServiceDependencies,
  memberId: string,
  message: PushMessage,
): Promise<number> {
  const payload = JSON.stringify(message);
  const rows = await dependencies.subscriptions.listOf(
    memberId,
    dependencies.clock.now() - deviceLifetimeMs,
  );
  const accepted = await Promise.all(
    rows.map(async (row) => isDeliveredTo(dependencies, { row, payload })),
  );

  return accepted.filter(Boolean).length;
}

export function createPushService(dependencies: PushServiceDependencies) {
  return {
    publicKey: () => dependencies.publicKey,
    ...bindFirst(dependencies, { subscribe, unsubscribe, sendTo }),
  };
}

export type PushService = ReturnType<typeof createPushService>;
