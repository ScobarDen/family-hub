import { action, atom, computed, noop, withAsync, withAsyncData, wrap } from "@reatom/core";

import type { AppModule, FeedUpcoming, SlotModule, Today } from "@family-hub/contract";

import type { PlanOrSubplan, TodayApi } from "../today.api.ts";
import { dueRowOf, headerOf, nextRowOf, statusOf, tilesOf, type Tile } from "../today.lib.ts";

export type TodayTarget =
  | { kind: "plan"; planId: string }
  | { kind: "event"; eventId: string }
  | { kind: "calendar" }
  | { kind: "pet"; petId: string }
  | { kind: "add-pet" };

export type TodayDependencies = {
  api: TodayApi;
  today: () => string;
  // The undo window after a one-tap Completed.
  wait: (ms: number) => Promise<void>;
  onOpen: (target: TodayTarget) => void;
  onOpenSection: (module: SlotModule) => void;
  onRecord: (due: { petId: string; entryId: string }) => void;
  onOpenFeed: () => void;
};

const shownDue = 3;
const undoMs = 4000;

type Completing = { key: string; title: string; plan: PlanOrSubplan };

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

// One Pet opens its card, none offers adding one, several open the list.
function petTargetOf({ active, only }: Today["tiles"]["pet"]): TodayTarget | undefined {
  if (only !== null) {
    return { kind: "pet", petId: only.petId };
  }

  return active === 0 ? { kind: "add-pet" } : undefined;
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

function completingOf({ key, title, planId, subplanId }: Extract<FeedUpcoming, { kind: "plan" }>) {
  return { key, title, plan: { planId, subplanId } };
}

function reatomHidden() {
  const hidden = atom<string[]>([], "today.hidden");

  return {
    hidden,
    hide: (key: string) => {
      hidden.set([...hidden(), key]);
    },
    show: (key: string) => {
      hidden.set(hidden().filter((other) => other !== key));
    },
  };
}

// The row leaves at once, but the Plan API hears of it only once the undo window passes: completing
// a Plan closes its open Subplans too, and reopening it would not bring them back.
function reatomCompletion(
  { api, wait }: Pick<TodayDependencies, "api" | "wait">,
  onCompleted: () => void,
) {
  const { hidden, hide, show } = reatomHidden();
  const pending = atom<Completing | undefined>(undefined, "today.pending");

  async function send({ key, plan }: Completing): Promise<void> {
    try {
      await api.complete(plan);
      onCompleted();
    } catch {
      show(key);
    }
  }

  // A second tap sends the first completion at once, so the undo always names the last one.
  const complete = action(async (item: Extract<FeedUpcoming, { kind: "plan" }>) => {
    const previous = pending();
    const completing = completingOf(item);

    if (previous !== undefined) {
      send(previous).catch(noop);
    }

    hide(item.key);
    pending.set(completing);
    await wrap(wait(undoMs));

    if (pending() === completing) {
      pending.set(undefined);
      await wrap(send(completing));
    }
  }, "today.complete").extend(withAsync());

  const revert = action(() => {
    const completing = pending();

    if (completing !== undefined) {
      pending.set(undefined);
      show(completing.key);
    }
  }, "today.revertCompletion");

  return { hidden, pending, complete, revert };
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
        feed: data.data() === undefined || count === 0 ? undefined : headerOf(count),
      };
    }, "today.statuses"),
    nearestGoalId: computed(() => data.data()?.tiles.goals.nearest?.goalId, "today.nearestGoal"),
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
    more: computed(() => {
      const rest = due().length - shownDue;

      return rest > 0 ? rest : undefined;
    }, "today.more"),
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
    act: action((key: string) => {
      const item = find(key);

      if (item?.kind === "plan") {
        completion.complete(item).catch(noop);
      } else if (item?.kind === "due") {
        dependencies.onRecord({ petId: item.petId, entryId: item.entryId });
      }
    }, "today.act"),
    revert: completion.revert,
    openItem: action((key: string) => {
      const item = find(key);

      if (item !== undefined) {
        dependencies.onOpen(targetOf(item));
      }
    }, "today.openItem"),
    openTile: action((module: SlotModule) => {
      const pet = data.data()?.tiles.pet;
      const target = module === "pet" && pet !== undefined ? petTargetOf(pet) : undefined;

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
    failure: computed(
      () => (data.error() === undefined ? undefined : "Не получилось загрузить «Сегодня»."),
      "today.failure",
    ),
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
