-- Add 'tournament_prize' to the game_type ENUM on every table that references it.
-- Tournament prize payouts (issued by tournamentService.finalize via
-- balanceService.manualAdjustment) need a non-null game_type because the
-- `balances` table's game_type column is NOT NULL in MySQL. Previously the
-- payout INSERT was being rejected under strict mode (or producing a NULL
-- value violating the NOT NULL constraint), causing finalize() to swallow
-- the failure and return prizesAwarded: 0.
ALTER TABLE `transactions`
  MODIFY `game_type` ENUM('crash','plinko','wheel','roulette','blackjack','landmines','dice','slots','tournament_prize') NULL;
--> statement-breakpoint
ALTER TABLE `game_sessions`
  MODIFY `game_type` ENUM('crash','plinko','wheel','roulette','blackjack','landmines','dice','slots','tournament_prize') NOT NULL;
--> statement-breakpoint
ALTER TABLE `balances`
  MODIFY `game_type` ENUM('crash','plinko','wheel','roulette','blackjack','landmines','dice','slots','tournament_prize') NOT NULL;
