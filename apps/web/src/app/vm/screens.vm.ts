import { Temporal } from "temporal-polyfill";

import { createAlbumsApi, reatomAlbumsScreen } from "@/modules/albums";
import { createFeedApi, reatomFeed } from "@/modules/feed";
import { createGoalsApi, reatomGoalsScreen } from "@/modules/goals";
import { createInvitesApi, reatomInvites } from "@/modules/invites";
import { createCareApi, reatomPetTab } from "@/modules/pets";
import { createRecipesApi, reatomRecipesScreen } from "@/modules/recipes";
import { createTasksApi, reatomTasksScreen } from "@/modules/tasks";
import { createTodayApi, reatomToday } from "@/modules/today";

import type { Parts } from "./app.vm.ts";

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

export type Screens = ReturnType<typeof reatomCollections> &
  Planning &
  ReturnType<typeof reatomHubs> & { pet: ReturnType<typeof reatomPetScreen> };

export function reatomScreens(parts: Parts): Screens {
  const planning = reatomPlanning(parts);

  return {
    ...reatomCollections(parts),
    ...planning,
    ...reatomHubs(parts),
    pet: reatomPetScreen(parts, planning.tasks),
  };
}
