CREATE TABLE `tournaments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`game_type` varchar(50) NOT NULL,
	`scoring` varchar(40) NOT NULL,
	`start_time` timestamp NOT NULL,
	`end_time` timestamp NOT NULL,
	`prize_pool` decimal(15,2) NOT NULL,
	`prize_distribution` json NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'scheduled',
	`created_by` int,
	`finalized_at` timestamp NULL,
	`finalized_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tournaments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tournament_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tournament_id` int NOT NULL,
	`user_id` int NOT NULL,
	`score` decimal(15,4) NOT NULL DEFAULT '0',
	`total_wagered` decimal(15,2) NOT NULL DEFAULT '0',
	`total_won` decimal(15,2) NOT NULL DEFAULT '0',
	`biggest_win` decimal(15,2) NOT NULL DEFAULT '0',
	`rank` int,
	`prize_amount` decimal(15,2),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tournament_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tournaments` ADD CONSTRAINT `tournaments_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `tournaments` ADD CONSTRAINT `tournaments_finalized_by_users_id_fk` FOREIGN KEY (`finalized_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `tournament_entries` ADD CONSTRAINT `tournament_entries_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `tournament_entries` ADD CONSTRAINT `tournament_entries_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `tournaments_status_idx` ON `tournaments` (`status`);
--> statement-breakpoint
CREATE INDEX `tournaments_game_type_idx` ON `tournaments` (`game_type`);
--> statement-breakpoint
CREATE INDEX `tournaments_active_lookup_idx` ON `tournaments` (`status`, `start_time`, `end_time`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_entries_tournament_user_unique` ON `tournament_entries` (`tournament_id`, `user_id`);
--> statement-breakpoint
CREATE INDEX `tournament_entries_leaderboard_idx` ON `tournament_entries` (`tournament_id`, `score`);
