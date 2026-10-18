import type { AuthService } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { Db } from "@/common/db";
import type { BotApi } from "@/common/telegram";
import type { FamilyRequestService } from "@/modules/family-request";
import type { InviteService } from "@/modules/invite";
import type { MemberService } from "@/modules/member";

export type AppServices = {
  db: Db;
  clock: Clock;
  bot: BotApi;
  auth: AuthService;
  familyRequests: FamilyRequestService;
  invites: InviteService;
  members: MemberService;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppServices;
};
