import type { PushMessage, PushRotation, PushSubscriptionChange } from "@family-hub/contract";

import { bindFirst } from "@/common/bind.lib.ts";
import type { Clock } from "@/common/clock.lib.ts";
import { deviceLifetimeMs, type Membership } from "@/modules/auth";

import type { PressClaims, PressTokens } from "./lib/press-token.lib.ts";
import type { PushRepo, SubscriptionRow } from "./push.repo.ts";
import type { PressTarget, PushTransport } from "./push.types.ts";

// Devices are the auth module's; the app wires in its check of a Member's unexpired Device.
type DevicePort = {
  isLive(memberId: string, deviceId: string, usedSince: number): Promise<boolean>;
};

type PushServiceDependencies = {
  subscriptions: PushRepo;
  devices: DevicePort;
  transport: PushTransport;
  pressTokens: PressTokens;
  clock: Clock;
  publicKey: string;
};

type Sending = {
  row: SubscriptionRow;
  message: Omit<PushMessage, "pressToken">;
  press?: PressTarget;
};

async function payloadOf(
  { pressTokens }: PushServiceDependencies,
  { row, message, press }: Sending,
): Promise<string> {
  const pressToken =
    press && (await pressTokens.sign({ ...press, memberId: row.memberId, deviceId: row.deviceId }));

  return JSON.stringify(pressToken === undefined ? message : { ...message, pressToken });
}

// A push service that fails is logged and counted out; it never stops the other Devices or the bot.
async function isDeliveredTo(
  dependencies: PushServiceDependencies,
  sending: Sending,
): Promise<boolean> {
  const { transport, subscriptions } = dependencies;
  const { memberId, deviceId } = sending.row;

  try {
    const outcome = await transport.send(sending.row, await payloadOf(dependencies, sending));

    if (outcome === "gone") {
      console.warn("Push gone", { memberId, deviceId });
      await subscriptions.remove(memberId, deviceId);
    } else if (outcome === "refused") {
      console.error("Push refused", { memberId, deviceId });
    }

    return outcome === "accepted";
  } catch (error) {
    console.error("Push not sent", { memberId, deviceId, error });

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

async function rotate(
  { subscriptions, clock }: PushServiceDependencies,
  { oldEndpoint, subscription }: PushRotation,
): Promise<"rotated" | "not-found"> {
  const isRotated = await subscriptions.rotate(oldEndpoint, {
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    createdAt: clock.now(),
  });

  return isRotated ? "rotated" : "not-found";
}

async function endpointOf(
  { subscriptions }: PushServiceDependencies,
  { member }: Membership,
  deviceId: string,
): Promise<string | null> {
  return subscriptions.endpointOf(member.id, deviceId);
}

// A press counts while the Device it came to is live, so revoking a Device silences its buttons.
async function pressOf(
  { pressTokens, devices, clock }: PushServiceDependencies,
  token: string,
): Promise<Omit<PressClaims, "deviceId"> | undefined> {
  const claims = await pressTokens.read(token);

  if (
    claims === undefined ||
    !(await devices.isLive(claims.memberId, claims.deviceId, clock.now() - deviceLifetimeMs))
  ) {
    return undefined;
  }

  return {
    dispatchId: claims.dispatchId,
    occurrence: claims.occurrence,
    memberId: claims.memberId,
  };
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
  { message, press }: Omit<Sending, "row">,
): Promise<number> {
  const rows = await dependencies.subscriptions.listOf(
    memberId,
    dependencies.clock.now() - deviceLifetimeMs,
  );
  const deliveries = await Promise.all(
    rows.map(async (row) => isDeliveredTo(dependencies, { row, message, press })),
  );
  const accepted = deliveries.filter(Boolean).length;

  // A Member whose every Device stopped answering is who stops getting Push without a word.
  if (rows.length > 0 && accepted === 0) {
    console.warn("Push reached no Device", { memberId, devices: rows.length });
  }

  return accepted;
}

export function createPushService(dependencies: PushServiceDependencies) {
  return {
    publicKey: () => dependencies.publicKey,
    ...bindFirst(dependencies, {
      subscribe,
      unsubscribe,
      rotate,
      endpointOf,
      pressOf,
      sendTo,
    }),
  };
}

export type PushService = ReturnType<typeof createPushService>;
