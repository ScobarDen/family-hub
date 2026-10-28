import { reatomComponent } from "@reatom/react";
import { Mic } from "lucide-react";
import type { KeyboardEvent } from "react";

import { cn, LiveRegion } from "@/common/ui";

import type { MicrophoneModel } from "../vm/microphone.vm.ts";

export type MicrophoneProps = { model: MicrophoneModel };

// Holding Space or Enter talks the way holding the button does.
function isTalkKey(key: string): boolean {
  return key === " " || key === "Enter";
}

function talkKeysOf(model: MicrophoneModel) {
  return {
    onKeyDown: (event: KeyboardEvent) => {
      if (isTalkKey(event.key) && !event.repeat) {
        event.preventDefault();
        model.press();
      }
    },
    onKeyUp: (event: KeyboardEvent) => {
      if (isTalkKey(event.key)) {
        event.preventDefault();
        model.release();
      }
    },
  };
}

export const Microphone = reatomComponent(({ model }: MicrophoneProps) => {
  const isRecording = model.state() === "recording";
  const hint = model.hint();

  return (
    <div className="relative flex flex-col items-center">
      <LiveRegion className="absolute bottom-full mb-2">
        {(isRecording || hint !== undefined) && (
          <span className="block w-max max-w-[calc(100vw-2rem)] rounded-full bg-foreground px-3 py-1 text-center text-xs font-medium text-background">
            {isRecording ? <span aria-hidden>● {model.timer()}</span> : hint}
          </span>
        )}
      </LiveRegion>
      <button
        type="button"
        aria-label="Удерживайте и говорите"
        aria-pressed={isRecording}
        className={cn(
          "flex size-12 touch-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md select-none motion-safe:transition-transform",
          isRecording && "bg-destructive motion-safe:scale-125",
        )}
        onPointerDown={model.press}
        onPointerUp={model.release}
        onPointerLeave={model.leave}
        onPointerCancel={model.leave}
        {...talkKeysOf(model)}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
      >
        <Mic className="size-6" />
      </button>
    </div>
  );
}, "Microphone");
