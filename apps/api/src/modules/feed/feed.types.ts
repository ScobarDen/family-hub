import type { FeedActivity, FeedUpcoming } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { KeysetPage } from "@/common/keyset";

// The viewer's calendar days from today to the last day of Upcoming, in their zone.
export type FeedWindow = { today: string; last: string; timeZone: string };

// Up to `limit` items older than the keyset as the viewer may see them, keyed as in its SQL.
export type ActivitySource = {
  before(viewer: Membership, page: KeysetPage): Promise<FeedActivity[]>;
};

// What falls due by the window's last day, overdue items included.
export type UpcomingSource = {
  within(viewer: Membership, window: FeedWindow): Promise<FeedUpcoming[]>;
};
