CREATE TABLE `pets` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`species` text NOT NULL,
	`breed` text,
	`sex` text,
	`birth_date` text,
	`chip_number` text,
	`notes` text,
	`memo_food` text,
	`memo_clinic` text,
	`memo_important` text,
	`memo_updated_at` integer,
	`memo_updated_by` text,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`memo_updated_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pets_family_id_idx` ON `pets` (`family_id`);