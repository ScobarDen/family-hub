import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { Photo } from "@family-hub/contract";

import { HttpError } from "@/common/http-client";

import { reatomBatchUpload } from "./batch-upload.vm.ts";

function photoOf(id: string): Photo {
  return {
    id,
    takenAt: null,
    urls: { thumb: `/t/${id}`, medium: `/m/${id}`, full: `/f/${id}` },
    canDelete: true,
  };
}

type Answer = "ok" | "429" | "broken";

function startBatch(answers: Answer[] = []) {
  const pending = [...answers];
  const added: string[] = [];
  const waits: number[] = [];
  let uploads = 0;
  const model = reatomBatchUpload({
    preparePhoto: async (file) => ({ file, takenAt: null }),
    upload: async () => {
      uploads += 1;

      const answer = pending.shift() ?? "ok";

      if (answer === "429") {
        throw new HttpError(429, "PHOTO_RATE_LIMITED", 7);
      }

      if (answer === "broken") {
        throw new HttpError(502);
      }

      return photoOf(`photo-${uploads}`);
    },
    onUploaded: async (photo) => {
      added.push(photo.id);
    },
    wait: async (ms) => {
      waits.push(ms);
    },
  });

  model.progress.subscribe(noop);
  model.isRunning.subscribe(noop);

  return { model, added, waits };
}

function files(count: number): Blob[] {
  return Array.from({ length: count }, (_, index) => new Blob([String(index)]));
}

beforeEach(() => {
  context.reset();
});

describe("a batch of photos", () => {
  test("goes up one by one, each joining the Album as soon as it is up", async () => {
    const { model, added } = startBatch();

    model.start(files(3));

    expect(model.progress()).toBe("0 / 3");

    await vi.waitFor(() => {
      expect(model.isRunning()).toBe(false);
    });

    expect(model.progress()).toBe("3 / 3");
    expect(added).toEqual(["photo-1", "photo-2", "photo-3"]);
  });

  test("waits as long as Telegram asks on a 429 and goes on", async () => {
    const { model, added, waits } = startBatch(["ok", "429", "ok"]);

    model.start(files(2));
    await vi.waitFor(() => {
      expect(model.isRunning()).toBe(false);
    });

    expect(waits).toEqual([7000]);
    expect(model.failedCount()).toBe(0);
    expect(added).toHaveLength(2);
  });

  test("keeps the ones that failed for «Повторить»", async () => {
    const { model, added } = startBatch(["ok", "broken", "ok"]);

    model.start(files(3));
    await vi.waitFor(() => {
      expect(model.isRunning()).toBe(false);
    });

    expect(model.progress()).toBe("2 / 3");
    expect(model.failedCount()).toBe(1);

    model.retry();
    await vi.waitFor(() => {
      expect(model.progress()).toBe("3 / 3");
    });

    expect(model.failedCount()).toBe(0);
    expect(added).toHaveLength(3);
  });

  test("takes at most 50 photos", () => {
    const { model } = startBatch();

    model.start(files(60));

    expect(model.progress()).toBe("0 / 50");
  });
});
