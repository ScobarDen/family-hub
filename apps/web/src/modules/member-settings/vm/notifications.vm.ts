import { action, computed, reatomBoolean, withAsync, wrap } from "@reatom/core";

import { detached } from "@/modules/changes";

type NotificationsDependencies = {
  canMessage: () => boolean | undefined;
  telegram: { isInTelegram: boolean; requestWriteAccess: () => Promise<boolean> };
};

export function reatomNotifications({ canMessage, telegram }: NotificationsDependencies) {
  // The server learns of the new write access from initData at the next launch.
  const isAllowedNow = reatomBoolean(false, "notifications.isAllowedNow");
  const request = action(async () => {
    if (await wrap(telegram.requestWriteAccess())) {
      isAllowedNow.setTrue();
    }
  }, "notifications.request").extend(withAsync());

  return {
    // Outside Telegram the bot's write access cannot be asked for, and Push stands in for it.
    isShown: telegram.isInTelegram,
    isOff: computed(
      () => telegram.isInTelegram && canMessage() === false && !isAllowedNow(),
      "notifications.isOff",
    ),
    isEnabling: computed(() => !request.ready(), "notifications.isEnabling"),

    enable: detached(request, "notifications.enable"),
  };
}

export type NotificationsModel = ReturnType<typeof reatomNotifications>;
