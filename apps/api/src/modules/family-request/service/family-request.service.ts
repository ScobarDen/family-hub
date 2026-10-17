import type { CallbackQuery } from "@grammyjs/types";

import type { TelegramUser } from "@/common/auth";

import type { FamilyRequestDependencies } from "../family-request.types.ts";
import { handleCallback } from "./operator-decision.service.ts";
import { submit } from "./submission.service.ts";

export type { SubmitResult } from "./submission.service.ts";

export function createFamilyRequestService(dependencies: FamilyRequestDependencies) {
  return {
    submit: async (user: TelegramUser, familyName: string) =>
      submit(dependencies, user, familyName),
    handleCallback: async (query: CallbackQuery) => handleCallback(dependencies, query),
  };
}

export type FamilyRequestService = ReturnType<typeof createFamilyRequestService>;
