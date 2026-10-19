import { action, atom, computed, noop, withAsync, wrap } from "@reatom/core";

type NotificationsDependencies = {
  canMessage: () => boolean | undefined;
  telegram: { requestWriteAccess: () => Promise<boolean> };
};

export function reatomNotifications({ canMessage, telegram }: NotificationsDependencies) {
  // The server learns of the new write access from initData at the next launch.
  const isAllowedNow = atom(false, "notifications.isAllowedNow");
  const request = action(async () => {
    if (await wrap(telegram.requestWriteAccess())) {
      isAllowedNow.set(true);
    }
  }, "notifications.request").extend(withAsync());

  return {
    isOff: computed(() => canMessage() === false && !isAllowedNow(), "notifications.isOff"),
    isEnabling: computed(() => !request.ready(), "notifications.isEnabling"),

    enable: action(() => {
      request().catch(noop);
    }, "notifications.enable"),
  };
}

export type NotificationsModel = ReturnType<typeof reatomNotifications>;
