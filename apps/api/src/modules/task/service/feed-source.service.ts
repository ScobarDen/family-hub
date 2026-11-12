import { overdueLookbackDays, type FeedActivity, type FeedUpcoming } from "@family-hub/contract";
import { daysAfter, occurrenceMoment, timeInZone } from "@family-hub/recurrence";

import type { KeysetPage } from "@/common/keyset.lib.ts";
import type { Membership } from "@/modules/auth";
import type { ActivitySource, FeedWindow, UpcomingSource } from "@/modules/feed";
import type { PhotoLinks } from "@/modules/photo";

import { taskSeries } from "../lib/series.lib.ts";
import { isOverdue, recurrenceOf, titleOf } from "../lib/task.lib.ts";
import type { TaskRecord, TaskRepo, TaskTree } from "../task.repo.ts";

type TaskFeedDependencies = { tasks: TaskRepo; links: PhotoLinks };

const farPast = "1970-01-01";

type Line = Pick<
  FeedUpcoming & { kind: "task" },
  "taskId" | "subtaskId" | "petId" | "petPicture"
> & {
  petName: string | undefined;
};

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
  const { petName, ...link } = line;

  return {
    kind: "task",
    key: `task-${record.row.id}-${occurrence}`,
    title: petName === undefined ? title : `${title} — ${petName}`,
    date,
    time,
    occurrence,
    assignees: record.assignees.map(({ id, name, profilePicture }) => ({
      id,
      name,
      profilePicture,
    })),
    ...link,
  };
}

// What is ahead by the window's last day and what is Overdue behind it, by the one Overdue rule;
// a recurring Task looks back a limited number of days only.
function rootItems(tree: TaskTree, { window, line }: { window: FeedWindow; line: Line }) {
  const { root } = tree;
  const { row } = root;
  const { today, last, timeZone } = window;
  const { time, timeZone: zone } = row;
  const days = {
    from: recurrenceOf(row) === null ? farPast : daysAfter(today, -overdueLookbackDays),
    to: last,
    timeZone,
  };

  return taskSeries(root)
    .openOn(days, (occurrence) =>
      time === null || zone === null
        ? undefined
        : occurrenceMoment(occurrence, { time, timeZone: zone }),
    )
    .filter(({ date }) => date >= today || isOverdue(root, { date, today }))
    .map(({ occurrence, date, moment }) =>
      itemOf(root, {
        line,
        title: row.title,
        occurrence,
        date,
        time: moment === undefined ? null : timeInZone(moment, timeZone),
      }),
    );
}

function subtaskItems(tree: TaskTree, { window, line }: { window: FeedWindow; line: Line }) {
  return tree.subtasks.flatMap((subtask) => {
    const { date } = subtask.row;

    if (date === null || date > window.last || subtask.completions.length > 0) {
      return [];
    }

    return date >= window.today || isOverdue(subtask, { date, today: window.today })
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

// A Task's lines are open Occurrences of it and its dated Subtasks; an Archived Pet's Tasks are
// looked after by no one, so they are left out like its Reminders.
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

      if (pet !== undefined && pet.archivedAt !== null) {
        return [];
      }

      const line: Line = {
        taskId: tree.root.row.id,
        subtaskId: null,
        petId,
        petPicture: pet === undefined ? null : await links.thumbOf(pet.avatarPhotoId),
        petName: pet?.name,
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
