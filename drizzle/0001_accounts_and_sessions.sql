CREATE TABLE `delivery_users` (
	`username` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`person_id` text,
	`password_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_iterations` integer NOT NULL,
	`active` integer NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `delivery_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL REFERENCES `delivery_users`(`username`) ON DELETE CASCADE,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `delivery_sessions_expiry` ON `delivery_sessions` (`expires_at`);
