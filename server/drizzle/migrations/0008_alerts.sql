CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(60) NOT NULL,
	`severity` varchar(20) NOT NULL DEFAULT 'warning',
	`user_id` int,
	`game_type` varchar(50),
	`details` json NOT NULL,
	`acknowledged` boolean NOT NULL DEFAULT false,
	`acknowledged_at` timestamp NULL,
	`acknowledged_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_acknowledged_by_users_id_fk` FOREIGN KEY (`acknowledged_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `alerts_acknowledged_idx` ON `alerts` (`acknowledged`);
--> statement-breakpoint
CREATE INDEX `alerts_acknowledged_created_idx` ON `alerts` (`acknowledged`,`created_at`);
--> statement-breakpoint
CREATE INDEX `alerts_type_idx` ON `alerts` (`type`);
--> statement-breakpoint
CREATE INDEX `alerts_created_at_idx` ON `alerts` (`created_at`);
