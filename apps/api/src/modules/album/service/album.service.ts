import type { AlbumChange } from "@family-hub/contract";

import { bindFirst } from "@/common/bind.lib.ts";
import type { Membership } from "@/modules/auth";

import type { AlbumDeletion } from "../album.repo.ts";
import type { AlbumDependencies } from "../album.types.ts";
import { allPhotos, list } from "./album-read.service.ts";
import { addPhotos, create, current, remove, removePhoto, update } from "./album-write.service.ts";
import { sharePhoto } from "./share.service.ts";

export function createAlbumService(dependencies: AlbumDependencies) {
  return {
    ...bindFirst(dependencies, { list, get: current, allPhotos, create, removePhoto, sharePhoto }),
    update: async (membership: Membership, albumId: string, change: AlbumChange) =>
      update(dependencies, membership, { albumId, change }),
    remove: async (membership: Membership, albumId: string, scope: AlbumDeletion) =>
      remove(dependencies, membership, { albumId, scope }),
    addPhotos: async (membership: Membership, albumId: string, photoIds: string[]) =>
      addPhotos(dependencies, membership, { albumId, photoIds }),
  };
}

export type AlbumService = ReturnType<typeof createAlbumService>;
