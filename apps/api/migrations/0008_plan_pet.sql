ALTER TABLE `plans` ADD `pet_id` text REFERENCES pets(id) ON DELETE set null;
