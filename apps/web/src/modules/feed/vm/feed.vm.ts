import {
  action,
  atom,
  computed,
  noop,
  withAbort,
  withAsync,
  withAsyncData,
  wrap,
} from "@reatom/core";

import type { FeedActivity } from "@family-hub/contract";

import { reatomPhotoViewer } from "@/common/photo-viewer";
import type { Dialogs } from "@/common/telegram";

import type { FeedApi } from "../feed.api.ts";
import {
  blocksOf,
  summaryOf,
  type FeedBlock,
  type FeedFilter,
  type FeedItem,
} from "../feed.lib.ts";

export type FeedTarget =
  | { kind: "plan"; planId: string }
  | { kind: "event"; eventId: string }
  | { kind: "calendar" }
  | { kind: "pet"; petId: string }
  | { kind: "care-entry"; petId: string; entryId: string }
  | { kind: "goal"; goalId: string }
  | { kind: "album"; albumId: string }
  | { kind: "recipe"; recipeId: string };

export type FeedDependencies = {
  api: FeedApi;
  today: () => string;
  timeZone: () => string;
  onOpen: (target: FeedTarget) => void;
  onRecord: (due: { petId: string; entryId: string }) => void;
  telegram: Dialogs;
};

export const feedFilters: Array<{ value: FeedFilter; title: string }> = [
  { value: "all", title: "Всё" },
  { value: "plans", title: "Планы" },
  { value: "calendar", title: "Календарь" },
  { value: "pet", title: "Питомец" },
  { value: "goals", title: "Цели" },
  { value: "albums", title: "Альбомы" },
  { value: "recipes", title: "Рецепты" },
];

function petTargetOf(item: Extract<FeedItem, { petId: string }>): FeedTarget {
  return item.kind === "care"
    ? { kind: "care-entry", petId: item.petId, entryId: item.entryId }
    : { kind: "pet", petId: item.petId };
}

function targetOf(item: FeedItem): FeedTarget | undefined {
  if (item.kind === "plan") {
    return { kind: "plan", planId: item.planId };
  }

  if (item.kind === "event") {
    return { kind: "event", eventId: item.eventId };
  }

  if (item.kind === "reminder") {
    return { kind: "calendar" };
  }

  if (item.kind === "goal") {
    return { kind: "goal", goalId: item.goalId };
  }

  if (item.kind === "upload") {
    return { kind: "album", albumId: item.albumId };
  }

  if (item.kind === "cooked") {
    return { kind: "recipe", recipeId: item.recipeId };
  }

  return item.kind === "joined" ? undefined : petTargetOf(item);
}

function reatomPages(api: FeedApi) {
  const version = atom(0, "feed.version");
  const first = computed(async () => {
    version();

    return wrap(api.page());
  }, "feed.first").extend(withAsyncData());
  const older = atom<FeedActivity[]>([], "feed.older");
  const olderNext = atom<string | null | undefined>(undefined, "feed.olderNext");
  // Until an older page comes, the first one says where the next begins; null is the end.
  const next = computed(() => {
    const loaded = olderNext();

    return loaded === undefined ? (first.data()?.next ?? null) : loaded;
  }, "feed.next");
  const loadMore = action(async () => {
    const cursor = next();

    if (cursor !== null) {
      const page = await wrap(api.page(cursor));

      older.set([...older(), ...page.activity]);
      olderNext.set(page.next);
    }
  }, "feed.loadMore").extend(withAsync(), withAbort());
  // Older pages hang off the first one's cursor, so a fresh first page drops them.
  const reload = action(() => {
    loadMore.abort();
    older.set([]);
    olderNext.set(undefined);
    version.set(version() + 1);
  }, "feed.reload");

  return { first, older, next, loadMore, reload };
}

type Pages = ReturnType<typeof reatomPages>;

function finder({ first, older }: Pages) {
  return (key: string): FeedItem | undefined =>
    [
      ...(first.data()?.overdue ?? []),
      ...(first.data()?.upcoming ?? []),
      ...(first.data()?.activity ?? []),
      ...older(),
    ].find((item) => item.key === key);
}

// A completed step leaves what is ahead; its Activity line comes with the next load.
function reatomCompletion(api: FeedApi, pages: Pages) {
  const find = finder(pages);

  return action(async (key: string) => {
    const item = find(key);
    const page = pages.first.data();

    if (item?.kind === "plan" && "subplanId" in item && page !== undefined) {
      await wrap(api.complete(item));
      pages.first.data.set({
        ...page,
        overdue: page.overdue.filter((other) => other.key !== key),
        upcoming: page.upcoming.filter((other) => other.key !== key),
      });
    }
  }, "feed.complete").extend(withAsync());
}

function reatomBlocks(dependencies: FeedDependencies, pages: Pages, filter: () => FeedFilter) {
  return computed((): FeedBlock[] => {
    const page = pages.first.data();

    return blocksOf(
      {
        overdue: page?.overdue ?? [],
        upcoming: page?.upcoming ?? [],
        activity: [...(page?.activity ?? []), ...pages.older()],
      },
      {
        filter: filter(),
        viewer: { today: dependencies.today(), timeZone: dependencies.timeZone() },
      },
    );
  }, "feed.blocks");
}

function reatomTaps(dependencies: FeedDependencies, pages: Pages) {
  const find = finder(pages);

  return {
    record: action((key: string) => {
      const item = find(key);

      if (item?.kind === "due") {
        dependencies.onRecord({ petId: item.petId, entryId: item.entryId });
      }
    }, "feed.record"),
    open: action((key: string) => {
      const item = find(key);
      const target = item && targetOf(item);

      if (target !== undefined) {
        dependencies.onOpen(target);
      }
    }, "feed.open"),
  };
}

export function reatomFeed(dependencies: FeedDependencies) {
  const pages = reatomPages(dependencies.api);
  const filter = atom<FeedFilter>("all", "feed.filter");
  const complete = reatomCompletion(dependencies.api, pages);

  return {
    filter: computed(() => filter(), "feed.chosenFilter"),
    isLoading: computed(
      () => pages.first.data() === undefined && !pages.first.ready(),
      "feed.isLoading",
    ),
    blocks: reatomBlocks(dependencies, pages, filter),
    summary: computed((): string | undefined => {
      const page = pages.first.data();

      return page === undefined ? undefined : summaryOf(page, dependencies.today());
    }, "feed.summary"),
    canLoadMore: computed(
      () => pages.next() !== null && pages.loadMore.ready(),
      "feed.canLoadMore",
    ),
    isChanging: computed(() => !complete.ready(), "feed.isChanging"),

    choose: action((chosen: FeedFilter) => {
      filter.set(chosen);
    }, "feed.choose"),
    reload: pages.reload,
    loadMore: action(() => {
      pages.loadMore().catch(noop);
    }, "feed.more"),
    complete: action((key: string) => {
      complete(key).catch(noop);
    }, "feed.completeStep"),
    ...reatomTaps(dependencies, pages),
    viewer: reatomPhotoViewer({
      ...dependencies,
      onDeleted: pages.reload,
    }),
  };
}

export type FeedModel = ReturnType<typeof reatomFeed>;
