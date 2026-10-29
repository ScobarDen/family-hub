import { tileWindowDays } from "@family-hub/contract";
import { daysAfter } from "@family-hub/recurrence";

import type { PhotoLinks } from "@/modules/photo";
import type { TileSource } from "@/modules/today";

import type { TaskRepo } from "../task.repo.ts";
import { taskItemsWithin } from "./feed-source.service.ts";

// Open counts every Task not Completed; a recurring one is never Completed as a whole.
export function createTaskTile(dependencies: {
  tasks: TaskRepo;
  links: PhotoLinks;
}): TileSource<"tasks"> {
  return {
    tile: async (viewer, { today, timeZone }) => {
      const [trees, items] = await Promise.all([
        dependencies.tasks.listVisible(viewer.family.id, viewer.member.id),
        taskItemsWithin(dependencies, viewer, {
          today,
          last: daysAfter(today, tileWindowDays - 1),
          timeZone,
        }),
      ]);
      const open = trees.filter(
        ({ root }) => root.row.frequency !== null || root.completions.length === 0,
      );

      return {
        open: open.length,
        overdue: new Set(items.filter(({ date }) => date < today).map(({ key }) => key)).size,
        week: items.filter(({ date }) => date >= today).length,
      };
    },
  };
}
