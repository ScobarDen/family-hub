import { action, noop, take, throwAbort, withAbort, wrap } from "@reatom/core";

import {
  parseDeepLink,
  type AppModule,
  type CareEntryDraft,
  type DeepLink,
  type EventDraft,
  type ReminderDraft,
} from "@family-hub/contract";

import type { DraftOpening } from "@/common/form";
import type { Telegram } from "@/common/telegram";
import type { OpenedDraft } from "@/modules/command";

type TargetFields = {
  plan: { planId: string };
  "plan-for-pet": { petId: string };
  event: { eventId: string };
  calendar: Record<never, never>;
  pet: { petId: string };
  "care-entry": { entryId: string; petId?: string };
  "due-date": { entryId: string; petId?: string };
  goal: { goalId: string };
  album: { albumId: string };
  recipe: { recipeId: string };
  draft: { draftId: string };
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
    openModule: (module: AppModule) => void;
    openLaunchModule: (module: AppModule) => void;
    shownModule: () => AppModule | undefined;
  };
  // A draft or a Care Entry is fetched by its id with the session's token.
  isSignedIn: () => boolean;
  pets: { open: Open; showChoice: () => void; openedPetId: () => string | undefined };
  plans: { open: Open; addForPet: Open };
  care: {
    openEntry: Open;
    followUp: Open;
    editDraft: (opening: DraftOpening<CareEntryDraft>) => void;
  };
  calendar: {
    openEvent: Open;
    openEventDraft: (opening: DraftOpening<EventDraft>) => void;
    openReminderDraft: (opening: DraftOpening<ReminderDraft>) => void;
  };
  goals: { open: Open };
  albums: { open: Open };
  recipes: { open: Open };
  commandSheet: { openForEdit: Open };
};

// A draft's module is known only once the draft is at hand.
const modules: Partial<Record<TargetKind, AppModule>> = {
  plan: "plans",
  "plan-for-pet": "plans",
  event: "calendar",
  calendar: "calendar",
  pet: "pet",
  "care-entry": "pet",
  "due-date": "pet",
  goal: "goals",
  album: "albums",
  recipe: "recipes",
};

const linkTargets: Record<DeepLink["kind"], (id: string) => OpenTarget | undefined> = {
  // An Invite is the join-family module's, which reads start_param before the sign-in.
  inv: noop,
  pet: (petId) => ({ kind: "pet", petId }),
  entry: (entryId) => ({ kind: "care-entry", entryId }),
  event: (eventId) => ({ kind: "event", eventId }),
  goal: (goalId) => ({ kind: "goal", goalId }),
  plan: (planId) => ({ kind: "plan", planId }),
  cmd: (draftId) => ({ kind: "draft", draftId }),
};

function targetOfLink(startParameter: string | undefined): OpenTarget | undefined {
  const link = parseDeepLink(startParameter);

  return link === undefined ? undefined : linkTargets[link.kind](link.id);
}

async function untilSignedIn({ isSignedIn }: OpenerDependencies): Promise<void> {
  if (!isSignedIn()) {
    await wrap(take(isSignedIn, (is) => is || throwAbort()));
  }
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

async function openCareDraft(
  dependencies: OpenerDependencies,
  opening: DraftOpening<CareEntryDraft>,
): Promise<void> {
  const { petId } = opening.draft;

  dependencies.navigation.openModule("pet");

  if (petId === null) {
    dependencies.pets.showChoice();
  } else {
    dependencies.pets.open(petId);
  }

  if (await wrap(isPetPicked(dependencies))) {
    dependencies.care.editDraft(opening);
  }
}

async function openDraft(
  dependencies: OpenerDependencies,
  { draftId, draft, phrase }: OpenedDraft,
) {
  const { navigation, calendar } = dependencies;

  if (draft.kind === "care_entry") {
    await openCareDraft(dependencies, { draftId, draft, phrase });

    return;
  }

  navigation.openModule("calendar");

  if (draft.kind === "event") {
    calendar.openEventDraft({ draftId, draft, phrase });
  } else {
    calendar.openReminderDraft({ draftId, draft, phrase });
  }
}

type Openers = {
  [Kind in TargetKind]: (target: TargetOf<Kind>) => void | Promise<void>;
};

function openersOf(dependencies: OpenerDependencies): Openers {
  const { plans, pets, care, calendar, goals, albums, recipes, commandSheet } = dependencies;

  async function openPetThen(target: { petId?: string }, open: () => void): Promise<void> {
    if (target.petId !== undefined) {
      pets.open(target.petId);
    }

    await untilSignedIn(dependencies);
    open();
  }

  return {
    plan: ({ planId }) => plans.open(planId),
    "plan-for-pet": ({ petId }) => plans.addForPet(petId),
    event: ({ eventId }) => calendar.openEvent(eventId),
    calendar: noop,
    pet: ({ petId }) => pets.open(petId),
    "care-entry": async (target) => openPetThen(target, () => care.openEntry(target.entryId)),
    "due-date": async (target) => openPetThen(target, () => care.followUp(target.entryId)),
    goal: ({ goalId }) => goals.open(goalId),
    album: ({ albumId }) => albums.open(albumId),
    recipe: ({ recipeId }) => recipes.open(recipeId),
    draft: async ({ draftId }) => {
      await untilSignedIn(dependencies);
      commandSheet.openForEdit(draftId);
    },
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
  const follow = action(async (target: AnyTarget, openModule: (module: AppModule) => void) => {
    const module = modules[target.kind];

    if (module !== undefined) {
      openModule(module);
    }

    await wrap(openWith(openers, target));
  }, "opener.follow").extend(withAbort());

  return {
    open: action((target: OpenTarget) => {
      follow(target, dependencies.navigation.openModule).catch(noop);
    }, "opener.open"),
    editDraft: action((opened: OpenedDraft) => {
      follow({ kind: "opened-draft", ...opened }, dependencies.navigation.openModule).catch(noop);
    }, "opener.editDraft"),
    // telegram.startParam was read when the wrapper was built, before the first navigation.
    launch: action(() => {
      const target = targetOfLink(dependencies.telegram.startParam);

      if (target !== undefined) {
        follow(target, dependencies.navigation.openLaunchModule).catch(noop);
      }
    }, "opener.launch"),
  };
}
