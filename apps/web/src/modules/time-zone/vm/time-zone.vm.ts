import { action, atom, computed, effect, noop, peek, withAsync, wrap } from "@reatom/core";

import type { TimeZoneSettings } from "@family-hub/contract";

import type { TimeZoneApi } from "../time-zone.api.ts";

type TimeZoneSettingsDependencies = {
  api: TimeZoneApi;
  // undefined until the Member's settings arrive, null while the server knows no zone.
  saved: () => TimeZoneSettings | null | undefined;
};

function reatomTimeZoneSettings({ api, saved }: TimeZoneSettingsDependencies) {
  const confirmed = atom<TimeZoneSettings | undefined>(undefined, "timeZone.confirmed");
  const draft = atom<TimeZoneSettings | undefined>(undefined, "timeZone.draft");
  const failure = atom<string | undefined>(undefined, "timeZone.failure");

  const save = action(async (next: TimeZoneSettings) => {
    failure.set(undefined);
    draft.set(next);

    try {
      confirmed.set(await wrap(api.save(next)));
    } catch {
      failure.set("Не получилось сохранить часовой пояс. Попробуйте ещё раз.");
    } finally {
      if (draft() === next) {
        draft.set(undefined);
      }
    }
  }, "timeZone.save").extend(withAsync());

  return {
    zone: computed(
      (): TimeZoneSettings | undefined => draft() ?? confirmed() ?? saved() ?? undefined,
      "timeZone.zone",
    ),
    isChangedHere: computed(
      () => draft() !== undefined || confirmed() !== undefined,
      "timeZone.isChangedHere",
    ),
    failure,
    save,
  };
}

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
