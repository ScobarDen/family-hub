import { computed } from "@reatom/core";

import { careEntryPhotoMax, type Photo } from "@family-hub/contract";

import type { PreparedPhoto } from "@/modules/photo";
import { reatomPhotoAttachments } from "@/modules/photo-attachments";
import { reatomPhotoViewer } from "@/modules/photo-viewer";
import { readOnly, type RollbackFailure } from "@/modules/state";
import type { Dialogs, Fullscreen, Haptics } from "@/modules/telegram";

import type { CareApi } from "../care.api.ts";
import { petPhotosOf } from "../care.lib.ts";
import type { CareData } from "../care.model.ts";

type CarePhotosDependencies = {
  api: CareApi;
  telegram: Dialogs & Fullscreen & { haptics: Haptics };
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  photoHint: () => string | undefined;
  onMakeAvatar: (photoId: string) => void;
  isReadOnly: () => boolean;
  failure: RollbackFailure;
};

export function reatomCarePhotos(dependencies: CarePhotosDependencies, data: CareData) {
  return {
    attachments: reatomPhotoAttachments({
      max: careEntryPhotoMax,
      ...dependencies,
      haptics: dependencies.telegram.haptics,
      canUploadPhotos: () => dependencies.photoHint() === undefined && !dependencies.isReadOnly(),
    }),
    viewer: reatomPhotoViewer({
      ...dependencies,
      // An archived Pet's card reads only, its avatar included.
      onPick: (photoId) => {
        if (!dependencies.isReadOnly()) {
          dependencies.onMakeAvatar(photoId);
        }
      },
      onDeleted: data.reload,
    }),
    petPhotos: computed((): Photo[] => petPhotosOf(data.entries.data() ?? []), "care.petPhotos"),
    photoHint: readOnly(dependencies.photoHint),
  };
}
