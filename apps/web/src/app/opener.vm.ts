import { action, noop, take, throwAbort, withAbort, wrap } from "@reatom/core";

import {
  parseDeepLink,
  parseRecordLink,
  type AppModule,
  type CareEntryDraft,
  type DeepLink,
  type MovementKind,
  type RecordLink,
} from "@family-hub/contract";

import type { DraftOpening } from "@/common/form";
import type { Telegram } from "@/common/telegram";
import type { OpenedDraft } from "@/modules/command";
import type { TaskDraftOpening } from "@/modules/tasks";

import type { Place } from "./app.route.ts";

type TargetFields = {
  task: { taskId: string };
  "task-for-pet": { petId: string };
  record: RecordLink;
  "care-entry-for-pet": { petId: string; title: string };
  pet: { petId: string };
  "new-pet": object;
  "care-entry": { entryId: string; petId?: string };
  goal: { goalId: string };
  album: { albumId: string };
  recipe: { recipeId: string };
  draft: { draftId: string };
  "new-task": object;
  "new-care-entry": object;
  "new-contribution": { goalId: string };
  "opened-draft": OpenedDraft;
};

type TargetKind = keyof TargetFields;

type TargetOf<Kind extends TargetKind> = { kind: Kind } & TargetFields[Kind];

type AnyTarget = { [Kind in TargetKind]: TargetOf<Kind> }[TargetKind];

export type OpenTarget = Exclude<AnyTarget, { kind: "opened-draft" }>;

type Open = (id: string) => void;

type OpenerDependencies = {
  telegram: Pick<Telegram, "startParam">;
  navigation: {
    open: (place: Place) => void;
    // A launch link opens on top of the Today hub.
    launch: (place: Place | undefined) => void;
    shownModule: () => AppModule | undefined;
  };
  // A draft or a Care Entry is fetched by its id with the session's token.
  isSignedIn: () => boolean;
  pets: { showChoice: () => void; openedPetId: () => string | undefined; add: () => void };
  tasks: {
    open: Open;
    add: () => void;
    addForPet: Open;
    openDraft: (opening: TaskDraftOpening) => void;
    recordOccurrence: (target: RecordLink) => void;
  };
  care: {
    openEntry: Open;
    add: () => void;
    addFromTask: (taskTitle: string) => void;
    editDraft: (opening: DraftOpening<CareEntryDraft>) => void;
  };
  goals: {
    open: Open;
    openedGoalState: () => "loading" | "opened" | "missing";
    addMovement: (kind: MovementKind) => void;
  };
  albums: { open: Open; upload: (files: Blob[]) => void };
  recipes: { open: Open };
  commandSheet: { openForEdit: Open };
};

// A draft's module is known only once the draft is at hand.
const modules: Partial<Record<TargetKind, AppModule>> = {
  task: "tasks",
  "task-for-pet": "tasks",
  "new-task": "tasks",
  record: "tasks",
  pet: "pet",
  "new-pet": "pet",
  "care-entry": "pet",
  "new-care-entry": "pet",
  goal: "goals",
  "new-contribution": "goals",
  album: "albums",
  recipe: "recipes",
};

// A Pet named by the target opens at its own address.
function placeOf(target: AnyTarget): Place | undefined {
  const module = modules[target.kind];
  const petId = "petId" in target && target.kind !== "task-for-pet" ? target.petId : undefined;

  if (module === undefined) {
    return undefined;
  }

  return petId === undefined ? { module } : { module, petId };
}

const linkTargets: Record<DeepLink["kind"], (id: string) => OpenTarget | undefined> = {
  // An Invite is the join-family module's, which reads start_param before the sign-in.
  inv: noop,
  pet: (petId) => ({ kind: "pet", petId }),
  entry: (entryId) => ({ kind: "care-entry", entryId }),
  task: (taskId) => ({ kind: "task", taskId }),
  // Bot messages sent before Tasks still name a Plan or an Event, which kept its id as a Task.
  plan: (taskId) => ({ kind: "task", taskId }),
  event: (taskId) => ({ kind: "task", taskId }),
  rec: recordTargetOf,
  goal: (goalId) => ({ kind: "goal", goalId }),
  cmd: (draftId) => ({ kind: "draft", draftId }),
};

function recordTargetOf(id: string): OpenTarget | undefined {
  const link = parseRecordLink(id);

  return link === undefined ? undefined : { kind: "record", ...link };
}

function targetOfLink(startParameter: string | undefined): OpenTarget | undefined {
  const link = parseDeepLink(startParameter);

  return link === undefined ? undefined : linkTargets[link.kind](link.id);
}

async function untilTrue(isDone: () => boolean): Promise<void> {
  if (!isDone()) {
    await wrap(take(isDone, (is) => is || throwAbort()));
  }
}

async function untilKnown<State extends string>(state: () => State | "loading"): Promise<State> {
  const current = state();

  return current === "loading"
    ? wrap(take(state, (next) => (next === "loading" ? throwAbort() : next)))
    : current;
}

type PetChoice = "picking" | "picked" | "left";

async function isPetPicked({ navigation, pets }: OpenerDependencies): Promise<boolean> {
  function choice(): PetChoice {
    if (navigation.shownModule() !== "pet") {
      return "left";
    }

    return pets.openedPetId() === undefined ? "picking" : "picked";
  }

  const current = choice();
  const settled =
    current === "picking"
      ? await wrap(take(choice, (next) => (next === "picking" ? throwAbort() : next)))
      : current;

  return settled === "picked";
}

// A Care Entry needs a Pet: the one named, the only one in care, or the one the Member picks.
async function openForPet(
  dependencies: OpenerDependencies,
  { petId, onPicked }: { petId: string | null; onPicked: () => void },
): Promise<void> {
  if (petId === null) {
    dependencies.navigation.open({ module: "pet" });
    dependencies.pets.showChoice();
  } else {
    dependencies.navigation.open({ module: "pet", petId });
  }

  if (await wrap(isPetPicked(dependencies))) {
    onPicked();
  }
}

async function openDraft(
  dependencies: OpenerDependencies,
  { draftId, draft, phrase }: OpenedDraft,
) {
  const { navigation, tasks, care } = dependencies;

  if (draft.kind === "care_entry") {
    await openForPet(dependencies, {
      petId: draft.petId,
      onPicked: () => {
        care.editDraft({ draftId, draft, phrase });
      },
    });

    return;
  }

  navigation.open({ module: "tasks" });
  tasks.openDraft({ draftId, draft, phrase });
}

type Openers = {
  [Kind in TargetKind]: (target: TargetOf<Kind>) => void | Promise<void>;
};

function openersOf(dependencies: OpenerDependencies): Openers {
  const { tasks, pets, care, goals, albums, recipes, commandSheet } = dependencies;

  async function signedInThen(open: () => void): Promise<void> {
    await wrap(untilTrue(dependencies.isSignedIn));
    open();
  }

  return {
    task: ({ taskId }) => tasks.open(taskId),
    "task-for-pet": ({ petId }) => tasks.addForPet(petId),
    "new-task": () => tasks.add(),
    record: async ({ taskId, occurrence }) =>
      signedInThen(() => tasks.recordOccurrence({ taskId, occurrence })),
    "care-entry-for-pet": async ({ petId, title }) =>
      openForPet(dependencies, {
        petId,
        onPicked: () => {
          care.addFromTask(title);
        },
      }),
    pet: noop,
    "new-pet": () => pets.add(),
    "care-entry": async ({ entryId }) => signedInThen(() => care.openEntry(entryId)),
    "new-care-entry": async () => openForPet(dependencies, { petId: null, onPicked: care.add }),
    goal: ({ goalId }) => goals.open(goalId),
    "new-contribution": async ({ goalId }) => {
      goals.open(goalId);

      if ((await wrap(untilKnown(goals.openedGoalState))) === "opened") {
        goals.addMovement("contribution");
      }
    },
    album: ({ albumId }) => albums.open(albumId),
    recipe: ({ recipeId }) => recipes.open(recipeId),
    draft: async ({ draftId }) => signedInThen(() => commandSheet.openForEdit(draftId)),
    "opened-draft": async (opened) => openDraft(dependencies, opened),
  };
}

async function openWith<Kind extends TargetKind>(
  openers: Openers,
  target: TargetOf<Kind>,
): Promise<void> {
  const open: Openers[Kind] = openers[target.kind];

  await open(target);
}

export function reatomOpener(dependencies: OpenerDependencies) {
  const openers = openersOf(dependencies);
  // A new opening drops the one still waiting, for a sign-in or for a Pet to be picked.
  const follow = action(async (target: AnyTarget, go: (place: Place) => void) => {
    const place = placeOf(target);

    if (place !== undefined) {
      go(place);
    }

    await wrap(openWith(openers, target));
  }, "opener.follow").extend(withAbort());

  return {
    open: action((target: OpenTarget) => {
      follow(target, dependencies.navigation.open).catch(noop);
    }, "opener.open"),
    editDraft: action((opened: OpenedDraft) => {
      follow({ kind: "opened-draft", ...opened }, dependencies.navigation.open).catch(noop);
    }, "opener.editDraft"),
    // «+ Фото» uploads to the Family's photos, shown as the upload goes.
    uploadPhotos: action((files: Blob[]) => {
      follow.abort();
      dependencies.navigation.open({ module: "albums" });
      dependencies.albums.upload(files);
    }, "opener.uploadPhotos"),
    // telegram.startParam was read when the wrapper was built, before the first navigation.
    launch: action(() => {
      const target = targetOfLink(dependencies.telegram.startParam);

      if (target !== undefined) {
        follow(target, dependencies.navigation.launch).catch(noop);
      }
    }, "opener.launch"),
  };
}
