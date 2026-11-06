import { context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { cleaning, fakeBackend, loaded, startTasks } from "./tasks.fixtures.ts";

beforeEach(() => {
  context.reset();
});

describe("the Task form", () => {
  test("shows only the title and the date on «+»", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.add();

    expect([model.screen().kind, model.openForm(), model.formTitles().task]).toEqual([
      "list",
      "task",
      "Новое дело",
    ]);
    expect(model.taskForm.isExpanded()).toBe(false);
    expect(model.taskForm.form.fields.date()).toBe("");

    model.taskForm.expand();

    expect(model.taskForm.isExpanded()).toBe(true);
  });

  test("opens expanded with the Pet chosen when added from a Pet", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.addForPet("pet-1");

    expect(model.taskForm.isExpanded()).toBe(true);
    expect(model.taskForm.form.fields.petId()).toBe("pet-1");
  });

  test("opens expanded with the Task's values on edit", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.open("task-food");
    model.edit();

    expect(model.taskForm.isExpanded()).toBe(true);
    expect(model.taskForm.form.fields.time()).toBe("19:00");
  });

  test("saves an edit, and a recurring Task left without a repeat turns single", async () => {
    const { model, backend } = startTasks(fakeBackend([cleaning]));

    await loaded(model);
    model.open("task-cleaning");
    model.edit();
    model.taskForm.form.fields.title.set("Генеральная уборка");
    model.taskForm.form.fields.frequency.set("");
    model.taskForm.save();
    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({
        kind: "task",
        task: { title: "Генеральная уборка", isRecurring: false },
      });
    });

    expect(backend.sent).toContainEqual({
      request: "PUT /api/tasks/task-cleaning",
      body: expect.objectContaining({ title: "Генеральная уборка", recurrence: null }),
    });
  });

  test("offers only day-sized Reminders without a time", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.add();
    model.taskForm.form.fields.date.set("2026-10-20");

    expect(model.taskForm.offsets().map(({ offset }) => offset)).toEqual(["at-start", "1d", "1w"]);

    model.taskForm.form.fields.time.set("10:00");

    expect(model.taskForm.offsets()).toHaveLength(5);
  });

  test("asks whom to remind only once a Reminder is chosen", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.add();
    model.taskForm.form.fields.date.set("2026-10-20");
    model.taskForm.form.fields.recipients.set("members");

    expect(model.taskForm.hasReminders()).toBe(false);
    expect(model.taskForm.isPickingRecipients()).toBe(false);

    model.taskForm.toggleOffset("1d");

    expect(model.taskForm.hasReminders()).toBe(true);
    expect(model.taskForm.isPickingRecipients()).toBe(true);
  });

  test("drops the Reminders of a Task left without a date", async () => {
    const { model, backend } = startTasks();

    await loaded(model);
    model.add();
    model.taskForm.form.fields.title.set("Позвонить маме");
    model.taskForm.form.fields.date.set("2026-10-20");
    model.taskForm.toggleOffset("1d");
    model.taskForm.form.fields.date.set("");
    model.taskForm.save();
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("task");
    });

    expect(backend.sent).toContainEqual({
      request: "POST /api/tasks",
      body: expect.objectContaining({
        title: "Позвонить маме",
        when: null,
        reminderOffsets: [],
      }),
    });
  });
});

describe("a Private Task", () => {
  test("keeps only its owner among the people and is saved Private", async () => {
    const { model, backend } = startTasks();

    await loaded(model);
    model.add();
    model.taskForm.form.fields.title.set("Подарок Асе");
    model.taskForm.toggleAssignee("member-2");
    model.taskForm.chooseVisibility("private");

    expect(model.taskForm.assignees().map(({ id }) => id)).toEqual(["member-1"]);

    model.taskForm.save();
    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({
        kind: "task",
        task: { isPrivate: true, facts: "Личное" },
      });
    });

    expect(backend.sent).toContainEqual({
      request: "POST /api/tasks",
      body: expect.objectContaining({ visibility: "private", assigneeIds: [] }),
    });
  });
});
