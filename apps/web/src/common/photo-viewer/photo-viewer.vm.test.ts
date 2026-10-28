import { context, noop } from "@reatom/core";
import { beforeEach, expect, test, vi } from "vite-plus/test";

import type { Photo } from "@family-hub/contract";

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

function startViewer() {
  const frame = fakeWindow();
  const model = reatomPhotoViewer({
    api: { deletePhoto: async () => ({}) },
    telegram: {
      ...frame,
      showPopup: async () => "confirm",
      showAlert: noop,
      haptics: fakeHaptics(),
    },
    onDeleted: noop,
  });

  return { model, frame };
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
