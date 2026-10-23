import type { Clock } from "@/common/clock";

import type { MembershipRepo } from "./auth.repo.ts";
import type { Membership } from "./auth.types.ts";
import { verifyInitData, type TelegramUser } from "./lib/init-data.lib.ts";
import { createSessionTokens } from "./lib/session-token.lib.ts";

type SignInResult =
  | { status: "member"; token: string }
  | { status: "stranger"; telegramId: number }
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

  async function identify(initData: string): Promise<TelegramUser | undefined> {
    return verifyInitData({ initData, botToken, now: clock.now() });
  }

  return {
    identify,

    async signIn(initData: string): Promise<SignInResult> {
      const user = await identify(initData);

      if (!user) {
        return { status: "invalid" };
      }

      const membership = await memberships.findByTelegramId(user.id);

      if (!membership) {
        return { status: "stranger", telegramId: user.id };
      }

      // Telegram omits the flag on some launches, so only a 403 from the bot turns it off.
      if (user.allows_write_to_pm === true && !membership.member.canMessage) {
        await memberships.setCanMessage(membership.member.id, true, clock.now());
      }

      const profilePicture = user.photo_url ?? null;

      if (profilePicture !== membership.member.profilePicture) {
        await memberships.setProfilePicture(membership.member.id, profilePicture, clock.now());
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
