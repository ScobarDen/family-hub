import {
  action,
  atom,
  computed,
  noop,
  withAsync,
  withAsyncData,
  wrap,
  type Atom,
} from "@reatom/core";

import type { AppModule, FeedUpcoming, Plan, SlotModule, Today } from "@family-hub/contract";

import { detached, readOnly } from "@/common/state";

import type { PlanOrSubplan, TodayApi } from "../today.api.ts";
import {
  dueRowOf,
  feedStatusOf,
  headerOf,
  moreOf,
  nextRowOf,
  statusOf,
  tilesOf,
  type Tile,
} from "../today.lib.ts";

export type TodayTarget =
  | { kind: "plan"; planId: string }
  | { kind: "event"; eventId: string }
  | { kind: "calendar" }
  | { kind: "pet"; petId: string }
  | { kind: "new-pet" };

export type TodayDependencies = {
  api: TodayApi;
  today: () => string;
  onOpen: (target: TodayTarget) => void;
  onOpenSection: (module: SlotModule) => void;
  onRecord: (due: { petId: string; entryId: string }) => void;
  onOpenFeed: () => void;
};

const shownDue = 3;

type PlanItem = Extract<FeedUpcoming, { kind: "plan" }>;

type Completing = { key: string; title: string; target: PlanOrSubplan; done: Promise<Plan> };

type Loaded = { data: () => Today | undefined };

function targetOf(item: FeedUpcoming): TodayTarget {
  if (item.kind === "plan") {
    return { kind: "plan", planId: item.planId };
  }

  if (item.kind === "event") {
    return { kind: "event", eventId: item.eventId };
  }

  return item.kind === "reminder" ? { kind: "calendar" } : { kind: "pet", petId: item.petId };
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

function reatomData(api: TodayApi) {
  const version = atom(0, "today.version");
  const data = computed(async () => {
    version();

    return wrap(api.load());
  }, "today.data").extend(withAsyncData());

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
  failure: Atom<string | undefined>;
};

// The Plan API hears of the tap at once, so closing the app loses nothing; the undo stays offered
// with no timer, until it is dismissed or the next Plan is completed.
function reatomComplete(
  { api }: Pick<TodayDependencies, "api">,
  { state, onSettled }: { state: CompletionState; onSettled: () => void },
) {
  const { pending, failure, hide, show } = state;

  return action(async ({ key, title, planId, subplanId }: PlanItem) => {
    const target = { planId, subplanId };
    const completing = { key, title, target, done: api.complete(target) };

    failure.set(undefined);
    hide(key);
    pending.set(completing);

    try {
      await wrap(completing.done);
    } catch {
      show(key);
      pending.set(pending() === completing ? undefined : pending());
      failure.set(`Не получилось отметить «${title}». Попробуйте ещё раз.`);

      return;
    }

    onSettled();
  }, "today.complete").extend(withAsync());
}

// The undo reopens the Plan and the Subplans its completion closed, once that completion is in.
function reatomRevert(
  { api }: Pick<TodayDependencies, "api">,
  { state, onSettled }: { state: CompletionState; onSettled: () => void },
) {
  const { pending, failure, show } = state;

  return action(async () => {
    const completing = pending();

    if (completing === undefined) {
      return;
    }

    pending.set(undefined);
    show(completing.key);

    try {
      await wrap(api.reopen(completing.target, await wrap(completing.done)));
    } catch {
      failure.set(`Не получилось вернуть «${completing.title}». Попробуйте ещё раз.`);
    }

    onSettled();
  }, "today.revertCompletion").extend(withAsync());
}

function reatomCompletion(dependencies: Pick<TodayDependencies, "api">, onSettled: () => void) {
  const state: CompletionState = {
    ...reatomHidden(),
    pending: atom<Completing | undefined>(undefined, "today.pending"),
    failure: atom<string | undefined>(undefined, "today.completionFailure"),
  };

  return {
    hidden: state.hidden,
    pending: state.pending,
    failure: state.failure,
    complete: reatomComplete(dependencies, { state, onSettled }),
    dismiss: action(() => {
      state.pending.set(undefined);
    }, "today.dismissUndo"),
    dismissFailure: action(() => {
      state.failure.set(undefined);
    }, "today.dismissFailure"),
    revert: reatomRevert(dependencies, { state, onSettled }),
  };
}

type Completion = ReturnType<typeof reatomCompletion>;

// «Разделы» reads its status lines and the Goal for «+ Взнос» from the same payload.
function reatomForSections(
  data: Loaded,
  { due, tiles }: { due: () => FeedUpcoming[]; tiles: () => Tile[] },
) {
  return {
    statuses: computed((): Partial<Record<AppModule, string>> => {
      const count = due().length;

      return {
        ...Object.fromEntries(tiles().map((tile) => [tile.module, statusOf(tile)])),
        feed: data.data() === undefined ? undefined : feedStatusOf(count),
      };
    }, "today.statuses"),
    nearestGoalId: computed(() => data.data()?.tiles.goals?.nearest?.goalId, "today.nearestGoal"),
  };
}

function reatomBlocks(dependencies: TodayDependencies, data: Loaded, completion: Completion) {
  const due = computed(
    () => (data.data()?.due ?? []).filter(({ key }) => !completion.hidden().includes(key)),
    "today.due",
  );
  const tiles = computed((): Tile[] => {
    const loaded = data.data();

    return loaded === undefined ? [] : tilesOf(loaded.tiles, dependencies.today());
  }, "today.tiles");

  return {
    header: computed(
      () => (data.data() === undefined ? undefined : headerOf(due().length)),
      "today.header",
    ),
    rows: computed(
      () =>
        due()
          .slice(0, shownDue)
          .map((item) => dueRowOf(item, dependencies.today())),
      "today.rows",
    ),
    more: computed(() => moreOf(due().length - shownDue), "today.more"),
    next: computed(
      () => (data.data()?.next ?? []).map((item) => nextRowOf(item, dependencies.today())),
      "today.next",
    ),
    tiles,
    ...reatomForSections(data, { due, tiles }),
  };
}

function reatomTaps(dependencies: TodayDependencies, data: Loaded, completion: Completion) {
  function find(key: string): FeedUpcoming | undefined {
    const loaded = data.data();

    return [...(loaded?.due ?? []), ...(loaded?.next ?? [])].find((item) => item.key === key);
  }

  return {
    completeOrRecord: action((key: string) => {
      const item = find(key);

      if (item?.kind === "plan") {
        completion.complete(item).catch(noop);
      } else if (item?.kind === "due") {
        dependencies.onRecord({ petId: item.petId, entryId: item.entryId });
      }
    }, "today.completeOrRecord"),
    revert: detached(completion.revert, "today.revert"),
    dismissUndo: completion.dismiss,
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
  const { data, reload } = reatomData(dependencies.api);
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
    completionFailure: readOnly(completion.failure),
    undo: computed(() => {
      const completing = completion.pending();

      return completing === undefined ? undefined : { title: completing.title };
    }, "today.undo"),
    reload,
    ...reatomBlocks(dependencies, data, completion),
    ...reatomTaps(dependencies, data, completion),
  };
}

export type TodayModel = ReturnType<typeof reatomToday>;
