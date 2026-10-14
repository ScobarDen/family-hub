import type { ApiError, ErrorCode } from "@family-hub/contract";

export const httpStatus = {
  badRequest: 400,
  unauthorized: 401,
} as const;

export function apiError(code: ErrorCode, message: string): ApiError {
  return { code, message };
}
