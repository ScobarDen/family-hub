import { context, reatomForm } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { z } from "zod";

import { reatomEditableRecord } from "./form.model.ts";

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
    valuesOf: (note: Note) => ({ title: note.title }),
    valuesOfDraft: (draft: { title: string | null }) => ({ title: draft.title ?? "" }),
    create: async ({ title }) => answer(`create ${title}`, { id: "note-new", title }),
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

describe("a record started from a draft", () => {
  test("is created with the draft's values and settles the draft once", async () => {
    const { notes, requests, settledDrafts } = startNotes();

    notes.startFromDraft({ draftId: "draft-1", draft: { title: "Груминг" } });
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

    notes.startFromDraft({ draftId: "draft-1", draft: { title: "Груминг" } });
    notes.save();

    await vi.waitFor(() => {
      expect(notes.failure()).toBe(failureMessage);
    });
    expect(settledDrafts).toEqual([]);
  });

  test("is forgotten once another record is started", async () => {
    const { notes, saved, settledDrafts } = startNotes();

    notes.startFromDraft({ draftId: "draft-1", draft: { title: null } });
    notes.startEditing({ id: "note-1", title: "Корм" });
    notes.save();

    await vi.waitFor(() => {
      expect(saved).toHaveLength(1);
    });
    expect(settledDrafts).toEqual([]);
  });
});
