import { noop } from "@reatom/core";

import { today as todayIn, type Viewer } from "@/common/format-date.lib.ts";
import { createFamilyApi, reatomFamilyMembers } from "@/modules/family";
import { createFamilyRequestApi, reatomFamilyRequest } from "@/modules/family-request";
import { createJoinFamilyApi, reatomJoinFamily } from "@/modules/join-family";
import { createMemberSettingsApi, reatomTimeZone } from "@/modules/member-settings";
import { createPetsApi, reatomPets } from "@/modules/pets";
import { preparePhoto } from "@/modules/photo";
import { createPhotoStorageApi, reatomPhotoStorage } from "@/modules/photo-storage";
import { reatomSession } from "@/modules/session";
import { createTabBarApi, reatomTabBarModules } from "@/modules/tab-bar";

import { reatomTransport, type AppDependencies, type AppTransport } from "../app.model.ts";
import type { NavigationModel } from "../route/app.route.ts";
import type { OpenTarget } from "./opener.vm.ts";
import { reatomRouting, type AppRouting } from "./routing.vm.ts";
import { reatomScreens, type Screens } from "./screens.vm.ts";
import { reatomFamilyScreen, reatomSettings } from "./settings.vm.ts";
import { reatomShell } from "./shell.vm.ts";

function reatomEntry(
  { telegram, platform, botUsername }: AppDependencies,
  { httpClient, sessionApi, deviceCache }: AppTransport,
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

export type Session = ReturnType<typeof reatomEntry>["session"];

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

export type MemberSettingsApi = ReturnType<typeof createMemberSettingsApi>;
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
function reatomShared({ httpClient, live, deviceCache }: AppTransport, session: Session) {
  const familyApi = createFamilyApi(httpClient);
  const petsApi = createPetsApi(httpClient);

  return {
    familyApi,
    petsApi,
    // A write to the Family moves the feed version, the only one that names it.
    members: reatomFamilyMembers({ api: familyApi, liveVersion: () => live.versionOf("feed") }),
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

export type Parts = {
  dependencies: AppDependencies;
  transport: AppTransport;
  session: Session;
  clock: Clock;
  shared: Shared;
  routing: Routing;
};

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
