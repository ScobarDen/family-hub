import { action, atom, computed, withAsync, wrap } from "@reatom/core";

import type { TimeZoneSettings } from "@family-hub/contract";

import type { TimeZoneApi } from "./time-zone.api.ts";

type TimeZoneSettingsDependencies = {
  api: TimeZoneApi;
  // undefined until the Member's settings arrive, null while the server knows no zone.
  saved: () => TimeZoneSettings | null | undefined;
};

export function reatomTimeZoneSettings({ api, saved }: TimeZoneSettingsDependencies) {
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

export type TimeZoneSettingsModel = ReturnType<typeof reatomTimeZoneSettings>;
