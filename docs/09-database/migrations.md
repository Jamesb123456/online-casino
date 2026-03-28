# Database Migrations

## Overview

Database migrations are managed by **Drizzle Kit** (`drizzle-kit ^0.23.0`). The configuration lives in `server/drizzle.config.js` and points to the schema source and migration output directory:

```javascript
export default defineConfig({
  schema: './drizzle/schema.js',
  out: './drizzle/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/casino',
  },
  verbose: true,
  strict: true,
});
```

Migration SQL files are stored in `server/drizzle/migrations/` and tracked by a journal file at `server/drizzle/migrations/meta/_journal.json`.

---

## Commands

All commands are run from the `server/` directory:

```bash
# Generate a new migration from schema changes
npm run db:generate

# Apply pending migrations to the database
npm run db:migrate

# Push schema directly to the database (skips migration files; useful for development)
npm run db:push
```

These map to the underlying Drizzle Kit CLI commands:

| npm script | Drizzle Kit command | Purpose |
|---|---|---|
| `db:generate` | `drizzle-kit generate` | Diffs the TypeScript schema against the last snapshot and produces a new `.sql` migration file |
| `db:migrate` | `drizzle-kit migrate` | Runs all unapplied migration files against the target database in order |
| `db:push` | `drizzle-kit push` | Pushes the current schema state directly to the database without generating migration files |

---

## Migration Journal

The journal at `server/drizzle/migrations/meta/_journal.json` tracks which migrations exist and their order. Current state:

```json
{
  "version": "7",
  "dialect": "mysql",
  "entries": [
    {
      "idx": 0,
      "version": "5",
      "when": 1750783481053,
      "tag": "0000_fancy_bug",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "5",
      "when": 1750786532169,
      "tag": "0001_dapper_mandrill",
      "breakpoints": true
    },
    {
      "idx": 2,
      "version": "5",
      "when": 1750800298267,
      "tag": "0002_bent_imperial_guard",
      "breakpoints": true
    }
  ]
}
```

---

## Migration History

### 0000_fancy_bug -- Initial Schema

**File:** `server/drizzle/migrations/0000_fancy_bug.sql`

This migration creates the entire initial database schema. It was generated when the project migrated from MongoDB to MySQL with Drizzle ORM.

**Tables created:**

- `users` -- user accounts with username, password hash, role, balance, avatar, and activity tracking
- `transactions` -- financial event log with type, amount, balance snapshots, status, voiding support, and JSON metadata/notes
- `game_sessions` -- individual game rounds with bet amounts, outcome, multiplier, game state, and completion tracking
- `game_logs` -- granular event logging within game sessions (bets placed, results, cashouts, errors)
- `balances` -- balance change ledger with previous/current amounts, change type, and links to sessions and transactions
- `game_stats` -- aggregated per-game-type statistics with daily stats stored as JSON
- `messages` -- chat messages with user references

**Foreign keys established:**

- `balances.user_id` -> `users.id`
- `balances.related_session_id` -> `game_sessions.id`
- `balances.transaction_id` -> `transactions.id`
- `balances.admin_id` -> `users.id`
- `game_logs.session_id` -> `game_sessions.id`
- `game_logs.user_id` -> `users.id`
- `game_sessions.user_id` -> `users.id`
- `messages.user_id` -> `users.id`
- `transactions.user_id` -> `users.id`
- `transactions.created_by` -> `users.id`
- `transactions.voided_by` -> `users.id`

**Indexes created:** 28 indexes across all tables covering foreign keys, enum columns, timestamps, and frequently queried fields.

**Notes:**
- In this initial migration, primary keys used `varchar(36)` (UUID format) and the `users` table included an `email` column.
- The `balances` table column for type was named `balance_type`, and `transactions` used `transaction_type` and `transaction_status` as column names.

---

### 0001_dapper_mandrill -- UUID to Auto-Increment Migration

**File:** `server/drizzle/migrations/0001_dapper_mandrill.sql`

This migration converts all primary key and foreign key columns from `varchar(36)` (UUIDs) to `int AUTO_INCREMENT`. This change improves join performance, reduces storage overhead, and simplifies ID handling throughout the application.

**Columns modified:**

| Table | Columns Changed |
|---|---|
| `users` | `id` |
| `transactions` | `id`, `user_id`, `created_by`, `game_session_id`, `voided_by` |
| `game_sessions` | `id`, `user_id` |
| `game_logs` | `id`, `session_id`, `user_id` |
| `game_stats` | `id` |
| `balances` | `id`, `user_id`, `related_session_id`, `transaction_id`, `admin_id` |
| `messages` | `id`, `user_id` |

---

### 0002_bent_imperial_guard -- Remove Email Column

**File:** `server/drizzle/migrations/0002_bent_imperial_guard.sql`

This migration removes the `email` column from the `users` table. The platform uses usernames as the sole identifier and does not require email addresses for registration or account recovery.

**SQL:**

```sql
ALTER TABLE `users` DROP COLUMN `email`;
```

---

## Creating a New Migration

When you modify `server/drizzle/schema.ts`, follow these steps:

1. Make your changes to the schema file.
2. Run `npm run db:generate` from the `server/` directory. Drizzle Kit will diff your schema against the last known state and produce a new `.sql` file in `server/drizzle/migrations/`.
3. Review the generated SQL to confirm it matches your intent.
4. Run `npm run db:migrate` to apply the migration to your database.
5. Commit both the schema change and the generated migration file.

For development-only changes where you do not need a migration file, use `npm run db:push` to sync the schema directly.

---

## Related Documents

- [Database Schema](./schema.md) -- current table definitions and column details
- [Data Models](./data-models.md) -- ORM model classes that depend on this schema
- [Testing Strategy](../08-testing/testing-strategy.md) -- planned integration tests for database operations
