import { action, computed, isAbort, withAsync, wrap, type Action } from "@reatom/core";

import type { Pet } from "@family-hub/contract";

import { PhotoTooLargeError, type PreparedPhoto } from "@/modules/photo";
import { detached } from "@/modules/state";
import {
  didSucceedOrAlert,
  isConfirmed,
  type Confirmation,
  type Dialogs,
  type Haptics,
} from "@/modules/telegram";

import type { PetsApi } from "../pets.api.ts";
import type { PetsModel } from "../pets.model.ts";

type PetAvatarDependencies = {
  api: PetsApi;
  pets: Pick<PetsModel, "keep">;
  telegram: Dialogs & { haptics: Haptics };
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  photoHint: () => string | undefined;
  openedPet: () => Pet | undefined;
};

type Save = Action<[photoId: string | null], Promise<void>>;

const removeQuestion: Confirmation = {
  title: "Убрать аватар?",
  message: "Фото, загруженное только для аватара, удалится. Фото из записей останется.",
  button: "Убрать",
};

function failureOf(error: unknown): string {
  return error instanceof PhotoTooLargeError
    ? "Фото больше 10 МБ."
    : "Не получилось загрузить фото. Попробуйте ещё раз.";
}

function reatomUpload({ api, telegram, preparePhoto }: PetAvatarDependencies, save: Save) {
  return action(async ([file]: Blob[]) => {
    if (file === undefined) {
      return;
    }

    try {
      const photo = await wrap(api.uploadPhoto(await wrap(preparePhoto(file))));

      await wrap(save(photo.id));
      telegram.haptics.success();
    } catch (error) {
      if (isAbort(error)) {
        throw error;
      }

      telegram.haptics.error();
      telegram.showAlert(failureOf(error));
    }
  }, "pets.uploadAvatarPhoto").extend(withAsync());
}

function reatomRemoval({ telegram }: PetAvatarDependencies, save: Save) {
  return action(async () => {
    if (await wrap(isConfirmed(telegram, removeQuestion))) {
      await wrap(
        didSucceedOrAlert(telegram, {
          failure: "Не получилось убрать аватар. Попробуйте ещё раз.",
          call: save(null),
        }),
      );
    }
  }, "pets.confirmAvatarRemoval").extend(withAsync());
}

export function reatomPetAvatar(dependencies: PetAvatarDependencies) {
  const { api, pets, openedPet, photoHint } = dependencies;
  const save = action(async (photoId: string | null) => {
    const pet = openedPet();

    if (pet !== undefined) {
      pets.keep(await wrap(api.setAvatar(pet.id, photoId)));
    }
  }, "pets.saveAvatar").extend(withAsync());
  const upload = reatomUpload(dependencies, save);
  const remove = reatomRemoval(dependencies, save);

  return {
    // An archived Pet's avatar reads only; without Photo Storage it can still be taken away.
    avatarChange: computed(() => {
      const pet = openedPet();
      const hint = photoHint();

      return pet === undefined || pet.archivedAt !== null
        ? undefined
        : { canUpload: hint === undefined, hint };
    }, "pets.avatarChange"),
    isAvatarSaving: computed(
      () => !upload.ready() || !remove.ready() || !save.ready(),
      "pets.isAvatarSaving",
    ),
    makeAvatar: detached(save, "pets.makeAvatar"),
    uploadAvatar: detached(upload, "pets.uploadAvatar"),
    removeAvatar: detached(remove, "pets.removeAvatar"),
  };
}
