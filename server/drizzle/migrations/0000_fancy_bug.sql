CREATE TABLE `balances` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`amount` decimal(15,2) NOT NULL DEFAULT '0',
	`previous_balance` decimal(15,2) NOT NULL,
	`change_amount` decimal(15,2) NOT NULL,
	`balance_type` enum('deposit','withdrawal','win','loss','admin_adjustment') NOT NULL,
	`game_type` enum('crash','plinko','wheel','roulette','blackjack') NOT NULL,
	`related_session_id` varchar(36),
	`transaction_id` varchar(36),
	`note` text,
	`admin_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `balances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_logs` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36),
	`user_id` varchar(36),
	`game_type` enum('crash','plinko','wheel','roulette','blackjack') NOT NULL,
	`event_type` enum('session_start','bet_placed','bet_updated','game_result','win','loss','cashout','error','game_state_change') NOT NULL,
	`event_details` json NOT NULL,
	`amount` decimal(15,2),
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`game_type` enum('crash','plinko','wheel','roulette','blackjack') NOT NULL,
	`start_time` timestamp NOT NULL DEFAULT (now()),
	`end_time` timestamp,
	`initial_bet` decimal(15,2) NOT NULL,
	`total_bet` decimal(15,2) NOT NULL,
	`outcome` decimal(15,2) NOT NULL DEFAULT '0',
	`final_multiplier` decimal(10,6),
	`game_state` json,
	`is_completed` boolean NOT NULL DEFAULT false,
	`result_details` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_stats` (
	`id` varchar(36) NOT NULL,
	`game_type` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`total_games_played` int NOT NULL DEFAULT 0,
	`total_bets_amount` decimal(20,2) NOT NULL DEFAULT '0',
	`total_winnings_amount` decimal(20,2) NOT NULL DEFAULT '0',
	`house_profit` decimal(20,2) NOT NULL DEFAULT '0',
	`daily_stats` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_stats_game_type_unique` UNIQUE(`game_type`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` varchar(36) NOT NULL,
	`content` text NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`transaction_type` enum('deposit','withdrawal','game_win','game_loss','admin_adjustment','bonus') NOT NULL,
	`game_type` enum('crash','plinko','wheel','roulette','blackjack'),
	`amount` decimal(15,2) NOT NULL,
	`balance_before` decimal(15,2) NOT NULL,
	`balance_after` decimal(15,2) NOT NULL,
	`transaction_status` enum('pending','completed','failed','voided','processing') NOT NULL DEFAULT 'completed',
	`created_by` varchar(36),
	`reference` varchar(255),
	`description` text,
	`game_session_id` varchar(36),
	`metadata` json,
	`notes` json,
	`voided_by` varchar(36),
	`voided_reason` text,
	`voided_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`username` varchar(30) NOT NULL,
	`password_hash` text NOT NULL,
	`user_role` enum('user','admin') NOT NULL DEFAULT 'user',
	`balance` decimal(15,2) NOT NULL DEFAULT '0',
	`email` varchar(255),
	`avatar` text DEFAULT (''),
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login` timestamp DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `balances` ADD CONSTRAINT `balances_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `balances` ADD CONSTRAINT `balances_related_session_id_game_sessions_id_fk` FOREIGN KEY (`related_session_id`) REFERENCES `game_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `balances` ADD CONSTRAINT `balances_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `balances` ADD CONSTRAINT `balances_admin_id_users_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `game_logs` ADD CONSTRAINT `game_logs_session_id_game_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `game_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `game_logs` ADD CONSTRAINT `game_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD CONSTRAINT `game_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_voided_by_users_id_fk` FOREIGN KEY (`voided_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `balances_user_id_idx` ON `balances` (`user_id`);--> statement-breakpoint
CREATE INDEX `balances_type_idx` ON `balances` (`balance_type`);--> statement-breakpoint
CREATE INDEX `balances_game_type_idx` ON `balances` (`game_type`);--> statement-breakpoint
CREATE INDEX `balances_related_session_id_idx` ON `balances` (`related_session_id`);--> statement-breakpoint
CREATE INDEX `balances_transaction_id_idx` ON `balances` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `game_logs_session_id_idx` ON `game_logs` (`session_id`);--> statement-breakpoint
CREATE INDEX `game_logs_user_id_idx` ON `game_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `game_logs_game_type_idx` ON `game_logs` (`game_type`);--> statement-breakpoint
CREATE INDEX `game_logs_event_type_idx` ON `game_logs` (`event_type`);--> statement-breakpoint
CREATE INDEX `game_logs_timestamp_idx` ON `game_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `game_sessions_user_id_idx` ON `game_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `game_sessions_game_type_idx` ON `game_sessions` (`game_type`);--> statement-breakpoint
CREATE INDEX `game_sessions_start_time_idx` ON `game_sessions` (`start_time`);--> statement-breakpoint
CREATE INDEX `game_sessions_is_completed_idx` ON `game_sessions` (`is_completed`);--> statement-breakpoint
CREATE INDEX `game_stats_game_type_idx` ON `game_stats` (`game_type`);--> statement-breakpoint
CREATE INDEX `messages_user_id_idx` ON `messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `messages_created_at_idx` ON `messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `transactions_user_id_idx` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `transactions` (`transaction_type`);--> statement-breakpoint
CREATE INDEX `transactions_game_type_idx` ON `transactions` (`game_type`);--> statement-breakpoint
CREATE INDEX `transactions_status_idx` ON `transactions` (`transaction_status`);--> statement-breakpoint
CREATE INDEX `transactions_amount_idx` ON `transactions` (`amount`);--> statement-breakpoint
CREATE INDEX `transactions_created_by_idx` ON `transactions` (`created_by`);--> statement-breakpoint
CREATE INDEX `transactions_game_session_id_idx` ON `transactions` (`game_session_id`);--> statement-breakpoint
CREATE INDEX `transactions_created_at_idx` ON `transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`user_role`);