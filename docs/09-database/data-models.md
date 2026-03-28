# Data Models (ORM)

## Overview

The application uses a model-per-table pattern with static class methods that wrap Drizzle ORM queries. Each model file lives in `server/drizzle/models/` and provides CRUD operations plus domain-specific query methods. Models import the shared `db` instance from `server/drizzle/db.ts` and table/type definitions from `server/drizzle/schema.ts`.

All models except `LoginRewardModel` use the `@ts-nocheck` directive at the top of the file, indicating the TypeScript types are not fully enforced in the model layer.

---

## Summary Table -- All Models and Methods

| Model | Method | Parameters | Return Type | Purpose |
|---|---|---|---|---|
| **UserModel** | `create` | `userData: Partial<NewUser>` | `Promise<User>` | Create user with auto-hashed password |
| | `findById` | `id: number` | `Promise<User \| null>` | Find user by primary key |
| | `findOne` | `filter: { username?, role? }` | `Promise<User \| null>` | Find user by criteria |
| | `updateById` | `id: number, updateData: Partial<NewUser>` | `Promise<User>` | Update user with auto-hashed password |
| | `update` | `id: number, updateData: Partial<NewUser>` | `Promise<User>` | Alias for `updateById` |
| | `comparePassword` | `candidatePassword: string, hashedPassword: string` | `Promise<boolean>` | Compare plaintext against bcrypt hash |
| | `findByIdSecure` | `id: number` | `Promise<Omit<User, 'passwordHash'> \| null>` | Find user excluding password hash |
| | `updateLastLogin` | `id: number` | `Promise<User>` | Set lastLogin to now |
| | `delete` | `id: number` | `Promise<User>` | Delete user and return deleted record |
| | `find` | `filter?: { role? }, options?: { limit?, offset? }` | `Promise<Omit<User, 'passwordHash'>[]>` | List users with filter and pagination |
| | `findAll` | `limit?: number, offset?: number` | `Promise<Omit<User, 'passwordHash'>[]>` | Alias for `find({})` |
| **TransactionModel** | `create` | `transactionData: any` | `Promise<Transaction>` | Create a transaction record |
| | `findById` | `id: number` | `Promise<Transaction \| null>` | Find transaction by primary key |
| | `findByIdWithUser` | `id: number` | `Promise<Transaction & { createdByUsername } \| null>` | Find transaction with creator username |
| | `getUserTransactionHistory` | `userId: number, limit?: number, offset?: number` | `Promise<Transaction[]>` | Paginated user transaction history |
| | `getTransactionStatsByDate` | `startDate?: string, endDate?: string` | `Promise<{ type, count, totalAmount }[]>` | Aggregate stats by type in date range |
| | `update` | `id: number, updateData: any` | `Promise<Transaction>` | Update transaction by ID |
| | `voidTransaction` | `id: number, adminId: number, reason: string` | `Promise<Transaction>` | Void a transaction with audit trail |
| | `findMany` | `filter?: TransactionFilter, limit?: number, offset?: number` | `Promise<Transaction[]>` | Filter by userId/type/gameType/status |
| | `delete` | `id: number` | `Promise<{ id, deleted }>` | Delete a transaction |
| | `addNote` | `id: number, noteText: string, addedBy: number` | `Promise<Transaction>` | Append note to JSON notes array |
| | `getUserTransactions` | `userId: number` | `Promise<Transaction[]>` | All user transactions with creator name |
| | `getTransactionsWithDetails` | (none) | `Promise<Transaction[]>` | All transactions with creator and voider names |
| | `findOne` | `conditions: Record<string, any>` | `Promise<Transaction \| null>` | Find one by multiple conditions |
| | `find` | `conditions?: Record<string, any>, options?: QueryOptions` | `Promise<Transaction[]>` | Advanced query with joins and filters |
| | `updateById` | `id: number, updateData: any` | `Promise<Transaction \| null>` | Update by ID (alternate) |
| | `deleteById` | `id: number` | `Promise<Transaction \| null>` | Delete and return deleted record |
| **GameSessionModel** | `create` | `sessionData: any` | `Promise<GameSession>` | Create session; copies initialBet to totalBet |
| | `findById` | `id: any` | `Promise<GameSession \| null>` | Find session by primary key |
| | `findByUserId` | `userId: any, limit?: number, offset?: number` | `Promise<GameSession[]>` | Paginated sessions for a user |
| | `update` | `id: any, updateData: any` | `Promise<GameSession>` | Update session by ID |
| | `calculateProfit` | `session: any` | `number` | Compute outcome minus totalBet |
| | `getGameStats` | `gameType: any, startDate?: any, endDate?: any` | `Promise<{ gameType, totalSessions, totalBets, totalOutcome, houseEdge, avgBet, profit }>` | Aggregate stats for a game type |
| | `getActiveSessions` | `gameType?: any` | `Promise<GameSession[]>` | Get incomplete sessions |
| | `completeSession` | `id: any, outcome: any, finalMultiplier?: any, resultDetails?: any` | `Promise<GameSession>` | Mark session complete |
| | `findByGameType` | `gameType: any, limit?: number, offset?: number` | `Promise<GameSession[]>` | Paginated sessions by game type |
| | `delete` | `id: any` | `Promise<GameSession>` | Delete session by ID |
| | `findWithUserDetails` | `limit?: number, offset?: number` | `Promise<(GameSession & { username })[]>` | Sessions joined with player username |
| | `findByDateRange` | `startDate: any, endDate: any, gameType?: any` | `Promise<GameSession[]>` | Sessions in a date range |
| **GameLogModel** | `create` | `logData: any` | `Promise<GameLog>` | Create a log entry |
| | `findById` | `id: any` | `Promise<GameLog \| null>` | Find log by primary key |
| | `getRecentUserLogs` | `userId: any, limit?: number` | `Promise<GameLog[]>` | Recent logs for a user with session details |
| | `getLogsByGameType` | `gameType: any, limit?: number` | `Promise<GameLog[]>` | Logs by game type with username |
| | `searchByDateRange` | `startDate, endDate, gameType?, eventType?, limit?` | `Promise<GameLog[]>` | Logs in date range with user and session joins |
| | `findBySessionId` | `sessionId: any, limit?: number` | `Promise<GameLog[]>` | Logs for a specific session |
| | `findByEventType` | `eventType: any, limit?: number, offset?: number` | `Promise<GameLog[]>` | Logs by event type with pagination |
| | `update` | `id: any, updateData: any` | `Promise<GameLog>` | Update log entry |
| | `delete` | `id: any` | `Promise<GameLog>` | Delete log entry |
| | `findWithDetails` | `limit?: number, offset?: number` | `Promise<GameLog[]>` | Logs with user and session details |
| | `getLogCount` | `gameType?, eventType?, userId?` | `Promise<number>` | Count logs matching criteria |
| | `getEventStats` | `gameType?: any` | `Promise<{ eventType, count, totalAmount }[]>` | Event aggregates by type |
| | `getUserLogs` | `userId: any` | `Promise<GameLog[]>` | All logs for a user |
| | `getGameTypeLogs` | `gameType: any` | `Promise<GameLog[]>` | All logs for a game type with usernames |
| | `getLogsWithFilters` | `filters?: object` | `Promise<GameLog[]>` | Flexible query with regex and date ranges |
| | `findOne` | `conditions: any` | `Promise<GameLog \| null>` | Find single log by conditions |
| | `find` | `conditions?: any` | `Promise<GameLog[]>` | Find logs with date range support |
| | `save` (instance) | (none) | `Promise<GameLog>` | Insert or update based on `this.id` |
| **GameStatModel** | `create` | `statData: any` | `Promise<GameStat>` | Create a stat record |
| | `findById` | `id: any` | `Promise<GameStat \| null>` | Find stat by ID; parses dailyStats JSON |
| | `findByGameType` | `gameType: any` | `Promise<GameStat \| null>` | Find stat by game type; parses dailyStats |
| | `findAll` | (none) | `Promise<GameStat[]>` | Get all stat records |
| | `updateStats` | `gameType: any, betAmount: number, winAmount: number` | `Promise<void>` | Increment totals after each game round |
| | `update` | `id: any, updateData: any` | `Promise<GameStat>` | Update stat by ID |
| | `updateByGameType` | `gameType: any, updateData: any` | `Promise<GameStat>` | Update stat by game type |
| | `delete` | `id: any` | `Promise<GameStat>` | Delete stat record |
| | `initializeAllGameTypes` | (none) | `Promise<GameStat[]>` | Seed stats for all 7 game types |
| | `getStatsSummary` | (none) | `Promise<{ totalGames, totalBets, totalWinnings, totalProfit, gameCount, averageBetPerGame, houseEdgePercentage }>` | Cross-game aggregate summary |
| | `getDailyStats` | `gameType: any, days?: number` | `Promise<DailyStat[]>` | Recent N daily stat entries |
| **BalanceModel** | `create` | `balanceData: any` | `Promise<Balance>` | Create a balance ledger entry |
| | `findById` | `id: any` | `Promise<Balance \| null>` | Find balance record by ID |
| | `getCurrentBalance` | `userId: any` | `Promise<number>` | Latest balance amount for a user |
| | `getBalanceHistory` | `userId: any, limit?: number` | `Promise<Balance[]>` | Balance history with admin and transaction details |
| | `findByUserId` | `userId: any, limit?: number, offset?: number` | `Promise<Balance[]>` | Paginated balances for a user |
| | `isPositiveChange` | `balance: any` | `boolean` | Check if changeAmount > 0 |
| | `update` | `id: any, updateData: any` | `Promise<Balance>` | Update balance record |
| | `delete` | `id: any` | `Promise<Balance>` | Delete and return balance record |
| | `findWithDetails` | `userId?: any, limit?: number, offset?: number` | `Promise<Balance[]>` | Balances joined with user details |
| | `findByType` | `type: any, userId?: any, limit?: number` | `Promise<Balance[]>` | Balances by type (win, loss, etc.) |
| | `findByGameType` | `gameType: any, userId?: any, limit?: number` | `Promise<Balance[]>` | Balances by game type |
| | `getBalanceStats` | `userId: any` | `Promise<{ totalWins, totalLosses, totalDeposits, totalWithdrawals, netProfit }>` | Aggregate balance stats for a user |
| | `getLatestBalance` | `userId: any` | `Promise<Balance \| null>` | Most recent balance record |
| | `findByUserIdAndType` | `userId: any, type: any` | `Promise<Balance \| null>` | Single balance by user and type |
| | `findAll` | (none) | `Promise<Balance[]>` | All balance records |
| **MessageModel** | `create` | `data: any` | `Promise<Message>` | Create a chat message |
| | `findById` | `id: any` | `Promise<Message \| null>` | Find message by ID with user details |
| | `findByIdWithUser` | `id: any` | `Promise<Message \| null>` | Find message with username and avatar |
| | `getRecentMessages` | `limit?: number` | `Promise<Message[]>` | Recent messages with user details |
| | `findByUserId` | `userId: any, limit?: number, offset?: number` | `Promise<Message[]>` | Paginated messages for a user |
| | `findWithPagination` | `limit?: number, offset?: number` | `Promise<Message[]>` | Paginated messages with user details |
| | `update` | `id: any, updateData: any` | `Promise<Message>` | Update message content |
| | `delete` | `id: any` | `Promise<Message>` | Delete message (throws if not found) |
| | `deleteByUserId` | `userId: any` | `Promise<Message[]>` | Delete all messages by a user |
| | `getMessageCount` | (none) | `Promise<number>` | Total message count |
| | `getUserMessageCount` | `userId: any` | `Promise<number>` | Message count for a user |
| | `findAll` | `limit?: number` | `Promise<Message[]>` | All messages with user details |
| | `searchByContent` | `searchTerm: any, limit?: number` | `Promise<Message[]>` | Search by content substring |
| | `find` | `conditions?: any` | `Promise<Message[]>` | Flexible query with date range support |
| | `findOne` | `conditions: any` | `Promise<Message \| null>` | Single message matching conditions |
| | `save` (instance) | (none) | `Promise<Message>` | Insert or update based on `this.id` |
| **LoginRewardModel** | `create` | `rewardData: { userId: number, amount: number \| string, transactionId?: number }` | `Promise<LoginReward>` | Create login reward record |
| | `hasClaimedToday` | `userId: number` | `Promise<boolean>` | Check if user claimed today |
| | `getHistoryByUserId` | `userId: number, limit?: number` | `Promise<LoginReward[]>` | Reward history for a user |
| | `getTotalRewardsByUserId` | `userId: number` | `Promise<number>` | Sum of all user rewards |
| | `getTotalRewardsToday` | (none) | `Promise<number>` | Sum of all rewards today |
| | `generateRewardAmount` | (none) | `number` | Random integer 0--100 |

---

## Model Files

| Model File | Table | Primary Import |
|---|---|---|
| `User.ts` | `users` | `UserModel` |
| `Transaction.ts` | `transactions` | `TransactionModel` |
| `GameSession.ts` | `game_sessions` | `GameSessionModel` |
| `GameLog.ts` | `game_logs` | `GameLogModel` |
| `GameStat.ts` | `game_stats` | `GameStatModel` |
| `Balance.ts` | `balances` | `BalanceModel` |
| `Message.ts` | `messages` | `MessageModel` |
| `LoginReward.ts` | `login_rewards` | `LoginRewardModel` |

---

## UserModel

**File:** `server/drizzle/models/User.ts`

Manages user accounts. Handles password hashing via `bcryptjs` internally on create and update operations.

### Methods

---

#### `create(userData)`

| | |
|---|---|
| **Parameters** | `userData: Partial<NewUser>` -- user data object. If `passwordHash` is included, it is treated as a plaintext password and hashed with bcrypt (salt rounds: 10) before insertion. |
| **Return type** | `Promise<User>` |
| **SQL generated** | `INSERT INTO users (..., created_at, updated_at) VALUES (...)` followed by `SELECT * FROM users WHERE id = <insertId>` |
| **Notes** | The field name `passwordHash` is misleading at call time: callers pass the raw password and this method hashes it. Timestamps `createdAt` and `updatedAt` are set to `new Date()` at insert time. |

**Usage example:**

```ts
const user = await UserModel.create({
  username: 'alice',
  passwordHash: 'plaintext-password-here',
  role: 'user',
});
```

---

#### `findById(id)`

| | |
|---|---|
| **Parameters** | `id: number` -- user primary key |
| **Return type** | `Promise<User \| null>` |
| **SQL generated** | `SELECT * FROM users WHERE id = ?` |
| **Notes** | Returns the full user record including `passwordHash`. Use `findByIdSecure` when exposing data to clients. |

**Usage example:**

```ts
const user = await UserModel.findById(42);
```

---

#### `findOne(filter)`

| | |
|---|---|
| **Parameters** | `filter: { username?: string; role?: 'user' \| 'admin' }` -- at least one field required |
| **Return type** | `Promise<User \| null>` |
| **SQL generated** | `SELECT * FROM users WHERE username = ?` (or `WHERE role = ?`) |
| **Notes** | Only applies the **first** condition found, even if both `username` and `role` are provided. Throws if no filter conditions are given. |

**Usage example:**

```ts
const user = await UserModel.findOne({ username: 'alice' });
```

---

#### `updateById(id, updateData)`

| | |
|---|---|
| **Parameters** | `id: number` -- user ID; `updateData: Partial<NewUser>` -- fields to update |
| **Return type** | `Promise<User>` |
| **SQL generated** | `UPDATE users SET ..., updated_at = ? WHERE id = ?` followed by `SELECT * FROM users WHERE id = ?` |
| **Notes** | If `passwordHash` is included in `updateData`, it is treated as a new plaintext password and re-hashed with bcrypt before saving. Always sets `updatedAt` to `new Date()`. |

**Usage example:**

```ts
const updated = await UserModel.updateById(42, { balance: '1500.00' });
```

---

#### `update(id, updateData)`

| | |
|---|---|
| **Parameters** | Same as `updateById` |
| **Return type** | `Promise<User>` |
| **SQL generated** | Delegates to `updateById` |
| **Notes** | This is an alias for `updateById`. |

---

#### `comparePassword(candidatePassword, hashedPassword)`

| | |
|---|---|
| **Parameters** | `candidatePassword: string` -- plaintext password to check; `hashedPassword: string` -- bcrypt hash to compare against |
| **Return type** | `Promise<boolean>` |
| **SQL generated** | None -- pure bcrypt comparison |
| **Notes** | Uses `bcrypt.compare()`. This is a static utility method; it does not touch the database. |

**Usage example:**

```ts
const isValid = await UserModel.comparePassword('my-password', user.passwordHash);
```

---

#### `findByIdSecure(id)`

| | |
|---|---|
| **Parameters** | `id: number` -- user primary key |
| **Return type** | `Promise<Omit<User, 'passwordHash'> \| null>` |
| **SQL generated** | `SELECT id, username, role, balance, avatar, is_active, last_login, created_at, updated_at FROM users WHERE id = ?` |
| **Notes** | Explicitly selects only safe columns -- `passwordHash` is never fetched. Use this for any response sent to the client. |

**Usage example:**

```ts
const safeUser = await UserModel.findByIdSecure(42);
// safeUser.passwordHash is undefined
```

---

#### `updateLastLogin(id)`

| | |
|---|---|
| **Parameters** | `id: number` -- user primary key |
| **Return type** | `Promise<User>` |
| **SQL generated** | `UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?` followed by `SELECT * FROM users WHERE id = ?` |
| **Notes** | Sets both `lastLogin` and `updatedAt` to the current timestamp. |

**Usage example:**

```ts
const user = await UserModel.updateLastLogin(42);
```

---

#### `delete(id)`

| | |
|---|---|
| **Parameters** | `id: number` -- user primary key |
| **Return type** | `Promise<User>` |
| **SQL generated** | `SELECT * FROM users WHERE id = ?` followed by `DELETE FROM users WHERE id = ?` |
| **Notes** | Fetches the user before deleting it so the deleted record can be returned. Does not cascade-delete related records; foreign key constraints in the schema will determine behavior. |

**Usage example:**

```ts
const deletedUser = await UserModel.delete(42);
```

---

#### `find(filter, options)`

| | |
|---|---|
| **Parameters** | `filter?: { role?: 'user' \| 'admin' }` (default `{}`); `options?: { limit?: number; offset?: number }` (default `{}`) |
| **Return type** | `Promise<Omit<User, 'passwordHash'>[]>` |
| **SQL generated** | `SELECT id, username, role, balance, avatar, is_active, last_login, created_at, updated_at FROM users [WHERE role = ?] ORDER BY created_at DESC [LIMIT ? OFFSET ?]` |
| **Notes** | Excludes `passwordHash` from the select list. Results are sorted by `createdAt` descending. |

**Usage example:**

```ts
const admins = await UserModel.find({ role: 'admin' }, { limit: 10, offset: 0 });
```

---

#### `findAll(limit, offset)`

| | |
|---|---|
| **Parameters** | `limit?: number` (default `50`); `offset?: number` (default `0`) |
| **Return type** | `Promise<Omit<User, 'passwordHash'>[]>` |
| **SQL generated** | Delegates to `find({}, { limit, offset })` |
| **Notes** | Convenience alias for listing all users with pagination. |

**Usage example:**

```ts
const users = await UserModel.findAll(20, 0);
```

---

### Usage by Services

- **Auth service:** `create`, `findOne` (by username), `comparePassword`, `updateLastLogin`
- **Admin service:** `find`, `findAll`, `updateById`, `delete`, `findByIdSecure`
- **Profile service:** `findByIdSecure`, `update`

---

## TransactionModel

**File:** `server/drizzle/models/Transaction.ts`

Manages financial transaction records. Supports filtering, voiding, note management, and joined queries with user details. Defines the following local interfaces:

```ts
interface TransactionFilter {
  userId?: number;
  type?: 'deposit' | 'withdrawal' | 'game_win' | 'game_loss' | 'admin_adjustment' | 'bonus';
  gameType?: 'crash' | 'plinko' | 'wheel' | 'roulette' | 'blackjack';
  status?: 'pending' | 'completed' | 'failed' | 'voided' | 'processing';
}

interface QueryOptions {
  populate?: string[];       // 'userId' and/or 'createdBy' to LEFT JOIN users
  sort?: { createdAt?: -1 | 1 };
  limit?: number;
}
```

### Methods

---

#### `create(transactionData)`

| | |
|---|---|
| **Parameters** | `transactionData: any` -- object with fields matching the `transactions` table schema |
| **Return type** | `Promise<Transaction>` |
| **SQL generated** | `INSERT INTO transactions (..., created_at, updated_at) VALUES (...)` followed by `SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1` |
| **Notes** | Retrieves the inserted record by querying the most recent transaction for the user rather than using `insertId`, which can be unreliable in some edge cases. |

**Usage example:**

```ts
const tx = await TransactionModel.create({
  userId: 1,
  type: 'game_win',
  amount: '50.00',
  balanceBefore: '100.00',
  balanceAfter: '150.00',
  status: 'completed',
  description: 'Crash game win',
});
```

---

#### `findById(id)`

| | |
|---|---|
| **Parameters** | `id: number` -- transaction primary key |
| **Return type** | `Promise<Transaction \| null>` |
| **SQL generated** | `SELECT * FROM transactions WHERE id = ?` |

**Usage example:**

```ts
const tx = await TransactionModel.findById(203);
```

---

#### `findByIdWithUser(id)`

| | |
|---|---|
| **Parameters** | `id: number` -- transaction primary key |
| **Return type** | `Promise<(Transaction & { createdByUsername: string }) \| null>` |
| **SQL generated** | `SELECT t.*, u.username AS created_by_username FROM transactions t LEFT JOIN users u ON t.created_by = u.id WHERE t.id = ?` |
| **Notes** | Joins with `users` on `createdBy` to include the admin/creator username. |

**Usage example:**

```ts
const tx = await TransactionModel.findByIdWithUser(203);
console.log(tx.createdByUsername); // 'admin1'
```

---

#### `getUserTransactionHistory(userId, limit, offset)`

| | |
|---|---|
| **Parameters** | `userId: number`; `limit: number` (default `50`); `offset: number` (default `0`) |
| **Return type** | `Promise<Transaction[]>` (with `createdByUsername` field added) |
| **SQL generated** | `SELECT t.id, t.type, ..., u.username AS created_by_username FROM transactions t LEFT JOIN users u ON t.created_by = u.id WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT ? OFFSET ?` |
| **Notes** | Returns a subset of transaction fields (excludes `userId` itself) plus the creator username. |

**Usage example:**

```ts
const history = await TransactionModel.getUserTransactionHistory(1, 20, 0);
```

---

#### `getTransactionStatsByDate(startDate, endDate)`

| | |
|---|---|
| **Parameters** | `startDate?: string` -- ISO date string; `endDate?: string` -- ISO date string. Both optional. |
| **Return type** | `Promise<{ type: string, count: number, totalAmount: number }[]>` |
| **SQL generated** | `SELECT type, amount FROM transactions [WHERE created_at >= ? AND created_at <= ?]` |
| **Notes** | Fetches raw rows and groups them in JavaScript using `Array.reduce()`. This approach was chosen because Drizzle ORM does not have direct aggregation grouping like Mongoose (as noted in the source code comments). Returns one object per transaction type with `count` and `totalAmount`. |

**Usage example:**

```ts
const stats = await TransactionModel.getTransactionStatsByDate('2025-01-01', '2025-01-31');
// [ { type: 'game_win', count: 150, totalAmount: 7500.50 }, ... ]
```

---

#### `update(id, updateData)`

| | |
|---|---|
| **Parameters** | `id: number`; `updateData: any` |
| **Return type** | `Promise<Transaction>` |
| **SQL generated** | `UPDATE transactions SET ..., updated_at = ? WHERE id = ?` followed by `SELECT * FROM transactions WHERE id = ?` |

**Usage example:**

```ts
const updated = await TransactionModel.update(203, { status: 'completed' });
```

---

#### `voidTransaction(id, adminId, reason)`

| | |
|---|---|
| **Parameters** | `id: number` -- transaction ID; `adminId: number` -- admin user who is voiding; `reason: string` -- reason for voiding |
| **Return type** | `Promise<Transaction>` |
| **SQL generated** | `SELECT * FROM transactions WHERE id = ?` (to verify existence and current status), then `UPDATE transactions SET status = 'voided', voided_by = ?, voided_reason = ?, voided_at = ?, notes = ?, updated_at = ? WHERE id = ?`, then `SELECT * FROM transactions WHERE id = ?` |
| **Notes** | Throws if the transaction does not exist or is already voided. Appends a timestamped audit note to the JSON `notes` array: `{ text: "Transaction voided: <reason>", addedBy: <adminId>, timestamp: <now> }`. This method does **not** reverse the balance change -- the caller is responsible for adjusting the user's balance. |

**Usage example:**

```ts
const voided = await TransactionModel.voidTransaction(203, 1, 'Duplicate entry');
```

---

#### `findMany(filter, limit, offset)`

| | |
|---|---|
| **Parameters** | `filter?: TransactionFilter` (default `{}`); `limit?: number` (default `50`); `offset?: number` (default `0`) |
| **Return type** | `Promise<Transaction[]>` |
| **SQL generated** | `SELECT * FROM transactions [WHERE user_id = ? AND type = ? AND game_type = ? AND status = ?] ORDER BY created_at DESC LIMIT ? OFFSET ?` |
| **Notes** | Applies each filter condition independently. Multiple conditions are applied sequentially using `.where()` chaining rather than `AND` -- be aware this may produce unexpected behavior with multiple filters (each `.where()` call replaces the previous one in Drizzle). |

**Usage example:**

```ts
const pending = await TransactionModel.findMany({ status: 'pending' }, 10, 0);
```

---

#### `delete(id)`

| | |
|---|---|
| **Parameters** | `id: number` |
| **Return type** | `Promise<{ id: number, deleted: true }>` |
| **SQL generated** | `DELETE FROM transactions WHERE id = ?` |
| **Notes** | Does not fetch the record before deletion. Returns a simple confirmation object. |

---

#### `addNote(id, noteText, addedBy)`

| | |
|---|---|
| **Parameters** | `id: number` -- transaction ID; `noteText: string` -- note content; `addedBy: number` -- user ID who wrote the note |
| **Return type** | `Promise<Transaction>` |
| **SQL generated** | `SELECT * FROM transactions WHERE id = ?`, then `UPDATE transactions SET notes = ?, updated_at = ? WHERE id = ?`, then `SELECT * FROM transactions WHERE id = ?` |
| **Notes** | Appends a `{ text, addedBy, timestamp }` object to the existing JSON `notes` array. Throws if the transaction is not found. |

**Usage example:**

```ts
const updated = await TransactionModel.addNote(203, 'Reviewed and approved', 1);
```

---

#### `getUserTransactions(userId)`

| | |
|---|---|
| **Parameters** | `userId: number` |
| **Return type** | `Promise<Transaction[]>` (with `createdByUsername` field) |
| **SQL generated** | `SELECT t.id, t.user_id, t.type, t.amount, t.status, t.description, t.game_type, t.created_at, u.username AS created_by_username FROM transactions t LEFT JOIN users u ON t.created_by = u.id WHERE t.user_id = ? ORDER BY t.created_at DESC` |
| **Notes** | Returns all transactions for a user (no pagination). Selects a smaller set of fields than `findById`. |

---

#### `getTransactionsWithDetails()`

| | |
|---|---|
| **Parameters** | (none) |
| **Return type** | `Promise<Transaction[]>` (with `createdByUsername` and `voidedByUsername` fields) |
| **SQL generated** | `SELECT t.id, ..., cbu.username AS created_by_username, vbu.username AS voided_by_username FROM transactions t LEFT JOIN users cbu ON t.created_by = cbu.id LEFT JOIN users vbu ON t.voided_by = vbu.id ORDER BY t.created_at DESC` |
| **Notes** | Uses Drizzle `alias()` to join the `users` table twice -- once for `createdBy` and once for `voidedBy`. Returns all transactions. Intended for admin dashboards. |

---

#### `findOne(conditions)`

| | |
|---|---|
| **Parameters** | `conditions: Record<string, any>` -- key-value pairs mapping column names to values |
| **Return type** | `Promise<Transaction \| null>` |
| **SQL generated** | `SELECT * FROM transactions WHERE <col1> = ? AND <col2> = ? ... LIMIT 1` |
| **Notes** | Supports keys: `id`, `userId`, `type`, `gameType`, `status`, `reference`, `gameSessionId`. Unknown keys are silently ignored. Uses `and()` to combine all conditions. |

**Usage example:**

```ts
const tx = await TransactionModel.findOne({ userId: 1, type: 'game_win', gameSessionId: 55 });
```

---

#### `find(conditions, options)`

| | |
|---|---|
| **Parameters** | `conditions?: Record<string, any>` (default `{}`); `options?: QueryOptions` (default `{}`) |
| **Return type** | `Promise<Transaction[]>` |
| **SQL generated** | Dynamic -- builds a complex query with optional LEFT JOINs, WHERE conditions, ORDER BY, and LIMIT |
| **Notes** | This is the most powerful query method in TransactionModel. Supports: (1) `options.populate` array to LEFT JOIN `users` via `userId` and/or `createdBy`, (2) date range conditions using `{ $gte, $lte }` syntax on `createdAt` and `amount`, (3) regex-like text search using `{ $regex }` on `description` and `reference` (converted to SQL `LIKE %...%`), (4) sorting by `createdAt` descending when `options.sort.createdAt === -1`. This method was designed to mimic Mongoose-style queries. |

**Usage example:**

```ts
const results = await TransactionModel.find(
  { type: 'deposit', createdAt: { $gte: new Date('2025-01-01'), $lte: new Date('2025-01-31') } },
  { populate: ['userId', 'createdBy'], sort: { createdAt: -1 }, limit: 100 }
);
```

---

#### `updateById(id, updateData)`

| | |
|---|---|
| **Parameters** | `id: number`; `updateData: any` |
| **Return type** | `Promise<Transaction \| null>` |
| **SQL generated** | `UPDATE transactions SET ..., updated_at = ? WHERE id = ?` followed by `SELECT * FROM transactions WHERE id = ?` |
| **Notes** | Alternate implementation of `update()`. Returns `null` if the ID does not exist (rather than throwing). |

---

#### `deleteById(id)`

| | |
|---|---|
| **Parameters** | `id: number` |
| **Return type** | `Promise<Transaction \| null>` |
| **SQL generated** | `SELECT * FROM transactions WHERE id = ?` followed by `DELETE FROM transactions WHERE id = ?` |
| **Notes** | Fetches the record before deleting so it can return the deleted row. Returns `null` if the ID does not exist. |

---

### Usage by Services

- **Transaction service:** `create`, `findById`, `getUserTransactionHistory`, `voidTransaction`, `addNote`
- **Admin service:** `getTransactionsWithDetails`, `getTransactionStatsByDate`, `find`
- **Game handlers:** `create` (for recording game wins/losses)
- **Balance service:** `create` (to pair with balance changes)
- **Login rewards route:** `create` (for login_reward type transactions)

---

## GameSessionModel

**File:** `server/drizzle/models/GameSession.ts`

Manages game session lifecycle from creation through completion. A game session represents a single play event (one round of crash, one spin of roulette, etc.).

### Methods

---

#### `create(sessionData)`

| | |
|---|---|
| **Parameters** | `sessionData: any` -- session data object with fields matching the `game_sessions` schema |
| **Return type** | `Promise<GameSession>` |
| **SQL generated** | `INSERT INTO game_sessions (..., created_at, updated_at) VALUES (...)` followed by `SELECT * FROM game_sessions WHERE id = <insertId>` |
| **Notes** | Automatically copies `initialBet` to `totalBet` if `totalBet` is not explicitly provided. |

**Usage example:**

```ts
const session = await GameSessionModel.create({
  userId: 1,
  gameType: 'crash',
  initialBet: '10.00',
  startTime: new Date(),
});
// session.totalBet === '10.00'
```

---

#### `findById(id)`

| | |
|---|---|
| **Parameters** | `id: any` -- session primary key |
| **Return type** | `Promise<GameSession \| null>` |
| **SQL generated** | `SELECT * FROM game_sessions WHERE id = ?` |

---

#### `findByUserId(userId, limit, offset)`

| | |
|---|---|
| **Parameters** | `userId: any`; `limit: number` (default `50`); `offset: number` (default `0`) |
| **Return type** | `Promise<GameSession[]>` |
| **SQL generated** | `SELECT * FROM game_sessions WHERE user_id = ? ORDER BY start_time DESC LIMIT ? OFFSET ?` |

---

#### `update(id, updateData)`

| | |
|---|---|
| **Parameters** | `id: any`; `updateData: any` |
| **Return type** | `Promise<GameSession>` |
| **SQL generated** | `UPDATE game_sessions SET ..., updated_at = ? WHERE id = ?` followed by `SELECT * FROM game_sessions WHERE id = ?` |

---

#### `calculateProfit(session)`

| | |
|---|---|
| **Parameters** | `session: any` -- a game session object with `outcome` and `totalBet` fields |
| **Return type** | `number` |
| **SQL generated** | None -- pure calculation |
| **Notes** | Returns `parseFloat(session.outcome) - parseFloat(session.totalBet)`. Defaults both values to `0` if falsy. This is a static utility method. |

**Usage example:**

```ts
const profit = GameSessionModel.calculateProfit(session);
// Positive = player won, Negative = house won
```

---

#### `getGameStats(gameType, startDate, endDate)`

| | |
|---|---|
| **Parameters** | `gameType: any` -- e.g. `'crash'`, `'roulette'`; `startDate?: any`; `endDate?: any` |
| **Return type** | `Promise<{ gameType, totalSessions, totalBets, totalOutcome, houseEdge, avgBet, profit }>` |
| **SQL generated** | `SELECT total_bet, outcome FROM game_sessions WHERE game_type = ? [AND start_time >= ? AND start_time <= ?]` |
| **Notes** | Fetches all matching sessions and aggregates in JavaScript. Calculates: `houseEdge = 1 - (totalOutcome / totalBets)`, `profit = totalBets - totalOutcome`, `avgBet = totalBets / totalSessions`. |

**Usage example:**

```ts
const stats = await GameSessionModel.getGameStats('crash', '2025-01-01', '2025-01-31');
// { gameType: 'crash', totalSessions: 500, totalBets: 15000, ... }
```

---

#### `getActiveSessions(gameType)`

| | |
|---|---|
| **Parameters** | `gameType?: any` -- optional filter |
| **Return type** | `Promise<GameSession[]>` |
| **SQL generated** | `SELECT * FROM game_sessions WHERE is_completed = false [AND game_type = ?] ORDER BY start_time DESC` |
| **Notes** | Returns sessions that have not yet been marked as completed. |

---

#### `completeSession(id, outcome, finalMultiplier, resultDetails)`

| | |
|---|---|
| **Parameters** | `id: any` -- session ID; `outcome: any` -- total payout amount; `finalMultiplier?: any` -- e.g. crash multiplier; `resultDetails?: any` -- JSON with game-specific details |
| **Return type** | `Promise<GameSession>` |
| **SQL generated** | `UPDATE game_sessions SET is_completed = true, outcome = ?, end_time = ?, updated_at = ? [, final_multiplier = ?] [, result_details = ?] WHERE id = ?` followed by `SELECT * FROM game_sessions WHERE id = ?` |
| **Notes** | Converts `outcome` and `finalMultiplier` to strings for decimal storage. Sets `endTime` to the current timestamp. |

**Usage example:**

```ts
const completed = await GameSessionModel.completeSession(
  55,      // session ID
  150.00,  // payout
  3.5,     // crash multiplier
  { crashedAt: 3.5, autoCashout: true }
);
```

---

#### `findByGameType(gameType, limit, offset)`

| | |
|---|---|
| **Parameters** | `gameType: any`; `limit: number` (default `50`); `offset: number` (default `0`) |
| **Return type** | `Promise<GameSession[]>` |
| **SQL generated** | `SELECT * FROM game_sessions WHERE game_type = ? ORDER BY start_time DESC LIMIT ? OFFSET ?` |

---

#### `delete(id)`

| | |
|---|---|
| **Parameters** | `id: any` |
| **Return type** | `Promise<GameSession>` |
| **SQL generated** | `SELECT * FROM game_sessions WHERE id = ?` followed by `DELETE FROM game_sessions WHERE id = ?` |

---

#### `findWithUserDetails(limit, offset)`

| | |
|---|---|
| **Parameters** | `limit: number` (default `50`); `offset: number` (default `0`) |
| **Return type** | `Promise<(GameSession & { username: string })[]>` |
| **SQL generated** | `SELECT gs.*, u.username FROM game_sessions gs LEFT JOIN users u ON gs.user_id = u.id ORDER BY gs.start_time DESC LIMIT ? OFFSET ?` |
| **Notes** | Joins with `users` to include the player's username. |

---

#### `findByDateRange(startDate, endDate, gameType)`

| | |
|---|---|
| **Parameters** | `startDate: any`; `endDate: any`; `gameType?: any` -- optional additional filter |
| **Return type** | `Promise<GameSession[]>` |
| **SQL generated** | `SELECT * FROM game_sessions WHERE start_time >= ? AND start_time <= ? [AND game_type = ?] ORDER BY start_time DESC` |
| **Notes** | All parameters are optional; calling with no arguments returns all sessions ordered by start time descending. |

---

### Usage by Services

- **Game handlers (crash, plinko, etc.):** `create`, `completeSession`, `findById`, `update`
- **Admin dashboard:** `getGameStats`, `findWithUserDetails`, `getActiveSessions`
- **User profile:** `findByUserId`

---

## GameLogModel

**File:** `server/drizzle/models/GameLog.ts`

Provides granular event logging within game sessions. Supports both static class methods and an instance-level `save()` method. Joins with both `users` and `gameSessions` tables for enriched queries.

### Methods

---

#### `create(logData)`

| | |
|---|---|
| **Parameters** | `logData: any` -- log entry data with fields matching the `game_logs` schema |
| **Return type** | `Promise<GameLog>` |
| **SQL generated** | `INSERT INTO game_logs (..., created_at, updated_at) VALUES (...)` followed by `SELECT * FROM game_logs WHERE id = <insertId>` |

**Usage example:**

```ts
const log = await GameLogModel.create({
  sessionId: 55,
  userId: 1,
  gameType: 'crash',
  eventType: 'bet_placed',
  eventDetails: 'Player placed initial bet',
  amount: '10.00',
  timestamp: new Date(),
});
```

---

#### `findById(id)`

| | |
|---|---|
| **Parameters** | `id: any` |
| **Return type** | `Promise<GameLog \| null>` |
| **SQL generated** | `SELECT * FROM game_logs WHERE id = ?` |

---

#### `getRecentUserLogs(userId, limit)`

| | |
|---|---|
| **Parameters** | `userId: any`; `limit: number` (default `100`) |
| **Return type** | `Promise<GameLog[]>` (enriched with `sessionStartTime`, `sessionGameType`) |
| **SQL generated** | `SELECT gl.*, gs.start_time, gs.game_type FROM game_logs gl LEFT JOIN game_sessions gs ON gl.session_id = gs.id WHERE gl.user_id = ? ORDER BY gl.timestamp DESC LIMIT ?` |
| **Notes** | Includes session metadata for context. |

---

#### `getLogsByGameType(gameType, limit)`

| | |
|---|---|
| **Parameters** | `gameType: any`; `limit: number` (default `100`) |
| **Return type** | `Promise<GameLog[]>` (enriched with `username`) |
| **SQL generated** | `SELECT gl.*, u.username FROM game_logs gl LEFT JOIN users u ON gl.user_id = u.id WHERE gl.game_type = ? ORDER BY gl.timestamp DESC LIMIT ?` |

---

#### `searchByDateRange(startDate, endDate, gameType, eventType, limit)`

| | |
|---|---|
| **Parameters** | `startDate: any`; `endDate: any`; `gameType?: any`; `eventType?: any`; `limit: number` (default `1000`) |
| **Return type** | `Promise<GameLog[]>` (enriched with `username`, `sessionStartTime`) |
| **SQL generated** | `SELECT gl.*, u.username, gs.start_time FROM game_logs gl LEFT JOIN users u ON gl.user_id = u.id LEFT JOIN game_sessions gs ON gl.session_id = gs.id WHERE [timestamp >= ? AND timestamp <= ?] [AND game_type = ?] [AND event_type = ?] ORDER BY gl.timestamp DESC LIMIT ?` |
| **Notes** | All filter parameters are optional. Joins both `users` and `gameSessions` for a fully enriched result. Default limit is 1000 (higher than most methods). |

---

#### `findBySessionId(sessionId, limit)`

| | |
|---|---|
| **Parameters** | `sessionId: any`; `limit: number` (default `100`) |
| **Return type** | `Promise<GameLog[]>` |
| **SQL generated** | `SELECT * FROM game_logs WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?` |

---

#### `findByEventType(eventType, limit, offset)`

| | |
|---|---|
| **Parameters** | `eventType: any`; `limit: number` (default `100`); `offset: number` (default `0`) |
| **Return type** | `Promise<GameLog[]>` |
| **SQL generated** | `SELECT * FROM game_logs WHERE event_type = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?` |

---

#### `update(id, updateData)`

| | |
|---|---|
| **Parameters** | `id: any`; `updateData: any` |
| **Return type** | `Promise<GameLog>` |
| **SQL generated** | `UPDATE game_logs SET ..., updated_at = ? WHERE id = ?` followed by `SELECT * FROM game_logs WHERE id = ?` |

---

#### `delete(id)`

| | |
|---|---|
| **Parameters** | `id: any` |
| **Return type** | `Promise<GameLog>` |
| **SQL generated** | `SELECT * FROM game_logs WHERE id = ?` followed by `DELETE FROM game_logs WHERE id = ?` |

---

#### `findWithDetails(limit, offset)`

| | |
|---|---|
| **Parameters** | `limit: number` (default `100`); `offset: number` (default `0`) |
| **Return type** | `Promise<GameLog[]>` (enriched with `username`, `sessionStartTime`, `sessionIsCompleted`) |
| **SQL generated** | `SELECT gl.*, u.username, gs.start_time, gs.is_completed FROM game_logs gl LEFT JOIN users u ON gl.user_id = u.id LEFT JOIN game_sessions gs ON gl.session_id = gs.id ORDER BY gl.timestamp DESC LIMIT ? OFFSET ?` |

---

#### `getLogCount(gameType, eventType, userId)`

| | |
|---|---|
| **Parameters** | `gameType?: any`; `eventType?: any`; `userId?: any` -- all optional filters |
| **Return type** | `Promise<number>` |
| **SQL generated** | `SELECT id FROM game_logs [WHERE game_type = ? AND event_type = ? AND user_id = ?]` |
| **Notes** | Counts by checking `result.length` on returned rows rather than using SQL `COUNT()`. This works but is inefficient for large datasets. |

---

#### `getEventStats(gameType)`

| | |
|---|---|
| **Parameters** | `gameType?: any` -- optional filter |
| **Return type** | `Promise<{ eventType: string, count: number, totalAmount: number }[]>` |
| **SQL generated** | `SELECT event_type, game_type, amount FROM game_logs [WHERE game_type = ?]` |
| **Notes** | Fetches all matching rows and groups by `eventType` in JavaScript using `Array.reduce()`. |

---

#### `getUserLogs(userId)`

| | |
|---|---|
| **Parameters** | `userId: any` |
| **Return type** | `Promise<GameLog[]>` |
| **SQL generated** | `SELECT gl.id, gl.user_id, gl.game_type, gl.action, gl.game_data, gl.timestamp, gl.session_id FROM game_logs gl LEFT JOIN game_sessions gs ON gl.session_id = gs.id WHERE gl.user_id = ? ORDER BY gl.timestamp DESC` |
| **Notes** | Selects `action` and `gameData` fields (column aliases that may differ from the `eventType`/`eventDetails` fields used elsewhere). |

---

#### `getGameTypeLogs(gameType)`

| | |
|---|---|
| **Parameters** | `gameType: any` |
| **Return type** | `Promise<GameLog[]>` (enriched with `username`) |
| **SQL generated** | `SELECT gl.id, gl.user_id, gl.game_type, gl.action, gl.game_data, gl.timestamp, u.username FROM game_logs gl LEFT JOIN users u ON gl.user_id = u.id WHERE gl.game_type = ? ORDER BY gl.timestamp DESC` |

---

#### `getLogsWithFilters(filters)`

| | |
|---|---|
| **Parameters** | `filters?: { userId?, gameType?, action?: string \| { $regex: string }, timestamp?: { $gte?, $lte? } }` |
| **Return type** | `Promise<GameLog[]>` |
| **SQL generated** | Dynamic query with LEFT JOINs on `users` and `game_sessions`. Supports exact match, `LIKE` (for `$regex` syntax), and date range conditions. |
| **Notes** | If `action` is provided as `{ $regex: 'pattern' }`, it is converted to `LIKE %pattern%`. Supports Mongoose-style `{ $gte, $lte }` for timestamp range queries. |

**Usage example:**

```ts
const logs = await GameLogModel.getLogsWithFilters({
  gameType: 'crash',
  action: { $regex: 'cashout' },
  timestamp: { $gte: new Date('2025-01-01'), $lte: new Date('2025-01-31') },
});
```

---

#### `findOne(conditions)`

| | |
|---|---|
| **Parameters** | `conditions: any` -- key-value pairs mapped to `gameLogs` table columns |
| **Return type** | `Promise<GameLog \| null>` |
| **SQL generated** | `SELECT * FROM game_logs WHERE <col1> = ? AND <col2> = ? ... LIMIT 1` |
| **Notes** | Uses dynamic property access on `gameLogs[key]` -- the caller must use the Drizzle column name (e.g., `userId`, not `user_id`). |

---

#### `find(conditions)`

| | |
|---|---|
| **Parameters** | `conditions?: any` (default `{}`) |
| **Return type** | `Promise<GameLog[]>` |
| **SQL generated** | `SELECT * FROM game_logs [WHERE ...] ORDER BY timestamp DESC` |
| **Notes** | Supports `{ $gte, $lte }` syntax for range queries. When called with no conditions, returns all logs. |

---

#### `save()` (instance method)

| | |
|---|---|
| **Parameters** | (none -- operates on `this`) |
| **Return type** | `Promise<GameLog>` |
| **SQL generated** | If `this.id` exists: `UPDATE game_logs SET ... WHERE id = ?` followed by `SELECT`. If no `this.id`: `INSERT INTO game_logs VALUES (...)` followed by `SELECT`. |
| **Notes** | Upsert behavior: updates if the instance has an ID, inserts otherwise. Mutates `this` with the database result via `Object.assign()`. |

---

### Usage by Services

- **Game handlers:** `create` (logging bets, results, cashouts, errors, state changes)
- **Admin analytics:** `getEventStats`, `searchByDateRange`, `getLogCount`
- **Audit trail:** `findBySessionId`, `findWithDetails`

---

## GameStatModel

**File:** `server/drizzle/models/GameStat.ts`

Manages aggregated per-game-type statistics. Maintains a rolling 30-day window of daily stats stored as JSON in the `daily_stats` column. One row per game type.

### Methods

---

#### `create(statData)`

| | |
|---|---|
| **Parameters** | `statData: any` -- object with `gameType`, `name`, `totalGamesPlayed`, `totalBetsAmount`, `totalWinningsAmount`, `houseProfit`, `dailyStats` |
| **Return type** | `Promise<GameStat>` |
| **SQL generated** | `INSERT INTO game_stats (..., created_at, updated_at) VALUES (...)` followed by `SELECT * FROM game_stats WHERE id = <insertId>` |

---

#### `findById(id)`

| | |
|---|---|
| **Parameters** | `id: any` |
| **Return type** | `Promise<GameStat \| null>` |
| **SQL generated** | `SELECT * FROM game_stats WHERE id = ?` |
| **Notes** | Parses the `dailyStats` field from JSON string if present. |

---

#### `findByGameType(gameType)`

| | |
|---|---|
| **Parameters** | `gameType: any` -- e.g. `'crash'`, `'roulette'` |
| **Return type** | `Promise<GameStat \| null>` |
| **SQL generated** | `SELECT * FROM game_stats WHERE game_type = ?` |
| **Notes** | Parses `dailyStats` from JSON. Returns the single stat row for the game type. |

---

#### `findAll()`

| | |
|---|---|
| **Parameters** | (none) |
| **Return type** | `Promise<GameStat[]>` |
| **SQL generated** | `SELECT * FROM game_stats` |

---

#### `updateStats(gameType, betAmount, winAmount)`

| | |
|---|---|
| **Parameters** | `gameType: any` -- e.g. `'crash'`; `betAmount: number`; `winAmount: number` |
| **Return type** | `Promise<void>` |
| **SQL generated** | Calls `findByGameType` internally, then either `UPDATE game_stats SET ... WHERE id = ?` (if existing) or `INSERT INTO game_stats ...` via `create()` (if new). |
| **Notes** | This is the core method called after every game round. It: (1) Calculates profit as `betAmount - winAmount`. (2) Looks up existing stats for the game type. (3) If found, increments `totalGamesPlayed`, `totalBetsAmount`, `totalWinningsAmount`, and `houseProfit`. Updates or creates today's entry in the `dailyStats` JSON array. Trims `dailyStats` to the last 30 days. (4) If not found, creates a new stat record with initial values. The game name is auto-capitalized from the game type string. |

**Usage example:**

```ts
await GameStatModel.updateStats('crash', 10.00, 35.00);
// profit = 10 - 35 = -25 (player won)
```

---

#### `update(id, updateData)`

| | |
|---|---|
| **Parameters** | `id: any`; `updateData: any` |
| **Return type** | `Promise<GameStat>` |
| **SQL generated** | `UPDATE game_stats SET ..., updated_at = ? WHERE id = ?` followed by `SELECT * FROM game_stats WHERE id = ?` |

---

#### `updateByGameType(gameType, updateData)`

| | |
|---|---|
| **Parameters** | `gameType: any`; `updateData: any` |
| **Return type** | `Promise<GameStat>` |
| **SQL generated** | `UPDATE game_stats SET ..., updated_at = ? WHERE game_type = ?` followed by `SELECT * FROM game_stats WHERE game_type = ?` |

---

#### `delete(id)`

| | |
|---|---|
| **Parameters** | `id: any` |
| **Return type** | `Promise<GameStat>` |
| **SQL generated** | `SELECT * FROM game_stats WHERE id = ?` followed by `DELETE FROM game_stats WHERE id = ?` |

---

#### `initializeAllGameTypes()`

| | |
|---|---|
| **Parameters** | (none) |
| **Return type** | `Promise<GameStat[]>` |
| **SQL generated** | For each of 7 game types: `SELECT * FROM game_stats WHERE game_type = ?`, then `INSERT INTO game_stats ...` if not found. |
| **Notes** | Seeds the following game types: `roulette`, `blackjack`, `crash`, `slots`, `landmines`, `plinko`, `wheel`. Each is initialized with zeroed-out counters and an empty `dailyStats` array. Only creates records for game types that do not yet have a row. Returns the array of newly created stat records (excludes pre-existing ones). |

**Usage example:**

```ts
const newStats = await GameStatModel.initializeAllGameTypes();
// Called during server startup
```

---

#### `getStatsSummary()`

| | |
|---|---|
| **Parameters** | (none) |
| **Return type** | `Promise<{ totalGames: number, totalBets: number, totalWinnings: number, totalProfit: number, gameCount: number, averageBetPerGame: number, houseEdgePercentage: number }>` |
| **SQL generated** | `SELECT * FROM game_stats` (via `findAll()`) |
| **Notes** | Aggregates across all game types in JavaScript. Computes `houseEdgePercentage = (totalProfit / totalBets) * 100`. `gameCount` is the number of distinct game types, not total games played. |

---

#### `getDailyStats(gameType, days)`

| | |
|---|---|
| **Parameters** | `gameType: any`; `days: number` (default `30`) |
| **Return type** | `Promise<DailyStat[]>` -- where each entry is `{ date, gamesPlayed, betsAmount, winningsAmount, profit }` |
| **SQL generated** | `SELECT * FROM game_stats WHERE game_type = ?` (via `findByGameType()`) |
| **Notes** | Returns the `dailyStats` JSON array (already parsed by `findByGameType`), sorted by date descending and sliced to the most recent N days. Returns an empty array if no stat record exists. |

---

### Usage by Services

- **Game handlers:** `updateStats` (called after each game round completes)
- **Admin dashboard:** `findAll`, `getStatsSummary`, `getDailyStats`
- **Initialization scripts:** `initializeAllGameTypes`

---

## BalanceModel

**File:** `server/drizzle/models/Balance.ts`

Manages the balance change ledger. Each record captures a snapshot of the previous and new balance along with the change amount and type. This forms an append-only audit trail of every balance modification.

### Methods

---

#### `create(balanceData)`

| | |
|---|---|
| **Parameters** | `balanceData: any` -- must include `userId`; typically also includes `amount`, `previousBalance`, `changeAmount`, `type`, `gameType`, `note`, `adminId`, `transactionId` |
| **Return type** | `Promise<Balance>` |
| **SQL generated** | `INSERT INTO balances (..., created_at, updated_at) VALUES (...)` followed by `SELECT * FROM balances WHERE user_id = ? ORDER BY created_at DESC LIMIT 1` |
| **Notes** | Retrieves the created record by querying the latest balance for the user (since MySQL's `insertId` is handled differently with Drizzle). |

**Usage example:**

```ts
const entry = await BalanceModel.create({
  userId: 1,
  amount: '150.00',
  previousBalance: '100.00',
  changeAmount: '50.00',
  type: 'win',
  gameType: 'crash',
  note: 'Crash game payout',
});
```

---

#### `findById(id)`

| | |
|---|---|
| **Parameters** | `id: any` |
| **Return type** | `Promise<Balance \| null>` |
| **SQL generated** | `SELECT * FROM balances WHERE id = ?` |

---

#### `getCurrentBalance(userId)`

| | |
|---|---|
| **Parameters** | `userId: any` |
| **Return type** | `Promise<number>` |
| **SQL generated** | `SELECT * FROM balances WHERE user_id = ? ORDER BY created_at DESC LIMIT 1` |
| **Notes** | Returns the `amount` field (parsed as float) from the most recent balance entry. Returns `0` if no balance records exist for the user. This represents the current balance as tracked by the ledger. |

---

#### `getBalanceHistory(userId, limit)`

| | |
|---|---|
| **Parameters** | `userId: any`; `limit: number` (default `50`) |
| **Return type** | `Promise<Balance[]>` (enriched with `adminUsername`, `transactionId`) |
| **SQL generated** | `SELECT b.id, b.user_id, b.amount, b.previous_balance, b.change_amount, b.type, b.note, b.game_type, b.created_at, u.username AS admin_username, b.transaction_id FROM balances b LEFT JOIN users u ON b.admin_id = u.id LEFT JOIN transactions t ON b.transaction_id = t.id WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT ?` |
| **Notes** | Joins with `users` (for admin username) and `transactions` (for the linked transaction). |

---

#### `findByUserId(userId, limit, offset)`

| | |
|---|---|
| **Parameters** | `userId: any`; `limit: number` (default `50`); `offset: number` (default `0`) |
| **Return type** | `Promise<Balance[]>` |
| **SQL generated** | `SELECT * FROM balances WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?` |

---

#### `isPositiveChange(balance)`

| | |
|---|---|
| **Parameters** | `balance: any` -- a balance record object |
| **Return type** | `boolean` |
| **SQL generated** | None -- pure calculation |
| **Notes** | Returns `parseFloat(balance.changeAmount) > 0`. Static utility method. |

---

#### `update(id, updateData)`

| | |
|---|---|
| **Parameters** | `id: any`; `updateData: any` |
| **Return type** | `Promise<Balance>` |
| **SQL generated** | `UPDATE balances SET ..., updated_at = ? WHERE id = ?` followed by `SELECT * FROM balances WHERE id = ?` |

---

#### `delete(id)`

| | |
|---|---|
| **Parameters** | `id: any` |
| **Return type** | `Promise<Balance>` |
| **SQL generated** | `SELECT * FROM balances WHERE id = ?` followed by `DELETE FROM balances WHERE id = ?` |

---

#### `findWithDetails(userId, limit, offset)`

| | |
|---|---|
| **Parameters** | `userId?: any` (optional -- omit to get all users); `limit: number` (default `50`); `offset: number` (default `0`) |
| **Return type** | `Promise<Balance[]>` (enriched with `username`, `adminUsername`) |
| **SQL generated** | `SELECT b.*, u.username FROM balances b LEFT JOIN users u ON b.user_id = u.id [WHERE b.user_id = ?] ORDER BY b.created_at DESC LIMIT ? OFFSET ?` |
| **Notes** | When `userId` is provided, filters to that user. When omitted, returns all balances across all users. |

---

#### `findByType(type, userId, limit)`

| | |
|---|---|
| **Parameters** | `type: any` -- e.g. `'win'`, `'loss'`, `'deposit'`, `'withdrawal'`; `userId?: any`; `limit: number` (default `50`) |
| **Return type** | `Promise<Balance[]>` |
| **SQL generated** | `SELECT * FROM balances WHERE type = ? [AND user_id = ?] ORDER BY created_at DESC LIMIT ?` |

---

#### `findByGameType(gameType, userId, limit)`

| | |
|---|---|
| **Parameters** | `gameType: any` -- e.g. `'crash'`, `'roulette'`; `userId?: any`; `limit: number` (default `50`) |
| **Return type** | `Promise<Balance[]>` |
| **SQL generated** | `SELECT * FROM balances WHERE game_type = ? [AND user_id = ?] ORDER BY created_at DESC LIMIT ?` |

---

#### `getBalanceStats(userId)`

| | |
|---|---|
| **Parameters** | `userId: any` |
| **Return type** | `Promise<{ totalWins: number, totalLosses: number, totalDeposits: number, totalWithdrawals: number, netProfit: number }>` |
| **SQL generated** | `SELECT change_amount, type FROM balances WHERE user_id = ?` |
| **Notes** | Fetches all balance records for the user and aggregates in JavaScript by type. `totalLosses` and `totalWithdrawals` use `Math.abs()` since those change amounts are negative. `netProfit = totalWins - totalLosses`. |

---

#### `getLatestBalance(userId)`

| | |
|---|---|
| **Parameters** | `userId: any` |
| **Return type** | `Promise<Balance \| null>` |
| **SQL generated** | `SELECT * FROM balances WHERE user_id = ? ORDER BY created_at DESC LIMIT 1` |
| **Notes** | Similar to `getCurrentBalance` but returns the full record object instead of just the parsed amount. |

---

#### `findByUserIdAndType(userId, type)`

| | |
|---|---|
| **Parameters** | `userId: any`; `type: any` |
| **Return type** | `Promise<Balance \| null>` |
| **SQL generated** | `SELECT * FROM balances WHERE user_id = ? AND type = ? LIMIT 1` |

---

#### `findAll()`

| | |
|---|---|
| **Parameters** | (none) |
| **Return type** | `Promise<Balance[]>` |
| **SQL generated** | `SELECT * FROM balances` |
| **Notes** | Returns all records with no filtering or pagination. Intended for admin use on small datasets. |

---

### Usage by Services

- **Balance service:** `create`, `getCurrentBalance`, `getBalanceHistory`, `getBalanceStats`
- **Game handlers:** `create` (recording win/loss balance changes)
- **Admin service:** `findWithDetails`, `findAll`, `findByType`
- **Transaction service:** `create` (pairing balance records with transactions)

---

## MessageModel

**File:** `server/drizzle/models/Message.ts`

Manages chat messages. Supports both static class methods and an instance-level `save()` method. Most query methods LEFT JOIN with `users` to include `username` and `avatar`.

### Methods

---

#### `create(data)`

| | |
|---|---|
| **Parameters** | `data: any` -- message data (typically `{ content, userId, isSystem }`) |
| **Return type** | `Promise<Message>` |
| **SQL generated** | `INSERT INTO messages (...) VALUES (...)` followed by `SELECT * FROM messages WHERE id = <insertId>` |
| **Notes** | Uses `result.insertId` to fetch the created record. Has a fallback return if `insertId` is not available. Does **not** set `createdAt`/`updatedAt` manually -- relies on database defaults. |

**Usage example:**

```ts
const msg = await MessageModel.create({
  content: 'Hello world!',
  userId: 1,
  isSystem: false,
});
```

---

#### `findById(id)`

| | |
|---|---|
| **Parameters** | `id: any` |
| **Return type** | `Promise<Message \| null>` (enriched with nested `user: { id, username, avatar }`) |
| **SQL generated** | `SELECT m.id, m.content, m.created_at, m.user_id, m.is_system, u.id, u.username, u.avatar FROM messages m LEFT JOIN users u ON m.user_id = u.id WHERE m.id = ? LIMIT 1` |
| **Notes** | Returns user data as a nested `user` object rather than flat fields. |

---

#### `findByIdWithUser(id)`

| | |
|---|---|
| **Parameters** | `id: any` |
| **Return type** | `Promise<(Message & { username, avatar }) \| null>` |
| **SQL generated** | `SELECT m.id, m.content, m.user_id, m.created_at, u.username, u.avatar FROM messages m LEFT JOIN users u ON m.user_id = u.id WHERE m.id = ?` |
| **Notes** | Similar to `findById` but returns user fields as flat properties rather than a nested object. |

---

#### `getRecentMessages(limit)`

| | |
|---|---|
| **Parameters** | `limit: number` (default `50`) |
| **Return type** | `Promise<Message[]>` (with `username`, `avatar`) |
| **SQL generated** | `SELECT m.id, m.content, m.user_id, m.created_at, u.username, u.avatar FROM messages m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC LIMIT ?` |

---

#### `findByUserId(userId, limit, offset)`

| | |
|---|---|
| **Parameters** | `userId: any`; `limit: number` (default `50`); `offset: number` (default `0`) |
| **Return type** | `Promise<Message[]>` |
| **SQL generated** | `SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?` |
| **Notes** | Does not join with `users` (no username/avatar in results). |

---

#### `findWithPagination(limit, offset)`

| | |
|---|---|
| **Parameters** | `limit: number` (default `50`); `offset: number` (default `0`) |
| **Return type** | `Promise<Message[]>` (with `username`, `avatar`) |
| **SQL generated** | `SELECT m.id, m.content, m.user_id, m.created_at, u.username, u.avatar FROM messages m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC LIMIT ? OFFSET ?` |

---

#### `update(id, updateData)`

| | |
|---|---|
| **Parameters** | `id: any`; `updateData: any` |
| **Return type** | `Promise<Message>` |
| **SQL generated** | `UPDATE messages SET ... WHERE id = ?` followed by `SELECT * FROM messages WHERE id = ?` |
| **Notes** | Does **not** set `updatedAt` -- passes `updateData` directly without adding a timestamp. |

---

#### `delete(id)`

| | |
|---|---|
| **Parameters** | `id: any` |
| **Return type** | `Promise<Message>` |
| **SQL generated** | `SELECT * FROM messages WHERE id = ?` followed by `DELETE FROM messages WHERE id = ?` |
| **Notes** | Throws an error with message `"Message not found"` if the record does not exist. This is stricter than other model `delete` methods which silently return undefined. |

---

#### `deleteByUserId(userId)`

| | |
|---|---|
| **Parameters** | `userId: any` |
| **Return type** | `Promise<Message[]>` |
| **SQL generated** | `SELECT * FROM messages WHERE user_id = ?` followed by `DELETE FROM messages WHERE user_id = ?` |
| **Notes** | Bulk-deletes all messages for a user. Returns the array of deleted records. Useful for user account cleanup or moderation. |

---

#### `getMessageCount()`

| | |
|---|---|
| **Parameters** | (none) |
| **Return type** | `Promise<number>` |
| **SQL generated** | `SELECT id FROM messages` |
| **Notes** | Counts by checking `result.length` rather than using SQL `COUNT()`. Inefficient for large tables. |

---

#### `getUserMessageCount(userId)`

| | |
|---|---|
| **Parameters** | `userId: any` |
| **Return type** | `Promise<number>` |
| **SQL generated** | `SELECT id FROM messages WHERE user_id = ?` |
| **Notes** | Same length-based counting approach as `getMessageCount`. |

---

#### `findAll(limit)`

| | |
|---|---|
| **Parameters** | `limit?: number` (default `null` -- no limit) |
| **Return type** | `Promise<Message[]>` (with `username`, `avatar`) |
| **SQL generated** | `SELECT m.id, m.content, m.user_id, m.created_at, u.username, u.avatar FROM messages m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC [LIMIT ?]` |

---

#### `searchByContent(searchTerm, limit)`

| | |
|---|---|
| **Parameters** | `searchTerm: any`; `limit: number` (default `50`) |
| **Return type** | `Promise<Message[]>` (with `username`, `avatar`) |
| **SQL generated** | Attempts to use `messages.content.includes(searchTerm)` which maps to a `LIKE` or containment check depending on the Drizzle driver |
| **Notes** | Uses Drizzle's `.includes()` method on the content column. May not work with all Drizzle MySQL configurations. Consider using `like()` with wildcards for more reliable substring matching. |

---

#### `find(conditions)`

| | |
|---|---|
| **Parameters** | `conditions?: any` (default `{}`) |
| **Return type** | `Promise<Message[]>` (with `username`, `avatar`, `isSystem`) |
| **SQL generated** | Dynamic query with LEFT JOIN on `users`. Supports exact match and `{ $gte, $lte }` range syntax. Ordered by `created_at DESC`, limited to 50 results. |
| **Notes** | Uses dynamic property access `messages[key]` for building WHERE conditions. |

---

#### `findOne(conditions)`

| | |
|---|---|
| **Parameters** | `conditions: any` -- key-value pairs |
| **Return type** | `Promise<Message \| null>` (with `username`, `avatar`, `isSystem`) |
| **SQL generated** | `SELECT m.*, u.username, u.avatar FROM messages m LEFT JOIN users u ON m.user_id = u.id WHERE ... LIMIT 1` |

---

#### `save()` (instance method)

| | |
|---|---|
| **Parameters** | (none -- operates on `this`) |
| **Return type** | `Promise<Message>` |
| **SQL generated** | If `this.id` exists: `UPDATE messages SET ... WHERE id = ?` followed by `SELECT`. If no `this.id`: `INSERT INTO messages VALUES (...)`. |
| **Notes** | Upsert behavior. Mutates `this` with the database result via `Object.assign()`. Sets `this.id` from `result.insertId` on new inserts. |

---

### Usage by Services

- **Chat handler (Socket.IO):** `create`, `getRecentMessages`
- **Admin moderation:** `delete`, `deleteByUserId`, `findAll`, `searchByContent`
- **User profile:** `findByUserId`, `getUserMessageCount`

---

## LoginRewardModel

**File:** `server/drizzle/models/LoginReward.ts`

Manages daily login reward claims. This is the only model with full TypeScript type annotations (the `@ts-nocheck` directive is present but the code uses explicit types throughout).

### Methods

---

#### `create(rewardData)`

| | |
|---|---|
| **Parameters** | `rewardData: { userId: number; amount: number \| string; transactionId?: number }` |
| **Return type** | `Promise<LoginReward>` |
| **SQL generated** | `INSERT INTO login_rewards (user_id, amount, transaction_id) VALUES (?, ?, ?)` followed by `SELECT * FROM login_rewards WHERE user_id = ? ORDER BY created_at DESC LIMIT 1` |
| **Notes** | Validates that both `userId` and `amount` are present; throws if either is missing. Converts numeric `amount` to string for decimal column storage. Does not manually set `createdAt` -- relies on the database `defaultNow()`. |

**Usage example:**

```ts
const reward = await LoginRewardModel.create({
  userId: 1,
  amount: 42,
  transactionId: 203,
});
```

---

#### `hasClaimedToday(userId)`

| | |
|---|---|
| **Parameters** | `userId: number` |
| **Return type** | `Promise<boolean>` |
| **SQL generated** | `SELECT * FROM login_rewards WHERE user_id = ? AND created_at > ? AND created_at < ?` |
| **Notes** | Computes today's midnight and tomorrow's midnight using JavaScript `Date` manipulation (`setHours(0,0,0,0)` for today, `setDate(+1)` for tomorrow). Uses `gt` (greater than) and `lt` (less than), so records exactly at midnight boundaries depend on timestamp precision. Returns `true` if any record exists in the window. |

**Usage example:**

```ts
const claimed = await LoginRewardModel.hasClaimedToday(1);
if (!claimed) {
  // Allow claim
}
```

---

#### `getHistoryByUserId(userId, limit)`

| | |
|---|---|
| **Parameters** | `userId: number`; `limit: number` (default `30`) |
| **Return type** | `Promise<LoginReward[]>` |
| **SQL generated** | `SELECT * FROM login_rewards WHERE user_id = ? ORDER BY created_at DESC LIMIT ?` |

**Usage example:**

```ts
const history = await LoginRewardModel.getHistoryByUserId(1, 30);
```

---

#### `getTotalRewardsByUserId(userId)`

| | |
|---|---|
| **Parameters** | `userId: number` |
| **Return type** | `Promise<number>` |
| **SQL generated** | `SELECT SUM(amount) AS total FROM login_rewards WHERE user_id = ?` |
| **Notes** | Uses raw SQL `SUM()` via Drizzle's `sql` template literal. Parses the result as float. Returns `0` if no rewards exist (handles null via `'0'` fallback). |

**Usage example:**

```ts
const total = await LoginRewardModel.getTotalRewardsByUserId(1);
// 1250.00
```

---

#### `getTotalRewardsToday()`

| | |
|---|---|
| **Parameters** | (none) |
| **Return type** | `Promise<number>` |
| **SQL generated** | `SELECT SUM(amount) AS total FROM login_rewards WHERE created_at > ? AND created_at < ?` |
| **Notes** | Uses the same midnight-to-midnight window as `hasClaimedToday`. Returns `0` if no rewards have been claimed today. |

---

#### `generateRewardAmount()`

| | |
|---|---|
| **Parameters** | (none) |
| **Return type** | `number` |
| **SQL generated** | None -- pure calculation |
| **Notes** | Returns `Math.floor(Math.random() * 101)` which gives an integer between 0 and 100, inclusive. Uniform distribution. |

**Usage example:**

```ts
const amount = LoginRewardModel.generateRewardAmount();
// e.g. 42
```

---

### Usage by Services

- **Login reward route handler:** `hasClaimedToday`, `create`, `generateRewardAmount`
- **Admin dashboard:** `getTotalRewardsToday`
- **User profile:** `getHistoryByUserId`, `getTotalRewardsByUserId`

---

## Relations Defined in Schema

The `server/drizzle/schema.ts` file defines Drizzle ORM relations separately from the table definitions. These enable the `with` syntax in relational queries:

| Relation Source | Relation Type | Target | Join Condition |
|---|---|---|---|
| `users` | `one-to-many` | `transactions` | `transactions.userId -> users.id` |
| `users` | `one-to-many` | `gameSessions` | `gameSessions.userId -> users.id` |
| `users` | `one-to-many` | `gameLogs` | `gameLogs.userId -> users.id` |
| `users` | `one-to-many` | `balances` | `balances.userId -> users.id` |
| `users` | `one-to-many` | `messages` | `messages.userId -> users.id` |
| `users` | `one-to-many` | `loginRewards` | `loginRewards.userId -> users.id` |
| `transactions` | `many-to-one` | `users` (owner) | `transactions.userId -> users.id` |
| `transactions` | `many-to-one` | `users` (creator) | `transactions.createdBy -> users.id` |
| `transactions` | `many-to-one` | `users` (voider) | `transactions.voidedBy -> users.id` |
| `transactions` | `many-to-one` | `gameSessions` | `transactions.gameSessionId -> gameSessions.id` |
| `gameSessions` | `many-to-one` | `users` | `gameSessions.userId -> users.id` |
| `gameSessions` | `one-to-many` | `transactions` | -- |
| `gameSessions` | `one-to-many` | `gameLogs` | -- |
| `gameSessions` | `one-to-many` | `balances` | -- |
| `gameLogs` | `many-to-one` | `users` | `gameLogs.userId -> users.id` |
| `gameLogs` | `many-to-one` | `gameSessions` | `gameLogs.sessionId -> gameSessions.id` |
| `balances` | `many-to-one` | `users` (owner) | `balances.userId -> users.id` |
| `balances` | `many-to-one` | `users` (admin) | `balances.adminId -> users.id` |
| `balances` | `many-to-one` | `gameSessions` | `balances.relatedSessionId -> gameSessions.id` |
| `balances` | `many-to-one` | `transactions` | `balances.transactionId -> transactions.id` |
| `loginRewards` | `many-to-one` | `users` | `loginRewards.userId -> users.id` |
| `loginRewards` | `many-to-one` | `transactions` | `loginRewards.transactionId -> transactions.id` |
| `messages` | `many-to-one` | `users` | `messages.userId -> users.id` |

---

## Common Patterns Across Models

1. **Create-then-fetch:** Because MySQL's `mysql2` driver does not support `RETURNING`, most `create` methods insert a row and then immediately query it back using the `insertId` or by ordering by `createdAt DESC`.

2. **Manual aggregation:** Several methods (e.g., `TransactionModel.getTransactionStatsByDate`, `GameSessionModel.getGameStats`, `GameLogModel.getEventStats`, `BalanceModel.getBalanceStats`) fetch raw rows and aggregate them in JavaScript rather than using SQL `GROUP BY`, as noted in code comments.

3. **Pagination defaults:** Most list methods default to `limit = 50` and `offset = 0`. Notable exceptions: `GameLogModel.searchByDateRange` defaults to `limit = 1000`; `LoginRewardModel.getHistoryByUserId` defaults to `limit = 30`.

4. **Timestamp management:** Models manually set `createdAt` and `updatedAt` on insert, and `updatedAt` on update, even though the schema defines database-level defaults and `ON UPDATE CURRENT_TIMESTAMP`. Exception: `MessageModel.create` and `LoginRewardModel.create` rely on database defaults.

5. **Error wrapping:** All methods wrap errors in a new `Error` with a descriptive prefix, e.g., `"Error creating user: <original message>"`.

6. **Delete-after-fetch:** Most `delete` methods fetch the record before deleting it so the deleted data can be returned to the caller.

7. **Instance save methods:** `GameLogModel` and `MessageModel` include an instance-level `save()` method that provides upsert behavior, allowing objects to be used in a more ORM-like fashion.

8. **Mongoose-style query syntax:** Several models (`TransactionModel.find`, `GameLogModel.getLogsWithFilters`) support MongoDB-style query operators (`$gte`, `$lte`, `$regex`) that are translated into SQL equivalents.

---

## Related Documents

- [Database Schema](./schema.md) -- table definitions, column types, and indexes
- [Migrations](./migrations.md) -- how the schema evolved over time
- [Testing Strategy](../08-testing/testing-strategy.md) -- planned unit tests for model methods
- [Login Rewards](../03-features/login-rewards.md) -- detailed documentation of the login rewards feature
- [Balance System](../03-features/balance-system.md) -- how balance changes are tracked
