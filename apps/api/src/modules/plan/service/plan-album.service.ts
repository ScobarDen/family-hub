import { planAlbumPreview, type Plan, type PlanAlbum } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import { toPlan } from "../plan.lib.ts";
import type { PlanTree } from "../plan.repo.ts";
import type { PlanDependencies } from "../plan.types.ts";

// The strip shows the Album's first photos by when they were taken.
async function albumOf(
  { plans, links }: PlanDependencies,
  { family, member, isFamilyOwner }: Membership,
  albumId: string | null,
): Promise<PlanAlbum | null> {
  const row = albumId === null ? undefined : await plans.albumOf({ familyId: family.id, albumId });

  if (!row) {
    return null;
  }

  const sorted = row.photos.toSorted(
    (left, right) => (left.takenAt ?? left.createdAt) - (right.takenAt ?? right.createdAt),
  );
  const viewer = { memberId: member.id, isFamilyOwner };

  return {
    id: row.id,
    title: row.title,
    photos: await Promise.all(
      sorted.slice(0, planAlbumPreview).map(async (photo) => links.photoOf(photo, viewer)),
    ),
    photoCount: sorted.length,
  };
}

export async function planOf(
  dependencies: PlanDependencies,
  membership: Membership,
  tree: PlanTree,
): Promise<Plan> {
  return toPlan(tree, {
    memberId: membership.member.id,
    album: await albumOf(dependencies, membership, tree.root.albumId),
  });
}
