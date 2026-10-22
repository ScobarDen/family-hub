import { action, computed, noop } from "@reatom/core";

import { defaultDigestTime, type DigestSettings } from "@family-hub/contract";

import { reatomFailure } from "@/common/state";

import type { MemberSettingsApi } from "../member-settings.api.ts";
import { reatomSavedSetting } from "../member-settings.model.ts";

type DigestDependencies = {
  api: MemberSettingsApi;
  // undefined until the Member's settings arrive.
  saved: () => DigestSettings | undefined;
};

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/u;

export function reatomDigest({ api, saved }: DigestDependencies) {
  const setting = reatomSavedSetting("digest", { send: api.saveDigest, saved });
  const current = computed(
    (): DigestSettings => setting.current() ?? { isEnabled: true, time: defaultDigestTime },
    "digest.current",
  );

  function save(next: DigestSettings): void {
    setting.save(next).catch(noop);
  }

  return {
    isEnabled: computed(() => current().isEnabled, "digest.isEnabled"),
    time: computed(() => current().time, "digest.time"),
    schedule: computed(
      () =>
        current().isEnabled
          ? `Каждое утро в ${current().time} — сообщением от бота`
          : "Выключена: бот не пишет по утрам",
      "digest.schedule",
    ),
    failure: reatomFailure(setting.save, {
      message: "Не получилось сохранить сводку. Попробуйте ещё раз.",
      name: "digest.failure",
    }),

    toggle: action((isEnabled: boolean) => {
      save({ ...current(), isEnabled });
    }, "digest.toggle"),
    chooseTime: action((time: string) => {
      if (timePattern.test(time)) {
        save({ ...current(), time });
      }
    }, "digest.chooseTime"),
  };
}

export type DigestModel = ReturnType<typeof reatomDigest>;
