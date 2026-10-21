export type Recording = { stop(): Promise<Blob>; cancel(): void };

export type RecordingRefusal = "denied" | "unavailable";

export type VoiceRecorder = {
  isAvailable: boolean;
  start(): Promise<Recording | RecordingRefusal>;
};

export type MicrophoneStream = {
  getTracks(): Array<Pick<MediaStreamTrack, "readyState" | "stop">>;
};

// The browser parts the recorder touches, so tests can stand in for them.
export type RecorderEnvironment<Stream extends MicrophoneStream> = {
  requestMicrophone: (() => Promise<Stream>) | undefined;
  record: ((stream: Stream) => Recording) | undefined;
  page: {
    visibilityState: DocumentVisibilityState;
    addEventListener(type: "visibilitychange", listener: () => void): void;
  };
};

// iOS WebViews record only mp4; the others take webm. Whatever comes first and works wins.
const formats = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

function refusalOf(error: unknown): RecordingRefusal {
  return error instanceof DOMException && error.name === "NotAllowedError"
    ? "denied"
    : "unavailable";
}

function recordingOf(Recorder: typeof MediaRecorder, stream: MediaStream): Recording {
  const format = formats.find((each) => Recorder.isTypeSupported(each));
  const recorder = new Recorder(stream, format === undefined ? {} : { mimeType: format });
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

      return new Blob(chunks, { type: recorder.mimeType });
    },
    cancel() {
      recorder.stop();
    },
  };
}

function browserEnvironment(): RecorderEnvironment<MediaStream> {
  const mediaDevices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  const Recorder = typeof MediaRecorder === "undefined" ? undefined : MediaRecorder;

  return {
    requestMicrophone:
      mediaDevices?.getUserMedia === undefined
        ? undefined
        : async () => mediaDevices.getUserMedia({ audio: true }),
    record: Recorder && ((stream) => recordingOf(Recorder, stream)),
    page: document,
  };
}

// Telegram's Android WebView asks for the microphone on every getUserMedia, so the stream stays
// open while the Mini App is on screen and is let go only when it leaves.
function openMicrophone<Stream extends MicrophoneStream>({
  requestMicrophone,
  page,
}: RecorderEnvironment<Stream>) {
  let stream: Stream | undefined;

  function release(): void {
    for (const track of stream?.getTracks() ?? []) {
      track.stop();
    }

    stream = undefined;
  }

  page.addEventListener("visibilitychange", () => {
    if (page.visibilityState === "hidden") {
      release();
    }
  });

  return async (): Promise<Stream> => {
    const isLive = stream?.getTracks().every(({ readyState }) => readyState === "live") === true;

    if (stream === undefined || !isLive) {
      stream = await requestMicrophone?.();
    }

    if (stream === undefined) {
      throw new Error("No microphone");
    }

    return stream;
  };
}

export function voiceRecorderOver<Stream extends MicrophoneStream>(
  environment: RecorderEnvironment<Stream>,
): VoiceRecorder {
  const { record, requestMicrophone } = environment;
  const microphone = openMicrophone(environment);

  return {
    isAvailable: record !== undefined && requestMicrophone !== undefined,
    async start() {
      if (record === undefined) {
        return "unavailable";
      }

      try {
        return record(await microphone());
      } catch (error) {
        return refusalOf(error);
      }
    },
  };
}

export function createVoiceRecorder(): VoiceRecorder {
  return voiceRecorderOver(browserEnvironment());
}
