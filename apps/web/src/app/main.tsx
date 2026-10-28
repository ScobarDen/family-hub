import { noop } from "@reatom/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Temporal } from "temporal-polyfill";

import { deviceTimeZone, today as todayIn } from "@/common/format-date";
import { createHttpClient } from "@/common/http-client";
import { openLiveSocket, reatomLiveUpdates } from "@/common/live-updates";
import { preparePhoto } from "@/common/photo";
import { reatomTelegram } from "@/common/telegram";
import { createVoiceRecorder } from "@/common/voice-recorder";
import { createAlbumsApi, reatomAlbumsScreen } from "@/modules/albums";
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
import { createRecipesApi, reatomRecipesScreen } from "@/modules/recipes";
import { createSessionApi, reatomSession } from "@/modules/session";
import {
  createTabBarApi,
  reatomSections,
  reatomTabBar,
  reatomTabBarMenu,
  reatomTabBarModules,
} from "@/modules/tab-bar";
import { createTasksApi, reatomTasksScreen } from "@/modules/tasks";
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
  page: document,
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

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const live = reatomLiveUpdates({ open: () => openLiveSocket(httpClient), page: document, wait });

const commandApi = createCommandApi(httpClient);
const familyApi = createFamilyApi(httpClient);
// One query each for the Family's Members and Pets, so every picker sees the same list.
const members = reatomFamilyMembers(familyApi);
const petsApi = createPetsApi(httpClient);
const petsModel = reatomPets({ api: petsApi, liveVersion: () => live.versionOf("pet") });

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
  liveVersion: () => live.versionOf("albums"),
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
  liveVersion: () => live.versionOf("recipes"),
  telegram,
  today,
  timeZone: zone,
  preparePhoto: prepare,
  photoHint: photoStorage.uploadHint,
});
const tasks = reatomTasksScreen({
  api: createTasksApi(httpClient),
  liveVersion: () => live.versionOf("tasks"),
  members,
  pets: petsModel.list,
  telegram,
  self,
  viewer,
  onOpenAlbum: (albumId) => {
    opener.open({ kind: "album", albumId });
  },
  onOpenPet: (petId) => {
    opener.open({ kind: "pet", petId });
  },
  onRecord: (record) => {
    opener.open({ kind: "care-entry-for-pet", ...record });
  },
  onDraftSaved: (draftId) => {
    commandApi.markCreated(draftId).catch(noop);
  },
});
const goals = reatomGoalsScreen({
  api: createGoalsApi(httpClient),
  liveVersion: () => live.versionOf("goals"),
  members,
  telegram,
  self,
  today,
  timeZone: zone,
});
const pet = reatomPetTab({
  api: petsApi,
  liveVersion: () => live.versionOf("pet"),
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
  tasksOf: (petId) => tasks.tasksOf(petId),
  onOpenTask: (taskId) => {
    opener.open({ kind: "task", taskId });
  },
  onAddTask: (petId) => {
    opener.open({ kind: "task-for-pet", petId });
  },
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
    tasks.reload();
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
  liveVersion: live.all,
  today,
  timeZone: zone,
  onOpen: (target) => {
    opener.open(target);
  },
  telegram,
});
const todayHub = reatomToday({
  api: createTodayApi(httpClient),
  liveVersion: live.all,
  today,
  onOpen: (target) => {
    opener.open(target);
  },
  onOpenSection: (module) => {
    navigation.openModule(module);
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
    tasks,
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
  tasks,
  care: {
    ...pet.care,
    add: () => {
      pet.care.add("note");
    },
  },
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
  tasks,
  photoStorage,
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
live.start();

createRoot(root).render(
  <StrictMode>
    <App {...home} familyRequest={familyRequest} joinFamily={joinFamily} />
  </StrictMode>,
);
