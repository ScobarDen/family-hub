import type { FeedActivity, FeedUpcoming } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { KeysetPage } from "@/common/keyset";
import type { PhotoLinks } from "@/common/photo-link";
import {
  previewOf,
  type ActivitySource,
  type FeedWindow,
  type UpcomingSource,
} from "@/modules/feed";

import { careTitleOf } from "../care-entry.lib.ts";
import type { CareEntryRepo } from "../care-entry.repo.ts";
import { openDueDates } from "../due-date/index.ts";

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

async function dueWithin(
  { entries }: CareFeedDependencies,
  { family }: Membership,
  { last }: FeedWindow,
): Promise<FeedUpcoming[]> {
  const [pets, candidates] = await Promise.all([
    entries.petsOf(family.id),
    entries.allDueCandidates(family.id),
  ]);

  return openDueDates({ pets, entries: candidates })
    .filter(({ dueDate }) => dueDate <= last)
    .map(({ entryId, petId, kind, title, dueDate }) => ({
      kind: "due",
      key: `due-${entryId}`,
      title,
      date: dueDate,
      careKind: kind,
      petId,
      entryId,
    }));
}

export function createCareFeed(
  dependencies: CareFeedDependencies,
): ActivitySource & UpcomingSource {
  return {
    before: async (viewer, page) => activityBefore(dependencies, viewer, page),
    within: async (viewer, window) => dueWithin(dependencies, viewer, window),
  };
}
