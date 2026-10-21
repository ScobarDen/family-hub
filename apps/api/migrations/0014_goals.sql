CREATE TABLE `goal_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`member_id` text NOT NULL,
	`comment` text,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `goal_movements_goal_id_idx` ON `goal_movements` (`goal_id`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`owner_member_id` text,
	`visibility` text NOT NULL,
	`title` text NOT NULL,
	`target` integer NOT NULL,
	`deadline` text,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`note` text,
	`completed_at` integer,
	`completed_by` text,
	`outcome` text,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`completed_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `goals_family_id_idx` ON `goals` (`family_id`);