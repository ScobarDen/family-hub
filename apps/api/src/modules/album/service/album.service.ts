import type { AlbumChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import type { AlbumDeletion } from "../album.repo.ts";
import type { AlbumDependencies } from "../album.types.ts";
import { allPhotos, list } from "./album-read.service.ts";
import { addPhotos, create, current, remove, removePhoto, update } from "./album-write.service.ts";

type PhotoTarget = { albumId: string; photoId: string };

export function createAlbumService(dependencies: AlbumDependencies) {
  return {
    list: async (membership: Membership) => list(dependencies, membership),
    get: async (membership: Membership, albumId: string) =>
      current(dependencies, membership, albumId),
    allPhotos: async (membership: Membership) => allPhotos(dependencies, membership),
    create: async (membership: Membership, change: AlbumChange) =>
      create(dependencies, membership, change),
    update: async (membership: Membership, albumId: string, change: AlbumChange) =>
      update(dependencies, membership, { albumId, change }),
    remove: async (membership: Membership, albumId: string, scope: AlbumDeletion) =>
      remove(dependencies, membership, { albumId, scope }),
    addPhotos: async (membership: Membership, albumId: string, photoIds: string[]) =>
      addPhotos(dependencies, membership, { albumId, photoIds }),
    removePhoto: async (membership: Membership, target: PhotoTarget) =>
      removePhoto(dependencies, membership, target),
  };
}

export type AlbumService = ReturnType<typeof createAlbumService>;
