import { action, computed, effect, noop, peek } from "@reatom/core";

import type { TimeZoneSettings } from "@family-hub/contract";

import { reatomFailure } from "@/common/state";

import type { MemberSettingsApi } from "../member-settings.api.ts";
import { reatomSavedSetting } from "../member-settings.model.ts";

type TimeZoneDependencies = {
  api: MemberSettingsApi;
  saved: () => TimeZoneSettings | null | undefined;
  deviceZone: string;
  zones: string[];
};

export function reatomTimeZone({ api, saved, deviceZone, zones }: TimeZoneDependencies) {
  const setting = reatomSavedSetting("timeZone", { send: api.saveTimeZone, saved });
  const device: TimeZoneSettings = { timeZone: deviceZone, isAuto: true };

  function save(next: TimeZoneSettings): void {
    setting.save(next).catch(noop);
  }

  return {
    zone: setting.current,
    zones,
    isSaving: computed(() => !setting.save.ready(), "timeZone.isSaving"),
    failure: reatomFailure(setting.save, {
      message: "Не получилось сохранить часовой пояс. Попробуйте ещё раз.",
      name: "timeZone.failure",
    }),

    keepFollowingDevice: () =>
      effect(() => {
        const current = saved();

        // Only the Member's stored zone drives this; reading the save's own state would loop.
        if (current === undefined || peek(setting.isChangedHere)) {
          return;
        }

        if (current === null || (current.isAuto && current.timeZone !== deviceZone)) {
          save(device);
        }
      }, "timeZone.keepFollowingDevice"),
    choose: action((timeZone: string) => {
      save({ timeZone, isAuto: false });
    }, "timeZone.choose"),
    followDevice: action((isOn: boolean) => {
      const current = setting.current();

      if (isOn) {
        save(device);
      } else if (current !== undefined) {
        save({ timeZone: current.timeZone, isAuto: false });
      }
    }, "timeZone.followDevice"),
  };
}

export type TimeZoneModel = ReturnType<typeof reatomTimeZone>;
