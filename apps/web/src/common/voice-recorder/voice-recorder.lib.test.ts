import { noop } from "@reatom/core";
import { describe, expect, test } from "vite-plus/test";

import { voiceRecorderOver, type Recording } from "./voice-recorder.lib.ts";

function fakeTrack() {
  const track = {
    readyState: "live" as MediaStreamTrackState,
    stop() {
      track.readyState = "ended";
    },
  };

  return track;
}

type FakeTrack = ReturnType<typeof fakeTrack>;

function fakeMicrophone() {
  const tracks: FakeTrack[] = [];
  const listeners: Array<() => void> = [];
  const page = {
    visibilityState: "visible" as DocumentVisibilityState,
    addEventListener(_type: "visibilitychange", listener: () => void) {
      listeners.push(listener);
    },
  };
  const recorder = voiceRecorderOver({
    async requestMicrophone() {
      const track = fakeTrack();

      tracks.push(track);

      return { getTracks: () => [track] };
    },
    record: (): Recording => ({
      stop: async () => new Blob(["voice"], { type: "audio/webm" }),
      cancel: noop,
    }),
    page,
  });

  function hidePage() {
    page.visibilityState = "hidden";

    for (const listener of listeners) {
      listener();
    }

    page.visibilityState = "visible";
  }

  return { recorder, tracks, hidePage };
}

async function record(recorder: ReturnType<typeof voiceRecorderOver>): Promise<Blob> {
  const recording = await recorder.start();

  if (typeof recording === "string") {
    throw new TypeError(recording);
  }

  return recording.stop();
}

describe("the voice recorder", () => {
  test("asks for the microphone once and keeps it for the next recordings", async () => {
    const { recorder, tracks } = fakeMicrophone();

    await record(recorder);
    await record(recorder);

    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.readyState).toBe("live");
  });

  test("lets the microphone go when the Mini App leaves the screen, and asks again on return", async () => {
    const microphone = fakeMicrophone();

    await record(microphone.recorder);
    microphone.hidePage();

    expect(microphone.tracks[0]?.readyState).toBe("ended");

    await record(microphone.recorder);

    expect(microphone.tracks).toHaveLength(2);
  });
});
