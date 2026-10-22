import { action, atom, computed, withAsync, wrap } from "@reatom/core";

type SavedSettingDependencies<Setting> = {
  send: (next: Setting) => Promise<Setting>;
  // undefined until the Member's settings arrive; null while the server knows none.
  saved: () => Setting | null | undefined;
};

// A change shows at once; a refused one falls back to the last value the server accepted.
export function reatomSavedSetting<Setting>(
  name: string,
  { send, saved }: SavedSettingDependencies<Setting>,
) {
  const confirmed = atom<Setting | undefined>(undefined, `${name}.confirmed`);
  const draft = atom<Setting | undefined>(undefined, `${name}.draft`);

  const save = action(async (next: Setting) => {
    draft.set(next);

    try {
      confirmed.set(await wrap(send(next)));
    } finally {
      if (draft() === next) {
        draft.set(undefined);
      }
    }
  }, `${name}.save`).extend(withAsync());

  return {
    current: computed(
      (): Setting | undefined => draft() ?? confirmed() ?? saved() ?? undefined,
      `${name}.current`,
    ),
    isChangedHere: computed(
      () => draft() !== undefined || confirmed() !== undefined,
      `${name}.isChangedHere`,
    ),
    save,
  };
}
