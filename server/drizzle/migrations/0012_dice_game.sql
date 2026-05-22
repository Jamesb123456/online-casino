-- Add 'dice' to the game_type ENUM on every table that references it.
-- The new value is appended to preserve existing ordinal indexes.
ALTER TABLE `transactions`
  MODIFY `game_type` ENUM('crash','plinko','wheel','roulette','blackjack','landmines','dice') NULL;
--> statement-breakpoint
ALTER TABLE `game_sessions`
  MODIFY `game_type` ENUM('crash','plinko','wheel','roulette','blackjack','landmines','dice') NOT NULL;
--> statement-breakpoint
ALTER TABLE `balances`
  MODIFY `game_type` ENUM('crash','plinko','wheel','roulette','blackjack','landmines','dice') NOT NULL;
--> statement-breakpoint
-- Seed default config (4% house edge, enabled, no maxBet, empty payoutTable since dice uses a formula).
INSERT INTO `game_config` (`game_type`, `house_edge`, `payout_table`, `max_bet`, `enabled`, `created_at`, `updated_at`)
VALUES ('dice', 0.0400, '{}', '0', 1, NOW(), NOW());
