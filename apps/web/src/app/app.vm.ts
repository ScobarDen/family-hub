import { noop } from "@reatom/core";
import { Temporal } from "temporal-polyfill";

import { today as todayIn, type Viewer } from "@/common/format-date.lib.ts";
import { createAlbumsApi, reatomAlbumsScreen } from "@/modules/albums";
import { createFamilyApi, reatomFamily, reatomFamilyMembers } from "@/modules/family";
import { createFamilyRequestApi, reatomFamilyRequest } from "@/modules/family-request";
import { createFeedApi, reatomFeed } from "@/modules/feed";
import { createGoalsApi, reatomGoalsScreen } from "@/modules/goals";
import { createInvitesApi, reatomInvites } from "@/modules/invites";
import { createJoinFamilyApi, reatomJoinFamily } from "@/modules/join-family";
import {
  createMemberSettingsApi,
  reatomDevices,
  reatomDigest,
  reatomHomeScreen,
  reatomInstallEntry,
  reatomNotifications,
  reatomPush,
  reatomReminderChannel,
  reatomTimeZone,
} from "@/modules/member-settings";
import { createCareApi, createPetsApi, reatomPets, reatomPetTab } from "@/modules/pets";
import { preparePhoto } from "@/modules/photo";
import { createPhotoStorageApi, reatomPhotoStorage } from "@/modules/photo-storage";
import { reatomQuickAdd } from "@/modules/quick-add";
import { createRecipesApi, reatomRecipesScreen } from "@/modules/recipes";
import { reatomSession } from "@/modules/session";
import {
  createTabBarApi,
  reatomSections,
  reatomTabBar,
  reatomTabBarMenu,
  reatomTabBarModules,
} from "@/modules/tab-bar";
import { createTasksApi, reatomTasksScreen } from "@/modules/tasks";
import { createTodayApi, reatomToday } from "@/modules/today";

import { reatomTransport, type AppDependencies, type AppTransport } from "./app.model.ts";
import { reatomNavigation, type NavigationModel } from "./app.route.ts";
import { reatomOpener, type OpenTarget } from "./opener.vm.ts";
import { reatomPrefetch } from "./prefetch.vm.ts";

type Transport = AppTransport;

function reatomEntry(
  { telegram, platform, botUsername }: AppDependencies,
  { httpClient, sessionApi, deviceCache }: Transport,
) {
  const session = reatomSession({
    api: sessionApi,
    telegram,
    isJoiningFamily: () => joinFamily.isOpen(),
    deviceCache,
    botUsername,
    unsubscribePush: platform?.unsubscribePush,
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

  return { session, joinFamily, familyRequest };
}

type Session = ReturnType<typeof reatomEntry>["session"];

function reatomClock(
  dependencies: AppDependencies,
  { session, memberSettingsApi }: { session: Session; memberSettingsApi: MemberSettingsApi },
) {
  const timeZone = reatomTimeZone({
    api: memberSettingsApi,
    saved: () => session.member()?.settings.timeZone,
    deviceZone: dependencies.deviceZone(),
    zones: dependencies.zones,
    haptics: dependencies.telegram.haptics,
  });

  // The zone picked in the Profile wins; the device's is the fallback until the settings arrive.
  function zone(): string {
    return timeZone.zone()?.timeZone ?? dependencies.deviceZone();
  }

  function today(): string {
    return todayIn(zone());
  }

  return {
    timeZone,
    zone,
    today,
    viewer: (): Viewer => ({ today: today(), timeZone: zone() }),
    prepare: async (file: Blob) => preparePhoto(file, zone()),
    self: (): string | undefined => session.member()?.member.id,
  };
}

type MemberSettingsApi = ReturnType<typeof createMemberSettingsApi>;
type Clock = ReturnType<typeof reatomClock>;

// The navigation and the opener are built last, yet the screens built before them call into them.
function lateRouting() {
  let routing: { navigation: NavigationModel; open: (target: OpenTarget) => void } | undefined;

  return {
    bind: (navigation: NavigationModel, open: (target: OpenTarget) => void) => {
      routing = { navigation, open };
    },
    open: (target: OpenTarget) => {
      routing?.open(target);
    },
    navigation: () => routing?.navigation,
  };
}

type Routing = ReturnType<typeof lateRouting>;

// One query each for the Family's Members and Pets, so every picker sees the same list.
function reatomShared({ httpClient, live, deviceCache }: Transport, session: Session) {
  const familyApi = createFamilyApi(httpClient);
  const petsApi = createPetsApi(httpClient);

  return {
    familyApi,
    petsApi,
    members: reatomFamilyMembers(familyApi),
    petsModel: reatomPets({
      api: petsApi,
      liveVersion: () => live.versionOf("pet"),
      deviceCache,
    }),
    tabBarModules: reatomTabBarModules({
      api: createTabBarApi(httpClient),
      saved: () => session.member()?.settings.tabBar,
    }),
    photoStorage: reatomPhotoStorage({
      api: createPhotoStorageApi(httpClient),
      isFamilyOwner: () => session.member()?.isFamilyOwner === true,
    }),
  };
}

type Shared = ReturnType<typeof reatomShared>;

type Parts = {
  dependencies: AppDependencies;
  transport: Transport;
  session: Session;
  clock: Clock;
  shared: Shared;
  routing: Routing;
};

function reatomCollections({ dependencies, transport, clock, shared, routing }: Parts) {
  const { httpClient, live, deviceCache } = transport;
  const { telegram, slide } = dependencies;

  return {
    albums: reatomAlbumsScreen({
      api: createAlbumsApi(httpClient),
      liveVersion: () => live.versionOf("albums"),
      deviceCache,
      telegram,
      viewer: clock.viewer,
      preparePhoto: clock.prepare,
      wait: dependencies.wait,
      photoHint: shared.photoStorage.uploadHint,
      canSetUpPhotos: shared.photoStorage.canSetUp,
      onSetUpPhotos: () => {
        routing.navigation()?.openProfile();
      },
      sharePhotoFile: dependencies.platform?.shareFile,
      slide,
    }),
    recipes: reatomRecipesScreen({
      api: createRecipesApi(httpClient),
      liveVersion: () => live.versionOf("recipes"),
      deviceCache,
      telegram,
      preparePhoto: clock.prepare,
      photoHint: shared.photoStorage.uploadHint,
      slide,
    }),
  };
}

function reatomPlanning({ dependencies, transport, clock, shared, routing }: Parts) {
  const { httpClient, live, deviceCache } = transport;
  const { telegram, slide } = dependencies;

  return {
    tasks: reatomTasksScreen({
      api: createTasksApi(httpClient),
      liveVersion: () => live.versionOf("tasks"),
      albumsVersion: () => live.versionOf("albums"),
      deviceCache,
      members: shared.members,
      pets: shared.petsModel.list,
      telegram,
      self: clock.self,
      viewer: clock.viewer,
      onOpenAlbum: (albumId) => {
        routing.open({ kind: "album", albumId });
      },
      onOpenPet: (petId) => {
        routing.open({ kind: "pet", petId });
      },
      onRecord: (record) => {
        routing.open({ kind: "care-entry-for-pet", ...record });
      },
      slide,
    }),
    goals: reatomGoalsScreen({
      api: createGoalsApi(httpClient),
      liveVersion: () => live.versionOf("goals"),
      deviceCache,
      members: shared.members,
      telegram,
      self: clock.self,
      today: clock.today,
      timeZone: clock.zone,
      slide,
    }),
  };
}

type Planning = ReturnType<typeof reatomPlanning>;

function reatomPetScreen(parts: Parts, tasks: Planning["tasks"]) {
  const { dependencies, transport, session, clock, shared, routing } = parts;

  return reatomPetTab({
    api: shared.petsApi,
    liveVersion: () => transport.live.versionOf("pet"),
    route: {
      petId: () => routing.navigation()?.openedPetId(),
      open: (petId) => {
        routing.navigation()?.openPet(petId);
      },
      close: () => {
        routing.navigation()?.leave();
      },
    },
    careApi: createCareApi(transport.httpClient),
    pets: shared.petsModel,
    viewer: clock.viewer,
    now: () => Temporal.Now.plainDateTimeISO(clock.zone()).toString({ smallestUnit: "minute" }),
    telegram: dependencies.telegram,
    isFamilyOwner: () => session.member()?.isFamilyOwner === true,
    preparePhoto: clock.prepare,
    photoHint: shared.photoStorage.uploadHint,
    tasksOf: (petId) => tasks.tasksOf(petId),
    onOpenTask: (taskId) => {
      routing.open({ kind: "task", taskId });
    },
    onAddTask: (petId) => {
      routing.open({ kind: "task-for-pet", petId });
    },
  });
}

function reatomHubs({ dependencies, transport, clock, routing }: Parts) {
  const { httpClient, live, deviceCache } = transport;
  const { telegram } = dependencies;

  return {
    feed: reatomFeed({
      api: createFeedApi(httpClient),
      liveVersion: live.all,
      deviceCache,
      today: clock.today,
      timeZone: clock.zone,
      onOpen: routing.open,
      telegram,
    }),
    today: reatomToday({
      api: createTodayApi(httpClient),
      deviceCache,
      liveVersion: live.all,
      isLive: live.isConnected,
      today: clock.today,
      telegram,
      onOpen: routing.open,
      onOpenSection: (module) => {
        routing.navigation()?.openModule(module);
      },
      onOpenFeed: () => {
        routing.navigation()?.openModule("feed");
      },
    }),
    invites: reatomInvites({
      api: createInvitesApi(httpClient),
      telegram,
      viewer: clock.viewer,
    }),
  };
}

type Screens = ReturnType<typeof reatomCollections> &
  Planning &
  ReturnType<typeof reatomHubs> & { pet: ReturnType<typeof reatomPetScreen> };

function reatomScreens(parts: Parts): Screens {
  const planning = reatomPlanning(parts);

  return {
    ...reatomCollections(parts),
    ...planning,
    ...reatomHubs(parts),
    pet: reatomPetScreen(parts, planning.tasks),
  };
}

// Today and the two tab-bar slot screens load in the background once sign-in returns.
function prefetchOf({ session, shared }: Parts, screens: Screens) {
  return reatomPrefetch({
    isSignedIn: session.isSignedIn,
    slots: shared.tabBarModules.modules,
    today: screens.today.tiles,
    screens: {
      tasks: screens.tasks.screen,
      pet: screens.pet.pets.screen,
      goals: screens.goals.screen,
      albums: screens.albums.screen,
      recipes: screens.recipes.screen,
    },
  });
}

function reatomRouting(parts: Parts, screens: Screens) {
  const { dependencies, session, shared } = parts;
  const { pet, tasks, goals, albums, recipes, invites, today } = screens;
  const { telegram } = dependencies;
  const navigation = reatomNavigation({
    base: dependencies.base,
    slots: shared.tabBarModules.modules,
    onTodayShown: today.shown,
    isSignedIn: () => session.member() !== undefined,
    telegram,
    slide: dependencies.slide,
    nestedBack: { pet, tasks, goals, albums, recipes, profile: invites },
  });
  const opener = reatomOpener({
    telegram,
    navigation,
    isSignedIn: session.isSignedIn,
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
  });

  return { navigation, opener, prefetch: prefetchOf(parts, screens) };
}

type AppRouting = ReturnType<typeof reatomRouting>;

function pushOf(
  { telegram, platform }: AppDependencies,
  { session, memberSettingsApi }: { session: Session; memberSettingsApi: MemberSettingsApi },
) {
  return (
    platform &&
    reatomPush({
      api: memberSettingsApi,
      platform,
      deviceId: session.currentDeviceId,
      haptics: telegram.haptics,
    })
  );
}

function reatomSettings(
  { dependencies, session, clock, shared }: Parts,
  memberSettingsApi: MemberSettingsApi,
) {
  const { telegram } = dependencies;

  return {
    notifications: reatomNotifications({
      canMessage: () => session.member()?.settings.canMessage,
      telegram,
    }),
    timeZone: clock.timeZone,
    digest: reatomDigest({
      api: memberSettingsApi,
      saved: () => session.member()?.settings.digest,
      haptics: telegram.haptics,
    }),
    homeScreen: reatomHomeScreen({ telegram }),
    installEntry: reatomInstallEntry({ telegram, installUrl: dependencies.installUrl }),
    devices: reatomDevices({
      api: memberSettingsApi,
      currentDeviceId: session.currentDeviceId,
      telegram,
      viewer: clock.viewer,
      onSignedOut: session.signOut,
    }),
    reminderChannel: reatomReminderChannel({
      api: memberSettingsApi,
      saved: () => session.member()?.settings.reminderChannel,
      haptics: telegram.haptics,
    }),
    push: pushOf(dependencies, { session, memberSettingsApi }),
    photoStorage: shared.photoStorage,
  };
}

function reatomFamilyScreen({ dependencies, session, clock, shared }: Parts) {
  return reatomFamily({
    api: shared.familyApi,
    members: shared.members,
    telegram: dependencies.telegram,
    self: () => {
      const memberId = clock.self();

      return memberId === undefined ? undefined : { memberId, familyName: session.familyName() };
    },
    onLeft: session.signIn,
  });
}

function reatomShell(
  { dependencies, shared }: Parts,
  { navigation, opener }: AppRouting,
  today: Screens["today"],
) {
  const { telegram } = dependencies;
  const modules = shared.tabBarModules;

  return {
    navigation,
    tabBar: reatomTabBar({
      modules,
      activeTab: navigation.activeTab,
      onOpen: navigation.openTab,
      telegram,
      titles: () => {
        const petTitle = shared.petsModel.tabTitle();

        return petTitle === undefined ? {} : { pet: petTitle };
      },
    }),
    tabBarMenu: reatomTabBarMenu({ modules, telegram }),
    quickAdd: reatomQuickAdd({
      contributionGoalId: today.nearestGoalId,
      canAddPhoto: () => shared.photoStorage.view()?.isConnected === true,
      onQuickAdd: opener.open,
      onAddPhotos: opener.uploadPhotos,
      telegram,
    }),
    sections: reatomSections({
      modules,
      onOpen: navigation.openModule,
      onConfigure: navigation.openTabBarMenu,
      onOpenSettings: navigation.openProfile,
    }),
  };
}

type Launched = {
  joinFamily: { load: () => void };
  routes: AppRouting;
  settings: ReturnType<typeof reatomSettings>;
  today: Screens["today"];
};

function launcherOf(
  { dependencies, transport, session, clock }: Parts,
  { joinFamily, routes, settings, today }: Launched,
) {
  return () => {
    dependencies.telegram.launch(transport.deviceCache.whenRead([session.member, today.header]));
    routes.navigation.start();
    settings.homeScreen.load().catch(noop);
    settings.push?.load().catch(noop);
    routes.opener.launch();
    clock.timeZone.keepFollowingDevice();
    session.signIn();
    routes.prefetch().catch(noop);
    joinFamily.load();
    transport.live.start();
  };
}

// Every model and ViewModel, wired as the app runs: the entry point hands in the browser and
// Telegram, a test hands in fakes.
export function reatomApp(dependencies: AppDependencies) {
  const transport = reatomTransport(dependencies);
  const { session, joinFamily, familyRequest } = reatomEntry(dependencies, transport);
  const memberSettingsApi = createMemberSettingsApi(transport.httpClient);
  const clock = reatomClock(dependencies, { session, memberSettingsApi });
  const routing = lateRouting();
  const shared = reatomShared(transport, session);
  const parts: Parts = { dependencies, transport, session, clock, shared, routing };
  const screens = reatomScreens(parts);
  const routes = reatomRouting(parts, screens);
  const settings = reatomSettings(parts, memberSettingsApi);

  routing.bind(routes.navigation, routes.opener.open);

  const home = {
    session,
    ...reatomShell(parts, routes, screens.today),
    ...settings,
    ...screens,
    family: reatomFamilyScreen(parts),
  };

  return {
    home,
    familyRequest,
    joinFamily,
    launch: launcherOf(parts, { joinFamily, routes, settings, today: screens.today }),
  };
}

export type AppModel = ReturnType<typeof reatomApp>;
