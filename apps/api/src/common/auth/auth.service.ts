import type { Clock } from "@/common/clock";

import type { MembershipRepo } from "./auth.repo.ts";
import type { Membership } from "./auth.types.ts";
import { verifyInitData } from "./lib/init-data.lib.ts";
import { readSessionToken, signSessionToken } from "./lib/session-token.lib.ts";

export type SignInResult =
  | { status: "member"; token: string }
  | { status: "stranger" }
  | { status: "invalid" };

type AuthServiceDependencies = {
  memberships: MembershipRepo;
  clock: Clock;
  botToken: string;
  jwtSecret: string;
};

export function createAuthService({
  memberships,
  clock,
  botToken,
  jwtSecret,
}: AuthServiceDependencies) {
  return {
    async signIn(initData: string): Promise<SignInResult> {
      const user = await verifyInitData({ initData, botToken, now: clock.now() });

      if (!user) {
        return { status: "invalid" };
      }

      const membership = await memberships.findByTelegramId(user.id);

      if (!membership) {
        return { status: "stranger" };
      }

      const token = await signSessionToken({
        memberId: membership.memberId,
        secret: jwtSecret,
        now: clock.now(),
      });

      return { status: "member", token };
    },

    async authenticate(token: string): Promise<Membership | undefined> {
      const memberId = await readSessionToken({ token, secret: jwtSecret, now: clock.now() });

      return memberId === undefined ? undefined : memberships.findByMemberId(memberId);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
