import { feedPhotoPreview, type FeedActivity } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { PhotoLinks } from "@/common/photo-link";

import { uploadBatchesOf, type PhotoPreview } from "../feed.lib.ts";
import type { FeedCareRow, FeedPhotoRow, FeedRepo } from "../feed.repo.ts";

type PhotoDependencies = { feed: FeedRepo; links: PhotoLinks };

async function previewOf(
  links: PhotoLinks,
  { photos, membership }: { photos: FeedPhotoRow[]; membership: Membership },
): Promise<PhotoPreview> {
  const viewer = { memberId: membership.member.id, isFamilyOwner: membership.isFamilyOwner };

  return {
    photos: await Promise.all(
      photos.slice(0, feedPhotoPreview).map(async (photo) => links.photoOf(photo, viewer)),
    ),
    photoCount: photos.length,
  };
}

export async function carePreviews(
  { feed, links }: PhotoDependencies,
  { membership, care }: { membership: Membership; care: FeedCareRow[] },
): Promise<Map<string, PhotoPreview>> {
  const attached = await feed.entryPhotosOf(
    membership.family.id,
    care.map(({ id }) => id),
  );
  const previews = await Promise.all(
    care.map(async ({ id }) => {
      const photos = attached
        .filter(({ careEntryId }) => careEntryId === id)
        .map(({ photo }) => photo);

      return [id, await previewOf(links, { photos, membership })] as const;
    }),
  );

  return new Map(previews);
}

// Albums are always Shared, so every Member sees every batch.
export async function uploadActivity(
  { feed, links }: PhotoDependencies,
  membership: Membership,
): Promise<FeedActivity[]> {
  const batches = uploadBatchesOf(await feed.uploadsOf(membership.family.id));

  return Promise.all(
    batches.map(async (batch) => ({
      kind: "upload" as const,
      key: batch.key,
      at: batch.at,
      memberName: batch.memberName,
      albumId: batch.albumId,
      albumTitle: batch.albumTitle,
      ...(await previewOf(links, { photos: batch.photos, membership })),
    })),
  );
}
