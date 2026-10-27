import type { AppModule } from "@family-hub/contract";

// «Готово» completes a Task Occurrence; a Command Draft's buttons create Tasks and Care Entries.
export const reminderCallbackModules: AppModule[] = ["tasks"];

export const commandCallbackModules: AppModule[] = ["tasks", "pet"];

// The first segment after `/api/` names what a write changed; the Feed and Today read every module.
// Pets carry their Tasks and birthdays, and a Care Entry may create a follow-up Task.
export const modulesByPath = new Map<string, AppModule[]>([
  ["tasks", ["tasks", "pet"]],
  ["pets", ["pet", "tasks"]],
  ["care-entries", ["pet", "tasks"]],
  ["goals", ["goals"]],
  ["albums", ["albums"]],
  ["photos", ["albums"]],
  ["recipes", ["recipes"]],
  ["recipe-tags", ["recipes"]],
  ["commands", commandCallbackModules],
  ["family", ["feed"]],
]);
