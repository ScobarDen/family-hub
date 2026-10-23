import {
  feedPageSize,
  feedUpcomingDays,
  todayNextCount,
  type FeedPage,
  type FeedUpcoming,
} from "@family-hub/contract";
import { dateInZone, daysAfter } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";
import { fallbackTimeZone, type Clock } from "@/common/clock";
import { parseKeyset } from "@/common/keyset";

import { agendaOf, pageOf } from "./feed.lib.ts";
import type { ActivitySource, FeedWindow, UpcomingSource } from "./feed.types.ts";

type FeedDependencies = { activity: ActivitySource[]; upcoming: UpcomingSource[]; clock: Clock };

function windowOf({ clock }: FeedDependencies, { member }: Membership): FeedWindow {
  const timeZone = member.timeZone ?? fallbackTimeZone;
  const today = dateInZone(clock.now(), timeZone);

  return { today, last: daysAfter(today, feedUpcomingDays - 1), timeZone };
}

async function ahead(dependencies: FeedDependencies, membership: Membership, window: FeedWindow) {
  const items = await Promise.all(
    dependencies.upcoming.map(async (source) => source.within(membership, window)),
  );

  return agendaOf(items.flat(), window);
}

// Each source returns one item more than a page, so the merge knows whether anything is left.
async function activityPage(
  { activity }: FeedDependencies,
  membership: Membership,
  before: string | undefined,
) {
  const keyset = parseKeyset(before);
  const items = await Promise.all(
    activity.map(async (source) => source.before(membership, { keyset, limit: feedPageSize + 1 })),
  );

  return pageOf(items.flat(), feedPageSize);
}

// What the morning digest says: what is overdue and what falls on the Member's today.
async function digestOf(dependencies: FeedDependencies, membership: Membership) {
  const window = windowOf(dependencies, membership);
  const { overdue, upcoming } = await ahead(dependencies, membership, window);

  return { overdue, today: upcoming.filter(({ date }) => date === window.today), upcoming };
}

// Events, Reminders and birthdays come and go by themselves; Plans and Due Dates wait to be closed.
function isClosable({ kind }: FeedUpcoming): boolean {
  return kind === "plan" || kind === "due";
}

export function createFeedService(dependencies: FeedDependencies) {
  return {
    async digestOf(membership: Membership) {
      const { overdue, today } = await digestOf(dependencies, membership);

      return { overdue, today };
    },
    // The hub's «Сделать сегодня» is the digest's closable part, so the bot and the app agree.
    async todayOf(membership: Membership) {
      const { overdue, today, upcoming } = await digestOf(dependencies, membership);
      const due = [...overdue, ...today].filter(isClosable);
      const dueKeys = new Set(due.map(({ key }) => key));

      return {
        due,
        next: upcoming.filter(({ key }) => !dueKeys.has(key)).slice(0, todayNextCount),
      };
    },
    page: async (membership: Membership, before: string | undefined): Promise<FeedPage> => {
      const page = await activityPage(dependencies, membership, before);

      if (before !== undefined) {
        return { overdue: [], upcoming: [], ...page };
      }

      return {
        ...(await ahead(dependencies, membership, windowOf(dependencies, membership))),
        ...page,
      };
    },
  };
}

export type FeedService = ReturnType<typeof createFeedService>;
