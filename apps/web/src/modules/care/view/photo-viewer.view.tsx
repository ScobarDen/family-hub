import { reatomComponent } from "@reatom/react";
import { ChevronLeft, ChevronRight, Trash2, UserRound, X } from "lucide-react";

import { Button } from "@/common/ui";

import type { PhotoViewerModel } from "../vm/photo-viewer.vm.ts";

type ViewerProps = { model: PhotoViewerModel; canMakeAvatar: boolean };

type BarProps = ViewerProps & { position: string; canDelete: boolean };

const ViewerBar = reatomComponent(
  ({ model, canMakeAvatar, position, canDelete }: BarProps) => (
    <div className="flex items-center justify-between p-2">
      <Button variant="ghost" size="icon-lg" aria-label="Закрыть" onClick={model.close}>
        <X />
      </Button>
      <span className="text-sm">{position}</span>
      <div className="flex gap-1">
        {canMakeAvatar && (
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Сделать аватаром"
            onClick={model.makeAvatar}
          >
            <UserRound />
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Удалить фото"
            disabled={model.isRemoving()}
            onClick={model.remove}
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  ),
  "ViewerBar",
);

// Full screen over everything, as Telegram's own photo viewer is.
export const PhotoViewer = reatomComponent(({ model, canMakeAvatar }: ViewerProps) => {
  const current = model.current();
  const photo = current?.photo;

  if (current === undefined || photo === undefined) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black pt-safe-top pb-safe-bottom text-white">
      <ViewerBar
        model={model}
        canMakeAvatar={canMakeAvatar}
        position={current.position}
        canDelete={photo.canDelete}
      />
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <img src={photo.urls.full} alt="" className="max-h-full max-w-full object-contain" />
        <button
          type="button"
          className="absolute inset-y-0 left-0 w-1/4"
          aria-label="Предыдущее фото"
          onClick={model.previous}
        >
          <ChevronLeft className="ml-2" />
        </button>
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-1/4 justify-end"
          aria-label="Следующее фото"
          onClick={model.next}
        >
          <ChevronRight className="mr-2 self-center" />
        </button>
      </div>
    </div>
  );
}, "PhotoViewer");
