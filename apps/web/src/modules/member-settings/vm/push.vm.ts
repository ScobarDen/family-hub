import { action, atom, computed, noop, withAsync, wrap, type Atom } from "@reatom/core";

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

  // A subscription the server never saved would look «on» at the next launch and never ring.
  await wrap(
    api.savePush(device, subscription).catch(async (error: unknown) => {
      await platform.unsubscribePush().catch(noop);
      throw error;
    }),
  );
  isOn.set(true);
}

// The server forgets the subscription first, so a failure leaves Push on as it was.
async function turnOff({ api, platform, isOn }: PushSwitch, device: string) {
  await wrap(api.deletePush(device));
  await wrap(platform.unsubscribePush());
  isOn.set(false);
}

export function reatomPush({ api, platform, deviceId, haptics }: PushDependencies) {
  const permission = atom(platform.pushPermission(), "push.permission");
  const isOn = atom(false, "push.isSubscribed");
  const pushSwitch = { api, platform, permission, isOn };

  const switchPush = action(async (isWanted: boolean) => {
    const device = deviceId();

    if (device === undefined) {
      throw new Error("Push needs the Device this app signed in with");
    }

    await wrap(isWanted ? turnOn(pushSwitch, device) : turnOff(pushSwitch, device));
  }, "push.switch").extend(withAsync());
  const detachedSwitch = detached(switchPush, "push.switchDetached");
  const state = computed(
    () => stateOf(platform, { permission: permission(), isOn: isOn() }),
    "push.state",
  );

  return {
    state,
    hint: computed(() => hints[state()], "push.hint"),
    canToggle: computed(() => ["on", "off", "denied"].includes(state()), "push.canToggle"),
    isOn: computed(() => state() === "on", "push.isOn"),
    isSwitching: computed(() => !switchPush.ready(), "push.isSwitching"),
    failure: reatomFailure(switchPush, {
      message: "Не получилось переключить Push. Попробуйте ещё раз.",
      name: "push.failure",
      haptics,
    }),

    // Permission can change in the browser's settings while the app is closed.
    load: action(async () => {
      permission.set(platform.pushPermission());
      isOn.set(await wrap(platform.hasPushSubscription()));
    }, "push.load"),
    toggle: action((isWanted: boolean) => {
      if (switchPush.ready()) {
        detachedSwitch(isWanted);
      }
    }, "push.toggle"),
  };
}

export type PushModel = ReturnType<typeof reatomPush>;
