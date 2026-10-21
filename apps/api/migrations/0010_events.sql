CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`owner_member_id` text,
	`visibility` text NOT NULL,
	`title` text NOT NULL,
	`note` text,
	`start_date` text NOT NULL,
	`start_time` text,
	`time_zone` text,
	`end_date` text,
	`end_time` text,
	`frequency` text,
	`until` text,
	`skipped_dates` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_family_id_idx` ON `events` (`family_id`);