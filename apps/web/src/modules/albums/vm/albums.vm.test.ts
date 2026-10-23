import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { Album, Photo } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createAlbumsApi } from "../albums.api.ts";
import { reatomAlbumsScreen } from "./albums.vm.ts";

function photoOf(id: string): Photo {
  return {
    id,
    takenAt: null,
    urls: { thumb: `/t/${id}`, medium: `/m/${id}`, full: `/f/${id}` },
    canDelete: true,
  };
}

function albumOf(id: string): Album {
  return {
    id,
    kind: "album",
    title: `Альбом ${id}`,
    description: null,
    cover: null,
    coverPhotoId: null,
    photoCount: 0,
    from: null,
    to: null,
    petId: null,
    canEdit: true,
    canDelete: true,
    photos: [],
  };
}

type Answer = "ok" | "429" | "broken";

function startAlbums({
  uploads = [],
  additions: additionAnswers = [],
}: { uploads?: Answer[]; additions?: Answer[] } = {}) {
  const requests: string[] = [];
  const waits: number[] = [];
  const pendingUploads = [...uploads];
  const pendingAdditions = [...additionAnswers];
  let uploadCount = 0;
  let release: () => void = noop;
  let gate: Promise<void> = Promise.resolve();

  function answerOf(answer: Answer, ok: () => unknown): Response {
    if (answer === "429") {
      return Response.json({}, { status: 429, headers: { "retry-after": "7" } });
    }

    return answer === "broken" ? Response.json({}, { status: 502 }) : Response.json(ok());
  }

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}`;

    requests.push(request);

    if (request === "POST /api/photos") {
      await gate;

      return answerOf(pendingUploads.shift() ?? "ok", () => {
        uploadCount += 1;

        return photoOf(`photo-${uploadCount}`);
      });
    }

    if (request.endsWith("/photos")) {
      return answerOf(pendingAdditions.shift() ?? "ok", () => albumOf("album-1"));
    }

    return Response.json(
      url.pathname === "/api/albums" ? [] : albumOf(url.pathname.split("/")[3] ?? ""),
    );
  }

  const model = reatomAlbumsScreen({
    api: createAlbumsApi(createHttpClient({ baseUrl: "https://api.family-hub.test", fetch })),
    telegram: { showPopup: async () => "cancel", showAlert: noop },
    viewer: () => ({ timeZone: "Europe/Moscow", today: "2026-10-16" }),
    preparePhoto: async (file) => ({ file, takenAt: null }),
    wait: async (ms) => {
      waits.push(ms);
    },
    photoHint: noop,
    canSetUpPhotos: () => false,
    onSetUpPhotos: noop,
  });

  model.screen.subscribe(noop);
  model.batch.progress.subscribe(noop);
  model.batch.isRunning.subscribe(noop);

  return {
    model,
    requests,
    waits,
    hold() {
      gate = new Promise((resolve) => {
        release = resolve;
      });
    },
    release() {
      release();
    },
  };
}

type Started = ReturnType<typeof startAlbums>;

function files(count: number): Blob[] {
  return Array.from({ length: count }, (_, index) => new Blob([String(index)]));
}

async function openAlbum({ model }: Started, albumId: string) {
  model.open(albumId);
  await vi.waitFor(() => {
    expect(model.screen()).toMatchObject({ kind: "album", album: { id: albumId } });
  });
}

async function uploaded({ model }: Started) {
  await vi.waitFor(() => {
    expect(model.batch.isRunning()).toBe(false);
  });
}

function additions({ requests }: Started): string[] {
  return requests.filter((request) => request.endsWith("/photos") && request.includes("albums"));
}

beforeEach(() => {
  context.reset();
});

describe("the Albums", () => {
  test("say how many there are, or that there are none yet", async () => {
    const { model } = startAlbums();

    await vi.waitFor(() => {
      expect(model.screen()).toEqual({ kind: "list", albums: [], summary: "Пока нет альбомов" });
    });
  });
});

describe("a batch of photos", () => {
  test("goes up one by one, each joining the Album as soon as it is up", async () => {
    const started = startAlbums();

    await openAlbum(started, "album-1");
    started.model.upload(files(3));

    expect(started.model.batch.progress()).toBe("0 / 3");

    await uploaded(started);

    expect(started.model.batch.progress()).toBe("3 / 3");
    expect(additions(started)).toEqual([
      "POST /api/albums/album-1/photos",
      "POST /api/albums/album-1/photos",
      "POST /api/albums/album-1/photos",
    ]);
  });

  test("joins the Album it was started in, whichever Album is open when a photo is up", async () => {
    const started = startAlbums();

    await openAlbum(started, "album-1");
    started.hold();
    started.model.upload(files(2));
    await openAlbum(started, "album-2");
    started.release();
    await uploaded(started);

    expect(additions(started)).toEqual([
      "POST /api/albums/album-1/photos",
      "POST /api/albums/album-1/photos",
    ]);
  });

  test("reloads the open Album once, when the batch is over", async () => {
    const started = startAlbums();

    await openAlbum(started, "album-1");
    const before = started.requests.length;

    started.model.upload(files(3));
    await uploaded(started);
    await vi.waitFor(() => {
      expect(
        started.requests.slice(before).filter((request) => request === "GET /api/albums/album-1"),
      ).toHaveLength(1);
    });
  });

  test("waits as long as Telegram asks on a 429 and goes on", async () => {
    const started = startAlbums({ uploads: ["ok", "429", "ok"] });

    await openAlbum(started, "album-1");
    started.model.upload(files(2));
    await uploaded(started);

    expect(started.waits).toEqual([7000]);
    expect(started.model.batch.failedCount()).toBe(0);
    expect(additions(started)).toHaveLength(2);
  });

  test("after a 429 on joining the Album repeats only the joining", async () => {
    const started = startAlbums({ additions: ["429", "ok"] });

    await openAlbum(started, "album-1");
    started.model.upload(files(1));
    await uploaded(started);

    expect(started.requests.filter((request) => request === "POST /api/photos")).toHaveLength(1);
    expect(additions(started)).toHaveLength(2);
    expect(started.model.batch.progress()).toBe("1 / 1");
  });

  test("keeps the ones that failed for «Повторить»", async () => {
    const started = startAlbums({ uploads: ["ok", "broken", "ok"] });

    await openAlbum(started, "album-1");
    started.model.upload(files(3));
    await uploaded(started);

    expect(started.model.batch.progress()).toBe("2 / 3");
    expect(started.model.batch.failedCount()).toBe(1);

    started.model.batch.retry();
    await vi.waitFor(() => {
      expect(started.model.batch.progress()).toBe("3 / 3");
    });

    expect(started.model.batch.failedCount()).toBe(0);
    expect(additions(started)).toHaveLength(3);
  });

  test("stops when the Album is left", async () => {
    const started = startAlbums();

    await openAlbum(started, "album-1");
    started.hold();
    started.model.upload(files(3));
    started.model.back();
    started.release();
    await uploaded(started);

    expect(started.model.batch.isActive()).toBe(false);
    expect(additions(started)).toEqual([]);
  });

  test("takes at most 50 photos", async () => {
    const started = startAlbums();

    await openAlbum(started, "album-1");
    started.hold();
    started.model.upload(files(60));

    expect(started.model.batch.progress()).toBe("0 / 50");
  });
});
