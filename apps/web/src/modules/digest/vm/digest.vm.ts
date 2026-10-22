import { action, atom, computed, noop, withAsync, wrap } from "@reatom/core";

import { defaultDigestTime, type DigestSettings } from "@family-hub/contract";

import { reatomFailure } from "@/common/state";

import type { DigestApi } from "../digest.api.ts";

type DigestDependencies = {
  api: DigestApi;
  // undefined until the Member's settings arrive.
  saved: () => DigestSettings | undefined;
};

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/u;

// A change shows at once and stays unless the server refuses it.
export function reatomDigest({ api, saved }: DigestDependencies) {
  const draft = atom<DigestSettings | undefined>(undefined, "digest.draft");
  const current = computed(
    (): DigestSettings => draft() ?? saved() ?? { isEnabled: true, time: defaultDigestTime },
    "digest.current",
  );

  const save = action(async (next: DigestSettings) => {
    draft.set(next);

    try {
      await wrap(api.save(next));
    } catch (error) {
      draft.set(undefined);
      throw error;
    }
  }, "digest.save").extend(withAsync());

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
    failure: reatomFailure(save, {
      message: "Не получилось сохранить сводку. Попробуйте ещё раз.",
      name: "digest.failure",
    }),

    toggle: action((isEnabled: boolean) => {
      save({ ...current(), isEnabled }).catch(noop);
    }, "digest.toggle"),
    chooseTime: action((time: string) => {
      if (timePattern.test(time)) {
        save({ ...current(), time }).catch(noop);
      }
    }, "digest.chooseTime"),
  };
}

export type DigestModel = ReturnType<typeof reatomDigest>;
