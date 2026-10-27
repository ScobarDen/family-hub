DROP TABLE `events`;--> statement-breakpoint
DROP TABLE `plans`;--> statement-breakpoint
DROP TABLE `reminder_recipients`;--> statement-breakpoint
DROP TABLE `reminders`;--> statement-breakpoint
ALTER TABLE `care_entries` DROP COLUMN `due_date`;--> statement-breakpoint
ALTER TABLE `care_entries` DROP COLUMN `due_key`;