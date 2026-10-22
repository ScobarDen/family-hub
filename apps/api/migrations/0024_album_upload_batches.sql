CREATE TABLE `album_upload_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`album_id` text NOT NULL,
	`last_added_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `album_upload_batches_family_id_last_added_at_idx` ON `album_upload_batches` (`family_id`,`last_added_at`);--> statement-breakpoint
DROP INDEX `care_entries_family_id_idx`;--> statement-breakpoint
CREATE INDEX `care_entries_family_id_created_at_idx` ON `care_entries` (`family_id`,`created_at`);--> statement-breakpoint
DROP INDEX `goals_family_id_idx`;--> statement-breakpoint
CREATE INDEX `goals_family_id_completed_at_idx` ON `goals` (`family_id`,`completed_at`);--> statement-breakpoint
DROP INDEX `plans_family_id_idx`;--> statement-breakpoint
CREATE INDEX `plans_family_id_completed_at_idx` ON `plans` (`family_id`,`completed_at`);--> statement-breakpoint
ALTER TABLE `album_photos` ADD `batch_id` text REFERENCES album_upload_batches(id);--> statement-breakpoint
CREATE INDEX `album_photos_batch_id_idx` ON `album_photos` (`batch_id`);--> statement-breakpoint
CREATE INDEX `goal_movements_family_id_created_at_idx` ON `goal_movements` (`family_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `recipe_cooks_family_id_cooked_at_idx` ON `recipe_cooks` (`family_id`,`cooked_at`);--> statement-breakpoint
-- Existing photos make the batches the Feed computed before: one Member, one Album, pauses under 600000 ms.
-- The sum counts peers with equal added_at together, so a tie never splits a batch.
INSERT INTO `album_upload_batches` (`id`, `family_id`, `album_id`, `last_added_at`, `created_at`, `created_by`, `updated_at`)
WITH `starts` AS (
	SELECT `album_id`, `family_id`, `added_by`, `added_at`,
		CASE WHEN `added_at` - lag(`added_at`) OVER (PARTITION BY `album_id`, `added_by` ORDER BY `added_at`) < 600000 THEN 0 ELSE 1 END AS `is_start`
	FROM `album_photos`
), `numbered` AS (
	SELECT *, sum(`is_start`) OVER (PARTITION BY `album_id`, `added_by` ORDER BY `added_at`) AS `batch_number`
	FROM `starts`
)
SELECT `album_id` || ':' || `added_by` || ':' || `batch_number`, `family_id`, `album_id`, max(`added_at`), min(`added_at`), `added_by`, max(`added_at`)
FROM `numbered`
GROUP BY `album_id`, `added_by`, `batch_number`;--> statement-breakpoint
WITH `starts` AS (
	SELECT `album_id`, `photo_id`, `added_by`, `added_at`,
		CASE WHEN `added_at` - lag(`added_at`) OVER (PARTITION BY `album_id`, `added_by` ORDER BY `added_at`) < 600000 THEN 0 ELSE 1 END AS `is_start`
	FROM `album_photos`
), `numbered` AS (
	SELECT *, sum(`is_start`) OVER (PARTITION BY `album_id`, `added_by` ORDER BY `added_at`) AS `batch_number`
	FROM `starts`
)
UPDATE `album_photos`
SET `batch_id` = `numbered`.`album_id` || ':' || `numbered`.`added_by` || ':' || `numbered`.`batch_number`
FROM `numbered`
WHERE `album_photos`.`album_id` = `numbered`.`album_id` AND `album_photos`.`photo_id` = `numbered`.`photo_id`;
