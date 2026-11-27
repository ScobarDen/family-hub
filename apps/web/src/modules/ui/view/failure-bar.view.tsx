import { LiveRegion } from "./live-region.view.tsx";

// A wide window has no tab bar to clear; there the bar centres over the content past
// `--content-start`, the sidebar's width the shell sets and the photo viewer resets.
export const floatingBarClass =
  "fixed inset-x-4 bottom-[calc(var(--safe-area-bottom)+6rem)] lg:bottom-[calc(var(--safe-area-bottom)+1rem)] lg:left-[calc(var(--content-start,0px)+1rem)] z-50 mx-auto flex max-w-lg flex-wrap items-center gap-x-1 rounded-2xl border border-transparent bg-foreground py-2 pr-2 pl-4 text-background shadow-lg animate-in duration-300 ease-out fade-in motion-safe:slide-in-from-bottom-4";

// Every module reports a rolled-back change here. Only the text sits in the live region, mounted
// before it appears, so «Скрыть» is not read with it; the page makes room for the bar through `data-undo`.
export function FailureBar({
  failure,
  onDismiss,
}: {
  failure: string | undefined;
  onDismiss: () => void;
}) {
  const isShown = failure !== undefined;

  return (
    <div data-undo={isShown || undefined} className={isShown ? floatingBarClass : "absolute"}>
      <LiveRegion className="min-w-0 flex-1 basis-40 leading-snug break-words">
        {failure}
      </LiveRegion>
      {isShown && (
        <button type="button" className="min-h-11 px-2 font-semibold" onClick={onDismiss}>
          Скрыть
        </button>
      )}
    </div>
  );
}
