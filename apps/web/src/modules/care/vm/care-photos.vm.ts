import { computed } from "@reatom/core";

import type { Photo } from "@family-hub/contract";

import type { PreparedPhoto } from "@/common/photo";
import type { PopupParams } from "@/common/telegram";

import type { CareApi } from "../care.api.ts";
import { petPhotosOf } from "../care.lib.ts";
import type { CareData } from "../care.model.ts";
import { reatomEntryPhotos } from "./entry-photos.vm.ts";
import { reatomPhotoViewer } from "./photo-viewer.vm.ts";

type CarePhotosDependencies = {
  api: CareApi;
  telegram: { showPopup: (params: PopupParams) => Promise<string | undefined> };
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  photoHint: () => string | undefined;
  onMakeAvatar: (photoId: string) => void;
  isReadOnly: () => boolean;
};

export function reatomCarePhotos(dependencies: CarePhotosDependencies, data: CareData) {
  return {
    attachments: reatomEntryPhotos({
      ...dependencies,
      canUploadPhotos: () => dependencies.photoHint() === undefined,
    }),
    viewer: reatomPhotoViewer({
      ...dependencies,
      // An archived Pet's card reads only, its avatar included.
      onMakeAvatar: (photoId) => {
        if (!dependencies.isReadOnly()) {
          dependencies.onMakeAvatar(photoId);
        }
      },
      onDeleted: data.reload,
    }),
    petPhotos: computed((): Photo[] => petPhotosOf(data.entries.data() ?? []), "care.petPhotos"),
    photoHint: computed(() => dependencies.photoHint(), "care.photoHint"),
  };
}
