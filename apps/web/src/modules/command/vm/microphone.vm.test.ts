import { context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { Recording, RecordingRefusal } from "@/common/voice-recorder.lib.ts";
import { fakeHaptics } from "@/modules/telegram";

import { botHint, holdHint, reatomMicrophone } from "./microphone.vm.ts";

function fakeRecorder({ isAvailable = true } = {}) {
  const recorder = {
    isAvailable,
    stopped: 0,
    cancelled: 0,
    refusal: undefined as RecordingRefusal | undefined,
    permission: undefined as Promise<void> | undefined,
    async start(): Promise<Recording | RecordingRefusal> {
      await recorder.permission;

      if (recorder.refusal !== undefined) {
        return recorder.refusal;
      }

      return {
        async stop() {
          recorder.stopped += 1;

          return new Blob(["voice"], { type: "audio/mp4" });
        },
        cancel() {
          recorder.cancelled += 1;
        },
      };
    },
  };

  return recorder;
}

function startMicrophone(recorder = fakeRecorder()) {
  const seconds: Array<() => void> = [];
  const telegram = {
    calls: [] as string[],
    haptics: fakeHaptics(),
    disableVerticalSwipes() {
      telegram.calls.push("disableVerticalSwipes");
    },
    enableVerticalSwipes() {
      telegram.calls.push("enableVerticalSwipes");
    },
    openTelegramLink(url: string) {
      telegram.calls.push(`openTelegramLink ${url}`);
    },
  };
  const sent: Blob[] = [];
  const model = reatomMicrophone({
    recorder,
    telegram,
    botChat: async () => "https://t.me/family_hub_bot",
    wait: async () =>
      new Promise((resolve) => {
        seconds.push(resolve);
      }),
    onRecorded: (recording) => {
      sent.push(recording);
    },
  });

  async function pass(count: number) {
    for (let second = 0; second < count; second += 1) {
      await vi.waitFor(() => {
        expect(seconds.length).toBeGreaterThan(0);
      });
      seconds.shift()?.();
      await Promise.resolve();
    }
  }

  return { model, recorder, telegram, sent, pass };
}

async function recordingStarted(model: ReturnType<typeof reatomMicrophone>) {
  await vi.waitFor(() => {
    expect(model.state()).toBe("recording");
  });
}

function swipes(calls: string[]): string[] {
  return calls.filter((call) => call.endsWith("VerticalSwipes"));
}

beforeEach(() => {
  context.reset();
});

describe("holding the microphone", () => {
  test("records while held and sends on release, with swipes off only for the hold", async () => {
    const { model, telegram, sent, pass } = startMicrophone();

    model.press();
    await recordingStarted(model);
    await pass(3);
    await vi.waitFor(() => {
      expect(model.timer()).toBe("0:03");
    });

    model.release();

    await vi.waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(model.state()).toBe("idle");
    expect(swipes(telegram.calls)).toEqual(["disableVerticalSwipes", "enableVerticalSwipes"]);
    expect(telegram.haptics.felt).toEqual(["impact medium", "impact light"]);
  });

  test("cancels without sending when the finger slides off", async () => {
    const { model, recorder, sent, telegram } = startMicrophone();

    model.press();
    await recordingStarted(model);
    model.leave();

    expect(recorder.cancelled).toBe(1);
    expect(sent).toEqual([]);
    expect(telegram.haptics.felt).toEqual(["impact medium", "warning"]);
    expect(model.state()).toBe("idle");
  });

  test("stops and sends by itself at 30 seconds", async () => {
    const { model, sent, pass } = startMicrophone();

    model.press();
    await recordingStarted(model);
    await pass(30);

    await vi.waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(model.state()).toBe("idle");
  });

  test("sends nothing when the hold went to the permission prompt, and says to hold", async () => {
    const recorder = fakeRecorder();
    let allowMicrophone: (() => void) | undefined;

    recorder.permission = new Promise((resolve) => {
      allowMicrophone = resolve;
    });

    const { model, sent, telegram } = startMicrophone(recorder);

    model.press();
    model.release();
    allowMicrophone?.();

    await vi.waitFor(() => {
      expect(model.hint()).toBe(holdHint);
    });
    expect(recorder.cancelled).toBe(1);
    expect(sent).toEqual([]);
    expect(model.state()).toBe("idle");
    expect(telegram.haptics.felt).toEqual(["warning"]);
  });
});

describe("without a microphone", () => {
  test("opens the bot chat when the WebView cannot record", async () => {
    const { model, telegram } = startMicrophone(fakeRecorder({ isAvailable: false }));

    model.press();

    await vi.waitFor(() => {
      expect(telegram.calls).toEqual(["openTelegramLink https://t.me/family_hub_bot"]);
    });
    expect(model.hint()).toBe(botHint);
  });

  test("opens the bot chat when the Member refuses the microphone", async () => {
    const recorder = fakeRecorder();

    recorder.refusal = "refused";

    const { model, telegram } = startMicrophone(recorder);

    model.press();

    await vi.waitFor(() => {
      expect(telegram.calls).toContain("openTelegramLink https://t.me/family_hub_bot");
    });
    expect(swipes(telegram.calls)).toEqual(["disableVerticalSwipes", "enableVerticalSwipes"]);
    expect(model.state()).toBe("idle");
  });
});
