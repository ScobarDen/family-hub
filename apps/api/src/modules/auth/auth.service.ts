import { uuidv7, type DeviceList, type TelegramWidgetLogin } from "@family-hub/contract";

import { bindFirst } from "@/common/bind.lib.ts";
import type { Clock } from "@/common/clock.lib.ts";

import { deviceLifetimeMs, deviceTouchIntervalMs } from "./auth.config.ts";
import type { DeviceRepo, MembershipRepo } from "./auth.repo.ts";
import type { Membership } from "./auth.types.ts";
import { credentialHashOf, deviceLabelOf, newCredential } from "./lib/device-credential.lib.ts";
import { verifyInitData, type TelegramUser } from "./lib/init-data.lib.ts";
import { createSessionTokens } from "./lib/session-token.lib.ts";
import { verifyTelegramLogin } from "./lib/telegram-login.lib.ts";

type SignInResult =
  | { status: "member"; token: string; membership: Membership }
  | { status: "stranger"; telegramId: number }
  | { status: "invalid" };

type LoginSignInResult =
  | {
      status: "member";
      token: string;
      membership: Membership;
      device: { id: string; credential: string };
    }
  | { status: "stranger" }
  | { status: "invalid" };

type DeviceSignInResult =
  | { status: "member"; token: string; membership: Membership }
  | { status: "stranger" }
  | { status: "invalid" };

type AuthServiceDependencies = {
  memberships: MembershipRepo;
  devices: DeviceRepo;
  clock: Clock;
  botToken: string;
  jwtSecret: string;
};

type AuthContext = AuthServiceDependencies & {
  sessionTokens: ReturnType<typeof createSessionTokens>;
};

async function syncProfile(
  { memberships, clock }: Pick<AuthServiceDependencies, "memberships" | "clock">,
  { user, member }: { user: TelegramUser; member: Membership["member"] },
): Promise<void> {
  // Telegram omits the flag on some launches, so only a 403 from the bot turns it off.
  if (user.allows_write_to_pm === true && !member.canMessage) {
    await memberships.setCanMessage(member.id, true, clock.now());
  }

  const profilePicture = user.photo_url ?? null;

  if (profilePicture !== member.profilePicture) {
    await memberships.setProfilePicture(member.id, profilePicture, clock.now());
  }
}

async function registerDevice(
  { devices }: AuthContext,
  { memberId, userAgent, now }: { memberId: string; userAgent: string | undefined; now: number },
) {
  const device = { id: uuidv7(now), credential: newCredential() };

  await devices.removeUnusedOf(memberId, now - deviceLifetimeMs);
  await devices.insert({
    id: device.id,
    memberId,
    credentialHash: await credentialHashOf(device.credential),
    label: deviceLabelOf(userAgent),
    createdAt: now,
    lastUsedAt: now,
  });

  return device;
}

// Only Members get a Device: a stranger is sent to the bot, which is where a Family starts.
async function signInWithLogin(
  context: AuthContext,
  login: TelegramWidgetLogin,
  userAgent: string | undefined,
): Promise<LoginSignInResult> {
  const { memberships, clock, botToken, sessionTokens } = context;
  const now = clock.now();
  const user = await verifyTelegramLogin({ login, botToken, now });

  if (!user) {
    return { status: "invalid" };
  }

  const membership = await memberships.findByTelegramId(user.id);

  if (!membership) {
    return { status: "stranger" };
  }

  await syncProfile(context, { user, member: membership.member });

  const device = await registerDevice(context, { memberId: membership.member.id, userAgent, now });

  return {
    status: "member",
    token: await sessionTokens.sign({ memberId: membership.member.id, deviceId: device.id }, now),
    membership,
    device,
  };
}

// A Device dies after 90 days unused; its use is written at most once a day.
async function signInWithDevice(
  { devices, memberships, clock, sessionTokens }: AuthContext,
  credential: string,
): Promise<DeviceSignInResult> {
  const now = clock.now();
  const device = await devices.findByCredentialHash(await credentialHashOf(credential));

  if (device === undefined) {
    return { status: "invalid" };
  }

  if (now - device.lastUsedAt >= deviceLifetimeMs) {
    await devices.removeById(device.id);

    return { status: "invalid" };
  }

  if (now - device.lastUsedAt >= deviceTouchIntervalMs) {
    await devices.touch(device.id, now);
  }

  const membership = await memberships.findByMemberId(device.memberId);

  return membership === undefined
    ? { status: "stranger" }
    : {
        status: "member",
        token: await sessionTokens.sign(
          { memberId: membership.member.id, deviceId: device.id },
          now,
        ),
        membership,
      };
}

async function devicesOf({ devices }: AuthContext, { member }: Membership): Promise<DeviceList> {
  const rows = await devices.listOf(member.id);

  return rows.map(({ id, label, createdAt, lastUsedAt }) => ({ id, label, createdAt, lastUsedAt }));
}

async function revokeDevice({ devices }: AuthContext, { member }: Membership, deviceId: string) {
  return devices.remove(member.id, deviceId);
}

async function signIn(context: AuthContext, initData: string): Promise<SignInResult> {
  const { memberships, clock, botToken, sessionTokens } = context;
  const user = await verifyInitData({ initData, botToken, now: clock.now() });

  if (!user) {
    return { status: "invalid" };
  }

  const membership = await memberships.findByTelegramId(user.id);

  if (!membership) {
    return { status: "stranger", telegramId: user.id };
  }

  await syncProfile(context, { user, member: membership.member });

  return {
    status: "member",
    token: await sessionTokens.sign({ memberId: membership.member.id }, clock.now()),
    membership,
  };
}

export type Session = { membership: Membership; deviceId: string | undefined };

export function createAuthService(dependencies: AuthServiceDependencies) {
  const { memberships, devices, clock, botToken } = dependencies;
  const sessionTokens = createSessionTokens(dependencies.jwtSecret);

  return {
    identify: async (initData: string): Promise<TelegramUser | undefined> =>
      verifyInitData({ initData, botToken, now: clock.now() }),
    memberOf: memberships.findByTelegramId,
    ...bindFirst(
      { ...dependencies, sessionTokens },
      { signIn, signInWithLogin, signInWithDevice, devicesOf, revokeDevice },
    ),
    // Renewing is use too: an Installed App kept open never signs in with its Device again.
    async renew({ member }: Membership, deviceId: string | undefined): Promise<string> {
      const now = clock.now();

      if (deviceId !== undefined) {
        await devices.touch(deviceId, now);
      }

      return sessionTokens.sign({ memberId: member.id, deviceId }, now);
    },

    async authenticate(token: string): Promise<Session | undefined> {
      const now = clock.now();
      const claims = await sessionTokens.read(token, now);

      if (
        claims === undefined ||
        (claims.deviceId !== undefined &&
          !(await devices.isLive(claims.memberId, claims.deviceId, now - deviceLifetimeMs)))
      ) {
        return undefined;
      }

      const membership = await memberships.findByMemberId(claims.memberId);

      return membership && { membership, deviceId: claims.deviceId };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
