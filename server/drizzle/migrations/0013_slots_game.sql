-- Add 'slots' to the game_type ENUM on every table that references it.
-- The new value is appended to preserve existing ordinal indexes.
ALTER TABLE `transactions`
  MODIFY `game_type` ENUM('crash','plinko','wheel','roulette','blackjack','landmines','dice','slots') NULL;
--> statement-breakpoint
ALTER TABLE `game_sessions`
  MODIFY `game_type` ENUM('crash','plinko','wheel','roulette','blackjack','landmines','dice','slots') NOT NULL;
--> statement-breakpoint
ALTER TABLE `balances`
  MODIFY `game_type` ENUM('crash','plinko','wheel','roulette','blackjack','landmines','dice','slots') NOT NULL;
--> statement-breakpoint
-- Seed default config (5% house edge, enabled, no maxBet, full paytable in payoutTable).
INSERT INTO `game_config` (`game_type`, `house_edge`, `payout_table`, `max_bet`, `enabled`, `created_at`, `updated_at`)
VALUES ('slots', 0.0500, '{"symbols":["CHERRY","LEMON","ORANGE","PLUM","BELL","BAR","SEVEN"],"reels":[["CHERRY","CHERRY","LEMON","ORANGE","PLUM","BELL","CHERRY","LEMON","BAR","ORANGE","CHERRY","LEMON","SEVEN","PLUM","BELL","ORANGE","LEMON","CHERRY","BAR","PLUM"],["LEMON","ORANGE","PLUM","BELL","CHERRY","LEMON","BAR","ORANGE","CHERRY","PLUM","BELL","ORANGE","LEMON","CHERRY","SEVEN","PLUM","BELL","CHERRY","LEMON","BAR"],["ORANGE","PLUM","BELL","CHERRY","LEMON","BAR","ORANGE","CHERRY","PLUM","BELL","CHERRY","LEMON","SEVEN","PLUM","ORANGE","LEMON","CHERRY","BAR","BELL","CHERRY"],["PLUM","BELL","CHERRY","LEMON","ORANGE","CHERRY","BAR","PLUM","BELL","ORANGE","LEMON","CHERRY","SEVEN","BAR","ORANGE","CHERRY","LEMON","BELL","PLUM","CHERRY"],["BELL","CHERRY","LEMON","BAR","ORANGE","PLUM","CHERRY","BELL","ORANGE","LEMON","BAR","CHERRY","SEVEN","PLUM","ORANGE","LEMON","CHERRY","BELL","BAR","PLUM"]],"lines":[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2]],"payouts":{"CHERRY":{"3":14,"4":45,"5":140},"LEMON":{"3":14,"4":45,"5":140},"ORANGE":{"3":22,"4":70,"5":210},"PLUM":{"3":22,"4":70,"5":210},"BELL":{"3":42,"4":140,"5":560},"BAR":{"3":70,"4":280,"5":1400},"SEVEN":{"3":140,"4":700,"5":4200}}}', '0', 1, NOW(), NOW());
