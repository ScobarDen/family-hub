import { action, atom, computed, noop, withAsync, wrap, type Atom } from "@reatom/core";

import type { PushSubscriptionChange } from "@family-hub/contract";

import type { BrowserPlatform, PushPermission } from "@/modules/browser-platform";
import { detached, reatomFailure } from "@/modules/changes";
import type { Haptics } from "@/modules/telegram";

import type { MemberSettingsApi } from "../member-settings.api.ts";

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

type PushDependencies = {
  api: Pick<MemberSettingsApi, "pushKey" | "pushEndpoint" | "savePush" | "deletePush">;
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

// Samsung and Xiaomi put the browser to sleep, so a Push can arrive late until it is exempted.
const androidOnHint =
  "Напоминания приходят на это устройство. Если опаздывают, уберите браузер из экономии батареи в настройках телефона";

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

// At launch a subscription only one side holds is mended: the browser's is saved, a lost one is
// made again while notifications are allowed and forgotten on the server when they are not.
async function mend(
  pushSwitch: PushSwitch,
  { device, held }: { device: string; held: PushSubscriptionChange | undefined },
) {
  const { api, permission, isOn } = pushSwitch;

  if (held !== undefined) {
    await wrap(api.savePush(device, held));
    isOn.set(true);
  } else if (permission() === "granted") {
    await wrap(turnOn(pushSwitch, device));
  } else {
    await wrap(api.deletePush(device));
    isOn.set(false);
  }
}

// The switch shows what the server keeps, which the push service may have dropped (ADR 0016).
// Offline, the server is taken to agree with the browser. A subscription held without permission
// rings nothing, so it counts as none.
async function reconcile(pushSwitch: PushSwitch, device: string) {
  const { api, platform, permission, isOn } = pushSwitch;
  const held = permission() === "granted" ? await wrap(platform.pushSubscription()) : undefined;
  const { endpoint } = await wrap(
    api.pushEndpoint(device).catch(() => ({ endpoint: held?.endpoint ?? null })),
  );

  if (held?.endpoint === (endpoint ?? undefined)) {
    isOn.set(held !== undefined);

    return;
  }

  try {
    await wrap(mend(pushSwitch, { device, held }));
  } catch {
    isOn.set(false);
  }
}

// The server forgets the subscription first, so a failure leaves Push on as it was.
async function turnOff({ api, platform, isOn }: PushSwitch, device: string) {
  await wrap(api.deletePush(device));
  await wrap(platform.unsubscribePush());
  isOn.set(false);
}

// Permission can change in the browser's settings while the app is closed.
async function load(pushSwitch: PushSwitch, device: string | undefined) {
  const { platform, permission, isOn } = pushSwitch;

  permission.set(platform.pushPermission());

  if (device === undefined || platform.pushAvailability() !== "available") {
    isOn.set((await wrap(platform.pushSubscription())) !== undefined);

    return;
  }

  await wrap(reconcile(pushSwitch, device));
}

// The launch's reconciling and the Member's switch would overwrite each other, so one waits.
function reatomPushActions(pushSwitch: PushSwitch, deviceId: () => string | undefined) {
  const switchPush = action(async (isWanted: boolean) => {
    const device = deviceId();

    if (device === undefined) {
      throw new Error("Push needs the Device this app signed in with");
    }

    await wrap(isWanted ? turnOn(pushSwitch, device) : turnOff(pushSwitch, device));
  }, "push.switch").extend(withAsync());
  const loadPush = action(async () => {
    if (switchPush.ready()) {
      await wrap(load(pushSwitch, deviceId()));
    }
  }, "push.load").extend(withAsync());

  return { switchPush, loadPush };
}

export function reatomPush({ api, platform, deviceId, haptics }: PushDependencies) {
  const permission = atom(platform.pushPermission(), "push.permission");
  const isOn = atom(false, "push.isSubscribed");
  const pushSwitch = { api, platform, permission, isOn };

  const { switchPush, loadPush } = reatomPushActions(pushSwitch, deviceId);
  const detachedSwitch = detached(switchPush, "push.switchDetached");
  const state = computed(
    () => stateOf(platform, { permission: permission(), isOn: isOn() }),
    "push.state",
  );

  return {
    state,
    hint: computed(
      () => (state() === "on" && platform.isAndroid ? androidOnHint : hints[state()]),
      "push.hint",
    ),
    canToggle: computed(() => ["on", "off", "denied"].includes(state()), "push.canToggle"),
    isOn: computed(() => state() === "on", "push.isOn"),
    isSwitching: computed(() => !switchPush.ready() || !loadPush.ready(), "push.isSwitching"),
    failure: reatomFailure(switchPush, {
      message: "Не получилось переключить Push. Попробуйте ещё раз.",
      name: "push.failure",
      haptics,
    }),

    load: loadPush,
    toggle: action((isWanted: boolean) => {
      if (switchPush.ready() && loadPush.ready()) {
        detachedSwitch(isWanted);
      }
    }, "push.toggle"),
  };
}

export type PushModel = ReturnType<typeof reatomPush>;
