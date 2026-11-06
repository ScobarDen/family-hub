import { context, reatomForm } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { z } from "zod";

import { fakeHaptics, fakeWindow } from "@/modules/telegram";

import { reatomEditableRecord, reatomFormBack } from "./form.model.ts";

type Note = { id: string; title: string };

const failureMessage = "Не получилось сохранить заметку. Попробуйте ещё раз.";

function startNotes({ failSaving = false } = {}) {
  const requests: string[] = [];
  const saved: Note[] = [];
  let pending: (() => void) | undefined;
  let isHeld = false;

  async function answer(request: string, note: Note): Promise<Note> {
    requests.push(request);

    if (isHeld) {
      await new Promise<void>((resolve) => {
        pending = resolve;
      });
    }

    if (failSaving) {
      throw new Error("Server refused");
    }

    return note;
  }

  const haptics = fakeHaptics();
  const frame = fakeWindow();
  const notes = reatomEditableRecord({
    name: "test.notes",
    form: (onSubmit) =>
      reatomForm(
        { title: "" },
        {
          name: "test.notes.form",
          schema: z.object({ title: z.string().trim().min(1, "Введите название") }),
          onSubmit,
        },
      ),
    failureMessage,
    haptics,
    closingConfirmation: frame,
    valuesOf: (note: Note) => ({ title: note.title }),
    create: async ({ title }) => answer(`create ${title}`, { id: "note-new", title }),
    update: async (note, { title }) => answer(`update ${note.id} ${title}`, { ...note, title }),
    onSaved: (note) => {
      saved.push(note);
    },
  });

  return {
    notes,
    felt: haptics.felt,
    closing: frame.calls,
    frame,
    requests,
    saved,
    hold: () => {
      isHeld = true;
    },
    release: () => {
      pending?.();
    },
  };
}

beforeEach(() => {
  context.reset();
});

describe("an editable record", () => {
  test("is created from the values it starts with", async () => {
    const { notes, requests, saved } = startNotes();

    notes.startCreating({ title: "Корм Бьюику" });
    expect(notes.isCreating()).toBe(true);

    notes.save();

    await vi.waitFor(() => {
      expect(saved).toEqual([{ id: "note-new", title: "Корм Бьюику" }]);
    });
    expect(requests).toEqual(["create Корм Бьюику"]);
  });

  test("pulses success once it is saved", async () => {
    const { notes, felt, saved } = startNotes();

    notes.startCreating({ title: "Корм Бьюику" });
    notes.save();

    await vi.waitFor(() => {
      expect(felt).toEqual(["success"]);
    });
    expect(saved).toHaveLength(1);
  });

  test("pulses error when a field needs fixing or the server refuses it", async () => {
    const refused = startNotes({ failSaving: true });
    const invalid = startNotes();

    refused.notes.startCreating({ title: "Корм" });
    refused.notes.save();
    invalid.notes.startCreating({ title: " " });
    invalid.notes.save();

    await vi.waitFor(() => {
      expect(refused.felt).toEqual(["error"]);
    });
    await vi.waitFor(() => {
      expect(invalid.felt).toEqual(["error"]);
    });
  });

  test("is updated when it was opened for editing", async () => {
    const { notes, requests, saved } = startNotes();

    notes.startEditing({ id: "note-1", title: "Корм" });
    expect(notes.isCreating()).toBe(false);
    expect(notes.edited()).toEqual({ id: "note-1", title: "Корм" });
    expect(notes.form.fields.title()).toBe("Корм");

    notes.form.fields.title.set("Корм Бьюику");
    notes.save();

    await vi.waitFor(() => {
      expect(saved).toEqual([{ id: "note-1", title: "Корм Бьюику" }]);
    });
    expect(requests).toEqual(["update note-1 Корм Бьюику"]);
  });

  test("is saving until the server answers", async () => {
    const { notes, hold, release, requests, saved } = startNotes();

    hold();
    notes.startCreating({ title: "Корм" });
    notes.save();

    await vi.waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    expect(notes.isSaving()).toBe(true);

    release();

    await vi.waitFor(() => {
      expect(notes.isSaving()).toBe(false);
    });
    expect(saved).toHaveLength(1);
  });

  test("is sent once however often it is saved while saving", async () => {
    const { notes, hold, release, requests, saved } = startNotes();

    hold();
    notes.startCreating({ title: "Корм" });
    notes.save();

    await vi.waitFor(() => {
      expect(requests).toHaveLength(1);
    });

    notes.save();
    release();

    await vi.waitFor(() => {
      expect(saved).toHaveLength(1);
    });
    expect(requests).toEqual(["create Корм"]);
  });

  test("says the server refused it, but not that a field needs fixing", async () => {
    const refused = startNotes({ failSaving: true });
    const invalid = startNotes();

    refused.notes.startCreating({ title: "Корм" });
    refused.notes.save();
    invalid.notes.startCreating({ title: " " });
    invalid.notes.save();

    await vi.waitFor(() => {
      expect(refused.notes.failure()).toBe(failureMessage);
    });
    expect(refused.saved).toEqual([]);
    expect(invalid.notes.failure()).toBeUndefined();
    expect(invalid.requests).toEqual([]);
  });
});

describe("closing confirmation", () => {
  const on = "enableClosingConfirmation";
  const off = "disableClosingConfirmation";

  test("is on while the form has unsaved changes and off once it is saved", async () => {
    const { notes, closing } = startNotes();

    notes.startCreating({ title: "" });
    notes.confirmClosingWhileDirty();
    notes.form.fields.title.change("Корм Бьюику");
    await vi.waitFor(() => {
      expect(closing).toEqual([off, on]);
    });
    notes.save();

    await vi.waitFor(() => {
      expect(closing).toEqual([off, on, off]);
    });
  });

  test("goes off when the form starts over", async () => {
    const { notes, closing } = startNotes();

    notes.startCreating({ title: "" });
    notes.confirmClosingWhileDirty();
    notes.form.fields.title.change("Корм Бьюику");
    await vi.waitFor(() => {
      expect(closing).toEqual([off, on]);
    });
    notes.startEditing({ id: "note-1", title: "Корм" });

    await vi.waitFor(() => {
      expect(closing).toEqual([off, on, off]);
    });
  });

  test("goes off when the form leaves the screen with changes", async () => {
    const { notes, closing } = startNotes();

    notes.startCreating({ title: "" });
    const leave = notes.confirmClosingWhileDirty();

    notes.form.fields.title.change("Корм Бьюику");
    await vi.waitFor(() => {
      expect(closing).toEqual([off, on]);
    });
    leave();

    expect(closing).toEqual([off, on, off]);
  });
});

function startClosing(answers: Array<string | undefined>) {
  const notes = startNotes();
  const asked: string[] = [];
  let isFormOpen = true;
  const back = reatomFormBack({
    name: "test.notes.back",
    telegram: {
      ...notes.frame,
      haptics: fakeHaptics(),
      showPopup: async ({ title }) => {
        asked.push(title ?? "");

        return answers.shift();
      },
    },
    isFormOpen: () => isFormOpen,
    back: () => {
      isFormOpen = false;
    },
  });

  notes.notes.startCreating({ title: "" });
  notes.notes.confirmClosingWhileDirty();

  return { ...notes, asked, back, isFormOpen: () => isFormOpen };
}

describe("closing the form", () => {
  test("closes a form with nothing typed at once", () => {
    const { back, asked, isFormOpen } = startClosing([]);

    back();

    expect(isFormOpen()).toBe(false);
    expect(asked).toEqual([]);
  });

  test("asks before dropping unsaved input and stays open when the Member keeps it", async () => {
    const { notes, frame, back, asked, isFormOpen } = startClosing([undefined]);

    notes.form.fields.title.change("Корм Бьюику");
    await vi.waitFor(() => {
      expect(frame.isClosingConfirmationEnabled()).toBe(true);
    });
    back();

    await vi.waitFor(() => {
      expect(asked).toEqual(["Отменить изменения?"]);
    });
    expect(isFormOpen()).toBe(true);
  });

  test("closes once the Member agrees to drop unsaved input", async () => {
    const { notes, frame, back, isFormOpen } = startClosing(["confirm"]);

    notes.form.fields.title.change("Корм Бьюику");
    await vi.waitFor(() => {
      expect(frame.isClosingConfirmationEnabled()).toBe(true);
    });
    back();

    await vi.waitFor(() => {
      expect(isFormOpen()).toBe(false);
    });
  });
});
