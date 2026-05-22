CREATE INDEX `idx_transactions_user_type_created` ON `transactions` (`user_id`, `transaction_type`, `created_at`);
CREATE INDEX `idx_transactions_type_created` ON `transactions` (`transaction_type`, `created_at`);
