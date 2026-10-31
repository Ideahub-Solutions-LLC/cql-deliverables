CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL UNIQUE,
	`sort_order` integer NOT NULL,
	`active` integer NOT NULL DEFAULT 1
);
--> statement-breakpoint
INSERT INTO `workspaces` (`id`, `name`, `sort_order`, `active`) VALUES
	('digital-smile-innovations', 'Digital Smile Innovations', 1, 1),
	('ideahub', 'iDeaHub', 2, 1),
	('right-team-provider', 'Right Team Provider', 3, 1);
--> statement-breakpoint
CREATE TABLE `workspace_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`) ON DELETE CASCADE,
	`name` text NOT NULL,
	`created_by` text NOT NULL REFERENCES `delivery_users`(`username`),
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_project_name` ON `workspace_projects` (`workspace_id`, `name`);
--> statement-breakpoint
CREATE INDEX `workspace_projects_workspace` ON `workspace_projects` (`workspace_id`, `created_at`);
--> statement-breakpoint
INSERT INTO `workspace_projects` (`id`, `workspace_id`, `name`, `created_by`, `created_at`) VALUES
	('dsi-delivery-tracker', 'digital-smile-innovations', 'DSI Daily Execution Tracker', 'marco', '2026-10-31T00:00:00.000Z');
--> statement-breakpoint
ALTER TABLE `delivery_sessions` ADD COLUMN `workspace_id` text REFERENCES `workspaces`(`id`);
--> statement-breakpoint
UPDATE `delivery_sessions` SET `workspace_id` = 'digital-smile-innovations' WHERE `workspace_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `delivery_sessions_workspace` ON `delivery_sessions` (`workspace_id`);
