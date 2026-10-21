import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Temporal } from "temporal-polyfill";

import { parseDeepLink } from "@family-hub/contract";

import { deviceTimeZone, today } from "@/common/format-date";
import { createHttpClient } from "@/common/http-client";
import { reatomTelegram } from "@/common/telegram";
import { createCareApi, reatomCare } from "@/modules/care";
import { createFamilyApi, reatomFamily } from "@/modules/family";
import { createFamilyRequestApi, reatomFamilyRequest } from "@/modules/family-request";
import { createInvitesApi, reatomInvites } from "@/modules/invites";
import { createJoinFamilyApi, reatomJoinFamily } from "@/modules/join-family";
import { reatomNotifications } from "@/modules/notifications";
import { createPetsApi, reatomPets, reatomPetsScreen } from "@/modules/pets";
import { createPhotoStorageApi, reatomPhotoStorage } from "@/modules/photo-storage";
import { createPlansApi, reatomPlans, reatomPlansScreen } from "@/modules/plans";
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

const tabBarModules = reatomTabBarModules({
  api: createTabBarApi(httpClient),
  saved: () => session.member()?.settings.tabBar,
});
const photoStorage = reatomPhotoStorage({
  api: createPhotoStorageApi(httpClient),
  isFamilyOwner: () => session.member()?.isFamilyOwner === true,
});
const plansApi = createPlansApi(httpClient);
const plans = reatomPlansScreen({
  api: plansApi,
  plans: reatomPlans({ api: plansApi }),
  telegram,
  self: () => session.member()?.member.id,
  timeZone: deviceTimeZone,
});
const petsApi = createPetsApi(httpClient);
const petsModel = reatomPets({ api: petsApi });
const pets = reatomPetsScreen({
  api: petsApi,
  pets: petsModel,
  viewer: () => ({ today: today(deviceTimeZone()), timeZone: deviceTimeZone() }),
  photoHint: photoStorage.uploadHint,
  soonPlans: plans.openPlansOf,
  onOpenPlan: (planId) => {
    navigation.openModule("plans");
    plans.open(planId);
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
};

telegram.launch();
telegram.followColorScheme(document.documentElement);
telegram.followPlatform(document.documentElement);
navigation.start();

// The navigation opens the module of a deep link; the module opens the record itself.
const link = parseDeepLink(telegram.startParam);

if (link?.kind === "plan") {
  plans.open(link.id);
} else if (link?.kind === "pet") {
  pets.open(link.id);
}

timeZone.keepFollowingDevice();
session.signIn();
joinFamily.load();

createRoot(root).render(
  <StrictMode>
    <App {...home} familyRequest={familyRequest} joinFamily={joinFamily} />
  </StrictMode>,
);
