import type { Visibility } from "@family-hub/contract";

type Owned = { visibility: Visibility | null; ownerMemberId: string | null };

// A Private record exists only for its owner.
export function isHiddenFrom(record: Owned, memberId: string): boolean {
  return record.visibility === "private" && record.ownerMemberId !== memberId;
}

// Others may already rely on a Shared record, so it never turns Private.
export function isTurnedPrivate(from: Visibility | null, to: Visibility): boolean {
  return from === "shared" && to === "private";
}
