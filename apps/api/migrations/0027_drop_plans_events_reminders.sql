DROP TABLE `events`;--> statement-breakpoint
DROP TABLE `plans`;--> statement-breakpoint
DROP TABLE `reminder_recipients`;--> statement-breakpoint
DROP TABLE `reminders`;--> statement-breakpoint
ALTER TABLE `care_entries` DROP COLUMN `due_date`;--> statement-breakpoint
ALTER TABLE `care_entries` DROP COLUMN `due_key`;--> statement-breakpoint
-- The Worker before Tasks kept writing its own kinds of rows until the deploy finished; nothing reads them now.
DELETE FROM `reminder_dispatch` WHERE `source` NOT IN ('task', 'pet_birthday', 'digest');
