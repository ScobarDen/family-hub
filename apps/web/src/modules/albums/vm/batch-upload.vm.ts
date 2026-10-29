import {
  action,
  atom,
  computed,
  isAbort,
  noop,
  withAbort,
  withAsync,
  wrap,
  type Atom,
} from "@reatom/core";

import { albumBatchMax, type Photo } from "@family-hub/contract";

import { HttpError } from "@/common/http-error.lib.ts";
import type { PreparedPhoto } from "@/modules/photo";
import type { Haptics } from "@/modules/telegram";

export type BatchStatus = "waiting" | "uploading" | "done" | "failed";

type BatchItem = { key: string; file: Blob; status: BatchStatus };

export type BatchUploadDependencies = {
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  upload: (prepared: PreparedPhoto) => Promise<Photo>;
  // Each photo joins the Album as soon as it is up, so a closed app loses only the rest.
  addToAlbum: (albumId: string, photo: Photo) => Promise<unknown>;
  onFinished: () => void;
  haptics: Pick<Haptics, "success" | "error">;
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

// Telegram's 429 is a pause for as long as it asks, not a failure.
async function patiently<Result>(
  wait: BatchUploadDependencies["wait"],
  step: () => Promise<Result>,
): Promise<Result> {
  for (;;) {
    try {
      return await wrap(step());
    } catch (error) {
      const ms = waitOf(error);

      if (ms === undefined) {
        throw error;
      }

      await wrap(wait(ms));
    }
  }
}

async function uploadOne(
  dependencies: BatchUploadDependencies,
  albumId: string,
  item: BatchItem,
): Promise<"done" | "failed"> {
  try {
    const prepared = await wrap(dependencies.preparePhoto(item.file));
    const photo = await wrap(
      patiently(dependencies.wait, async () => dependencies.upload(prepared)),
    );

    await wrap(patiently(dependencies.wait, async () => dependencies.addToAlbum(albumId, photo)));

    return "done";
  } catch (error) {
    if (isAbort(error)) {
      throw error;
    }

    return "failed";
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

function reatomRun(
  dependencies: BatchUploadDependencies,
  { items, albumId }: { items: Atom<BatchItem[]>; albumId: Atom<string | undefined> },
) {
  const mark = reatomStatuses(items);

  return action(async () => {
    const target = albumId();

    if (target === undefined) {
      return;
    }

    try {
      for (const item of items().filter(({ status }) => status === "waiting")) {
        mark(item.key, "uploading");
        mark(item.key, await wrap(uploadOne(dependencies, target, item)));
      }

      if (countOf(items(), "failed") > 0) {
        dependencies.haptics.error();
      } else {
        dependencies.haptics.success();
      }
    } finally {
      dependencies.onFinished();
    }
  }, "albums.batch.run").extend(withAsync(), withAbort());
}

function reatomBatchTexts(items: Atom<BatchItem[]>, run: { ready: () => boolean }) {
  const progress = computed(
    () => `${countOf(items(), "done")} / ${items().length}`,
    "albums.batch.progress",
  );
  const failedCount = computed(() => countOf(items(), "failed"), "albums.batch.failedCount");

  return {
    isActive: computed(() => items().length > 0, "albums.batch.isActive"),
    isRunning: computed(() => !run.ready(), "albums.batch.isRunning"),
    progress,
    failedCount,
    title: computed(
      () => `${run.ready() ? "Загружено" : "Загружаем"} ${progress()}`,
      "albums.batch.title",
    ),
    failedNote: computed(
      () => (failedCount() > 0 ? `Не загрузилось: ${failedCount()}` : undefined),
      "albums.batch.failedNote",
    ),
  };
}

export function reatomBatchUpload(dependencies: BatchUploadDependencies) {
  const items = atom<BatchItem[]>([], "albums.batch.items");
  const albumId = atom<string | undefined>(undefined, "albums.batch.albumId");
  const run = reatomRun(dependencies, { items, albumId });
  let lastKey = 0;

  return {
    ...reatomBatchTexts(items, run),

    start: action((target: string | undefined, files: Blob[]) => {
      albumId.set(target);
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
      run.abort();
      items.set([]);
    }, "albums.batch.dismiss"),
  };
}

export type BatchUploadModel = ReturnType<typeof reatomBatchUpload>;
