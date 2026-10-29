import { action, computed, withAsync, withAsyncData, wrap } from "@reatom/core";

import { formatDay, type Viewer } from "@/common/format-date.lib.ts";
import { withoutId } from "@/common/records.lib.ts";
import { detached, reatomFailure } from "@/modules/changes";
import { isConfirmed, type Dialogs, type Haptics } from "@/modules/telegram";

import type { MemberSettingsApi } from "../member-settings.api.ts";

export type DeviceItem = { id: string; title: string; lastUsed: string; signOutLabel: string };

type DevicesDependencies = {
  api: Pick<MemberSettingsApi, "listDevices" | "revokeDevice">;
  currentDeviceId: () => string | undefined;
  telegram: Pick<Dialogs, "showPopup"> & { haptics: Pick<Haptics, "warning" | "error"> };
  viewer: () => Viewer;
  // Signing out of the Device in hand leaves the app on its sign-in screen.
  onSignedOut: () => Promise<void>;
};

function reatomList(api: DevicesDependencies["api"]) {
  return computed(async () => wrap(api.listDevices()), "devices.list").extend(withAsyncData());
}

function reatomRevoke(
  { api, currentDeviceId, telegram, onSignedOut }: DevicesDependencies,
  list: ReturnType<typeof reatomList>,
) {
  return action(async (deviceId: string) => {
    const isCurrent = deviceId === currentDeviceId();
    const isSure = await wrap(
      isConfirmed(telegram, {
        title: isCurrent ? "Выйти на этом устройстве?" : "Выйти на устройстве?",
        message: isCurrent
          ? "Чтобы вернуться, войдите через Telegram ещё раз."
          : "Устройство потеряет доступ к семье и перестанет получать Push.",
        button: "Выйти",
      }),
    );

    if (!isSure) {
      return;
    }

    await wrap(api.revokeDevice(deviceId));

    if (isCurrent) {
      await wrap(onSignedOut());

      return;
    }

    list.data.set(withoutId(list.data() ?? [], deviceId));
  }, "devices.revokeDevice").extend(withAsync());
}

// Where the Member is signed in to the Installed App, the most recently used first.
export function reatomDevices(dependencies: DevicesDependencies) {
  const list = reatomList(dependencies.api);
  const revokeDevice = reatomRevoke(dependencies, list);

  return {
    devices: computed(
      (): DeviceItem[] =>
        (list.data() ?? []).map(({ id, label, lastUsedAt }) => {
          const isCurrent = id === dependencies.currentDeviceId();

          return {
            id,
            title: isCurrent ? `${label} — это устройство` : label,
            lastUsed: `Заходили ${formatDay(lastUsedAt, dependencies.viewer())}`,
            signOutLabel: isCurrent ? "Выйти на этом устройстве" : `Выйти на устройстве ${label}`,
          };
        }),
      "devices.items",
    ),
    failure: reatomFailure(revokeDevice, {
      message: "Не получилось выйти на устройстве. Попробуйте ещё раз.",
      name: "devices.failure",
      haptics: dependencies.telegram.haptics,
    }),

    revoke: detached(revokeDevice, "devices.revoke"),
  };
}

export type DevicesModel = ReturnType<typeof reatomDevices>;
