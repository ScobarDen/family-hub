import { action, atom, computed, noop, withAsync, wrap, type Atom } from "@reatom/core";

import { albumBatchMax, type Photo } from "@family-hub/contract";

import { HttpError } from "@/common/http-client";
import type { PreparedPhoto } from "@/common/photo";

export type BatchStatus = "waiting" | "uploading" | "done" | "failed";

type BatchItem = { key: string; file: Blob; status: BatchStatus };

export type BatchUploadDependencies = {
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  upload: (prepared: PreparedPhoto) => Promise<Photo>;
  // Each photo joins the Album as soon as it is up, so a closed app loses only the rest.
  onUploaded: (photo: Photo) => Promise<unknown>;
  wait: (ms: number) => Promise<void>;
};

const rateLimitedStatus = 429;
const msPerSecond = 1000;
const fallbackWaitSeconds = 3;

function waitOf(error: unknown): number | undefined {
  return error instanceof HttpError && error.status === rateLimitedStatus
    ? (error.retryAfterSeconds ?? fallbackWaitSeconds) * msPerSecond
    : undefined;
}

function reatomStatuses(items: Atom<BatchItem[]>) {
  return function mark(key: string, status: BatchStatus): void {
    items.set(items().map((item) => (item.key === key ? { ...item, status } : item)));
  };
}

// Photos go up one by one; Telegram's 429 is a pause for as long as it asks, not a failure.
async function uploadOne(
  dependencies: BatchUploadDependencies,
  item: BatchItem,
): Promise<"done" | "failed"> {
  for (;;) {
    try {
      const prepared = await wrap(dependencies.preparePhoto(item.file));
      const photo = await wrap(dependencies.upload(prepared));

      await wrap(dependencies.onUploaded(photo));

      return "done";
    } catch (error) {
      const ms = waitOf(error);

      if (ms === undefined) {
        return "failed";
      }

      await wrap(dependencies.wait(ms));
    }
  }
}

function countOf(items: BatchItem[], status: BatchStatus): number {
  return items.filter((item) => item.status === status).length;
}

function itemOf(file: Blob, key: string): BatchItem {
  return { key, file, status: "waiting" };
}

function retried(item: BatchItem): BatchItem {
  return item.status === "failed" ? { ...item, status: "waiting" } : item;
}

export function reatomBatchUpload(dependencies: BatchUploadDependencies) {
  const items = atom<BatchItem[]>([], "albums.batch.items");
  const mark = reatomStatuses(items);
  let lastKey = 0;

  const run = action(async () => {
    for (const item of items().filter(({ status }) => status === "waiting")) {
      mark(item.key, "uploading");
      mark(item.key, await wrap(uploadOne(dependencies, item)));
    }
  }, "albums.batch.run").extend(withAsync());

  return {
    isActive: computed(() => items().length > 0, "albums.batch.isActive"),
    isRunning: computed(() => !run.ready(), "albums.batch.isRunning"),
    progress: computed(
      () => `${countOf(items(), "done")} / ${items().length}`,
      "albums.batch.progress",
    ),
    failedCount: computed(() => countOf(items(), "failed"), "albums.batch.failedCount"),

    start: action((files: Blob[]) => {
      items.set(
        files.slice(0, albumBatchMax).map((file) => {
          lastKey += 1;

          return itemOf(file, `batch-${lastKey}`);
        }),
      );
      run().catch(noop);
    }, "albums.batch.start"),
    retry: action(() => {
      items.set(items().map(retried));
      run().catch(noop);
    }, "albums.batch.retry"),
    dismiss: action(() => {
      items.set([]);
    }, "albums.batch.dismiss"),
  };
}

export type BatchUploadModel = ReturnType<typeof reatomBatchUpload>;
