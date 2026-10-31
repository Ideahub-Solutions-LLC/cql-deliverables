ALTER TABLE `delivery_tasks` ADD COLUMN `owner_username` text REFERENCES `delivery_users`(`username`);
--> statement-breakpoint
UPDATE `delivery_tasks` SET `owner_username` = (
  SELECT `username` FROM `delivery_users` WHERE `display_name` = `delivery_tasks`.`owner` LIMIT 1
) WHERE `owner_username` IS NULL;
--> statement-breakpoint
CREATE INDEX `delivery_tasks_owner_account` ON `delivery_tasks` (`owner_username`);
