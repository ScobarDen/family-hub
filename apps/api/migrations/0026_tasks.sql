CREATE TABLE `task_assignees` (
	`task_id` text NOT NULL,
	`family_id` text NOT NULL,
	`member_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `member_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task_completions` (
	`task_id` text NOT NULL,
	`family_id` text NOT NULL,
	`occurrence` text NOT NULL,
	`completed_at` integer NOT NULL,
	`completed_by` text,
	PRIMARY KEY(`task_id`, `occurrence`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`completed_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `task_completions_family_id_completed_at_idx` ON `task_completions` (`family_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `task_recipients` (
	`task_id` text NOT NULL,
	`family_id` text NOT NULL,
	`member_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `member_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`parent_id` text,
	`owner_member_id` text,
	`visibility` text,
	`title` text NOT NULL,
	`note` text,
	`date` text,
	`time` text,
	`time_zone` text,
	`end_date` text,
	`end_time` text,
	`frequency` text,
	`until` text,
	`skipped_dates` text DEFAULT '[]' NOT NULL,
	`reminder_offsets` text DEFAULT '[]' NOT NULL,
	`recipients_mode` text DEFAULT 'default' NOT NULL,
	`pet_id` text,
	`album_id` text,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_family_id_idx` ON `tasks` (`family_id`);--> statement-breakpoint
CREATE INDEX `tasks_parent_id_idx` ON `tasks` (`parent_id`);--> statement-breakpoint
INSERT INTO `tasks` (`id`, `family_id`, `parent_id`, `owner_member_id`, `visibility`, `title`, `note`, `date`, `reminder_offsets`, `pet_id`, `album_id`, `created_at`, `created_by`, `updated_at`)
SELECT `id`, `family_id`, `parent_id`, `owner_member_id`, `visibility`, `title`, `note`, `due_date`,
	CASE WHEN `parent_id` IS NOT NULL OR `due_date` IS NULL THEN '[]'
		WHEN `reminder` = 'on-day' THEN '["at-start"]'
		WHEN `reminder` IN ('1d', '1w') THEN json_array(`reminder`)
		ELSE '[]' END,
	`pet_id`, `album_id`, `created_at`, `created_by`, `updated_at`
FROM `plans` ORDER BY `parent_id` IS NOT NULL;
--> statement-breakpoint
INSERT INTO `task_assignees` (`task_id`, `family_id`, `member_id`)
SELECT `id`, `family_id`, `assignee_member_id` FROM `plans` WHERE `assignee_member_id` IS NOT NULL;
--> statement-breakpoint
INSERT INTO `task_completions` (`task_id`, `family_id`, `occurrence`, `completed_at`, `completed_by`)
SELECT `id`, `family_id`, '', `completed_at`, `completed_by` FROM `plans` WHERE `completed_at` IS NOT NULL;
--> statement-breakpoint
INSERT INTO `tasks` (`id`, `family_id`, `owner_member_id`, `visibility`, `title`, `note`, `date`, `time`, `time_zone`, `end_date`, `end_time`, `frequency`, `until`, `skipped_dates`, `reminder_offsets`, `created_at`, `created_by`, `updated_at`)
SELECT `id`, `family_id`, `owner_member_id`, `visibility`, `title`, `note`, `start_date`, `start_time`, `time_zone`, `end_date`, `end_time`, `frequency`, `until`, `skipped_dates`,
	(SELECT json_group_array(`value`) FROM json_each(`events`.`reminder_offsets`) WHERE `events`.`start_time` IS NOT NULL OR `value` NOT IN ('15m', '1h')),
	`created_at`, `created_by`, `updated_at`
FROM `events`;
--> statement-breakpoint
INSERT INTO `tasks` (`id`, `family_id`, `owner_member_id`, `visibility`, `title`, `date`, `time`, `time_zone`, `frequency`, `until`, `reminder_offsets`, `recipients_mode`, `created_at`, `created_by`, `updated_at`)
SELECT `id`, `family_id`, `owner_member_id`, `visibility`, `text`, `start_date`, `start_time`, `time_zone`, `frequency`, `until`, '["at-start"]',
	CASE WHEN `is_for_everyone` THEN 'everyone' ELSE 'members' END,
	`created_at`, `created_by`, `updated_at`
FROM `reminders`;
--> statement-breakpoint
INSERT INTO `task_recipients` (`task_id`, `family_id`, `member_id`)
SELECT `reminder_id`, `family_id`, `member_id` FROM `reminder_recipients`;
--> statement-breakpoint
INSERT OR IGNORE INTO `task_completions` (`task_id`, `family_id`, `occurrence`, `completed_at`, `completed_by`)
SELECT `d`.`source_id`, `d`.`family_id`, CASE WHEN `r`.`frequency` IS NULL THEN '' ELSE `d`.`sent_occurrence` END, `d`.`done_at`, `d`.`done_by`
FROM `reminder_dispatch` `d` JOIN `reminders` `r` ON `r`.`id` = `d`.`source_id`
WHERE `d`.`source` = 'reminder' AND `d`.`done_at` IS NOT NULL AND `d`.`sent_occurrence` IS NOT NULL;
--> statement-breakpoint
INSERT INTO `tasks` (`id`, `family_id`, `owner_member_id`, `visibility`, `title`, `date`, `reminder_offsets`, `pet_id`, `created_at`, `created_by`, `updated_at`)
SELECT `e`.`id`, `e`.`family_id`, `e`.`created_by`, 'shared',
	CASE `e`.`kind` WHEN 'vaccination' THEN 'Прививка: ' || json_extract(`e`.`details`, '$.vaccine')
		WHEN 'treatment' THEN 'Обработка: ' || json_extract(`e`.`details`, '$.target')
		ELSE 'Визит к ветеринару' END,
	`e`.`due_date`, '["1w","at-start"]', `e`.`pet_id`, `e`.`created_at`, `e`.`created_by`, `e`.`updated_at`
FROM `care_entries` `e`
WHERE `e`.`due_key` IS NOT NULL AND `e`.`due_date` IS NOT NULL AND NOT EXISTS (
	SELECT 1 FROM `care_entries` `later`
	WHERE `later`.`pet_id` = `e`.`pet_id` AND `later`.`due_key` = `e`.`due_key`
		AND (`later`.`occurred_at` > `e`.`occurred_at` OR (`later`.`occurred_at` = `e`.`occurred_at` AND `later`.`rowid` > `e`.`rowid`))
);
--> statement-breakpoint
INSERT INTO `task_assignees` (`task_id`, `family_id`, `member_id`)
SELECT `t`.`id`, `t`.`family_id`, `t`.`created_by` FROM `tasks` `t`
JOIN `care_entries` `e` ON `e`.`id` = `t`.`id`
JOIN `family_members` `m` ON `m`.`family_id` = `t`.`family_id` AND `m`.`member_id` = `t`.`created_by`;
--> statement-breakpoint
UPDATE `care_entries` SET `details` = json_remove(`details`, '$.dueDate') WHERE json_type(`details`, '$.dueDate') IS NOT NULL;
--> statement-breakpoint
UPDATE `reminder_dispatch` SET `source` = 'task'
WHERE `source` = 'event' AND `member_id` = (SELECT `owner_member_id` FROM `events` WHERE `events`.`id` = substr(`reminder_dispatch`.`source_id`, 1, instr(`reminder_dispatch`.`source_id`, ':') - 1));
--> statement-breakpoint
UPDATE `reminder_dispatch` SET `source` = 'task', `source_id` = `source_id` || ':at-start' WHERE `source` = 'reminder';
--> statement-breakpoint
UPDATE `reminder_dispatch` SET `source` = 'task', `source_id` = (
	SELECT `p`.`id` || ':' || CASE `p`.`reminder` WHEN 'on-day' THEN 'at-start' ELSE `p`.`reminder` END
	FROM `plans` `p` WHERE `p`.`id` || ':' || `p`.`id` = `reminder_dispatch`.`source_id`
)
WHERE `source` = 'plan' AND EXISTS (
	SELECT 1 FROM `plans` `p`
	WHERE `p`.`id` || ':' || `p`.`id` = `reminder_dispatch`.`source_id` AND `p`.`reminder` IS NOT NULL AND `p`.`due_date` IS NOT NULL
		AND `reminder_dispatch`.`member_id` = coalesce(`p`.`assignee_member_id`, `p`.`owner_member_id`)
);
--> statement-breakpoint
DELETE FROM `reminder_dispatch` WHERE `source` IN ('event', 'plan', 'pet_due');
--> statement-breakpoint
-- A row without an Occurrence but with a fire time is planned by the next cron tick in its Recipient's zone.
INSERT INTO `reminder_dispatch` (`id`, `family_id`, `source`, `source_id`, `member_id`, `next_fire_at`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), `a`.`family_id`, 'task', `a`.`task_id` || ':' || `o`.`value`, `a`.`member_id`, 0, unixepoch() * 1000, unixepoch() * 1000
FROM `task_assignees` `a`
JOIN `care_entries` `e` ON `e`.`id` = `a`.`task_id`
JOIN json_each('["1w","at-start"]') `o`;
