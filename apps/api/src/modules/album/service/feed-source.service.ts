import type { FeedActivity } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { KeysetPage } from "@/common/keyset";
import type { PhotoLinks } from "@/common/photo-link";
import { previewOf, type ActivitySource } from "@/modules/feed";

import type { AlbumRepo } from "../album.repo.ts";

type AlbumFeedDependencies = { albums: AlbumRepo; links: PhotoLinks };

// Albums are always Shared, so every Member sees every Upload Batch.
async function uploadsBefore(
  { albums, links }: AlbumFeedDependencies,
  viewer: Membership,
  page: KeysetPage,
): Promise<FeedActivity[]> {
  const batches = await albums.batchesBefore(viewer.family.id, page);
  const photos = await albums.batchPhotosOf(
    viewer.family.id,
    batches.map(({ id }) => id),
  );

  return Promise.all(
    batches.map(async (batch) => ({
      kind: "upload" as const,
      key: batch.key,
      at: batch.lastAddedAt,
      memberName: batch.memberName,
      albumId: batch.albumId,
      albumTitle: batch.albumTitle,
      ...(await previewOf(links, {
        rows: photos.filter(({ batchId }) => batchId === batch.id).map(({ photo }) => photo),
        viewer,
      })),
    })),
  );
}

export function createAlbumFeed(dependencies: AlbumFeedDependencies): ActivitySource {
  return {
    before: async (viewer, page) => uploadsBefore(dependencies, viewer, page),
  };
}
