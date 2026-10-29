import { reatomComponent } from "@reatom/react";
import {
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Share,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRef, type PointerEvent } from "react";

import { FallbackImage, Button, FailureBar, ModalDialog } from "@/modules/ui";

import type { PhotoViewerModel } from "../vm/photo-viewer.vm.ts";

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
        {model.canShare() && (
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Поделиться"
            disabled={model.isSharing()}
            onClick={model.share}
          >
            <Share />
          </Button>
        )}
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

const SwipedPhoto = reatomComponent(({ model, src }: { model: PhotoViewerModel; src: string }) => {
  const swipe = useSwipe(model);

  return (
    <div
      className="relative flex flex-1 touch-pan-y items-center justify-center overflow-hidden"
      onPointerDown={swipe.onPointerDown}
      onPointerUp={swipe.onPointerUp}
    >
      <FallbackImage
        src={src}
        className="max-h-full max-w-full object-contain"
        fallback={<ImageOff aria-hidden className="size-12 text-white/50" />}
      />
      <StepButtons model={model} />
    </div>
  );
}, "SwipedPhoto");

// Full screen over everything, as Telegram's own photo viewer is.
export const PhotoViewer = reatomComponent(({ model, pickAction }: ViewerProps) => {
  const current = model.current();
  const photo = current?.photo;

  return (
    <ModalDialog
      isOpen={photo !== undefined}
      onClose={model.close}
      aria-label="Фото"
      className="flex-col bg-black pt-safe-top pr-[var(--tg-safe-area-inset-right,0px)] pb-safe-bottom pl-[var(--tg-safe-area-inset-left,0px)] text-white open:flex"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          model.previous();
        } else if (event.key === "ArrowRight") {
          model.next();
        }
      }}
    >
      {current !== undefined && photo !== undefined && (
        <>
          <ViewerBar
            model={model}
            pickAction={pickAction}
            position={current.position}
            canDelete={photo.canDelete}
          />
          <SwipedPhoto model={model} src={photo.urls.full} />
        </>
      )}
      <FailureBar failure={model.failure()} onDismiss={model.dismissFailure} />
    </ModalDialog>
  );
}, "PhotoViewer");
