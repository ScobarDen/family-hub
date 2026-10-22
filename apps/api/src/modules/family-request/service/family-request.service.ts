import { bindFirst } from "@/common/bind";

import { familyRequestRetentionMs } from "../family-request.config.ts";
import type { FamilyRequestDependencies } from "../family-request.types.ts";
import { handleCallback } from "./operator-decision.service.ts";
import { statusOf, submit } from "./submission.service.ts";

export type { SubmitResult } from "./submission.service.ts";

export function createFamilyRequestService(dependencies: FamilyRequestDependencies) {
  return {
    ...bindFirst(dependencies, { submit, handleCallback, statusOf }),
    cancelPending: async (telegramId: number) =>
      dependencies.requests.cancelPendingOf(telegramId, dependencies.clock.now()),
    sweep: async () =>
      dependencies.requests.sweepDecidedBefore(dependencies.clock.now() - familyRequestRetentionMs),
  };
}

export type FamilyRequestService = ReturnType<typeof createFamilyRequestService>;
