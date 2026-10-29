import {
  careEntryPhotoMax,
  uploadBatchGapMs,
  uuidv7,
  type AlbumChange,
} from "@family-hub/contract";

import type { Membership } from "@/modules/auth";

import { albumOf } from "../album.lib.ts";
import type { AlbumDeletion } from "../album.repo.ts";
import type { AlbumDependencies, AlbumRefusal, AlbumResult } from "../album.types.ts";
import { petIdOf, sourceOf, viewerOf } from "./album-read.service.ts";

export type DeleteResult = { status: "deleted" } | { status: AlbumRefusal };

export async function current(
  dependencies: AlbumDependencies,
  membership: Membership,
  albumId: string,
): Promise<AlbumResult> {
  const source = await sourceOf(dependencies, membership, albumId);

  return source
    ? {
        status: "ok",
        album: await albumOf(dependencies.links, { source, viewer: viewerOf(membership) }),
      }
    : { status: "not-found" };
}

export async function create(
  dependencies: AlbumDependencies,
  membership: Membership,
  change: AlbumChange,
): Promise<AlbumResult> {
  const now = dependencies.clock.now();
  const id = uuidv7(now);

  await dependencies.albums.add({
    id,
    familyId: membership.family.id,
    ...change,
    createdAt: now,
    createdBy: membership.member.id,
    updatedAt: now,
  });

  return current(dependencies, membership, id);
}

// A Pet's automatic Album is named after the Pet and cannot be renamed.
export async function update(
  dependencies: AlbumDependencies,
  membership: Membership,
  { albumId, change }: { albumId: string; change: AlbumChange },
): Promise<AlbumResult> {
  const source = await sourceOf(dependencies, membership, albumId);

  if (!source) {
    return { status: "not-found" };
  }

  if (source.kind === "pet") {
    return { status: "pet-album-fixed" };
  }

  await dependencies.albums.update(
    { familyId: membership.family.id, albumId },
    { ...change, updatedAt: dependencies.clock.now() },
  );

  return current(dependencies, membership, albumId);
}

export async function remove(
  dependencies: AlbumDependencies,
  membership: Membership,
  { albumId, scope }: { albumId: string; scope: AlbumDeletion },
): Promise<DeleteResult> {
  const source = await sourceOf(dependencies, membership, albumId);

  if (!source) {
    return { status: "not-found" };
  }

  if (source.kind === "pet") {
    return { status: "pet-album-fixed" };
  }

  if (!source.canDelete) {
    return { status: "not-owner" };
  }

  await dependencies.albums.delete({ familyId: membership.family.id, albumId }, scope);

  return { status: "deleted" };
}

// A Care Entry holds at most five photos, so a larger batch for a Pet makes several notes.
async function addToPet(
  dependencies: AlbumDependencies,
  membership: Membership,
  { petId, photoIds }: { petId: string; photoIds: string[] },
): Promise<void> {
  for (let start = 0; start < photoIds.length; start += careEntryPhotoMax) {
    await dependencies.petNotes.addNote(membership, {
      petId,
      photoIds: photoIds.slice(start, start + careEntryPhotoMax),
    });
  }
}

// Photos continue the Member's latest Upload Batch in the Album while the pause stays short.
async function addToAlbum(
  { albums, clock }: AlbumDependencies,
  membership: Membership,
  { albumId, photoIds }: { albumId: string; photoIds: string[] },
): Promise<void> {
  const familyId = membership.family.id;
  const memberId = membership.member.id;
  const now = clock.now();
  const latest = await albums.latestBatchOf({ familyId, albumId, memberId });
  const batchId =
    latest !== undefined && now - latest.lastAddedAt < uploadBatchGapMs ? latest.id : uuidv7(now);

  await albums.addPhotos({ familyId, albumId, photoIds, memberId, batchId, now });
}

export async function addPhotos(
  dependencies: AlbumDependencies,
  membership: Membership,
  { albumId, photoIds }: { albumId: string; photoIds: string[] },
): Promise<AlbumResult> {
  const familyId = membership.family.id;
  const source = await sourceOf(dependencies, membership, albumId);

  if (!source) {
    return { status: "not-found" };
  }

  const known = await dependencies.albums.knownPhotoIds(familyId, photoIds);

  if (photoIds.some((photoId) => !known.includes(photoId))) {
    return { status: "photo-not-found" };
  }

  const petId = petIdOf(albumId);

  await (petId === undefined
    ? addToAlbum(dependencies, membership, { albumId, photoIds })
    : addToPet(dependencies, membership, { petId, photoIds }));

  return current(dependencies, membership, albumId);
}

export async function removePhoto(
  dependencies: AlbumDependencies,
  membership: Membership,
  { albumId, photoId }: { albumId: string; photoId: string },
): Promise<AlbumResult> {
  const source = await sourceOf(dependencies, membership, albumId);

  if (!source) {
    return { status: "not-found" };
  }

  if (source.kind === "pet") {
    return { status: "pet-album-fixed" };
  }

  await dependencies.albums.removePhoto({ familyId: membership.family.id, albumId, photoId });

  return current(dependencies, membership, albumId);
}
