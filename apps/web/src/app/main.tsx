import { noop } from "@reatom/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Temporal } from "temporal-polyfill";

import { deviceTimeZone, today as todayIn } from "@/common/format-date";
import { createHttpClient } from "@/common/http-client";
import { preparePhoto } from "@/common/photo";
import { reatomTelegram } from "@/common/telegram";
import { createVoiceRecorder } from "@/common/voice-recorder";
import { createAlbumsApi, reatomAlbumsScreen } from "@/modules/albums";
import { createCalendarApi, reatomCalendar } from "@/modules/calendar";
import { createCommandApi, reatomCommandSheet, reatomMicrophone } from "@/modules/command";
import { createFamilyApi, reatomFamily, reatomFamilyMembers } from "@/modules/family";
import { createFamilyRequestApi, reatomFamilyRequest } from "@/modules/family-request";
import { createFeedApi, reatomFeed } from "@/modules/feed";
import { createGoalsApi, reatomGoalsScreen } from "@/modules/goals";
import { createInvitesApi, reatomInvites } from "@/modules/invites";
import { createJoinFamilyApi, reatomJoinFamily } from "@/modules/join-family";
import {
  createMemberSettingsApi,
  reatomDigest,
  reatomNotifications,
  reatomTimeZone,
} from "@/modules/member-settings";
import { createCareApi, createPetsApi, reatomPets, reatomPetTab } from "@/modules/pets";
import { createPhotoStorageApi, reatomPhotoStorage } from "@/modules/photo-storage";
import { createPlansApi, reatomPlansScreen } from "@/modules/plans";
import { createRecipesApi, reatomRecipesScreen } from "@/modules/recipes";
import { createSessionApi, reatomSession } from "@/modules/session";
import {
  createTabBarApi,
  reatomSections,
  reatomTabBar,
  reatomTabBarMenu,
  reatomTabBarModules,
} from "@/modules/tab-bar";
import { createTodayApi, reatomToday } from "@/modules/today";

import { reatomNavigation } from "./app.route.ts";
import { reatomOpener } from "./opener.vm.ts";
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

const memberSettingsApi = createMemberSettingsApi(httpClient);
const timeZone = reatomTimeZone({
  api: memberSettingsApi,
  saved: () => session.member()?.settings.timeZone,
  deviceZone: deviceTimeZone(),
  zones: Intl.supportedValuesOf("timeZone"),
});

// The zone picked in the Profile wins; the device's is the fallback until the settings arrive.
function zone(): string {
  return timeZone.zone()?.timeZone ?? deviceTimeZone();
}

function today(): string {
  return todayIn(zone());
}

function viewer() {
  return { today: today(), timeZone: zone() };
}

async function prepare(file: Blob) {
  return preparePhoto(file, zone());
}

function self(): string | undefined {
  return session.member()?.member.id;
}

const commandApi = createCommandApi(httpClient);
const familyApi = createFamilyApi(httpClient);
// One query each for the Family's Members and Pets, so every picker sees the same list.
const members = reatomFamilyMembers(familyApi);
const petsApi = createPetsApi(httpClient);
const petsModel = reatomPets({ api: petsApi });

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
  viewer,
  preparePhoto: prepare,
  wait,
  photoHint: photoStorage.uploadHint,
  canSetUpPhotos: photoStorage.canSetUp,
  onSetUpPhotos: () => {
    navigation.openProfile();
  },
});
const recipes = reatomRecipesScreen({
  api: createRecipesApi(httpClient),
  telegram,
  today,
  timeZone: zone,
  preparePhoto: prepare,
  photoHint: photoStorage.uploadHint,
});
const plans = reatomPlansScreen({
  api: createPlansApi(httpClient),
  members,
  pets: petsModel.list,
  telegram,
  self,
  viewer,
  onOpenAlbum: (albumId) => {
    opener.open({ kind: "album", albumId });
  },
});
const goals = reatomGoalsScreen({
  api: createGoalsApi(httpClient),
  members,
  telegram,
  self,
  today,
  timeZone: zone,
});
const pet = reatomPetTab({
  api: petsApi,
  route: {
    petId: () => navigation.openedPetId(),
    open: (petId) => {
      navigation.openPet(petId);
    },
    close: () => {
      navigation.leave();
    },
  },
  careApi: createCareApi(httpClient),
  pets: petsModel,
  viewer,
  now: () => Temporal.Now.plainDateTimeISO(zone()).toString({ smallestUnit: "minute" }),
  telegram,
  isFamilyOwner: () => session.member()?.isFamilyOwner === true,
  preparePhoto: prepare,
  photoHint: photoStorage.uploadHint,
  plansOf: (petId) =>
    plans.openPlansOf(petId).map(({ id, title, dueDate }) => ({
      id,
      title,
      dueDate,
      kind: "plan" as const,
    })),
  onOpenSoon: (target) => {
    opener.open(target);
  },
  onPlan: (petId) => {
    opener.open({ kind: "plan-for-pet", petId });
  },
  onDraftSaved: (draftId) => {
    commandApi.markCreated(draftId).catch(noop);
  },
});
const calendar = reatomCalendar({
  api: createCalendarApi(httpClient),
  members,
  pets: petsModel.list,
  today,
  timeZone: zone,
  telegram,
  onOpenPet: (petId) => {
    opener.open({ kind: "pet", petId });
  },
  onOpenPlan: (planId) => {
    opener.open({ kind: "plan", planId });
  },
  self,
  onDraftSaved: (draftId) => {
    commandApi.markCreated(draftId).catch(noop);
  },
});

const commandSheet = reatomCommandSheet({
  api: commandApi,
  members,
  pets: petsModel.list,
  onEdit: (opened) => {
    opener.editDraft(opened);
  },
  onCreated: () => {
    calendar.reload();
    pet.care.reload();
    feed.reload();
    todayHub.reload();
  },
});
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

const feed = reatomFeed({
  api: createFeedApi(httpClient),
  today,
  timeZone: zone,
  onOpen: (target) => {
    opener.open(target);
  },
  telegram,
  onRecord: (due) => {
    opener.open({ kind: "due-date", ...due });
  },
});
const todayHub = reatomToday({
  api: createTodayApi(httpClient),
  today,
  onOpen: (target) => {
    opener.open(target);
  },
  onOpenSection: (module) => {
    navigation.openModule(module);
  },
  onRecord: (due) => {
    opener.open({ kind: "due-date", ...due });
  },
  onOpenFeed: () => {
    navigation.openModule("feed");
  },
});
const navigation = reatomNavigation({
  base: import.meta.env.BASE_URL,
  slots: tabBarModules.modules,
  onTodayShown: () => {
    todayHub.reload();
  },
  isSignedIn: () => session.member() !== undefined,
  telegram,
  nestedBack: {
    pet,
    plans,
    calendar,
    goals,
    albums,
    recipes,
  },
});
const opener = reatomOpener({
  telegram,
  navigation,
  isSignedIn: () => session.member() !== undefined,
  pets: pet.pets,
  plans,
  care: {
    ...pet.care,
    add: () => {
      pet.care.add("note");
    },
  },
  calendar,
  goals,
  albums,
  recipes,
  commandSheet,
});
const home = {
  session,
  navigation,
  tabBar: reatomTabBar({
    modules: tabBarModules,
    activeTab: navigation.activeTab,
    onOpen: navigation.openTab,
    titles: () => {
      const petTitle = petsModel.tabTitle();

      return petTitle === undefined ? {} : { pet: petTitle };
    },
  }),
  tabBarMenu: reatomTabBarMenu({ modules: tabBarModules }),
  today: todayHub,
  sections: reatomSections({
    modules: tabBarModules,
    contributionGoalId: todayHub.nearestGoalId,
    canAddPhoto: () => photoStorage.view()?.isConnected === true,
    onOpen: navigation.openModule,
    onQuickAdd: opener.open,
    onAddPhotos: opener.uploadPhotos,
    onConfigure: navigation.openTabBarMenu,
    onOpenSettings: navigation.openProfile,
  }),
  notifications: reatomNotifications({
    canMessage: () => session.member()?.settings.canMessage,
    telegram,
  }),
  timeZone,
  digest: reatomDigest({
    api: memberSettingsApi,
    saved: () => session.member()?.settings.digest,
  }),
  family: reatomFamily({
    api: familyApi,
    members,
    telegram,
    self: () => {
      const memberId = self();

      return memberId === undefined ? undefined : { memberId, familyName: session.familyName() };
    },
    onLeft: session.signIn,
  }),
  invites: reatomInvites({
    api: createInvitesApi(httpClient),
    telegram,
    viewer,
  }),
  pet,
  plans,
  photoStorage,
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
opener.launch();

timeZone.keepFollowingDevice();
session.signIn();
joinFamily.load();

createRoot(root).render(
  <StrictMode>
    <App {...home} familyRequest={familyRequest} joinFamily={joinFamily} />
  </StrictMode>,
);
