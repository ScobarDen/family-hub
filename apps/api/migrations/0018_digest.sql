ALTER TABLE `members` ADD `is_digest_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `digest_time` text DEFAULT '09:00' NOT NULL;