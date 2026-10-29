import type { FeedActivity } from "@family-hub/contract";

import type { KeysetPage } from "@/common/keyset.lib.ts";
import type { Membership } from "@/modules/auth";
import { previewOf, type ActivitySource } from "@/modules/feed";
import type { PhotoLinks } from "@/modules/photo";

import { careTitleOf } from "../care-entry.lib.ts";
import type { CareEntryRepo } from "../care-entry.repo.ts";

type CareFeedDependencies = { entries: CareEntryRepo; links: PhotoLinks };

async function activityBefore(
  { entries, links }: CareFeedDependencies,
  viewer: Membership,
  page: KeysetPage,
): Promise<FeedActivity[]> {
  const familyId = viewer.family.id;
  const rows = await entries.activityBefore(familyId, page);
  const attached = await entries.photosOf(
    familyId,
    rows.map(({ id }) => id),
  );

  return Promise.all(
    rows.map(async (row) => ({
      kind: "care" as const,
      key: row.key,
      at: row.createdAt,
      memberName: row.memberName,
      memberPicture: row.memberPicture,
      title: `${careTitleOf(row.details)} — ${row.petName}`,
      petId: row.petId,
      entryId: row.id,
      ...(await previewOf(links, {
        rows: attached
          .filter(({ careEntryId }) => careEntryId === row.id)
          .map(({ photo }) => photo),
        viewer,
      })),
    })),
  );
}

export function createCareFeed(dependencies: CareFeedDependencies): ActivitySource {
  return { before: async (viewer, page) => activityBefore(dependencies, viewer, page) };
}
