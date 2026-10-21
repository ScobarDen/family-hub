import type { ApiError, ErrorCode } from "@family-hub/contract";

export const httpStatus = {
  created: 201,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  gone: 410,
  tooManyRequests: 429,
  serviceUnavailable: 503,
} as const;

export function apiError(code: ErrorCode, message: string): ApiError {
  return { code, message };
}
