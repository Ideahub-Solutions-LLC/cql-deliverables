ALTER TABLE `delivery_users` ADD COLUMN `email` text;
--> statement-breakpoint
ALTER TABLE `delivery_users` ADD COLUMN `first_name` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `delivery_users` ADD COLUMN `last_name` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `delivery_users` ADD COLUMN `avatar_data` text;
--> statement-breakpoint
ALTER TABLE `delivery_users` ADD COLUMN `timezone` text NOT NULL DEFAULT 'PST';
--> statement-breakpoint
ALTER TABLE `delivery_users` ADD COLUMN `theme_mode` text NOT NULL DEFAULT 'default';
--> statement-breakpoint
UPDATE `delivery_users` SET
  `first_name` = CASE WHEN instr(`display_name`, ' ') > 0 THEN substr(`display_name`, 1, instr(`display_name`, ' ') - 1) ELSE `display_name` END,
  `last_name` = CASE WHEN instr(`display_name`, ' ') > 0 THEN substr(`display_name`, instr(`display_name`, ' ') + 1) ELSE '' END
WHERE `first_name` = '';
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_users_email` ON `delivery_users` (`email`) WHERE `email` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `delivery_tasks` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `workspace_projects`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `owner` text NOT NULL,
  `workstream` text NOT NULL DEFAULT 'Additional deliverables',
  `start_date` text NOT NULL,
  `due_date` text NOT NULL,
  `deliverable` text NOT NULL,
  `acceptance` text NOT NULL,
  `target` text,
  `unit` text,
  `created_by` text NOT NULL REFERENCES `delivery_users`(`username`),
  `created_at` text NOT NULL,
  `deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `delivery_tasks_project` ON `delivery_tasks` (`project_id`, `due_date`);
--> statement-breakpoint
CREATE TABLE `delivery_comments` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL,
  `author_username` text NOT NULL REFERENCES `delivery_users`(`username`),
  `parent_id` text REFERENCES `delivery_comments`(`id`) ON DELETE RESTRICT,
  `content` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `delivery_comments_task` ON `delivery_comments` (`task_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `delivery_notifications` (
  `id` text PRIMARY KEY NOT NULL,
  `recipient_username` text NOT NULL REFERENCES `delivery_users`(`username`),
  `actor_username` text NOT NULL REFERENCES `delivery_users`(`username`),
  `task_id` text,
  `kind` text NOT NULL,
  `message` text NOT NULL,
  `read_at` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `delivery_notifications_recipient` ON `delivery_notifications` (`recipient_username`, `created_at`);
