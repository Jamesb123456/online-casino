CREATE TABLE `user_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`max_bet_per_round` decimal(15,2),
	`max_loss_per_day` decimal(15,2),
	`locked_until` timestamp NULL,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_limits_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `user_limits` ADD CONSTRAINT `user_limits_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `user_limits` ADD CONSTRAINT `user_limits_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `user_limits_user_id_idx` ON `user_limits` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_limits_locked_until_idx` ON `user_limits` (`locked_until`);
