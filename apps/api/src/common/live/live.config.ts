import type { AppModule } from "@family-hub/contract";

// The Calendar also lists Plans with a due date and Pets' Due Dates and birthdays.
// «Готово» closes a Plan or an Occurrence; a Command Draft's buttons create Events, Reminders and Care Entries.
export const reminderCallbackModules: AppModule[] = ["plans", "calendar"];

export const commandCallbackModules: AppModule[] = ["calendar", "pet"];

// The first segment after `/api/` names what a write changed; the Feed and Today read every module.
export const modulesByPath = new Map<string, AppModule[]>([
  ["plans", ["plans", "calendar"]],
  ["events", ["calendar"]],
  ["reminders", ["calendar"]],
  ["pets", ["pet", "calendar"]],
  ["care-entries", ["pet", "calendar"]],
  ["goals", ["goals"]],
  ["albums", ["albums"]],
  ["photos", ["albums"]],
  ["recipes", ["recipes"]],
  ["recipe-tags", ["recipes"]],
  ["commands", commandCallbackModules],
  ["family", ["feed"]],
]);
