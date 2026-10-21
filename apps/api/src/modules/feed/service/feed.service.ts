import { feedPageSize, feedUpcomingDays, type FeedPage } from "@family-hub/contract";
import { dateInZone, daysAfter } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { PhotoLinks } from "@/common/photo-link";

import {
  byDateAndTime,
  careActivity,
  goalActivity,
  joinActivity,
  pageOf,
  parseCursor,
  planActivity,
  visibleTrees,
} from "../feed.lib.ts";
import type { FeedRepo } from "../feed.repo.ts";
import { carePreviews, uploadActivity } from "./photo-activity.service.ts";
import {
  birthdayUpcoming,
  dueDeadlines,
  eventUpcoming,
  planDeadlines,
  reminderUpcoming,
  type Window,
} from "./upcoming.service.ts";

export type FeedDependencies = { feed: FeedRepo; clock: Clock; links: PhotoLinks };

// A Member whose zone the Mini App has not reported yet sees the Feed on UTC days.
const fallbackTimeZone = "UTC";

async function windowOf({ feed, clock }: FeedDependencies, memberId: string): Promise<Window> {
  const timeZone = (await feed.timeZoneOf(memberId)) ?? fallbackTimeZone;
  const today = dateInZone(clock.now(), timeZone);

  return { today, last: daysAfter(today, feedUpcomingDays - 1), timeZone };
}

async function ahead(
  { feed }: FeedDependencies,
  { family, member }: Membership,
  window: Window,
): Promise<Pick<FeedPage, "overdue" | "upcoming">> {
  const viewer = { familyId: family.id, memberId: member.id };
  const [events, reminders, pets, plans, dues] = await Promise.all([
    feed.events(viewer),
    feed.reminders(viewer),
    feed.petsInCare(family.id),
    feed.plans(family.id),
    feed.dues(family.id),
  ]);
  const deadlines = planDeadlines(plans, { memberId: member.id, window });
  const petDues = dueDeadlines(dues, { pets, window });

  return {
    overdue: [...deadlines.overdue, ...petDues.overdue].toSorted(byDateAndTime),
    upcoming: [
      ...events.flatMap((row) => eventUpcoming(row, window)),
      ...reminders.flatMap((row) => reminderUpcoming(row, window)),
      ...pets.flatMap((pet) => birthdayUpcoming(pet, window)),
      ...deadlines.upcoming,
      ...petDues.upcoming,
    ].toSorted(byDateAndTime),
  };
}

async function activityPage(
  dependencies: FeedDependencies,
  membership: Membership,
  before: string | undefined,
) {
  const { feed, clock } = dependencies;
  const { family, member } = membership;
  const cursor = parseCursor(before);
  const [care, pets, plans, joins, goals, movements] = await Promise.all([
    feed.careBefore({
      familyId: family.id,
      before: cursor?.at ?? clock.now(),
      limit: feedPageSize + 1,
    }),
    feed.petsOf(family.id),
    feed.plans(family.id),
    feed.joins(family.id),
    feed.goals(family.id),
    feed.movements(family.id),
  ]);
  const petNames = new Map(pets.map(({ id, name }) => [id, name]));
  const previews = await carePreviews(dependencies, { membership, care });

  return pageOf(
    [
      ...careActivity(care, { petNames, previews }),
      ...(await uploadActivity(dependencies, membership)),
      ...planActivity(visibleTrees(plans, member.id)),
      ...goalActivity({ goals, movements }, member.id),
      ...joinActivity(joins),
    ],
    { cursor, size: feedPageSize },
  );
}

export function createFeedService(dependencies: FeedDependencies) {
  return {
    page: async (membership: Membership, before: string | undefined): Promise<FeedPage> => {
      const page = await activityPage(dependencies, membership, before);

      if (before !== undefined) {
        return { overdue: [], upcoming: [], ...page };
      }

      const window = await windowOf(dependencies, membership.member.id);

      return { ...(await ahead(dependencies, membership, window)), ...page };
    },
  };
}

export type FeedService = ReturnType<typeof createFeedService>;
