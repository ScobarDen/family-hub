import { noop } from "@reatom/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Temporal } from "temporal-polyfill";

import { parseDeepLink } from "@family-hub/contract";

import { deviceTimeZone, today } from "@/common/format-date";
import { createHttpClient } from "@/common/http-client";
import { preparePhoto } from "@/common/photo";
import { reatomTelegram } from "@/common/telegram";
import { createVoiceRecorder } from "@/common/voice-recorder";
import { createAlbumsApi, reatomAlbumsScreen } from "@/modules/albums";
import { createCalendarApi, reatomCalendar } from "@/modules/calendar";
import { createCareApi, reatomCare } from "@/modules/care";
import {
  createCommandApi,
  reatomCommandSheet,
  reatomMicrophone,
  type OpenedDraft,
} from "@/modules/command";
import { createDigestApi, reatomDigest } from "@/modules/digest";
import { createFamilyApi, reatomFamily } from "@/modules/family";
import { createFamilyRequestApi, reatomFamilyRequest } from "@/modules/family-request";
import { createFeedApi, reatomFeed, type FeedTarget } from "@/modules/feed";
import { createGoalsApi, reatomGoals, reatomGoalsScreen } from "@/modules/goals";
import { createInvitesApi, reatomInvites } from "@/modules/invites";
import { createJoinFamilyApi, reatomJoinFamily } from "@/modules/join-family";
import { reatomNotifications } from "@/modules/notifications";
import { createPetsApi, reatomPets, reatomPetsScreen } from "@/modules/pets";
import { createPhotoStorageApi, reatomPhotoStorage } from "@/modules/photo-storage";
import { createPlansApi, reatomPlans, reatomPlansScreen } from "@/modules/plans";
import { createRecipesApi, reatomRecipesScreen } from "@/modules/recipes";
import { createSessionApi, reatomSession } from "@/modules/session";
import {
  createTabBarApi,
  reatomTabBar,
  reatomTabBarMenu,
  reatomTabBarModules,
} from "@/modules/tab-bar";
import { createTimeZoneApi, reatomTimeZone } from "@/modules/time-zone";

import { reatomNavigation } from "./app.route.ts";
import { App } from "./view/app.view.tsx";

const root = document.getElementById("root");

if (!root) {
  throw new Error("#root is missing from index.html");
}

// Built first: it reads the launch params before the first navigation rewrites the URL.
const telegram = reatomTelegram(window.Telegram.WebApp);
const httpClient = createHttpClient({
  baseUrl: import.meta.env.VITE_API_URL ?? window.location.origin,
  fetch: async (input, init) => fetch(input, init),
});
const session = reatomSession({
  api: createSessionApi(httpClient),
  telegram,
  isJoiningFamily: () => joinFamily.isOpen(),
});
const joinFamily = reatomJoinFamily({
  api: createJoinFamilyApi(httpClient),
  telegram,
  onJoined: session.signIn,
});
const familyRequest = reatomFamilyRequest({
  api: createFamilyRequestApi(httpClient),
  telegram,
  familyRequestStatus: session.familyRequestStatus,
  onBack: session.closeFamilyRequest,
  onCheck: session.signIn,
});

const commandApi = createCommandApi(httpClient);

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const tabBarModules = reatomTabBarModules({
  api: createTabBarApi(httpClient),
  saved: () => session.member()?.settings.tabBar,
});
const photoStorage = reatomPhotoStorage({
  api: createPhotoStorageApi(httpClient),
  isFamilyOwner: () => session.member()?.isFamilyOwner === true,
});
const albums = reatomAlbumsScreen({
  api: createAlbumsApi(httpClient),
  telegram,
  timeZone: deviceTimeZone,
  preparePhoto: async (file) => preparePhoto(file, deviceTimeZone()),
  wait,
  photoHint: photoStorage.uploadHint,
});
const recipes = reatomRecipesScreen({
  api: createRecipesApi(httpClient),
  telegram,
  today: () => today(deviceTimeZone()),
  timeZone: deviceTimeZone,
  preparePhoto: async (file) => preparePhoto(file, deviceTimeZone()),
  photoHint: photoStorage.uploadHint,
});
const plansApi = createPlansApi(httpClient);
const plans = reatomPlansScreen({
  api: plansApi,
  plans: reatomPlans({ api: plansApi }),
  telegram,
  self: () => session.member()?.member.id,
  timeZone: deviceTimeZone,
  onOpenAlbum: (albumId) => {
    navigation.openModule("albums");
    albums.open(albumId);
  },
});
const goalsApi = createGoalsApi(httpClient);
const goals = reatomGoalsScreen({
  api: goalsApi,
  goals: reatomGoals({ api: goalsApi }),
  telegram,
  self: () => session.member()?.member.id,
  today: () => today(deviceTimeZone()),
  timeZone: deviceTimeZone,
});
const petsApi = createPetsApi(httpClient);
const petsModel = reatomPets({ api: petsApi });
const pets = reatomPetsScreen({
  api: petsApi,
  pets: petsModel,
  viewer: () => ({ today: today(deviceTimeZone()), timeZone: deviceTimeZone() }),
  isFamilyOwner: () => session.member()?.isFamilyOwner === true,
  soon: (petId) => [
    ...plans.openPlansOf(petId).map(({ id, title, dueDate }) => ({
      id,
      title,
      dueDate,
      kind: "plan" as const,
    })),
    ...care.dueSources(),
  ],
  onOpenSoon: ({ id, kind }) => {
    if (kind === "due") {
      care.followUp(id);
    } else {
      navigation.openModule("plans");
      plans.open(id);
    }
  },
  onPlan: (petId) => {
    navigation.openModule("plans");
    plans.addForPet(petId);
  },
});
const care = reatomCare({
  api: createCareApi(httpClient),
  petId: () => pets.openedPetId(),
  today: () => today(deviceTimeZone()),
  now: () => Temporal.Now.plainDateTimeISO(deviceTimeZone()).toString({ smallestUnit: "minute" }),
  timeZone: deviceTimeZone,
  telegram,
  isReadOnly: () => pets.isOpenedPetArchived(),
  preparePhoto: async (file) => preparePhoto(file, deviceTimeZone()),
  photoHint: photoStorage.uploadHint,
  onMakeAvatar: (photoId) => {
    pets.makeAvatar(photoId);
  },
  onDraftSaved: (draftId) => {
    commandApi.markCreated(draftId).catch(noop);
  },
});
const calendar = reatomCalendar({
  api: createCalendarApi(httpClient),
  today: () => today(deviceTimeZone()),
  timeZone: deviceTimeZone,
  telegram,
  onOpenPet: (petId) => {
    navigation.openModule("pet");
    pets.open(petId);
  },
  onOpenPlan: (planId) => {
    navigation.openModule("plans");
    plans.open(planId);
  },
  self: () => session.member()?.member.id,
  onDraftSaved: (draftId) => {
    commandApi.markCreated(draftId).catch(noop);
  },
});

function editDraft({ draftId, draft }: OpenedDraft) {
  if (draft.kind === "care_entry") {
    navigation.openModule("pet");

    // Without a chosen Pet the form has nowhere to write; the Member picks the Pet first.
    if (draft.petId !== null) {
      pets.open(draft.petId);
      care.editDraft({ draftId, draft });
    }

    return;
  }

  navigation.openModule("calendar");

  if (draft.kind === "event") {
    calendar.openEventDraft({ draftId, draft });
  } else {
    calendar.openReminderDraft({ draftId, draft });
  }
}

const commandSheet = reatomCommandSheet({ api: commandApi, onEdit: editDraft, onCreated: noop });
const microphone = reatomMicrophone({
  recorder: createVoiceRecorder(),
  telegram,
  botChat: async () => {
    const chat = await commandApi.botChat();

    return chat.url;
  },
  wait,
  onRecorded: commandSheet.send,
});

function openFromFeed(target: FeedTarget) {
  if (target.kind === "plan") {
    navigation.openModule("plans");
    plans.open(target.planId);
  } else if (target.kind === "pet") {
    navigation.openModule("pet");
    pets.open(target.petId);
  } else if (target.kind === "goal") {
    navigation.openModule("goals");
    goals.open(target.goalId);
  } else if (target.kind === "album") {
    navigation.openModule("albums");
    albums.open(target.albumId);
  } else if (target.kind === "recipe") {
    navigation.openModule("recipes");
    recipes.open(target.recipeId);
  } else {
    navigation.openModule("calendar");

    if (target.kind === "event") {
      calendar.openEvent(target.eventId);
    }
  }
}

const feed = reatomFeed({
  api: createFeedApi(httpClient),
  today: () => today(deviceTimeZone()),
  timeZone: deviceTimeZone,
  onOpen: openFromFeed,
  telegram,
  onRecord: ({ petId, entryId }) => {
    navigation.openModule("pet");
    pets.open(petId);
    care.followUp(entryId);
  },
});
const navigation = reatomNavigation({
  base: import.meta.env.BASE_URL,
  tabBar: tabBarModules.modules,
  isSignedIn: () => session.member() !== undefined,
  telegram,
  nestedBack: {
    pet: {
      canGoBack: () => care.canGoBack() || pets.canGoBack(),
      back: () => {
        if (care.canGoBack()) {
          care.back();
        } else {
          pets.back();
        }
      },
    },
    plans,
    calendar,
    goals,
    albums,
    recipes,
  },
});
const timeZone = reatomTimeZone({
  api: createTimeZoneApi(httpClient),
  saved: () => session.member()?.settings.timeZone,
  deviceZone: deviceTimeZone(),
  zones: Intl.supportedValuesOf("timeZone"),
});
const home = {
  session,
  navigation,
  tabBar: reatomTabBar({
    modules: tabBarModules,
    activeModule: navigation.activeModule,
    onOpen: navigation.openModule,
    titles: () => {
      const petTitle = petsModel.tabTitle();

      return petTitle === undefined ? {} : { pet: petTitle };
    },
  }),
  tabBarMenu: reatomTabBarMenu({ modules: tabBarModules }),
  notifications: reatomNotifications({
    canMessage: () => session.member()?.settings.canMessage,
    telegram,
  }),
  timeZone,
  digest: reatomDigest({
    api: createDigestApi(httpClient),
    saved: () => session.member()?.settings.digest,
  }),
  family: reatomFamily({
    api: createFamilyApi(httpClient),
    telegram,
    self: () => {
      const current = session.member();

      return current && { memberId: current.member.id, familyName: current.family.name };
    },
    onLeft: session.signIn,
  }),
  invites: reatomInvites({
    api: createInvitesApi(httpClient),
    telegram,
    timeZone: deviceTimeZone(),
  }),
  pets,
  plans,
  photoStorage,
  care,
  calendar,
  feed,
  goals,
  albums,
  recipes,
  microphone,
  commandSheet,
};

telegram.launch();
telegram.followColorScheme(document.documentElement);
telegram.followPlatform(document.documentElement);
navigation.start();

// The navigation opens the module of a deep link; the module opens the record itself.
const link = parseDeepLink(telegram.startParam);

if (link?.kind === "plan") {
  plans.open(link.id);
} else if (link?.kind === "event") {
  calendar.openEvent(link.id);
} else if (link?.kind === "pet") {
  pets.open(link.id);
} else if (link?.kind === "goal") {
  goals.open(link.id);
}

// A draft needs the session's token, so the bot's «Изменить» opens only once signed in.
if (link?.kind === "cmd") {
  const stopWaiting = session.member.subscribe((member) => {
    if (member !== undefined) {
      stopWaiting();
      commandSheet.openForEdit(link.id);
    }
  });
}

timeZone.keepFollowingDevice();
session.signIn();
joinFamily.load();

createRoot(root).render(
  <StrictMode>
    <App {...home} familyRequest={familyRequest} joinFamily={joinFamily} />
  </StrictMode>,
);
