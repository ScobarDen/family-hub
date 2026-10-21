import { Hono, type Context } from "hono";

import { photoVariant, type ErrorCode, type Photo, type PhotoVariant } from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import type { PhotoRefusal, PhotoService, SignedRequest } from "./photo.service.ts";

export type PhotoEnv = {
  Variables: MemberEnv["Variables"] & { photos: PhotoService };
};

const refusals = {
  "storage-unavailable": {
    code: "PHOTO_STORAGE_UNAVAILABLE",
    message: "The Family has no Photo Storage connected",
    status: httpStatus.conflict,
  },
  "too-large": {
    code: "PHOTO_TOO_LARGE",
    message: "A photo is at most 10 MB",
    status: httpStatus.badRequest,
  },
  "not-found": {
    code: "PHOTO_NOT_FOUND",
    message: "No such photo in the Family",
    status: httpStatus.notFound,
  },
  "not-uploader": {
    code: "NOT_PHOTO_UPLOADER",
    message: "Only the Member who uploaded a photo or the Family Owner may delete it",
    status: httpStatus.forbidden,
  },
} as const satisfies Record<PhotoRefusal, { code: ErrorCode; message: string; status: number }>;

// Signed links change hourly; the edge keeps one copy per photo and variant regardless.
const cacheControl = "private, max-age=31536000, immutable";

function refuse(context: Context<PhotoEnv>, refusal: PhotoRefusal) {
  const { code, message, status } = refusals[refusal];

  return context.json(apiError(code, message), status);
}

function signedRequestOf(context: Context<PhotoEnv>): SignedRequest | undefined {
  const variant = photoVariant.safeParse(context.req.param("variant"));
  const expiresAt = Number(context.req.query("exp"));
  const signature = context.req.query("sig");

  return variant.success && Number.isFinite(expiresAt) && signature !== undefined
    ? { photoId: context.req.param("id") ?? "", variant: variant.data, expiresAt, signature }
    : undefined;
}

function cacheKeyOf(
  context: Context<PhotoEnv>,
  { photoId, variant }: { photoId: string; variant: PhotoVariant },
) {
  return new Request(new URL(`/photos/${photoId}/${variant}`, context.req.url));
}

async function freshPhoto(context: Context<PhotoEnv>, signed: SignedRequest): Promise<Response> {
  const served = await context.var.photos.serve(signed);

  if (served.status !== "ok") {
    return context.body(null, served.status === "gone" ? httpStatus.gone : httpStatus.forbidden);
  }

  return new Response(served.body.body, {
    headers: { "content-type": "image/jpeg", "cache-control": cacheControl },
  });
}

// Workers give the edge cache as caches.default; elsewhere, as in tests, there is none.
async function servePhoto(context: Context<PhotoEnv>): Promise<Response> {
  const signed = signedRequestOf(context);

  if (signed === undefined) {
    return context.body(null, httpStatus.forbidden);
  }

  const cache = typeof caches === "undefined" ? undefined : caches.default;
  const key = cacheKeyOf(context, signed);
  const cached = await cache?.match(key);

  if (cached !== undefined) {
    return cached;
  }

  const response = await freshPhoto(context, signed);

  if (response.ok && cache !== undefined) {
    context.executionCtx.waitUntil(cache.put(key, response.clone()));
  }

  return response;
}

export const photoRoute = new Hono<PhotoEnv>()
  .use("/api/photos", requireMember)
  .use("/api/photos/*", requireMember)
  .post("/api/photos", async (context) => {
    const form = await context.req.parseBody();
    const { file } = form;
    const takenAt = Number(form.takenAt);

    if (!(file instanceof Blob)) {
      return context.json(
        apiError("INVALID_REQUEST", "Send the photo as «file»"),
        httpStatus.badRequest,
      );
    }

    const result = await context.var.photos.upload(context.var.membership, {
      file,
      takenAt: Number.isFinite(takenAt) && takenAt > 0 ? takenAt : null,
    });

    if (result.status === "rate-limited") {
      context.header("retry-after", String(result.retryAfterSeconds));

      return context.json(
        apiError("PHOTO_RATE_LIMITED", "Telegram asks to wait before the next photo"),
        httpStatus.tooManyRequests,
      );
    }

    return result.status === "ok"
      ? context.json<Photo>(result.photo, httpStatus.created)
      : refuse(context, result.status);
  })
  .delete("/api/photos/:id", async (context) => {
    const result = await context.var.photos.remove(context.var.membership, context.req.param("id"));

    return result.status === "deleted" ? context.json(result) : refuse(context, result.status);
  })
  .get("/photos/:id/:variant", async (context) => servePhoto(context));
