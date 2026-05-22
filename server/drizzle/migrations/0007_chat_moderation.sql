ALTER TABLE `messages` ADD COLUMN `deleted_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `deleted_by` int NULL;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `deleted_reason` text NULL;
--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE `user_mutes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`muted_until` timestamp NOT NULL,
	`muted_by` int,
	`reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_mutes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user_mutes` ADD CONSTRAINT `user_mutes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `user_mutes` ADD CONSTRAINT `user_mutes_muted_by_users_id_fk` FOREIGN KEY (`muted_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `user_mutes_user_id_idx` ON `user_mutes` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_mutes_user_muted_until_idx` ON `user_mutes` (`user_id`,`muted_until`);
