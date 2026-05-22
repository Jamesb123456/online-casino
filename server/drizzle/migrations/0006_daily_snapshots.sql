CREATE TABLE `daily_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshot_date` varchar(10) NOT NULL,
	`house_balance_close` decimal(15,2) NOT NULL,
	`total_bets` decimal(20,2) NOT NULL,
	`total_wins` decimal(20,2) NOT NULL,
	`ggr` decimal(20,2) NOT NULL,
	`bonuses_paid` decimal(20,2) NOT NULL DEFAULT '0',
	`ngr` decimal(20,2) NOT NULL,
	`active_player_count` int NOT NULL DEFAULT 0,
	`new_player_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_snapshots_snapshot_date_unique` UNIQUE(`snapshot_date`)
);
--> statement-breakpoint
CREATE INDEX `daily_snapshots_snapshot_date_idx` ON `daily_snapshots` (`snapshot_date`);
