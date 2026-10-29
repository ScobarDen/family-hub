import {
  action,
  atom,
  computed,
  withAbort,
  withAsync,
  withAsyncData,
  withRollback,
  wrap,
} from "@reatom/core";

import { feedPage, type FeedActivity, type FeedPage } from "@family-hub/contract";

import { rolledBack } from "@/common/records.lib.ts";
import type { DeviceCache } from "@/modules/device-cache";
import type { LiveVersion } from "@/modules/live-updates";
import { reatomPhotoViewer } from "@/modules/photo-viewer";
import { detached, reatomOptimistic, reatomRollbackFailure, readOnly } from "@/modules/state";
import type { Dialogs, Fullscreen, Haptics } from "@/modules/telegram";

import type { FeedApi } from "../feed.api.ts";
import {
  blocksOf,
  summaryOf,
  type FeedBlock,
  type FeedFilter,
  type FeedItem,
} from "../feed.lib.ts";

export type FeedTarget =
  | { kind: "task"; taskId: string }
  | { kind: "pet"; petId: string }
  | { kind: "care-entry"; petId: string; entryId: string }
  | { kind: "goal"; goalId: string }
  | { kind: "album"; albumId: string };

export type FeedDependencies = LiveVersion & {
  api: FeedApi;
  deviceCache: Pick<DeviceCache, "withDeviceCache">;
  today: () => string;
  timeZone: () => string;
  onOpen: (target: FeedTarget) => void;
  telegram: Dialogs & Fullscreen & { haptics: Haptics };
};

export const feedFilters: Array<{ value: FeedFilter; title: string }> = [
  { value: "all", title: "Всё" },
  { value: "tasks", title: "Дела" },
  { value: "pet", title: "Питомцы" },
  { value: "goals", title: "Цели" },
  { value: "albums", title: "Альбомы" },
];

function petTargetOf(item: Extract<FeedItem, { petId: string }>): FeedTarget {
  return item.kind === "care"
    ? { kind: "care-entry", petId: item.petId, entryId: item.entryId }
    : { kind: "pet", petId: item.petId };
}

function targetOf(item: FeedItem): FeedTarget | undefined {
  if (item.kind === "task") {
    return { kind: "task", taskId: item.taskId };
  }

  if (item.kind === "goal") {
    return { kind: "goal", goalId: item.goalId };
  }

  if (item.kind === "upload") {
    return { kind: "album", albumId: item.albumId };
  }

  return item.kind === "joined" ? undefined : petTargetOf(item);
}

type PageStates = {
  beforeState: FeedPage;
  transactionState: FeedPage;
  currentState: FeedPage;
};

// A failed completion brings back its own line only, keeping the ones completed meanwhile.
function rolledBackPage({ beforeState, transactionState, currentState }: PageStates) {
  function lines(part: "overdue" | "upcoming") {
    return rolledBack(
      {
        beforeState: beforeState[part],
        transactionState: transactionState[part],
        currentState: currentState[part],
      },
      ({ key }) => key,
    );
  }

  return { ...currentState, overdue: lines("overdue"), upcoming: lines("upcoming") };
}

type OlderPages = { live: number | undefined; activity: FeedActivity[]; next: string | null };

type PagesDependencies = Pick<FeedDependencies, "api" | "liveVersion" | "deviceCache">;

function reatomFirstPage(
  { api, liveVersion, deviceCache }: PagesDependencies,
  version: () => number,
) {
  const first = computed(async () => {
    version();
    liveVersion?.();

    return wrap(api.page());
  }, "feed.first").extend(withAsyncData());

  first.data.extend(
    deviceCache.withDeviceCache({ key: "feed", schema: feedPage, version: 1 }),
    withRollback({ onRollback: rolledBackPage }),
  );

  return first;
}

function reatomPages(dependencies: PagesDependencies) {
  const { api, liveVersion } = dependencies;
  const version = atom(0, "feed.version");
  const first = reatomFirstPage(dependencies, version);
  // Older pages hang off the first one's cursor, so a first page refetched for another Member's
  // change drops them as well.
  const loaded = atom<OlderPages | undefined>(undefined, "feed.loaded");
  const current = computed(() => {
    const pages = loaded();

    return pages?.live === liveVersion?.() ? pages : undefined;
  }, "feed.current");
  const older = computed(() => current()?.activity ?? [], "feed.older");
  // Until an older page comes, the first one says where the next begins; null is the end.
  const next = computed(() => {
    const pages = current();

    return pages === undefined ? (first.data()?.next ?? null) : pages.next;
  }, "feed.next");
  const loadMore = action(async () => {
    const cursor = next();
    const live = liveVersion?.();

    if (cursor !== null) {
      const page = await wrap(api.page(cursor));

      loaded.set({ live, activity: [...older(), ...page.activity], next: page.next });
    }
  }, "feed.loadMore").extend(withAsync(), withAbort());
  const reload = action(() => {
    loadMore.abort();
    loaded.set(undefined);
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

// A completed step leaves what is ahead at once; its Activity line comes with the next load.
function reatomCompletion({ api, telegram }: FeedDependencies, pages: Pages) {
  const find = finder(pages);
  const failure = reatomRollbackFailure("feed.failure", telegram.haptics);
  const complete = reatomOptimistic(
    async (key: string) => {
      const item = find(key);
      const page = pages.first.data();

      if (item?.kind === "task" && "occurrence" in item && page !== undefined) {
        telegram.haptics.success();
        pages.first.data.set({
          ...page,
          overdue: page.overdue.filter((other) => other.key !== key),
          upcoming: page.upcoming.filter((other) => other.key !== key),
        });
        await wrap(api.complete(item));
      }
    },
    {
      name: "feed.complete",
      failure,
      refusal: "Не получилось отметить. Попробуйте ещё раз.",
    },
  );

  return { complete, failure };
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
  const pages = reatomPages(dependencies);
  const filter = atom<FeedFilter>("all", "feed.filter");
  const { complete, failure } = reatomCompletion(dependencies, pages);

  return {
    filter: readOnly(filter),
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
    failure: failure.failure,
    dismissFailure: failure.dismiss,

    choose: action((chosen: FeedFilter) => {
      dependencies.telegram.haptics.select();
      filter.set(chosen);
    }, "feed.choose"),
    reload: pages.reload,
    loadMore: detached(pages.loadMore, "feed.more"),
    complete: detached(complete, "feed.completeStep"),
    ...reatomTaps(dependencies, pages),
    viewer: reatomPhotoViewer({
      ...dependencies,
      onDeleted: pages.reload,
      failure,
    }),
  };
}

export type FeedModel = ReturnType<typeof reatomFeed>;
