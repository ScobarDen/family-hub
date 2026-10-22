import { feedPageSize, feedUpcomingDays, type FeedPage } from "@family-hub/contract";
import { dateInZone, daysAfter } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";
import { fallbackTimeZone, type Clock } from "@/common/clock";
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
import type { FeedPlanRow, FeedRepo } from "../feed.repo.ts";
import { carePreviews, cookedActivity, uploadActivity } from "./photo-activity.service.ts";
import {
  birthdayUpcoming,
  dueDeadlines,
  eventUpcoming,
  planDeadlines,
  reminderUpcoming,
  type Window,
} from "./upcoming.service.ts";

type FeedDependencies = { feed: FeedRepo; clock: Clock; links: PhotoLinks };

function windowOf({ clock }: FeedDependencies, { member }: Membership): Window {
  const timeZone = member.timeZone ?? fallbackTimeZone;
  const today = dateInZone(clock.now(), timeZone);

  return { today, last: daysAfter(today, feedUpcomingDays - 1), timeZone };
}

async function ahead(
  { feed }: FeedDependencies,
  { family, member }: Membership,
  { window, plans }: { window: Window; plans: FeedPlanRow[] },
): Promise<Pick<FeedPage, "overdue" | "upcoming">> {
  const viewer = { familyId: family.id, memberId: member.id };
  const [events, reminders, pets, dues] = await Promise.all([
    feed.events(viewer),
    feed.reminders(viewer),
    feed.petsInCare(family.id),
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
  { before, plans }: { before: string | undefined; plans: FeedPlanRow[] },
) {
  const { feed, clock } = dependencies;
  const { family, member } = membership;
  const cursor = parseCursor(before);
  const [care, pets, joins, goals, movements] = await Promise.all([
    feed.careBefore({
      familyId: family.id,
      before: cursor?.at ?? clock.now(),
      limit: feedPageSize + 1,
    }),
    feed.petsOf(family.id),
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
      ...(await cookedActivity(dependencies, membership)),
      ...planActivity(visibleTrees(plans, member.id)),
      ...goalActivity({ goals, movements }, member.id),
      ...joinActivity(joins),
    ],
    { cursor, size: feedPageSize },
  );
}

export function createFeedService(dependencies: FeedDependencies) {
  return {
    // What the morning digest says: what is overdue and what falls on the Member's today.
    async digestOf(membership: Membership) {
      const window = windowOf(dependencies, membership);
      const plans = await dependencies.feed.plans(membership.family.id);
      const { overdue, upcoming } = await ahead(dependencies, membership, { window, plans });

      return { overdue, today: upcoming.filter(({ date }) => date === window.today) };
    },
    page: async (membership: Membership, before: string | undefined): Promise<FeedPage> => {
      const plans = await dependencies.feed.plans(membership.family.id);
      const page = await activityPage(dependencies, membership, { before, plans });

      if (before !== undefined) {
        return { overdue: [], upcoming: [], ...page };
      }

      const window = windowOf(dependencies, membership);

      return { ...(await ahead(dependencies, membership, { window, plans })), ...page };
    },
  };
}

export type FeedService = ReturnType<typeof createFeedService>;
