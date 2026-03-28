# Database Schema

## Overview

Platinum Casino uses **MySQL 8** as its primary data store, accessed through the **Drizzle ORM** (`drizzle-orm ^0.32.0`) with the `mysql2` driver. The schema is defined in TypeScript at `server/drizzle/schema.ts` and uses Drizzle's MySQL table builder API.

The database contains **11 tables** in total:

- **3 Better Auth-managed tables:** `session`, `account`, `verification`
- **8 application-managed tables:** `users`, `transactions`, `game_sessions`, `game_logs`, `balances`, `game_stats`, `messages`, `login_rewards`

The database connection is configured in `server/drizzle/db.ts`, which creates a connection pool via `mysql2/promise` with the following defaults:

- Connection limit: 20
- Idle timeout: 60,000 ms
- Keep-alive enabled

The connection URL is read from the `DATABASE_URL` environment variable (default: `mysql://root:password@localhost:3306/casino`).

---

## Table Ownership

The schema is split between tables managed by **Better Auth** (the authentication library) and tables managed by **application code**. Understanding this distinction is important to avoid breaking the auth system.

### Better Auth-Managed Tables

These three tables are created, read, and written by the Better Auth library. **Do not modify their structure or data manually** -- Better Auth expects a specific schema and manages the lifecycle of rows in these tables automatically.

| Table | Purpose |
|---|---|
| `session` | Tracks active user sessions for session-based authentication. Created on login, deleted on logout or expiry. |
| `account` | Links users to authentication providers (email/password, OAuth). Stores provider credentials and tokens. |
| `verification` | Stores email verification tokens and other one-time-use verification values. Rows are ephemeral and auto-expire. |

The `users` table is a **shared** table: Better Auth manages certain core columns (`name`, `email`, `email_verified`, `image`) and plugin columns (`username`, `display_username`, `role`, `banned`, `ban_reason`, `ban_expires`), while the application manages casino-specific columns (`password_hash`, `balance`, `avatar`, `is_active`, `last_login`). When adding columns to `users`, take care not to conflict with Better Auth's expected schema.

For full details on how Better Auth is configured and integrated, see [Better Auth Integration](../13-integrations/better-auth-integration.md).

### Application-Managed Tables

These eight tables are fully managed by application code (routes, services, socket handlers):

| Table | Purpose |
|---|---|
| `users` | User accounts, credentials, and current balance (shared with Better Auth -- see above) |
| `transactions` | Financial event ledger: deposits, withdrawals, game wins/losses, bonuses, admin adjustments |
| `game_sessions` | Individual game rounds from start to completion |
| `game_logs` | Granular events within game sessions for auditing and analytics |
| `balances` | Full ledger of every balance change for audit and history |
| `game_stats` | Aggregated statistics per game type |
| `messages` | Chat messages sent by users |
| `login_rewards` | Daily login reward claims |

---

## Enum Types

The schema defines five MySQL ENUM types used across multiple tables. Note that `game_logs` uses `varchar` columns instead of enums for `gameType` and `eventType` (see the game_logs section for details).

| Enum Name | Column Name | Values |
|---|---|---|
| `transactionTypeEnum` | `transaction_type` | `deposit`, `withdrawal`, `game_win`, `game_loss`, `admin_adjustment`, `bonus`, `login_reward` |
| `transactionStatusEnum` | `transaction_status` | `pending`, `completed`, `failed`, `voided`, `processing` |
| `gameTypeEnum` | `game_type` | `crash`, `plinko`, `wheel`, `roulette`, `blackjack`, `landmines` |
| `balanceTypeEnum` | `balance_type` | `deposit`, `withdrawal`, `win`, `loss`, `admin_adjustment`, `login_reward` |
| `eventTypeEnum` | `event_type` | `session_start`, `bet_placed`, `bet_updated`, `game_result`, `win`, `loss`, `cashout`, `error`, `game_state_change` |

The previous `userRoleEnum` has been removed. User roles are now stored as `varchar(20)` to support Better Auth's admin plugin.

---

## Tables

### users

Stores user accounts, credentials, and current balance. Extended to support **Better Auth** with the username and admin plugins.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `int` | PRIMARY KEY, AUTO_INCREMENT | -- | |
| `name` | `varchar(255)` | NOT NULL | `''` | Better Auth core field |
| `email` | `varchar(255)` | NOT NULL, UNIQUE | -- | Better Auth core field |
| `email_verified` | `boolean` | NOT NULL | `false` | Better Auth core field |
| `image` | `text` | | `NULL` | Better Auth core field |
| `username` | `varchar(30)` | NOT NULL, UNIQUE | -- | Better Auth username plugin |
| `display_username` | `varchar(30)` | | `NULL` | Better Auth username plugin |
| `role` | `varchar(20)` | | `'user'` | Better Auth admin plugin |
| `banned` | `boolean` | | `false` | Better Auth admin plugin |
| `ban_reason` | `text` | | `NULL` | Better Auth admin plugin |
| `ban_expires` | `timestamp` | | `NULL` | Better Auth admin plugin |
| `password_hash` | `text` | | `NULL` | Casino custom field |
| `balance` | `decimal(15,2)` | NOT NULL | `'0'` | Casino custom field |
| `avatar` | `text` | | `''` | Casino custom field |
| `is_active` | `boolean` | NOT NULL | `true` | Casino custom field |
| `last_login` | `timestamp` | | `NOW()` | Casino custom field |
| `created_at` | `timestamp` | NOT NULL | `NOW()` | |
| `updated_at` | `timestamp` | NOT NULL | `NOW()` ON UPDATE CURRENT_TIMESTAMP | |

**Indexes:**

- `users_username_idx` on `username`
- `users_email_idx` on `email`
- `users_role_idx` on `role`

---

### session

Better Auth session table. Tracks active user sessions for session-based authentication.

> **Better Auth-managed.** Do not insert, update, or delete rows manually. Better Auth creates sessions on login and removes them on logout or expiry.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `int` | PRIMARY KEY, AUTO_INCREMENT | -- | Unique session identifier |
| `token` | `varchar(255)` | NOT NULL, UNIQUE | -- | Opaque session token sent as a cookie to the client |
| `user_id` | `int` | NOT NULL, FK -> `users.id` | -- | The user this session belongs to |
| `expires_at` | `timestamp` | NOT NULL | -- | When the session expires and becomes invalid |
| `ip_address` | `varchar(45)` | | `NULL` | Client IP address at the time of login (supports IPv6) |
| `user_agent` | `text` | | `NULL` | Browser/client user-agent string at login |
| `impersonated_by` | `varchar(255)` | | `NULL` | If an admin is impersonating this user, stores the admin's identifier |
| `created_at` | `timestamp` | NOT NULL | `NOW()` | When the session was created |
| `updated_at` | `timestamp` | NOT NULL | `NOW()` ON UPDATE CURRENT_TIMESTAMP | Last modification time |

**Foreign Keys:**

- `user_id` -> `users.id`

**Indexes:**

- `session_token_idx` on `token`
- `session_user_id_idx` on `user_id`

---

### account

Better Auth account table. Links users to authentication providers (email/password, OAuth, etc.).

> **Better Auth-managed.** Do not insert, update, or delete rows manually. Better Auth creates account records during registration and OAuth linking.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `int` | PRIMARY KEY, AUTO_INCREMENT | -- | Unique account record identifier |
| `user_id` | `int` | NOT NULL, FK -> `users.id` | -- | The user this account belongs to |
| `account_id` | `varchar(255)` | NOT NULL | -- | Provider-specific account identifier (e.g., the user's ID at the OAuth provider) |
| `provider_id` | `varchar(255)` | NOT NULL | -- | Authentication provider name (e.g., `credential`, `google`, `github`) |
| `access_token` | `text` | | `NULL` | OAuth access token (only for OAuth providers) |
| `refresh_token` | `text` | | `NULL` | OAuth refresh token (only for OAuth providers) |
| `access_token_expires_at` | `timestamp` | | `NULL` | When the access token expires |
| `refresh_token_expires_at` | `timestamp` | | `NULL` | When the refresh token expires |
| `scope` | `text` | | `NULL` | OAuth scopes granted by the provider |
| `id_token` | `text` | | `NULL` | OpenID Connect ID token (JWT) |
| `password` | `text` | | `NULL` | Hashed password (only for the `credential` provider) |
| `created_at` | `timestamp` | NOT NULL | `NOW()` | When the account record was created |
| `updated_at` | `timestamp` | NOT NULL | `NOW()` ON UPDATE CURRENT_TIMESTAMP | Last modification time |

**Foreign Keys:**

- `user_id` -> `users.id`

**Indexes:**

- `account_user_id_idx` on `user_id`
- `account_account_id_idx` on `account_id`

---

### verification

Better Auth verification table. Stores email verification tokens and other one-time-use verification values.

> **Better Auth-managed.** Do not insert, update, or delete rows manually. Better Auth creates verification tokens during email verification and password reset flows, and deletes them after use or expiry.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `int` | PRIMARY KEY, AUTO_INCREMENT | -- | Unique verification record identifier |
| `identifier` | `varchar(255)` | NOT NULL | -- | What is being verified (typically the user's email address) |
| `value` | `varchar(255)` | NOT NULL | -- | The verification token value (opaque string) |
| `expires_at` | `timestamp` | NOT NULL | -- | When this verification token expires |
| `created_at` | `timestamp` | NOT NULL | `NOW()` | When the token was created |
| `updated_at` | `timestamp` | NOT NULL | `NOW()` ON UPDATE CURRENT_TIMESTAMP | Last modification time |

**Indexes:** None (queries by `identifier` column are expected to be low volume).

---

### transactions

Records every financial event: deposits, withdrawals, game wins/losses, bonuses, and admin adjustments.

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `int` | PRIMARY KEY, AUTO_INCREMENT | -- |
| `user_id` | `int` | NOT NULL, FK -> `users.id` | -- |
| `transaction_type` | `enum(...)` | NOT NULL | -- |
| `game_type` | `enum(...)` | | `NULL` |
| `amount` | `decimal(15,2)` | NOT NULL | -- |
| `balance_before` | `decimal(15,2)` | NOT NULL | -- |
| `balance_after` | `decimal(15,2)` | NOT NULL | -- |
| `transaction_status` | `enum(...)` | NOT NULL | `'completed'` |
| `created_by` | `int` | FK -> `users.id` | `NULL` |
| `reference` | `varchar(255)` | | `NULL` |
| `description` | `text` | | `NULL` |
| `game_session_id` | `int` | | `NULL` |
| `metadata` | `json` | | `NULL` |
| `notes` | `json` | | `NULL` |
| `voided_by` | `int` | FK -> `users.id` | `NULL` |
| `voided_reason` | `text` | | `NULL` |
| `voided_at` | `timestamp` | | `NULL` |
| `created_at` | `timestamp` | NOT NULL | `NOW()` |
| `updated_at` | `timestamp` | NOT NULL | `NOW()` ON UPDATE CURRENT_TIMESTAMP |

**Foreign Keys:**

- `user_id` -> `users.id`
- `created_by` -> `users.id`
- `voided_by` -> `users.id`

**Indexes:**

- `transactions_user_id_idx` on `user_id`
- `transactions_type_idx` on `transaction_type`
- `transactions_game_type_idx` on `game_type`
- `transactions_status_idx` on `transaction_status`
- `transactions_amount_idx` on `amount`
- `transactions_created_by_idx` on `created_by`
- `transactions_game_session_id_idx` on `game_session_id`
- `transactions_created_at_idx` on `created_at`
- `idx_transactions_user_type` on (`user_id`, `transaction_type`) -- compound
- `idx_transactions_user_created` on (`user_id`, `created_at`) -- compound
- `idx_transactions_status_created` on (`transaction_status`, `created_at`) -- compound

---

### game_sessions

Tracks individual game rounds from start to completion, including bets and outcomes.

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `int` | PRIMARY KEY, AUTO_INCREMENT | -- |
| `user_id` | `int` | NOT NULL, FK -> `users.id` | -- |
| `game_type` | `enum(...)` | NOT NULL | -- |
| `start_time` | `timestamp` | NOT NULL | `NOW()` |
| `end_time` | `timestamp` | | `NULL` |
| `initial_bet` | `decimal(15,2)` | NOT NULL | -- |
| `total_bet` | `decimal(15,2)` | NOT NULL | -- |
| `outcome` | `decimal(15,2)` | NOT NULL | `'0'` |
| `final_multiplier` | `decimal(10,6)` | | `NULL` |
| `game_state` | `json` | | `NULL` |
| `is_completed` | `boolean` | NOT NULL | `false` |
| `result_details` | `json` | | `NULL` |
| `created_at` | `timestamp` | NOT NULL | `NOW()` |
| `updated_at` | `timestamp` | NOT NULL | `NOW()` ON UPDATE CURRENT_TIMESTAMP |

**Foreign Keys:**

- `user_id` -> `users.id`

**Indexes:**

- `game_sessions_user_id_idx` on `user_id`
- `game_sessions_game_type_idx` on `game_type`
- `game_sessions_start_time_idx` on `start_time`
- `game_sessions_is_completed_idx` on `is_completed`
- `idx_sessions_user_game` on (`user_id`, `game_type`) -- compound
- `idx_sessions_game_completed` on (`game_type`, `is_completed`) -- compound

---

### game_logs

Captures granular events within game sessions for auditing and analytics.

**Important:** The `game_type` and `event_type` columns use `varchar` instead of MySQL ENUM types. This is because `LoggingService` writes system and admin events (not just game events) to this table, which requires values outside the predefined enum sets.

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `int` | PRIMARY KEY, AUTO_INCREMENT | -- |
| `session_id` | `int` | FK -> `game_sessions.id` | `NULL` |
| `user_id` | `int` | FK -> `users.id` | `NULL` |
| `game_type` | `varchar(50)` | NOT NULL | -- |
| `event_type` | `varchar(100)` | NOT NULL | -- |
| `event_details` | `json` | NOT NULL | -- |
| `amount` | `decimal(15,2)` | | `NULL` |
| `timestamp` | `timestamp` | NOT NULL | `NOW()` |
| `metadata` | `json` | | `NULL` |
| `created_at` | `timestamp` | NOT NULL | `NOW()` |
| `updated_at` | `timestamp` | NOT NULL | `NOW()` ON UPDATE CURRENT_TIMESTAMP |

**Foreign Keys:**

- `session_id` -> `game_sessions.id`
- `user_id` -> `users.id`

**Indexes:**

- `game_logs_session_id_idx` on `session_id`
- `game_logs_user_id_idx` on `user_id`
- `game_logs_game_type_idx` on `game_type`
- `game_logs_event_type_idx` on `event_type`
- `game_logs_timestamp_idx` on `timestamp`
- `idx_logs_user_event` on (`user_id`, `event_type`) -- compound
- `idx_logs_game_created` on (`game_type`, `created_at`) -- compound

---

### balances

Maintains a full ledger of every balance change for audit and history purposes.

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `int` | PRIMARY KEY, AUTO_INCREMENT | -- |
| `user_id` | `int` | NOT NULL, FK -> `users.id` | -- |
| `amount` | `decimal(15,2)` | NOT NULL | `'0'` |
| `previous_balance` | `decimal(15,2)` | NOT NULL | -- |
| `change_amount` | `decimal(15,2)` | NOT NULL | -- |
| `balance_type` | `enum(...)` | NOT NULL | -- |
| `game_type` | `enum(...)` | | `NULL` |
| `related_session_id` | `int` | FK -> `game_sessions.id` | `NULL` |
| `transaction_id` | `int` | FK -> `transactions.id` | `NULL` |
| `note` | `text` | | `NULL` |
| `admin_id` | `int` | FK -> `users.id` | `NULL` |
| `created_at` | `timestamp` | NOT NULL | `NOW()` |
| `updated_at` | `timestamp` | NOT NULL | `NOW()` ON UPDATE CURRENT_TIMESTAMP |

**Foreign Keys:**

- `user_id` -> `users.id`
- `related_session_id` -> `game_sessions.id`
- `transaction_id` -> `transactions.id`
- `admin_id` -> `users.id`

**Indexes:**

- `balances_user_id_idx` on `user_id`
- `balances_type_idx` on `balance_type`
- `balances_game_type_idx` on `game_type`
- `balances_related_session_id_idx` on `related_session_id`
- `balances_transaction_id_idx` on `transaction_id`
- `idx_balances_user_created` on (`user_id`, `created_at`) -- compound

---

### game_stats

Aggregated statistics per game type, including rolling 30-day daily breakdowns stored as JSON.

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `int` | PRIMARY KEY, AUTO_INCREMENT | -- |
| `game_type` | `varchar(50)` | NOT NULL, UNIQUE | -- |
| `name` | `varchar(255)` | NOT NULL | -- |
| `total_games_played` | `int` | NOT NULL | `0` |
| `total_bets_amount` | `decimal(20,2)` | NOT NULL | `'0'` |
| `total_winnings_amount` | `decimal(20,2)` | NOT NULL | `'0'` |
| `house_profit` | `decimal(20,2)` | NOT NULL | `'0'` |
| `daily_stats` | `json` | | `NULL` |
| `created_at` | `timestamp` | NOT NULL | `NOW()` |
| `updated_at` | `timestamp` | NOT NULL | `NOW()` ON UPDATE CURRENT_TIMESTAMP |

**Indexes:**

- `game_stats_game_type_idx` on `game_type`

---

### messages

Chat messages sent by users in the global chat system.

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `int` | PRIMARY KEY, AUTO_INCREMENT | -- |
| `content` | `text` | NOT NULL | -- |
| `user_id` | `int` | NOT NULL, FK -> `users.id` | -- |
| `created_at` | `timestamp` | NOT NULL | `NOW()` |

**Foreign Keys:**

- `user_id` -> `users.id`

**Indexes:**

- `messages_user_id_idx` on `user_id`
- `messages_created_at_idx` on `created_at`

---

### login_rewards

Tracks daily login reward claims per user, linking to the corresponding transaction.

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `int` | PRIMARY KEY, AUTO_INCREMENT | -- |
| `user_id` | `int` | NOT NULL, FK -> `users.id` | -- |
| `amount` | `decimal(10,2)` | NOT NULL | -- |
| `transaction_id` | `int` | FK -> `transactions.id` | `NULL` |
| `created_at` | `timestamp` | NOT NULL | `NOW()` |

**Foreign Keys:**

- `user_id` -> `users.id`
- `transaction_id` -> `transactions.id`

**Indexes:**

- `login_rewards_user_id_idx` on `user_id`
- `login_rewards_created_at_idx` on `created_at`

---

## Entity-Relationship Diagram

```mermaid
erDiagram
    users ||--o{ session : "has sessions"
    users ||--o{ account : "has accounts"
    users ||--o{ verification : "has verifications"
    users ||--o{ transactions : "has transactions"
    users ||--o{ game_sessions : plays
    users ||--o{ balances : has
    users ||--o{ messages : sends
    users ||--o{ login_rewards : earns
    users ||--o{ game_logs : generates
    game_sessions ||--o{ game_logs : generates
    game_sessions ||--o{ balances : affects
    transactions }o--|| game_sessions : references
    balances }o--o| transactions : "linked to"
    login_rewards }o--o| transactions : "linked to"

    users {
        int id PK
        varchar name
        varchar email UK
        boolean email_verified
        text image
        varchar username UK
        varchar display_username
        varchar role
        boolean banned
        text ban_reason
        timestamp ban_expires
        text password_hash
        decimal balance
        text avatar
        boolean is_active
        timestamp last_login
        timestamp created_at
        timestamp updated_at
    }

    session {
        int id PK
        varchar token UK
        int user_id FK
        timestamp expires_at
        varchar ip_address
        text user_agent
        varchar impersonated_by
        timestamp created_at
        timestamp updated_at
    }

    account {
        int id PK
        int user_id FK
        varchar account_id
        varchar provider_id
        text access_token
        text refresh_token
        timestamp access_token_expires_at
        timestamp refresh_token_expires_at
        text scope
        text id_token
        text password
        timestamp created_at
        timestamp updated_at
    }

    verification {
        int id PK
        varchar identifier
        varchar value
        timestamp expires_at
        timestamp created_at
        timestamp updated_at
    }

    transactions {
        int id PK
        int user_id FK
        enum transaction_type
        enum game_type
        decimal amount
        decimal balance_before
        decimal balance_after
        enum transaction_status
        int created_by FK
        varchar reference
        text description
        int game_session_id
        json metadata
        json notes
        int voided_by FK
        text voided_reason
        timestamp voided_at
        timestamp created_at
        timestamp updated_at
    }

    game_sessions {
        int id PK
        int user_id FK
        enum game_type
        timestamp start_time
        timestamp end_time
        decimal initial_bet
        decimal total_bet
        decimal outcome
        decimal final_multiplier
        json game_state
        boolean is_completed
        json result_details
        timestamp created_at
        timestamp updated_at
    }

    game_logs {
        int id PK
        int session_id FK
        int user_id FK
        varchar game_type
        varchar event_type
        json event_details
        decimal amount
        timestamp timestamp
        json metadata
        timestamp created_at
        timestamp updated_at
    }

    balances {
        int id PK
        int user_id FK
        decimal amount
        decimal previous_balance
        decimal change_amount
        enum balance_type
        enum game_type
        int related_session_id FK
        int transaction_id FK
        text note
        int admin_id FK
        timestamp created_at
        timestamp updated_at
    }

    game_stats {
        int id PK
        varchar game_type UK
        varchar name
        int total_games_played
        decimal total_bets_amount
        decimal total_winnings_amount
        decimal house_profit
        json daily_stats
        timestamp created_at
        timestamp updated_at
    }

    messages {
        int id PK
        text content
        int user_id FK
        timestamp created_at
    }

    login_rewards {
        int id PK
        int user_id FK
        decimal amount
        int transaction_id FK
        timestamp created_at
    }
```

---

## Drizzle Relations

The schema defines explicit Drizzle relations for type-safe relational queries. Key relationships:

| Source Table | Relation Type | Target Table | Via Column |
|---|---|---|---|
| `users` | has many | `session` | `session.user_id` |
| `users` | has many | `account` | `account.user_id` |
| `users` | has many | `transactions` | `transactions.user_id` |
| `users` | has many | `game_sessions` | `game_sessions.user_id` |
| `users` | has many | `game_logs` | `game_logs.user_id` |
| `users` | has many | `balances` | `balances.user_id` |
| `users` | has many | `messages` | `messages.user_id` |
| `users` | has many | `login_rewards` | `login_rewards.user_id` |
| `session` | belongs to | `users` | `session.user_id` |
| `account` | belongs to | `users` | `account.user_id` |
| `transactions` | belongs to | `users` | `transactions.user_id` |
| `transactions` | belongs to | `users` (created by) | `transactions.created_by` |
| `transactions` | belongs to | `users` (voided by) | `transactions.voided_by` |
| `transactions` | belongs to | `game_sessions` | `transactions.game_session_id` |
| `game_sessions` | belongs to | `users` | `game_sessions.user_id` |
| `game_sessions` | has many | `transactions` | `transactions.game_session_id` |
| `game_sessions` | has many | `game_logs` | `game_logs.session_id` |
| `game_sessions` | has many | `balances` | `balances.related_session_id` |
| `game_logs` | belongs to | `users` | `game_logs.user_id` |
| `game_logs` | belongs to | `game_sessions` | `game_logs.session_id` |
| `balances` | belongs to | `users` | `balances.user_id` |
| `balances` | belongs to | `users` (admin) | `balances.admin_id` |
| `balances` | belongs to | `game_sessions` | `balances.related_session_id` |
| `balances` | belongs to | `transactions` | `balances.transaction_id` |
| `login_rewards` | belongs to | `users` | `login_rewards.user_id` |
| `login_rewards` | belongs to | `transactions` | `login_rewards.transaction_id` |
| `messages` | belongs to | `users` | `messages.user_id` |

---

## TypeScript Types

The schema exports inferred types for both selecting and inserting records. These are generated by Drizzle's `InferSelectModel` and `InferInsertModel` utilities:

```typescript
// Select types (full row shape returned from queries)
export type User = InferSelectModel<typeof users>;
export type Transaction = InferSelectModel<typeof transactions>;
export type GameSession = InferSelectModel<typeof gameSessions>;
export type GameLog = InferSelectModel<typeof gameLogs>;
export type Balance = InferSelectModel<typeof balances>;
export type GameStat = InferSelectModel<typeof gameStats>;
export type Message = InferSelectModel<typeof messages>;
export type LoginReward = InferSelectModel<typeof loginRewards>;
export type Session = InferSelectModel<typeof session>;
export type Account = InferSelectModel<typeof account>;
export type Verification = InferSelectModel<typeof verification>;

// Insert types (shape for creating new records; auto-generated and default columns are optional)
export type NewUser = InferInsertModel<typeof users>;
export type NewTransaction = InferInsertModel<typeof transactions>;
export type NewGameSession = InferInsertModel<typeof gameSessions>;
export type NewGameLog = InferInsertModel<typeof gameLogs>;
export type NewBalance = InferInsertModel<typeof balances>;
export type NewGameStat = InferInsertModel<typeof gameStats>;
export type NewMessage = InferInsertModel<typeof messages>;
export type NewLoginReward = InferInsertModel<typeof loginRewards>;
export type NewSession = InferInsertModel<typeof session>;
export type NewAccount = InferInsertModel<typeof account>;
export type NewVerification = InferInsertModel<typeof verification>;
```

Import from the schema module:

```typescript
import { type User, type NewUser, type Session, type Account } from '../drizzle/schema.js';
```

---

## Related Documents

- [Migrations](./migrations.md) -- migration history that built this schema
- [Data Models](./data-models.md) -- ORM model classes that operate on these tables
- [Testing Strategy](../08-testing/testing-strategy.md) -- planned tests for database operations
- [Better Auth Integration](../13-integrations/better-auth-integration.md) -- how Better Auth is configured, its session/account/verification table lifecycle, and plugin setup
