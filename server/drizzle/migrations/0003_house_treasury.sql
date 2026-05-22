CREATE TABLE `house_account` (
	`id` int AUTO_INCREMENT NOT NULL,
	`balance` decimal(15,2) NOT NULL DEFAULT '0',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `house_account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `house_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(50) NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`balance_before` decimal(15,2) NOT NULL,
	`balance_after` decimal(15,2) NOT NULL,
	`user_id` int,
	`game_type` varchar(50),
	`game_session_id` int,
	`transaction_id` int,
	`admin_id` int,
	`reason` text,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `house_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` json NOT NULL,
	`updated_by` int,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
ALTER TABLE `house_transactions` ADD CONSTRAINT `house_transactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `house_transactions` ADD CONSTRAINT `house_transactions_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `house_transactions` ADD CONSTRAINT `house_transactions_admin_id_users_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `settings` ADD CONSTRAINT `settings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `house_transactions_type_idx` ON `house_transactions` (`type`);--> statement-breakpoint
CREATE INDEX `house_transactions_user_id_idx` ON `house_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `house_transactions_game_type_idx` ON `house_transactions` (`game_type`);--> statement-breakpoint
CREATE INDEX `house_transactions_created_at_idx` ON `house_transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `settings_key_idx` ON `settings` (`key`);
