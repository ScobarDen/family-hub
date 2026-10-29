import type { CareEntry } from "@family-hub/contract";

import type { Membership } from "@/modules/auth";
import type { PhotoLinks } from "@/modules/photo";

import { toCareEntry } from "../care-entry.lib.ts";
import type { CareEntryRepo, CareEntryRow } from "../care-entry.repo.ts";

type PhotoDependencies = { entries: CareEntryRepo; links: PhotoLinks };

export async function withPhotos(
  { entries, links }: PhotoDependencies,
  { family, member, isFamilyOwner }: Membership,
  rows: CareEntryRow[],
): Promise<CareEntry[]> {
  const attached = await entries.photosOf(
    family.id,
    rows.map(({ id }) => id),
  );
  const viewer = { memberId: member.id, isFamilyOwner };

  return Promise.all(
    rows.map(async (row) =>
      toCareEntry(
        row,
        await Promise.all(
          attached
            .filter(({ careEntryId }) => careEntryId === row.id)
            .map(async ({ photo }) => links.photoOf(photo, viewer)),
        ),
      ),
    ),
  );
}

// An entry may only show photos already uploaded to the same Family.
export async function hasForeignPhotos(
  { entries }: PhotoDependencies,
  { family }: Membership,
  photoIds: string[],
): Promise<boolean> {
  const known = await entries.knownPhotoIds(family.id, photoIds);

  return photoIds.some((photoId) => !known.includes(photoId));
}
