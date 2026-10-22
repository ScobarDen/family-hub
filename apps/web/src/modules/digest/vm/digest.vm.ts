import { action, atom, computed, noop, withAsync, wrap } from "@reatom/core";

import { defaultDigestTime, type DigestSettings } from "@family-hub/contract";

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
  const failure = atom<string | undefined>(undefined, "digest.failure");
  const current = computed(
    (): DigestSettings => draft() ?? saved() ?? { isEnabled: true, time: defaultDigestTime },
    "digest.current",
  );

  const save = action(async (next: DigestSettings) => {
    failure.set(undefined);
    draft.set(next);

    try {
      await wrap(api.save(next));
    } catch {
      draft.set(undefined);
      failure.set("Не получилось сохранить сводку. Попробуйте ещё раз.");
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
    failure: computed(() => failure(), "digest.visibleFailure"),

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
