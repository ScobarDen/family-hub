CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`parent_id` text,
	`owner_member_id` text,
	`visibility` text,
	`title` text NOT NULL,
	`note` text,
	`due_date` text,
	`assignee_member_id` text,
	`completed_at` integer,
	`completed_by` text,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`completed_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plans_family_id_idx` ON `plans` (`family_id`);--> statement-breakpoint
CREATE INDEX `plans_parent_id_idx` ON `plans` (`parent_id`);