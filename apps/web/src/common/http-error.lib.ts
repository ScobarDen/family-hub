import type { ErrorCode } from "@family-hub/contract";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode | undefined;
  // How long the server asks to wait before trying again, from Retry-After.
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, code?: ErrorCode, retryAfterSeconds?: number) {
    super(`Request failed with status ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
