import { context, noop, reatomForm } from "@reatom/core";
import { beforeEach, describe, expect, expectTypeOf, test, vi } from "vite-plus/test";
import { z } from "zod";

import { fakeHaptics, fakeWindow } from "@/common/telegram";

import { reatomEditableRecord } from "./form.model.ts";

const phrase = { saidAt: Date.parse("2026-10-11T06:00:00Z"), timeZone: "Europe/Moscow" };

type Note = { id: string; title: string };

const failureMessage = "Не получилось сохранить заметку. Попробуйте ещё раз.";

function startNotes({ failSaving = false } = {}) {
  const requests: string[] = [];
  const saved: Note[] = [];
  const settledDrafts: string[] = [];
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
    valuesOfDraft: (draft: { title: string | null }) => ({ title: draft.title ?? "" }),
    create: async ({ title }, { phrase: said }) =>
      answer(said === undefined ? `create ${title}` : `create ${title} said in ${said.timeZone}`, {
        id: "note-new",
        title,
      }),
    update: async (note, { title }) => answer(`update ${note.id} ${title}`, { ...note, title }),
    onSaved: (note) => {
      saved.push(note);
    },
    onDraftSaved: (draftId) => {
      settledDrafts.push(draftId);
    },
  });

  return {
    notes,
    felt: haptics.felt,
    closing: frame.calls,
    requests,
    saved,
    settledDrafts,
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

describe("a record without drafts", () => {
  test("is created and updated, and offers no start from a draft", async () => {
    const requests: string[] = [];
    const notes = reatomEditableRecord({
      name: "test.plainNotes",
      form: (onSubmit) => reatomForm({ title: "" }, { name: "test.plainNotes.form", onSubmit }),
      failureMessage,
      haptics: fakeHaptics(),
      closingConfirmation: fakeWindow(),
      valuesOf: (note: Note) => ({ title: note.title }),
      create: async ({ title }) => {
        requests.push(`create ${title}`);

        return { id: "note-new", title };
      },
      update: async (note, { title }) => {
        requests.push(`update ${note.id} ${title}`);

        return { ...note, title };
      },
      onSaved: noop,
    });

    notes.startCreating({ title: "Корм" });
    notes.save();
    await vi.waitFor(() => {
      expect(requests).toEqual(["create Корм"]);
    });

    notes.startEditing({ id: "note-1", title: "Корм" });
    notes.save();
    await vi.waitFor(() => {
      expect(requests).toEqual(["create Корм", "update note-1 Корм"]);
    });
    expect("startFromDraft" in notes).toBe(false);
    expectTypeOf(notes).not.toHaveProperty("startFromDraft");
  });
});

describe("a record started from a draft", () => {
  test("is created with the phrase the draft was said in", async () => {
    const { notes, requests } = startNotes();

    notes.startFromDraft({
      draftId: "draft-1",
      phrase: { ...phrase, timeZone: "Asia/Vladivostok" },
      draft: { title: "Груминг" },
    });
    notes.save();

    await vi.waitFor(() => {
      expect(requests).toEqual(["create Груминг said in Asia/Vladivostok"]);
    });
  });

  test("is created with the draft's values and settles the draft once", async () => {
    const { notes, requests, settledDrafts } = startNotes();

    notes.startFromDraft({ draftId: "draft-1", phrase, draft: { title: "Груминг" } });
    expect(notes.isCreating()).toBe(true);
    expect(notes.form.fields.title()).toBe("Груминг");

    notes.save();
    await vi.waitFor(() => {
      expect(settledDrafts).toEqual(["draft-1"]);
    });

    notes.save();
    await vi.waitFor(() => {
      expect(requests).toHaveLength(2);
    });
    expect(settledDrafts).toEqual(["draft-1"]);
  });

  test("keeps the draft open while the server refuses it", async () => {
    const { notes, settledDrafts } = startNotes({ failSaving: true });

    notes.startFromDraft({ draftId: "draft-1", phrase, draft: { title: "Груминг" } });
    notes.save();

    await vi.waitFor(() => {
      expect(notes.failure()).toBe(failureMessage);
    });
    expect(settledDrafts).toEqual([]);
  });

  test("is forgotten once another record is started", async () => {
    const { notes, saved, settledDrafts } = startNotes();

    notes.startFromDraft({ draftId: "draft-1", phrase, draft: { title: null } });
    notes.startEditing({ id: "note-1", title: "Корм" });
    notes.save();

    await vi.waitFor(() => {
      expect(saved).toHaveLength(1);
    });
    expect(settledDrafts).toEqual([]);
  });
});
