import { reatomComponent } from "@reatom/react";
import { Mic } from "lucide-react";

import { cn } from "@/common/ui";

import type { MicrophoneModel } from "../vm/microphone.vm.ts";

export type MicrophoneProps = { model: MicrophoneModel };

export const Microphone = reatomComponent(({ model }: MicrophoneProps) => {
  const isRecording = model.state() === "recording";
  const hint = model.hint();

  return (
    <div className="relative flex flex-col items-center">
      {(isRecording || hint !== undefined) && (
        <span
          role="status"
          className="absolute bottom-full mb-2 rounded-full bg-foreground px-3 py-1 text-xs font-medium whitespace-nowrap text-background"
        >
          {isRecording ? `● ${model.timer()}` : hint}
        </span>
      )}
      <button
        type="button"
        aria-label="Удерживайте и говорите"
        aria-pressed={isRecording}
        className={cn(
          "flex size-12 touch-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform select-none",
          isRecording && "scale-125 bg-destructive",
        )}
        onPointerDown={model.press}
        onPointerUp={model.release}
        onPointerLeave={model.leave}
        onPointerCancel={model.leave}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
      >
        <Mic className="size-6" />
      </button>
    </div>
  );
}, "Microphone");
