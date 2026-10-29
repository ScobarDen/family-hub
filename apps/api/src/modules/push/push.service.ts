import type { PushMessage, PushSubscriptionChange } from "@family-hub/contract";

import { bindFirst } from "@/common/bind.lib.ts";
import type { Clock } from "@/common/clock.lib.ts";
import { httpStatus } from "@/common/errors.lib.ts";
import type { Membership } from "@/modules/auth";

import type { PushRepo, SubscriptionRow } from "./push.repo.ts";
import type { PushTransport } from "./push.types.ts";

// Devices are the auth module's; the app wires in its ownership check.
type DevicePort = { isOwnDevice(memberId: string, deviceId: string): Promise<boolean> };

type PushServiceDependencies = {
  subscriptions: PushRepo;
  devices: DevicePort;
  transport: PushTransport;
  clock: Clock;
  publicKey: string;
};

const goneStatuses = new Set<number>([httpStatus.notFound, httpStatus.gone]);
const acceptedStatusMax = 299;

// A push service that fails is logged and counted out; it never stops the other Devices or the bot.
async function isAccepted(
  { transport, subscriptions }: PushServiceDependencies,
  { row, payload }: { row: SubscriptionRow; payload: string },
): Promise<boolean> {
  try {
    const status = await transport.send(row, payload);

    if (goneStatuses.has(status)) {
      await subscriptions.remove(row.memberId, row.deviceId);
    } else if (status > acceptedStatusMax) {
      console.error("Push refused", { deviceId: row.deviceId, status });
    }

    return status <= acceptedStatusMax;
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
  if (!(await devices.isOwnDevice(member.id, deviceId))) {
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
  const rows = await dependencies.subscriptions.listOf(memberId);
  const accepted = await Promise.all(
    rows.map(async (row) => isAccepted(dependencies, { row, payload })),
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
