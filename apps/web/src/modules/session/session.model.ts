import { action, atom, computed, withAsyncData, wrap, type Atom } from "@reatom/core";

import {
  currentMember,
  parseDeepLink,
  type CurrentMember,
  telegramWidgetLogin,
  type FamilyRequestStatus,
} from "@family-hub/contract";

import type { DeviceCache } from "@/modules/device-cache";

import type { SessionApi } from "./session.api.ts";

export type SignInOutcome =
  | { status: "signed-out" }
  | { status: "not-member" }
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
  telegram: { initData: string; isInTelegram: boolean };
  deviceCache: SessionCache;
  cachedMember: CachedMember;
};

type Answer = Awaited<ReturnType<SessionApi["signIn"] | SessionApi["signInWithDevice"]>>;

// The token is handed out only once the cache belongs to this Member, so data loaded right
// after sign-in is never wiped together with another Family's.
function reatomAnsweredSignIn({ api, deviceCache, cachedMember }: SignInDependencies) {
  return action(async (answer: () => Promise<Answer>): Promise<SignInOutcome> => {
    const outcome = await wrap(answer());

    if (outcome.status !== "member") {
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

// Outside Telegram there is no initData: the Installed App signs in with its Device, or with a
// Telegram Login that creates one.
export function reatomSignIn(dependencies: SignInDependencies) {
  const { api, telegram } = dependencies;
  const signIn = reatomAnsweredSignIn(dependencies);

  return {
    signIn,
    signInAtLaunch: async () =>
      signIn(async () =>
        telegram.isInTelegram ? api.signIn(telegram.initData) : api.signInWithDevice(),
      ),
    // What the Telegram Login widget hands the page; anything else is ignored.
    signInWithLogin: async (login: unknown) => {
      const parsed = telegramWidgetLogin.safeParse(login);

      return parsed.success ? signIn(async () => api.signInWithLogin(parsed.data)) : undefined;
    },
  };
}
