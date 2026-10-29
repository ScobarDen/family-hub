CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`credential_hash` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_credential_hash_unique` ON `devices` (`credential_hash`);--> statement-breakpoint
CREATE INDEX `devices_member_id_idx` ON `devices` (`member_id`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`device_id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_member_id_idx` ON `push_subscriptions` (`member_id`);--> statement-breakpoint
ALTER TABLE `members` ADD `reminder_channel` text DEFAULT 'both' NOT NULL;