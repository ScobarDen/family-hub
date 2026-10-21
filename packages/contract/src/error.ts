import { z } from "zod";

export const errorCode = z.enum([
  "INVALID_REQUEST",
  "INIT_DATA_INVALID",
  "UNAUTHENTICATED",
  "ALREADY_MEMBER",
  "FAMILY_REQUEST_PENDING",
  "FAMILY_REQUEST_COOLDOWN",
  "OPERATOR_UNAVAILABLE",
  "INVITE_UNAVAILABLE",
  "INVITE_NOT_FOUND",
  "NOT_FAMILY_OWNER",
  "OWNER_MUST_HAND_OVER",
  "MEMBER_NOT_FOUND",
  "FAMILY_NAME_MISMATCH",
  "PET_NOT_FOUND",
  "CARE_ENTRY_NOT_FOUND",
  "PLAN_NOT_FOUND",
  "NOT_PLAN_OWNER",
  "ASSIGNEE_NOT_ALLOWED",
  "VISIBILITY_ONE_WAY",
]);

export type ErrorCode = z.infer<typeof errorCode>;

export const apiError = z.object({
  code: errorCode,
  message: z.string(),
});

export type ApiError = z.infer<typeof apiError>;
