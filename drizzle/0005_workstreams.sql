CREATE TABLE `delivery_workstreams` (
  `workspace_id` text NOT NULL REFERENCES `workspaces`(`id`) ON DELETE cascade,
  `name` text NOT NULL,
  `created_by` text NOT NULL REFERENCES `delivery_users`(`username`),
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_workstreams_name` ON `delivery_workstreams` (`workspace_id`, `name` COLLATE NOCASE);
