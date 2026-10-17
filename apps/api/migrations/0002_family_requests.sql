CREATE TABLE `family_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`telegram_id` integer NOT NULL,
	`family_name` text NOT NULL,
	`requester_name` text NOT NULL,
	`requester_username` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`decided_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `family_requests_pending_telegram_id_unique` ON `family_requests` (`telegram_id`) WHERE "family_requests"."status" = 'pending';