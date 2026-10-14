import type { Clock } from "@/common/clock";

import type { MembershipRepo } from "./auth.repo.ts";
import type { Membership } from "./auth.types.ts";
import { verifyInitData } from "./lib/init-data.lib.ts";
import { createSessionTokens } from "./lib/session-token.lib.ts";

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
  const sessionTokens = createSessionTokens(jwtSecret);

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

      return {
        status: "member",
        token: await sessionTokens.sign(membership.member.id, clock.now()),
      };
    },

    async authenticate(token: string): Promise<Membership | undefined> {
      const memberId = await sessionTokens.read(token, clock.now());

      return memberId === undefined ? undefined : memberships.findByMemberId(memberId);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
