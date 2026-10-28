import { context, noop } from "@reatom/core";
import { beforeEach, expect, test, vi } from "vite-plus/test";

import type { Photo } from "@family-hub/contract";

import { HttpError } from "@/common/http-client";
import { reatomRollbackFailure } from "@/common/state";
import { fakeHaptics, fakeWindow } from "@/common/telegram";

import { reatomPhotoViewer } from "./photo-viewer.vm.ts";

function photoOf(id: string): Photo {
  return {
    id,
    takenAt: null,
    urls: { thumb: `/t/${id}`, medium: `/m/${id}`, full: `/f/${id}` },
    canDelete: true,
  };
}

const photos = [photoOf("photo-1"), photoOf("photo-2")];

function startViewer({
  deletePhoto = async () => ({}),
}: { deletePhoto?: () => Promise<unknown> } = {}) {
  const frame = fakeWindow();
  const haptics = fakeHaptics();
  const failure = reatomRollbackFailure("test.failure", haptics);
  const model = reatomPhotoViewer({
    api: { deletePhoto },
    telegram: {
      ...frame,
      showPopup: async () => "confirm",
      showAlert: noop,
      haptics,
    },
    onDeleted: noop,
    failure,
  });

  return { model, frame, failure: failure.failure, felt: haptics.felt };
}

function positionOf(model: ReturnType<typeof startViewer>["model"]) {
  return model.current()?.position;
}

beforeEach(() => {
  context.reset();
});

test("goes full screen while open and back once closed", async () => {
  const { model, frame } = startViewer();

  model.open(photos, "photo-1");
  model.next();
  await vi.waitFor(() => {
    expect(frame.calls).toEqual(["requestFullscreen"]);
  });
  model.close();

  await vi.waitFor(() => {
    expect(frame.calls).toEqual(["requestFullscreen", "exitFullscreen"]);
  });
});

test("leaves full screen when the last photo is deleted", async () => {
  const { model, frame } = startViewer();

  model.open([photoOf("photo-1")], "photo-1");
  model.remove();

  await vi.waitFor(() => {
    expect(model.current()).toBeUndefined();
    expect(frame.calls).toEqual(["requestFullscreen", "exitFullscreen"]);
  });
});

test("drops a deleted photo before the server answers", async () => {
  const { model, failure, felt } = startViewer({ deletePhoto: async () => new Promise(noop) });

  model.open(photos, "photo-1");
  model.remove();

  await vi.waitFor(() => {
    expect(model.current()?.photo?.id).toBe("photo-2");
  });
  expect(positionOf(model)).toBe("1 / 1");
  expect(failure()).toBeUndefined();
  expect(felt).toEqual(["warning"]);
});

test.each([
  {
    trouble: "refused",
    error: new HttpError(500),
    said: "Не получилось удалить фото. Попробуйте ещё раз.",
  },
  {
    trouble: "unreachable",
    error: new TypeError("Failed to fetch"),
    said: "Нет связи, не сохранилось",
  },
])(
  "puts a photo back with the failure bar and an error pulse when $trouble",
  async ({ error, said }) => {
    const { model, failure, felt } = startViewer({
      deletePhoto: async () => {
        throw error;
      },
    });

    model.open(photos, "photo-1");
    model.remove();

    await vi.waitFor(() => {
      expect(failure()).toBe(said);
    });
    expect(model.current()?.photo?.id).toBe("photo-1");
    expect(positionOf(model)).toBe("1 / 2");
    expect(felt).toEqual(["warning", "error"]);
  },
);

test("shows the module's failure over the open viewer until it is dismissed", async () => {
  const { model, failure } = startViewer({
    deletePhoto: async () => {
      throw new HttpError(500);
    },
  });

  model.open(photos, "photo-1");
  model.remove();

  await vi.waitFor(() => {
    expect(model.failure()).toBe("Не получилось удалить фото. Попробуйте ещё раз.");
  });
  model.dismissFailure();
  expect(model.failure()).toBeUndefined();
  expect(failure()).toBeUndefined();
});
