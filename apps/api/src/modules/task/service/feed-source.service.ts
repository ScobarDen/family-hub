import { overdueLookbackDays, type FeedActivity, type FeedUpcoming } from "@family-hub/contract";
import { daysAfter, occurrenceMoment, occurrencesOnDays, timeInZone } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";
import type { KeysetPage } from "@/common/keyset";
import type { PhotoLinks } from "@/common/photo-link";
import type { ActivitySource, FeedWindow, UpcomingSource } from "@/modules/feed";

import { isCompleted, isOverdue, recurrenceOf, titleOf } from "../task.lib.ts";
import type { TaskRecord, TaskRepo, TaskTree } from "../task.repo.ts";

type TaskFeedDependencies = { tasks: TaskRepo; links: PhotoLinks };

const farPast = "1970-01-01";

type Line = Pick<FeedUpcoming & { kind: "task" }, "taskId" | "subtaskId" | "petId" | "petPicture">;

function itemOf(
  record: TaskRecord,
  {
    line,
    title,
    occurrence,
    date,
    time,
  }: { line: Line; title: string; occurrence: string; date: string; time: string | null },
): FeedUpcoming {
  return {
    kind: "task",
    key: `task-${record.row.id}-${occurrence}`,
    title,
    date,
    time,
    occurrence,
    assignees: record.assignees.map(({ id, name, profilePicture }) => ({
      id,
      name,
      profilePicture,
    })),
    ...line,
  };
}

// What is ahead by the window's last day and what is Overdue behind it, by the one Overdue rule;
// a recurring Task looks back a limited number of days only.
function rootItems(tree: TaskTree, { window, line }: { window: FeedWindow; line: Line }) {
  const { root } = tree;
  const { row } = root;
  const { today, last, timeZone } = window;
  const { date, time, timeZone: zone } = row;

  if (date === null) {
    return [];
  }

  const recurrence = recurrenceOf(row);

  return occurrencesOnDays(
    { startDate: date, recurrence, skipped: row.skippedDates },
    {
      days: {
        from: recurrence === null ? farPast : daysAfter(today, -overdueLookbackDays),
        to: last,
        timeZone,
      },
      momentOf: (occurrence) =>
        time === null || zone === null
          ? undefined
          : occurrenceMoment(occurrence, { time, timeZone: zone }),
    },
  ).flatMap(({ occurrence, date: day, moment }) => {
    const isAhead = day >= today && !isCompleted(root, occurrence);
    const isLate = isOverdue(root, { occurrence, date: day, today });

    return isAhead || isLate
      ? [
          itemOf(root, {
            line,
            title: row.title,
            occurrence,
            date: day,
            time: moment === undefined ? null : timeInZone(moment, timeZone),
          }),
        ]
      : [];
  });
}

function subtaskItems(tree: TaskTree, { window, line }: { window: FeedWindow; line: Line }) {
  return tree.subtasks.flatMap((subtask) => {
    const { date } = subtask.row;

    if (date === null || date > window.last || isCompleted(subtask, date)) {
      return [];
    }

    return date >= window.today ||
      isOverdue(subtask, { occurrence: date, date, today: window.today })
      ? [
          itemOf(subtask, {
            line: { ...line, subtaskId: subtask.row.id },
            title: titleOf(subtask.row, tree.root.row),
            occurrence: date,
            date,
            time: null,
          }),
        ]
      : [];
  });
}

// A Task's lines are open Occurrences of it and its dated Subtasks.
export async function taskItemsWithin(
  { tasks, links }: TaskFeedDependencies,
  { family, member }: Membership,
  window: FeedWindow,
): Promise<FeedUpcoming[]> {
  const trees = await tasks.listVisible(family.id, member.id);
  const lines = await Promise.all(
    trees.map(async (tree) => {
      const { petId } = tree.root.row;
      const pet = petId === null ? undefined : await tasks.petOf(family.id, petId);
      const line: Line = {
        taskId: tree.root.row.id,
        subtaskId: null,
        petId,
        petPicture: pet === undefined ? null : await links.thumbOf(pet.avatarPhotoId),
      };

      return [...rootItems(tree, { window, line }), ...subtaskItems(tree, { window, line })];
    }),
  );

  return lines.flat();
}

async function activityBefore(
  { tasks }: TaskFeedDependencies,
  { family, member }: Membership,
  page: KeysetPage,
): Promise<FeedActivity[]> {
  const rows = await tasks.activityBefore({ familyId: family.id, memberId: member.id }, page);

  return rows.map((row) => ({
    kind: "task",
    key: row.key,
    at: row.completedAt,
    memberName: row.memberName ?? "",
    memberPicture: row.memberPicture,
    title: titleOf(row, row.rootTitle === null ? null : { title: row.rootTitle }),
    taskId: row.rootId ?? row.taskId,
  }));
}

export function createTaskFeed(
  dependencies: TaskFeedDependencies,
): ActivitySource & UpcomingSource {
  return {
    before: async (viewer, page) => activityBefore(dependencies, viewer, page),
    within: async (viewer, window) => taskItemsWithin(dependencies, viewer, window),
  };
}
