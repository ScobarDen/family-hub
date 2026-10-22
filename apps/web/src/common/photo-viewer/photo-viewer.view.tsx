import { reatomComponent } from "@reatom/react";
import { ChevronLeft, ChevronRight, Trash2, X, type LucideIcon } from "lucide-react";
import { useRef, type PointerEvent } from "react";

import { Button } from "@/common/ui";

import type { PhotoViewerModel } from "./photo-viewer.vm.ts";

export type PickAction = { label: string; icon: LucideIcon };

type ViewerProps = { model: PhotoViewerModel; pickAction?: PickAction };

type BarProps = ViewerProps & { position: string; canDelete: boolean };

const ViewerBar = reatomComponent(
  ({ model, pickAction, position, canDelete }: BarProps) => (
    <div className="flex items-center justify-between p-2">
      <Button variant="ghost" size="icon-lg" aria-label="Закрыть" onClick={model.close}>
        <X />
      </Button>
      <span className="text-sm">{position}</span>
      <div className="flex gap-1">
        {pickAction !== undefined && (
          <Button variant="ghost" size="icon-lg" aria-label={pickAction.label} onClick={model.pick}>
            <pickAction.icon />
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

const StepButtons = reatomComponent(
  ({ model }: { model: PhotoViewerModel }) => (
    <>
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
    </>
  ),
  "StepButtons",
);

const swipeDistance = 50;

// A swipe left or right steps through the photos, as in Telegram's own viewer.
function useSwipe(model: PhotoViewerModel) {
  const startX = useRef<number | null>(null);

  return {
    onPointerDown: (event: PointerEvent) => {
      startX.current = event.clientX;
    },
    onPointerUp: (event: PointerEvent) => {
      const distance = event.clientX - (startX.current ?? event.clientX);

      if (distance > swipeDistance) {
        model.previous();
      } else if (distance < -swipeDistance) {
        model.next();
      }
    },
  };
}

// Full screen over everything, as Telegram's own photo viewer is.
export const PhotoViewer = reatomComponent(({ model, pickAction }: ViewerProps) => {
  const current = model.current();
  const photo = current?.photo;
  const swipe = useSwipe(model);

  if (current === undefined || photo === undefined) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black pt-safe-top pb-safe-bottom text-white">
      <ViewerBar
        model={model}
        pickAction={pickAction}
        position={current.position}
        canDelete={photo.canDelete}
      />
      <div
        className="relative flex flex-1 touch-pan-y items-center justify-center overflow-hidden"
        onPointerDown={swipe.onPointerDown}
        onPointerUp={swipe.onPointerUp}
      >
        <img src={photo.urls.full} alt="" className="max-h-full max-w-full object-contain" />
        <StepButtons model={model} />
      </div>
    </div>
  );
}, "PhotoViewer");
