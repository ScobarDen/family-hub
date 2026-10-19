ALTER TABLE `members` ADD `tab_bar` text;--> statement-breakpoint
ALTER TABLE `members` ADD `time_zone` text;--> statement-breakpoint
ALTER TABLE `members` ADD `is_time_zone_auto` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `can_message` integer DEFAULT true NOT NULL;