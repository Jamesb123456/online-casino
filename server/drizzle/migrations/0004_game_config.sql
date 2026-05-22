CREATE TABLE `game_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`game_type` varchar(50) NOT NULL,
	`house_edge` decimal(5,4) NOT NULL,
	`payout_table` json NOT NULL,
	`max_bet` decimal(15,2) NOT NULL DEFAULT '0',
	`enabled` boolean NOT NULL DEFAULT true,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_config_game_type_unique` UNIQUE(`game_type`)
);
--> statement-breakpoint
ALTER TABLE `game_config` ADD CONSTRAINT `game_config_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `game_config_game_type_idx` ON `game_config` (`game_type`);--> statement-breakpoint
-- Seed default configs matching the hardcoded values currently used by each handler
INSERT INTO `game_config` (`game_type`, `house_edge`, `payout_table`, `max_bet`, `enabled`) VALUES
  ('crash', 0.0400, '{}', '0', true),
  ('roulette', 0.0270, '{"STRAIGHT":35,"SPLIT":17,"STREET":11,"CORNER":8,"FIVE":6,"LINE":5,"COLUMN":2,"DOZEN":2,"RED":1,"BLACK":1,"ODD":1,"EVEN":1,"LOW":1,"HIGH":1}', '0', true),
  ('wheel', 0.0000, '{"easy":[0,0.2,0.3,0.5,0.5,0.8,1.0,1.0,1.2,1.5,1.5,3.0],"medium":[0,0,0,0.1,0.2,0.3,0.5,0.5,1.0,1.5,2.0,5.0],"hard":[0,0,0,0,0,0,0.1,0.2,0.5,1.0,2.0,7.0]}', '0', true),
  ('plinko', 0.0000, '{"low":{"8":[2.5,1.4,1.1,0.9,0.8,0.9,1.1,1.4,2.5],"9":[2.7,1.5,1.1,0.9,0.8,0.8,0.9,1.1,1.5,2.7],"10":[2.9,1.6,1.2,0.9,0.8,0.8,0.9,1.2,1.6,2.9],"11":[3.0,1.6,1.2,1.0,0.8,0.7,0.8,1.0,1.2,1.6,3.0],"12":[3.2,1.7,1.2,1.0,0.8,0.7,0.7,0.8,1.0,1.2,1.7,3.2],"13":[3.4,1.8,1.3,1.0,0.9,0.7,0.7,0.7,0.9,1.0,1.3,1.8,3.4],"14":[3.6,1.9,1.3,1.0,0.9,0.8,0.7,0.7,0.8,0.9,1.0,1.3,1.9,3.6],"15":[3.8,2.0,1.4,1.1,0.9,0.8,0.7,0.7,0.7,0.8,0.9,1.1,1.4,2.0,3.8],"16":[4.0,2.1,1.4,1.1,0.9,0.8,0.7,0.7,0.6,0.7,0.7,0.8,0.9,1.1,1.4,2.1,4.0]},"medium":{"8":[5.6,2.1,1.1,0.7,0.5,0.7,1.1,2.1,5.6],"9":[6.2,2.3,1.2,0.7,0.5,0.5,0.7,1.2,2.3,6.2],"10":[7.0,2.5,1.3,0.8,0.5,0.5,0.8,1.3,2.5,7.0],"11":[8.0,2.8,1.4,0.8,0.5,0.4,0.5,0.8,1.4,2.8,8.0],"12":[9.0,3.0,1.5,0.9,0.6,0.4,0.4,0.6,0.9,1.5,3.0,9.0],"13":[10.0,3.2,1.6,0.9,0.6,0.4,0.3,0.4,0.6,0.9,1.6,3.2,10.0],"14":[12.0,3.5,1.7,1.0,0.6,0.4,0.3,0.3,0.4,0.6,1.0,1.7,3.5,12.0],"15":[14.0,4.0,1.8,1.0,0.7,0.4,0.3,0.3,0.3,0.4,0.7,1.0,1.8,4.0,14.0],"16":[16.0,4.5,2.0,1.1,0.7,0.5,0.3,0.3,0.2,0.3,0.3,0.5,0.7,1.1,2.0,4.5,16.0]},"high":{"8":[15.0,4.0,1.5,0.5,0.3,0.5,1.5,4.0,15.0],"9":[18.0,4.5,1.6,0.6,0.3,0.3,0.6,1.6,4.5,18.0],"10":[22.0,5.0,1.8,0.6,0.3,0.2,0.3,0.6,1.8,5.0,22.0],"11":[26.0,5.5,2.0,0.7,0.3,0.2,0.3,0.7,2.0,5.5,26.0],"12":[30.0,6.0,2.2,0.8,0.4,0.2,0.2,0.4,0.8,2.2,6.0,30.0],"13":[35.0,7.0,2.5,0.9,0.4,0.2,0.1,0.2,0.4,0.9,2.5,7.0,35.0],"14":[40.0,8.0,2.8,1.0,0.4,0.2,0.1,0.1,0.2,0.4,1.0,2.8,8.0,40.0],"15":[45.0,9.0,3.0,1.1,0.5,0.2,0.1,0.1,0.1,0.2,0.5,1.1,3.0,9.0,45.0],"16":[50.0,10.0,3.5,1.2,0.5,0.3,0.1,0.1,0.1,0.1,0.1,0.3,0.5,1.2,3.5,10.0,50.0]}}', '0', true),
  ('landmines', 0.0500, '{}', '0', true),
  ('blackjack', 0.0200, '{"win":2.0,"blackjack":2.5,"push":1.0}', '0', true);
