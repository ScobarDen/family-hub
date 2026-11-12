import { describe, expect, test } from "vite-plus/test";

import { occurrenceMoment } from "@family-hub/recurrence";

import type { TaskRecord, TaskRow } from "../task.repo.ts";
import { taskSeries } from "./series.lib.ts";

const denis = "member-denis";
const asya = "member-asya";

function recordOf(
  row: Partial<TaskRow>,
  people: Partial<Omit<TaskRecord, "row">> = {},
): TaskRecord {
  return {
    row: {
      id: "task",
      familyId: "family",
      parentId: null,
      ownerMemberId: denis,
      visibility: "shared",
      title: "Таблетка Бьюику",
      note: null,
      date: "2026-10-01",
      time: null,
      timeZone: null,
      endDate: null,
      endTime: null,
      frequency: null,
      until: null,
      skippedDates: [],
      reminderOffsets: [],
      recipientsMode: "default",
      petId: null,
      albumId: null,
      createdAt: 0,
      createdBy: denis,
      updatedAt: 0,
      ...row,
    },
    assignees: [],
    recipients: [],
    completions: [],
    ...people,
  };
}

const weekly = { frequency: "weekly", until: null } as const;

function atNineInMoscow(occurrence: string): number {
  return occurrenceMoment(occurrence, { time: "09:00", timeZone: "Europe/Moscow" });
}

describe("an Occurrence of a recurring Task", () => {
  test("is not one once skipped", () => {
    const series = taskSeries(recordOf({ ...weekly, skippedDates: ["2026-10-08"] }));

    expect(series.isOccurrence("2026-10-08")).toBe(false);
    expect(series.isOccurrence("2026-10-15")).toBe(true);
  });
});

describe("a Task without a Recurrence", () => {
  test("has its date as the one open Occurrence", () => {
    const series = taskSeries(recordOf({ date: "2026-10-10" }));

    expect(series.first("2026-10-01")).toBe("2026-10-10");
    expect(series.next("2026-10-10")).toBeUndefined();
  });

  test("has nothing open once Completed, whichever date names it", () => {
    const series = taskSeries(
      recordOf(
        { date: "2026-10-10" },
        { completions: [{ occurrence: "", at: 0, by: "Ася", byId: asya }] },
      ),
    );

    expect(series.first("2026-10-01")).toBeUndefined();
    expect(series.isCompleted(null)).toBe(true);
    expect(series.isCompleted("2026-10-10")).toBe(true);
  });
});

describe("the open Occurrences of a recurring Task", () => {
  const series = taskSeries(
    recordOf(
      { frequency: "weekly", until: "2026-10-29", skippedDates: ["2026-10-08"] },
      { completions: [{ occurrence: "2026-10-15", at: 0, by: "Ася", byId: asya }] },
    ),
  );

  test("pass over skipped and Completed ones", () => {
    expect(series.first("2026-10-02")).toBe("2026-10-22");
  });

  test("end with the Recurrence", () => {
    expect(series.next("2026-10-22")).toBe("2026-10-29");
    expect(series.next("2026-10-29")).toBeUndefined();
  });

  test("fall on the viewer's days", () => {
    const days = { from: "2026-10-01", to: "2026-10-31", timeZone: "Europe/Moscow" };

    expect(series.openOn(days, atNineInMoscow).map(({ date }) => date)).toEqual([
      "2026-10-01",
      "2026-10-22",
      "2026-10-29",
    ]);
  });

  test("leave out a Completed one", () => {
    expect(series.isCompleted("2026-10-15")).toBe(true);
    expect(series.isOpen("2026-10-15")).toBe(false);
    expect(series.isOpen("2026-10-22")).toBe(true);
  });
});

describe("the Recipients of a Task", () => {
  const family = [denis, asya];
  const person = { name: "Ася", profilePicture: null };

  test("are its Assignees", () => {
    const series = taskSeries(recordOf({}, { assignees: [{ id: asya, ...person }] }));

    expect(series.recipients(family)).toEqual([asya]);
  });

  test("are its owner when it has no Assignees", () => {
    expect(taskSeries(recordOf({})).recipients(family)).toEqual([denis]);
  });

  test("are the whole Family when it reminds everyone", () => {
    const series = taskSeries(recordOf({ recipientsMode: "everyone" }));

    expect(series.recipients(family)).toEqual(family);
  });

  test("of a Private Task are only its owner, even when it reminds everyone", () => {
    const series = taskSeries(recordOf({ recipientsMode: "everyone", visibility: "private" }));

    expect(series.recipients(family)).toEqual([denis]);
  });
});
