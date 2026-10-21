CREATE TABLE `care_entry_photos` (
	`care_entry_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`family_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`care_entry_id`, `photo_id`),
	FOREIGN KEY (`care_entry_id`) REFERENCES `care_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`file_unique_id` text NOT NULL,
	`variants` text NOT NULL,
	`taken_at` integer,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_family_file_idx` ON `photos` (`family_id`,`file_unique_id`);--> statement-breakpoint
ALTER TABLE `pets` ADD `avatar_photo_id` text REFERENCES photos(id) ON DELETE SET NULL;