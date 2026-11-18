import { overdueLookbackDays, tileWindowDays } from "@family-hub/contract";
import { daysAfter } from "@family-hub/recurrence";

import type { PhotoLinks } from "@/modules/photo";
import type { TileSource, TileWindow } from "@/modules/today";

import { taskSeries } from "../lib/series.lib.ts";
import { isOverdue } from "../lib/task.lib.ts";
import type { TaskTree, TaskRepo } from "../task.repo.ts";
import { taskItemsWithin } from "./feed-source.service.ts";

const listedAheadDays = 366;

// A series counts while the list shows one of its Occurrences: one still ahead within a year, or
// one Overdue within the lookback. An ended series and passed Occurrences without Assignees do not.
function isSeriesListed({ root }: TaskTree, { today, timeZone }: TileWindow): boolean {
  return taskSeries(root)
    .openOn(
      {
        from: daysAfter(today, -overdueLookbackDays),
        to: daysAfter(today, listedAheadDays),
        timeZone,
      },
      (): undefined => undefined,
    )
    .some(({ date }) => date >= today || isOverdue(root, { date, today }));
}

// Open counts the Tasks the list shows: a single one until it is Completed, a series by its
// Occurrences.
function isListed(tree: TaskTree, window: TileWindow): boolean {
  const { row, completions } = tree.root;

  if (row.frequency === null || row.date === null) {
    return completions.length === 0;
  }

  return isSeriesListed(tree, window);
}

export function createTaskTile(dependencies: {
  tasks: TaskRepo;
  links: PhotoLinks;
}): TileSource<"tasks"> {
  return {
    tile: async (viewer, window) => {
      const { today, timeZone } = window;
      const [trees, items] = await Promise.all([
        dependencies.tasks.listVisible(viewer.family.id, viewer.member.id),
        taskItemsWithin(dependencies, viewer, {
          today,
          last: daysAfter(today, tileWindowDays - 1),
          timeZone,
        }),
      ]);

      return {
        open: trees.filter((tree) => isListed(tree, window)).length,
        overdue: new Set(items.filter(({ date }) => date < today).map(({ key }) => key)).size,
        week: items.filter(({ date }) => date >= today).length,
      };
    },
  };
}
