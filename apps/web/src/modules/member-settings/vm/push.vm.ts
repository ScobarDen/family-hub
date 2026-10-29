import { action, atom, computed, withAsync, wrap, type Atom } from "@reatom/core";

import type { BrowserPlatform, PushPermission } from "@/modules/browser-platform";
import { detached, reatomFailure } from "@/modules/changes";
import type { Haptics } from "@/modules/telegram";

import type { MemberSettingsApi } from "../member-settings.api.ts";

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

type PushDependencies = {
  api: Pick<MemberSettingsApi, "pushKey" | "savePush" | "deletePush">;
  platform: BrowserPlatform;
  deviceId: () => string | undefined;
  haptics: Pick<Haptics, "error">;
};

const hints: Partial<Record<PushState, string>> = {
  "needs-install":
    "На iPhone и iPad Push приходит, только когда приложение добавлено на экран «Домой»",
  denied:
    "Уведомления запрещены. Разрешите их для Домового в настройках браузера или системы и включите снова",
  on: "Напоминания приходят на это устройство",
  off: "Включите, чтобы напоминания приходили без Telegram",
};

function stateOf(
  platform: BrowserPlatform,
  { permission, isOn }: { permission: PushPermission; isOn: boolean },
): PushState {
  const availability = platform.pushAvailability();

  if (availability !== "available") {
    return availability;
  }

  if (permission === "denied") {
    return "denied";
  }

  return isOn ? "on" : "off";
}

type PushSwitch = Pick<PushDependencies, "api" | "platform"> & {
  permission: Atom<PushPermission>;
  isOn: Atom<boolean>;
};

// The browser asks for permission only here, when the Member turns Push on, never at launch.
async function turnOn({ api, platform, permission, isOn }: PushSwitch, device: string) {
  const answer =
    permission() === "granted" ? "granted" : await wrap(platform.requestPushPermission());

  permission.set(answer);

  if (answer !== "granted") {
    return;
  }

  const { publicKey } = await wrap(api.pushKey());
  const subscription = await wrap(platform.subscribePush(publicKey));

  await wrap(api.savePush(device, subscription));
  isOn.set(true);
}

async function turnOff({ api, platform, isOn }: PushSwitch, device: string) {
  await wrap(platform.unsubscribePush());
  await wrap(api.deletePush(device));
  isOn.set(false);
}

export function reatomPush({ api, platform, deviceId, haptics }: PushDependencies) {
  const permission = atom(platform.pushPermission(), "push.permission");
  const isOn = atom(false, "push.isOn");
  const pushSwitch = { api, platform, permission, isOn };

  const toggle = action(async (isWanted: boolean) => {
    const device = deviceId();

    if (device !== undefined) {
      await wrap(isWanted ? turnOn(pushSwitch, device) : turnOff(pushSwitch, device));
    }
  }, "push.toggle").extend(withAsync());
  const state = computed(
    () => stateOf(platform, { permission: permission(), isOn: isOn() }),
    "push.state",
  );

  return {
    state,
    hint: computed(() => hints[state()], "push.hint"),
    isSwitching: computed(() => !toggle.ready(), "push.isSwitching"),
    failure: reatomFailure(toggle, {
      message: "Не получилось переключить Push. Попробуйте ещё раз.",
      name: "push.failure",
      haptics,
    }),

    load: action(async () => {
      isOn.set(await wrap(platform.hasPushSubscription()));
    }, "push.load"),
    toggle: detached(toggle, "push.switch"),
  };
}

export type PushModel = ReturnType<typeof reatomPush>;
