import { action, computed, effect, noop, peek } from "@reatom/core";

import type { TimeZoneSettings } from "@family-hub/contract";

import type { TimeZoneApi } from "../time-zone.api.ts";
import { reatomTimeZoneSettings } from "../time-zone.model.ts";

type TimeZoneDependencies = {
  api: TimeZoneApi;
  saved: () => TimeZoneSettings | null | undefined;
  deviceZone: string;
  zones: string[];
};

export function reatomTimeZone({ api, saved, deviceZone, zones }: TimeZoneDependencies) {
  const { zone, isChangedHere, failure, save } = reatomTimeZoneSettings({ api, saved });
  const device: TimeZoneSettings = { timeZone: deviceZone, isAuto: true };

  return {
    zone,
    zones,
    isSaving: computed(() => !save.ready(), "timeZone.isSaving"),
    failure,

    keepFollowingDevice: () =>
      effect(() => {
        const current = saved();

        // Only the Member's stored zone drives this; reading the save's own state would loop.
        if (current === undefined || peek(isChangedHere)) {
          return;
        }

        if (current === null || (current.isAuto && current.timeZone !== deviceZone)) {
          save(device).catch(noop);
        }
      }, "timeZone.keepFollowingDevice"),
    choose: action((timeZone: string) => {
      save({ timeZone, isAuto: false }).catch(noop);
    }, "timeZone.choose"),
    followDevice: action((isOn: boolean) => {
      const current = zone();

      if (isOn) {
        save(device).catch(noop);
      } else if (current !== undefined) {
        save({ timeZone: current.timeZone, isAuto: false }).catch(noop);
      }
    }, "timeZone.followDevice"),
  };
}

export type TimeZoneModel = ReturnType<typeof reatomTimeZone>;
