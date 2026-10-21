CREATE TABLE `recipe_cooks` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`cooked_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recipe_cooks_recipe_id_idx` ON `recipe_cooks` (`recipe_id`);