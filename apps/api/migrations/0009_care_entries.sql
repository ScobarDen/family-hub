CREATE TABLE `care_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`pet_id` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`note` text,
	`details` text NOT NULL,
	`due_date` text,
	`due_key` text,
	`weight_kg` real,
	`expense_amount` integer,
	`expense_category` text,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `care_entries_pet_id_occurred_at_idx` ON `care_entries` (`pet_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `care_entries_family_id_idx` ON `care_entries` (`family_id`);