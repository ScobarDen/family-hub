import { sValidator } from "@hono/standard-validator";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodType } from "zod";

import type { ApiError, ErrorCode } from "@family-hub/contract";

export const httpStatus = {
  created: 201,
  noContent: 204,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  gone: 410,
  lengthRequired: 411,
  payloadTooLarge: 413,
  unsupportedMediaType: 415,
  tooManyRequests: 429,
  serviceUnavailable: 503,
} as const;

export type Refusal = { code: ErrorCode; message: string; status: ContentfulStatusCode };

export function apiError(code: ErrorCode, message: string): ApiError {
  return { code, message };
}

// A module names each of its refusals once; its routes answer one by its key.
export function refusalsOf<Key extends string>(refusals: Record<Key, Refusal>) {
  return (context: Context, refusal: Key) => {
    const { code, message, status } = refusals[refusal];

    return context.json(apiError(code, message), status);
  };
}

export function jsonBody<Schema extends ZodType>(schema: Schema, message: string) {
  return sValidator("json", schema, (result, context) =>
    result.success
      ? undefined
      : context.json(apiError("INVALID_REQUEST", message), httpStatus.badRequest),
  );
}
