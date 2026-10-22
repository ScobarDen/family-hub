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
import { createCareApi, reatomCare } from "@/modules/care";
import { createCommandApi, reatomCommandSheet, reatomMicrophone } from "@/modules/command";
import { createDigestApi, reatomDigest } from "@/modules/digest";
import { createFamilyApi, reatomFamily, reatomFamilyMembers } from "@/modules/family";
import { createFamilyRequestApi, reatomFamilyRequest } from "@/modules/family-request";
import { createFeedApi, reatomFeed } from "@/modules/feed";
import { createGoalsApi, reatomGoalsScreen } from "@/modules/goals";
import { createInvitesApi, reatomInvites } from "@/modules/invites";
import { createJoinFamilyApi, reatomJoinFamily } from "@/modules/join-family";
import { reatomNotifications } from "@/modules/notifications";
import { createPetsApi, reatomPets, reatomPetsScreen } from "@/modules/pets";
import { createPhotoStorageApi, reatomPhotoStorage } from "@/modules/photo-storage";
import { createPlansApi, reatomPlansScreen } from "@/modules/plans";
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

const timeZone = reatomTimeZone({
  api: createTimeZoneApi(httpClient),
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
  timeZone: zone,
  preparePhoto: prepare,
  wait,
  photoHint: photoStorage.uploadHint,
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
  timeZone: zone,
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
const pets = reatomPetsScreen({
  api: petsApi,
  pets: petsModel,
  viewer: () => ({ today: today(), timeZone: zone() }),
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
  onOpenSoon: (target) => {
    opener.open(target);
  },
  onPlan: (petId) => {
    opener.open({ kind: "plan-for-pet", petId });
  },
});
const care = reatomCare({
  api: createCareApi(httpClient),
  petId: () => pets.openedPetId(),
  today,
  now: () => Temporal.Now.plainDateTimeISO(zone()).toString({ smallestUnit: "minute" }),
  timeZone: zone,
  telegram,
  isReadOnly: () => pets.isOpenedPetArchived(),
  preparePhoto: prepare,
  photoHint: photoStorage.uploadHint,
  onMakeAvatar: (photoId) => {
    pets.makeAvatar(photoId);
  },
  onOpenPet: pets.open,
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
    care.reload();
    feed.reload();
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
const opener = reatomOpener({
  telegram,
  navigation,
  isSignedIn: () => session.member() !== undefined,
  pets,
  plans,
  care,
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
    timeZone: zone,
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
opener.launch();

timeZone.keepFollowingDevice();
session.signIn();
joinFamily.load();

createRoot(root).render(
  <StrictMode>
    <App {...home} familyRequest={familyRequest} joinFamily={joinFamily} />
  </StrictMode>,
);
