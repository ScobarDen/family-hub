CREATE TABLE `reminder_dispatch` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`member_id` text NOT NULL,
	`occurrence` text,
	`next_fire_at` integer,
	`sent_occurrence` text,
	`chat_id` integer,
	`message_id` integer,
	`done_at` integer,
	`done_by` text,
	`locked_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`done_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reminder_dispatch_next_fire_at_idx` ON `reminder_dispatch` (`next_fire_at`);--> statement-breakpoint
CREATE INDEX `reminder_dispatch_source_idx` ON `reminder_dispatch` (`source`,`source_id`);--> statement-breakpoint
CREATE TABLE `reminder_recipients` (
	`reminder_id` text NOT NULL,
	`family_id` text NOT NULL,
	`member_id` text NOT NULL,
	PRIMARY KEY(`reminder_id`, `member_id`),
	FOREIGN KEY (`reminder_id`) REFERENCES `reminders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`owner_member_id` text,
	`visibility` text NOT NULL,
	`text` text NOT NULL,
	`start_date` text NOT NULL,
	`start_time` text NOT NULL,
	`time_zone` text NOT NULL,
	`frequency` text,
	`until` text,
	`is_for_everyone` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reminders_family_id_idx` ON `reminders` (`family_id`);