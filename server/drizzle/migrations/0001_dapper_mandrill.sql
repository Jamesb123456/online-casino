ALTER TABLE `balances` MODIFY COLUMN `id` int AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `balances` MODIFY COLUMN `user_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `balances` MODIFY COLUMN `related_session_id` int;--> statement-breakpoint
ALTER TABLE `balances` MODIFY COLUMN `transaction_id` int;--> statement-breakpoint
ALTER TABLE `balances` MODIFY COLUMN `admin_id` int;--> statement-breakpoint
ALTER TABLE `game_logs` MODIFY COLUMN `id` int AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `game_logs` MODIFY COLUMN `session_id` int;--> statement-breakpoint
ALTER TABLE `game_logs` MODIFY COLUMN `user_id` int;--> statement-breakpoint
ALTER TABLE `game_sessions` MODIFY COLUMN `id` int AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `game_sessions` MODIFY COLUMN `user_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `game_stats` MODIFY COLUMN `id` int AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` MODIFY COLUMN `id` int AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` MODIFY COLUMN `user_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `id` int AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `user_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `created_by` int;--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `game_session_id` int;--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `voided_by` int;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `id` int AUTO_INCREMENT NOT NULL;