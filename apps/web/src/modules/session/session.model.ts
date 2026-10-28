import { action, atom, computed, withAsyncData, wrap, type Atom } from "@reatom/core";

import {
  currentMember,
  parseDeepLink,
  type CurrentMember,
  type FamilyRequestStatus,
} from "@family-hub/contract";

import type { DeviceCache } from "@/common/device-cache";

import type { SessionApi } from "./session.api.ts";

export type SignInOutcome =
  | { status: "outside-telegram" }
  | { status: "stranger"; familyRequest: FamilyRequestStatus }
  | { status: "member"; member: CurrentMember };

export type SessionCache = Pick<DeviceCache, "withDeviceCache" | "keepFor" | "clear">;

type CachedMember = Atom<CurrentMember | null>;

// The Member last signed in on this device, except on an Invite: joining another Family must
// never flash the old one.
export function reatomShell({
  deviceCache,
  startParam,
}: {
  deviceCache: SessionCache;
  startParam: string | undefined;
}) {
  const cachedMember: CachedMember = atom<CurrentMember | null>(
    null,
    "session.cachedMember",
  ).extend(
    deviceCache.withDeviceCache<CachedMember>({
      key: "member",
      schema: currentMember.nullable(),
      version: 1,
    }),
  );
  const isInviteLaunch = parseDeepLink(startParam)?.kind === "inv";

  return {
    cachedMember,
    shell: computed(
      () => (isInviteLaunch ? undefined : (cachedMember() ?? undefined)),
      "session.shell",
    ),
  };
}

type SignInDependencies = {
  api: SessionApi;
  initData: string;
  deviceCache: SessionCache;
  cachedMember: CachedMember;
};

// The token is handed out only once the cache belongs to this Member, so data loaded right
// after sign-in is never wiped together with another Family's.
export function reatomSignIn({ api, initData, deviceCache, cachedMember }: SignInDependencies) {
  return action(async (): Promise<SignInOutcome> => {
    if (initData === "") {
      return { status: "outside-telegram" };
    }

    const outcome = await wrap(api.signIn(initData));

    if (outcome.status === "stranger") {
      await wrap(deviceCache.clear());

      return outcome;
    }

    const { member, family } = outcome.member;

    await wrap(deviceCache.keepFor({ memberId: member.id, familyId: family.id }));
    cachedMember.set(outcome.member);
    api.startSession(outcome.token);

    return { status: "member", member: outcome.member };
  }, "session.signIn").extend(withAsyncData());
}
