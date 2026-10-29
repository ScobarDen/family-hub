import {
  action,
  atom,
  computed,
  noop,
  peek,
  withAsync,
  withAsyncData,
  wrap,
  type Atom,
} from "@reatom/core";
import { z } from "zod";

import { today, type FeedUpcoming, type SlotModule, type Today } from "@family-hub/contract";

import { detached, reatomRollbackFailure, type RollbackFailure } from "@/modules/changes";
import type { DeviceCache } from "@/modules/device-cache";
import type { LiveVersion } from "@/modules/live-updates";
import type { Haptics } from "@/modules/telegram";

import type { OccurrenceTarget, TodayApi } from "../today.api.ts";
import { dueRowOf, headerOf, moreOf, nextRowOf, tilesOf, type Tile } from "../today.lib.ts";

export type TodayTarget =
  | { kind: "task"; taskId: string }
  | { kind: "pet"; petId: string }
  | { kind: "new-pet" }
  | { kind: "care-entry-for-pet"; petId: string; title: string };

export type TodayDependencies = LiveVersion & {
  api: TodayApi;
  deviceCache: Pick<DeviceCache, "withDeviceCache">;
  today: () => string;
  telegram: { haptics: Pick<Haptics, "success" | "select" | "error"> };
  onOpen: (target: TodayTarget) => void;
  onOpenSection: (module: SlotModule) => void;
  onOpenFeed: () => void;
};

const shownDue = 3;

type TaskItem = Extract<FeedUpcoming, { kind: "task" }>;

type Completing = {
  key: string;
  title: string;
  target: OccurrenceTarget;
  // A Pet's Task, not one of its Subtasks, may be recorded in the Pet's journal.
  petId: string | undefined;
  done: Promise<void>;
};

// The date the Member's day was computed for, so a cached Today from another day is told apart.
type TodayOn = Today & { date: string };

const todayOn = today.extend({ date: z.string() });

type Loaded = { data: () => TodayOn | undefined };

function targetOf(item: FeedUpcoming): TodayTarget {
  return item.kind === "task"
    ? { kind: "task", taskId: item.taskId }
    : { kind: "pet", petId: item.petId };
}

// One Pet opens its card, none offers adding one, several (or an unread tile) open the list.
function petTargetOf(pet: Today["tiles"]["pet"] | undefined): TodayTarget | undefined {
  if (pet === null || pet === undefined) {
    return undefined;
  }

  if (pet.only !== null) {
    return { kind: "pet", petId: pet.only.petId };
  }

  return pet.activeCount === 0 ? { kind: "new-pet" } : undefined;
}

function reatomData({
  api,
  liveVersion,
  deviceCache,
  today: dateOfToday,
}: Pick<TodayDependencies, "api" | "liveVersion" | "deviceCache" | "today">) {
  const version = atom(0, "today.version");
  const data = computed(async (): Promise<TodayOn> => {
    version();
    liveVersion?.();
    const date = peek(dateOfToday);

    return { ...(await wrap(api.load())), date };
  }, "today.data").extend(withAsyncData());

  data.data.extend(deviceCache.withDeviceCache({ key: "today", schema: todayOn, version: 1 }));

  return {
    data,
    reload: action(() => {
      version.set(version() + 1);
    }, "today.reload"),
  };
}

function reatomHidden() {
  const hidden = atom<string[]>([], "today.hidden");

  return {
    hidden,
    hide: action((key: string) => {
      hidden.set([...hidden(), key]);
    }, "today.hide"),
    show: action((key: string) => {
      hidden.set(hidden().filter((other) => other !== key));
    }, "today.show"),
  };
}

type CompletionState = ReturnType<typeof reatomHidden> & {
  pending: Atom<Completing | undefined>;
  failure: RollbackFailure;
};

// The server hears of the tap at once, so closing the app loses nothing; the undo stays offered
// with no timer, until it is dismissed or the next Occurrence is completed.
function reatomComplete(
  { api, telegram }: Pick<TodayDependencies, "api" | "telegram">,
  { state, onSettled }: { state: CompletionState; onSettled: () => void },
) {
  const { pending, failure, hide, show } = state;

  return action(async ({ key, title, taskId, occurrence, subtaskId, petId }: TaskItem) => {
    const target = { taskId, occurrence, subtaskId };
    const completing = {
      key,
      title,
      target,
      petId: subtaskId === null ? (petId ?? undefined) : undefined,
      done: api.complete(target),
    };

    failure.dismiss();
    telegram.haptics.success();
    hide(key);
    pending.set(completing);

    try {
      await wrap(completing.done);
    } catch (error) {
      show(key);
      pending.set(pending() === completing ? undefined : pending());
      failure.report(error, `Не получилось отметить «${title}». Попробуйте ещё раз.`);

      return;
    }

    onSettled();
  }, "today.complete").extend(withAsync());
}

// The undo reopens the Occurrence once its completion is in.
function reatomRevert(
  { api, telegram }: Pick<TodayDependencies, "api" | "telegram">,
  { state, onSettled }: { state: CompletionState; onSettled: () => void },
) {
  const { pending, failure, show } = state;

  return action(async () => {
    const completing = pending();

    if (completing === undefined) {
      return;
    }

    pending.set(undefined);
    telegram.haptics.select();
    show(completing.key);

    try {
      await wrap(completing.done);
      await wrap(api.reopen(completing.target));
    } catch (error) {
      failure.report(error, `Не получилось вернуть «${completing.title}». Попробуйте ещё раз.`);
    }

    onSettled();
  }, "today.revertCompletion").extend(withAsync());
}

function reatomCompletion(
  dependencies: Pick<TodayDependencies, "api" | "onOpen" | "telegram">,
  onSettled: () => void,
) {
  const state: CompletionState = {
    ...reatomHidden(),
    pending: atom<Completing | undefined>(undefined, "today.pending"),
    failure: reatomRollbackFailure("today.completionFailure", dependencies.telegram.haptics),
  };

  return {
    hidden: state.hidden,
    pending: state.pending,
    failure: state.failure,
    complete: reatomComplete(dependencies, { state, onSettled }),
    dismiss: action(() => {
      state.pending.set(undefined);
    }, "today.dismissUndo"),
    recordCareEntry: action(() => {
      const completing = state.pending();

      state.pending.set(undefined);

      if (completing?.petId !== undefined) {
        dependencies.onOpen({
          kind: "care-entry-for-pet",
          petId: completing.petId,
          title: completing.title,
        });
      }
    }, "today.recordCareEntry"),
    dismissFailure: state.failure.dismiss,
    revert: reatomRevert(dependencies, { state, onSettled }),
  };
}

type Completion = ReturnType<typeof reatomCompletion>;

// A completed row stays among the rows, marked done, until Today is read again.
function reatomRows(
  dependencies: TodayDependencies,
  {
    listed,
    due,
    hidden,
  }: { listed: () => FeedUpcoming[]; due: () => FeedUpcoming[]; hidden: () => string[] },
) {
  return computed(() => {
    const shown = new Set(
      due()
        .slice(0, shownDue)
        .map(({ key }) => key),
    );

    return listed()
      .filter(({ key }) => shown.has(key) || hidden().includes(key))
      .map((item) =>
        dueRowOf(item, { today: dependencies.today(), isDone: hidden().includes(item.key) }),
      );
  }, "today.rows");
}

function reatomBlocks(dependencies: TodayDependencies, data: Loaded, completion: Completion) {
  // Yesterday's rows under today's heading would complete the wrong Occurrence.
  const isDueOutdated = computed(() => {
    const loaded = data.data();

    return loaded !== undefined && loaded.date !== dependencies.today();
  }, "today.isDueOutdated");
  const listed = computed(() => (isDueOutdated() ? [] : (data.data()?.due ?? [])), "today.listed");
  const due = computed(
    () => listed().filter(({ key }) => !completion.hidden().includes(key)),
    "today.due",
  );
  const tiles = computed((): Tile[] => {
    const loaded = data.data();

    return loaded === undefined ? [] : tilesOf(loaded.tiles, dependencies.today());
  }, "today.tiles");

  return {
    isDueOutdated,
    header: computed(
      () => (data.data() === undefined || isDueOutdated() ? undefined : headerOf(due().length)),
      "today.header",
    ),
    rows: reatomRows(dependencies, { listed, due, hidden: completion.hidden }),
    more: computed(() => moreOf(due().length - shownDue), "today.more"),
    next: computed(
      () => (data.data()?.next ?? []).map((item) => nextRowOf(item, dependencies.today())),
      "today.next",
    ),
    tiles,
    // «Разделы» sends «+ Взнос» to this Goal.
    nearestGoalId: computed(() => data.data()?.tiles.goals?.nearest?.goalId, "today.nearestGoal"),
  };
}

function reatomTaps(dependencies: TodayDependencies, data: Loaded, completion: Completion) {
  function find(key: string): FeedUpcoming | undefined {
    const loaded = data.data();

    return [...(loaded?.due ?? []), ...(loaded?.next ?? [])].find((item) => item.key === key);
  }

  return {
    complete: action((key: string) => {
      const item = find(key);

      if (item?.kind === "task") {
        completion.complete(item).catch(noop);
      }
    }, "today.completeRow"),
    revert: detached(completion.revert, "today.revert"),
    dismissUndo: completion.dismiss,
    recordCareEntry: completion.recordCareEntry,
    dismissFailure: completion.dismissFailure,
    openItem: action((key: string) => {
      const item = find(key);

      if (item !== undefined) {
        dependencies.onOpen(targetOf(item));
      }
    }, "today.openItem"),
    openTile: action((module: SlotModule) => {
      const target = module === "pet" ? petTargetOf(data.data()?.tiles.pet) : undefined;

      if (target === undefined) {
        dependencies.onOpenSection(module);
      } else {
        dependencies.onOpen(target);
      }
    }, "today.openTile"),
    openFeed: action(() => {
      dependencies.onOpenFeed();
    }, "today.openFeed"),
  };
}

export function reatomToday(dependencies: TodayDependencies) {
  const { data, reload } = reatomData(dependencies);
  const completion = reatomCompletion(dependencies, reload);

  return {
    isLoading: computed(() => data.data() === undefined && !data.ready(), "today.isLoading"),
    // A failed refresh keeps what was already shown.
    loadFailure: computed(
      () =>
        data.error() === undefined || data.data() !== undefined
          ? undefined
          : "Не получилось загрузить «Сегодня».",
      "today.loadFailure",
    ),
    // The undo bar and the failure bar share one place; the undo keeps it while it is offered.
    completionFailure: computed(
      () => (completion.pending() === undefined ? completion.failure.failure() : undefined),
      "today.shownFailure",
    ),
    undo: computed(() => {
      const completing = completion.pending();

      return completing === undefined
        ? undefined
        : { title: completing.title, hasPet: completing.petId !== undefined };
    }, "today.undo"),
    reload,
    ...reatomBlocks(dependencies, data, completion),
    ...reatomTaps(dependencies, data, completion),
  };
}

export type TodayModel = ReturnType<typeof reatomToday>;
