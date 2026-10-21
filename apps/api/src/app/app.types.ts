import type { AuthService } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { Db } from "@/common/db";
import type { BotApi } from "@/common/telegram";
import type { FamilyService } from "@/modules/family";
import type { FamilyRequestService } from "@/modules/family-request";
import type { InviteService } from "@/modules/invite";
import type { MemberService } from "@/modules/member";
import type { PetService } from "@/modules/pet";

export type AppServices = {
  db: Db;
  clock: Clock;
  bot: BotApi;
  auth: AuthService;
  families: FamilyService;
  familyRequests: FamilyRequestService;
  invites: InviteService;
  members: MemberService;
  pets: PetService;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppServices;
};
