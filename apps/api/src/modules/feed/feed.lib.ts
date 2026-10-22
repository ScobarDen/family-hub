import {
  feedPhotoPreview,
  type FeedActivity,
  type FeedUpcoming,
  type Photo,
} from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import { formatKeyset, newestFirst } from "@/common/keyset";
import type { PhotoLinks } from "@/common/photo-link";

import type { FeedWindow } from "./feed.types.ts";

function byDateAndTime(left: FeedUpcoming, right: FeedUpcoming): number {
  const leftTime = "time" in left ? (left.time ?? "") : "";
  const rightTime = "time" in right ? (right.time ?? "") : "";

  return left.date === right.date
    ? leftTime.localeCompare(rightTime)
    : left.date.localeCompare(right.date);
}

export function agendaOf(items: FeedUpcoming[], { today, last }: FeedWindow) {
  const sorted = items.toSorted(byDateAndTime);

  return {
    overdue: sorted.filter(({ date }) => date < today),
    upcoming: sorted.filter(({ date }) => date >= today && date <= last),
  };
}

export function pageOf(
  items: FeedActivity[],
  size: number,
): { activity: FeedActivity[]; next: string | null } {
  const sorted = items.toSorted(newestFirst);
  const activity = sorted.slice(0, size);
  const last = activity.at(-1);

  return {
    activity,
    next: sorted.length > size && last !== undefined ? formatKeyset(last) : null,
  };
}

type PhotoRow = Parameters<PhotoLinks["photoOf"]>[0];

export async function previewOf(
  links: PhotoLinks,
  { rows, viewer }: { rows: PhotoRow[]; viewer: Membership },
): Promise<{ photos: Photo[]; photoCount: number }> {
  const owner = { memberId: viewer.member.id, isFamilyOwner: viewer.isFamilyOwner };

  return {
    photos: await Promise.all(
      rows.slice(0, feedPhotoPreview).map(async (row) => links.photoOf(row, owner)),
    ),
    photoCount: rows.length,
  };
}
