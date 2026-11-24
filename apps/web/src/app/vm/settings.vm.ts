import { reatomFamily } from "@/modules/family";
import {
  reatomDevices,
  reatomDigest,
  reatomHomeScreen,
  reatomInstallEntry,
  reatomNotifications,
  reatomPush,
  reatomReminderChannel,
} from "@/modules/member-settings";

import type { AppDependencies } from "../app.model.ts";
import type { MemberSettingsApi, Parts, Session } from "./app.vm.ts";

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

export function reatomSettings(
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

export function reatomFamilyScreen({ dependencies, session, clock, shared }: Parts) {
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
