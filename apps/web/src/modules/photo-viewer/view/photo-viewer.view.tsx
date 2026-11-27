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
import { useEffect, useRef, type PointerEvent } from "react";

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

type StepProps = { model: PhotoViewerModel; hasPrevious: boolean; hasNext: boolean };

// A mouse sees the steps on hover, a touch screen keeps them shown.
const stepButton =
  "absolute inset-y-0 flex w-1/4 items-center outline-none transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100";

const stepIcon =
  "size-10 rounded-full bg-black/40 p-2 in-focus-visible:ring-2 in-focus-visible:ring-white";

const StepButtons = reatomComponent(
  ({ model, hasPrevious, hasNext }: StepProps) => (
    <>
      {hasPrevious && (
        <button
          type="button"
          className={`${stepButton} left-0 justify-start pl-2`}
          aria-label="Предыдущее фото"
          onClick={model.previous}
        >
          <ChevronLeft aria-hidden className={stepIcon} />
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          className={`${stepButton} right-0 justify-end pr-2`}
          aria-label="Следующее фото"
          onClick={model.next}
        >
          <ChevronRight aria-hidden className={stepIcon} />
        </button>
      )}
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

type PhotoProps = StepProps & { src: string };

const SwipedPhoto = reatomComponent(({ model, src, hasPrevious, hasNext }: PhotoProps) => {
  const swipe = useSwipe(model);

  return (
    <div
      className="group relative flex flex-1 touch-pan-y items-center justify-center overflow-hidden"
      onPointerDown={swipe.onPointerDown}
      onPointerUp={swipe.onPointerUp}
    >
      <FallbackImage
        src={src}
        className="max-h-full max-w-full object-contain"
        fallback={<ImageOff aria-hidden className="size-12 text-white/50" />}
      />
      <StepButtons model={model} hasPrevious={hasPrevious} hasNext={hasNext} />
    </div>
  );
}, "SwipedPhoto");

// On the document, not the dialog: a step button removed at the first or last photo drops focus out of the dialog.
function useArrowSteps(model: PhotoViewerModel, isOpen: boolean) {
  useEffect(() => {
    const listening = new AbortController();

    function step(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        model.previous();
      } else if (event.key === "ArrowRight") {
        model.next();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", step, { signal: listening.signal });
    }

    return () => {
      listening.abort();
    };
  }, [model, isOpen]);
}

// Full screen over everything, as Telegram's own photo viewer is.
export const PhotoViewer = reatomComponent(({ model, pickAction }: ViewerProps) => {
  const current = model.current();
  const photo = current?.photo;

  useArrowSteps(model, photo !== undefined);

  return (
    <ModalDialog
      isOpen={photo !== undefined}
      onClose={model.close}
      aria-label="Фото"
      className="flex-col bg-black [--content-start:0px] pt-safe-top pr-[var(--tg-safe-area-inset-right,0px)] pb-safe-bottom pl-[var(--tg-safe-area-inset-left,0px)] text-white open:flex"
    >
      {current !== undefined && photo !== undefined && (
        <>
          <ViewerBar
            model={model}
            pickAction={pickAction}
            position={current.position}
            canDelete={photo.canDelete}
          />
          <SwipedPhoto
            model={model}
            src={photo.urls.full}
            hasPrevious={current.hasPrevious}
            hasNext={current.hasNext}
          />
        </>
      )}
      <FailureBar failure={model.failure()} onDismiss={model.dismissFailure} />
    </ModalDialog>
  );
}, "PhotoViewer");
