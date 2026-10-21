export type Recording = { stop(): Promise<Blob>; cancel(): void };

export type RecordingRefusal = "denied" | "unavailable";

export type VoiceRecorder = {
  isAvailable: boolean;
  start(): Promise<Recording | RecordingRefusal>;
};

// iOS WebViews record only mp4; the others take webm. Whatever comes first and works wins.
const formats = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

function formatOf(): string | undefined {
  return formats.find((format) => MediaRecorder.isTypeSupported(format));
}

function refusalOf(error: unknown): RecordingRefusal {
  return error instanceof DOMException && error.name === "NotAllowedError"
    ? "denied"
    : "unavailable";
}

function release(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function recordingOf(stream: MediaStream, format: string | undefined): Recording {
  const recorder = new MediaRecorder(stream, format === undefined ? {} : { mimeType: format });
  const chunks: Blob[] = [];

  recorder.addEventListener("dataavailable", (event) => {
    chunks.push(event.data);
  });
  recorder.start();

  return {
    async stop() {
      const stopped = new Promise<void>((resolve) => {
        recorder.addEventListener(
          "stop",
          () => {
            resolve();
          },
          { once: true },
        );
      });

      recorder.stop();
      await stopped;
      release(stream);

      return new Blob(chunks, { type: recorder.mimeType });
    },
    cancel() {
      recorder.stop();
      release(stream);
    },
  };
}

export function createVoiceRecorder(): VoiceRecorder {
  const isAvailable =
    typeof MediaRecorder !== "undefined" && navigator.mediaDevices?.getUserMedia !== undefined;

  return {
    isAvailable,
    async start() {
      if (!isAvailable) {
        return "unavailable";
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        return recordingOf(stream, formatOf());
      } catch (error) {
        return refusalOf(error);
      }
    },
  };
}
