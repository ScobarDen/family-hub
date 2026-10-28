import { action, atom, computed, noop, wrap } from "@reatom/core";

import { voiceMaxSeconds } from "@family-hub/contract";

import { readOnly } from "@/common/state";
import type { Haptics } from "@/common/telegram";
import type { Recording, VoiceRecorder } from "@/common/voice-recorder";

type MicrophoneDependencies = {
  recorder: VoiceRecorder;
  telegram: {
    haptics: Pick<Haptics, "impact" | "warning">;
    disableVerticalSwipes: () => void;
    enableVerticalSwipes: () => void;
    openTelegramLink: (url: string) => void;
  };
  botChat: () => Promise<string>;
  wait: (ms: number) => Promise<void>;
  onRecorded: (recording: Blob) => void;
};

export type MicrophoneState = "idle" | "starting" | "recording";

type Letting = "holding" | "released" | "left";

export const holdHint = "Держите кнопку и говорите";
export const botHint = "Микрофон недоступен — отправьте голосовое боту";

const secondMs = 1000;
const secondsInMinute = 60;
const secondsDigits = 2;

function timerOf(seconds: number): string {
  const rest = seconds % secondsInMinute;

  return `${Math.floor(seconds / secondsInMinute)}:${String(rest).padStart(secondsDigits, "0")}`;
}

function reatomRecordingState() {
  return {
    state: atom<MicrophoneState>("idle", "microphone.state"),
    elapsed: atom(0, "microphone.elapsed"),
    hint: atom<string | undefined>(undefined, "microphone.hint"),
    recording: atom<Recording | undefined>(undefined, "microphone.recording"),
    letting: atom<Letting>("holding", "microphone.letting"),
  };
}

type RecordingState = ReturnType<typeof reatomRecordingState>;

function reatomFinish(dependencies: MicrophoneDependencies, current: RecordingState) {
  const send = action(async (recording: Recording) => {
    dependencies.onRecorded(await wrap(recording.stop()));
  }, "microphone.send");

  return action((shouldSend: boolean) => {
    const recording = current.recording();

    current.recording.set(undefined);
    current.state.set("idle");
    current.elapsed.set(0);
    dependencies.telegram.enableVerticalSwipes();

    if (shouldSend) {
      dependencies.telegram.haptics.impact("light");
    } else {
      dependencies.telegram.haptics.warning();
    }

    if (recording === undefined) {
      return;
    }

    if (shouldSend) {
      send(recording).catch(noop);
    } else {
      recording.cancel();
    }
  }, "microphone.finish");
}

// Hold to talk, as in Telegram: the seconds tick until release, or until the 30 s limit sends it.
function reatomCount(
  dependencies: MicrophoneDependencies,
  current: RecordingState,
  finish: (shouldSend: boolean) => void,
) {
  return action(async (recording: Recording) => {
    while (current.recording() === recording) {
      await wrap(dependencies.wait(secondMs));

      if (current.recording() !== recording) {
        return;
      }

      current.elapsed.set(current.elapsed() + 1);

      if (current.elapsed() >= voiceMaxSeconds) {
        finish(true);
      }
    }
  }, "microphone.count");
}

function reatomToBot(dependencies: MicrophoneDependencies, current: RecordingState) {
  return action(async () => {
    current.hint.set(botHint);
    dependencies.telegram.openTelegramLink(await wrap(dependencies.botChat()));
  }, "microphone.toBot");
}

type Steps = {
  count: (recording: Recording) => Promise<void>;
  toBot: () => Promise<void>;
};

// The first hold may go to Telegram's permission prompt, and the finger is gone before it ends.
function reatomStart(
  dependencies: MicrophoneDependencies,
  current: RecordingState,
  { count, toBot }: Steps,
) {
  return action(async () => {
    const started = await wrap(dependencies.recorder.start());

    if (typeof started === "string" || current.letting() !== "holding") {
      current.state.set("idle");
      dependencies.telegram.enableVerticalSwipes();
    }

    if (typeof started === "string") {
      toBot().catch(noop);
    } else if (current.letting() === "holding") {
      current.recording.set(started);
      current.state.set("recording");
      dependencies.telegram.haptics.impact("medium");
      count(started).catch(noop);
    } else {
      started.cancel();
      dependencies.telegram.haptics.warning();
      current.hint.set(current.letting() === "released" ? holdHint : undefined);
    }
  }, "microphone.start");
}

function reatomFinger(
  dependencies: MicrophoneDependencies,
  current: RecordingState,
  { finish, steps }: { finish: (shouldSend: boolean) => void; steps: Steps },
) {
  const start = reatomStart(dependencies, current, steps);

  return {
    press: action(() => {
      current.hint.set(undefined);

      if (!dependencies.recorder.isAvailable) {
        steps.toBot().catch(noop);

        return;
      }

      if (current.state() !== "idle") {
        return;
      }

      current.letting.set("holding");
      current.state.set("starting");
      dependencies.telegram.disableVerticalSwipes();
      start().catch(noop);
    }, "microphone.press"),
    release: action(() => {
      if (current.state() === "starting") {
        current.letting.set("released");
      } else if (current.state() === "recording") {
        finish(true);
      }
    }, "microphone.release"),
    // A finger slid off the button cancels without sending.
    leave: action(() => {
      if (current.state() === "starting") {
        current.letting.set("left");
      } else if (current.state() === "recording") {
        finish(false);
      }
    }, "microphone.leave"),
  };
}

export function reatomMicrophone(dependencies: MicrophoneDependencies) {
  const current = reatomRecordingState();
  const finish = reatomFinish(dependencies, current);
  const steps = {
    count: reatomCount(dependencies, current, finish),
    toBot: reatomToBot(dependencies, current),
  };

  return {
    state: readOnly(current.state),
    timer: computed(() => timerOf(current.elapsed()), "microphone.timer"),
    hint: readOnly(current.hint),
    ...reatomFinger(dependencies, current, { finish, steps }),
  };
}

export type MicrophoneModel = ReturnType<typeof reatomMicrophone>;
