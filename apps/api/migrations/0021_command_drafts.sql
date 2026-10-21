CREATE TABLE `command_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`member_id` text NOT NULL,
	`kind` text,
	`payload` text,
	`source` text NOT NULL,
	`chat_id` integer,
	`message_id` integer,
	`status` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `command_drafts_family_created_idx` ON `command_drafts` (`family_id`,`created_at`);