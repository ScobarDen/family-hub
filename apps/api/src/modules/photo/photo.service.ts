import { photoMaxBytes, uuidv7, type Photo, type PhotoVariant } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { Clock } from "@/common/clock";
import { httpStatus } from "@/common/errors";
import type { PhotoLinks } from "@/common/photo-link";
import { BotApiError } from "@/common/telegram";

import type { PhotoFiles } from "./photo-file.repo.ts";
import type { PhotoRepo } from "./photo.repo.ts";

export type PhotoDependencies = {
  photos: PhotoRepo;
  files: PhotoFiles;
  links: PhotoLinks;
  clock: Clock;
};

export type PhotoRefusal = "storage-unavailable" | "too-large" | "not-found" | "not-uploader";

type UploadResult =
  | { status: "ok"; photo: Photo }
  | { status: "rate-limited"; retryAfterSeconds: number }
  | { status: PhotoRefusal };

const defaultRetryAfterSeconds = 3;

export type DeleteResult = { status: "deleted" } | { status: PhotoRefusal };

export type SignedRequest = {
  photoId: string;
  variant: PhotoVariant;
  expiresAt: number;
  signature: string;
};

type ServedPhoto =
  | { status: "ok"; open: () => Promise<Response> }
  | { status: "forbidden" | "gone" };

function viewerOf({ member, isFamilyOwner }: Membership) {
  return { memberId: member.id, isFamilyOwner };
}

// A burst of uploads meets Telegram's per-channel limit; the Mini App waits as long as it is told.
async function uploadedOrRateLimit(
  { files }: PhotoDependencies,
  { channelId, file }: { channelId: number; file: Blob },
) {
  try {
    return await files.upload(channelId, file);
  } catch (error) {
    if (error instanceof BotApiError && error.errorCode === httpStatus.tooManyRequests) {
      return { retryAfterSeconds: error.retryAfterSeconds ?? defaultRetryAfterSeconds };
    }

    throw error;
  }
}

// The same picture uploaded twice, even at once, is one photo: Telegram gives it the same
// file_unique_id, and the first row written wins.
async function upload(
  dependencies: PhotoDependencies,
  membership: Membership,
  { file, takenAt }: { file: Blob; takenAt: number | null },
): Promise<UploadResult> {
  const familyId = membership.family.id;
  const channelId = await dependencies.photos.channelOf(familyId);

  if (channelId === undefined) {
    return { status: "storage-unavailable" };
  }

  if (file.size > photoMaxBytes) {
    return { status: "too-large" };
  }

  const uploaded = await uploadedOrRateLimit(dependencies, { channelId, file });

  if ("retryAfterSeconds" in uploaded) {
    return { status: "rate-limited", retryAfterSeconds: uploaded.retryAfterSeconds };
  }

  const now = dependencies.clock.now();
  const fresh = {
    id: uuidv7(now),
    familyId,
    ...uploaded,
    takenAt,
    createdAt: now,
    createdBy: membership.member.id,
  };

  await dependencies.photos.add(fresh);

  const row = (await dependencies.photos.findByUnique(familyId, uploaded.fileUniqueId)) ?? fresh;

  return { status: "ok", photo: await dependencies.links.photoOf(row, viewerOf(membership)) };
}

async function remove(
  { photos }: PhotoDependencies,
  membership: Membership,
  photoId: string,
): Promise<DeleteResult> {
  const target = { familyId: membership.family.id, photoId };
  const row = await photos.find(target);

  if (!row) {
    return { status: "not-found" };
  }

  if (!membership.isFamilyOwner && row.createdBy !== membership.member.id) {
    return { status: "not-uploader" };
  }

  await photos.delete(target);

  return { status: "deleted" };
}

// A forgotten photo or a disconnected channel is gone for good; a bad or stale link is refused.
async function serve(
  { photos, files, links }: PhotoDependencies,
  request: SignedRequest,
): Promise<ServedPhoto> {
  if (!(await links.isValid(request))) {
    return { status: "forbidden" };
  }

  const row = await photos.findById(request.photoId);
  const isStored = row !== undefined && (await photos.channelOf(row.familyId)) !== undefined;

  return isStored
    ? { status: "ok", open: async () => files.open(row.variants[request.variant]) }
    : { status: "gone" };
}

export function createPhotoService(dependencies: PhotoDependencies) {
  return {
    upload: async (membership: Membership, picked: { file: Blob; takenAt: number | null }) =>
      upload(dependencies, membership, picked),
    remove: async (membership: Membership, photoId: string) =>
      remove(dependencies, membership, photoId),
    serve: async (request: SignedRequest) => serve(dependencies, request),
  };
}

export type PhotoService = ReturnType<typeof createPhotoService>;
