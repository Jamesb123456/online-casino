/**
 * Direct database helpers for integration test assertions.
 * Bypasses the application layer to set up test state and verify results.
 */
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

// These are imported lazily to avoid circular dependency issues with env setup
let _db: any = null;
let _schema: any = null;

async function getDb() {
  if (!_db) {
    const mod = await import('../../../drizzle/db.js');
    _db = mod.db;
  }
  return _db;
}

async function getSchema() {
  if (!_schema) {
    _schema = await import('../../../drizzle/schema.js');
  }
  return _schema;
}

/**
 * Set a user's balance directly in the database.
 */
export async function setBalance(userId: number, amount: string | number): Promise<void> {
  const db = await getDb();
  const schema = await getSchema();
  await db.update(schema.users)
    .set({ balance: String(amount) })
    .where(eq(schema.users.id, userId));
}

/**
 * Get a user's current balance from the database.
 */
export async function getBalance(userId: number): Promise<string> {
  const db = await getDb();
  const schema = await getSchema();
  const [row] = await db.select({ balance: schema.users.balance })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return row?.balance || '0';
}

/**
 * Get all transactions for a user.
 */
export async function getTransactions(userId: number): Promise<any[]> {
  const db = await getDb();
  const schema = await getSchema();
  return db.select()
    .from(schema.transactions)
    .where(eq(schema.transactions.userId, userId));
}

/**
 * Get a user by ID.
 */
export async function getUser(userId: number): Promise<any> {
  const db = await getDb();
  const schema = await getSchema();
  const [row] = await db.select()
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return row;
}

/**
 * Get a user's ID by username.
 */
export async function getUserIdByUsername(username: string): Promise<number | null> {
  const db = await getDb();
  const schema = await getSchema();
  const [row] = await db.select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username));
  return row?.id || null;
}

/**
 * Truncate game-related tables to reset state between tests.
 * Preserves user accounts but clears transactions and game data.
 */
export async function clearGameData(): Promise<void> {
  const db = await getDb();
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  await db.execute(sql`TRUNCATE TABLE transactions`);
  await db.execute(sql`TRUNCATE TABLE balances`);
  await db.execute(sql`TRUNCATE TABLE game_sessions`);
  await db.execute(sql`TRUNCATE TABLE game_logs`);
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}

/**
 * Truncate ALL tables. Use in global setup/teardown only.
 */
export async function truncateAllTables(): Promise<void> {
  const db = await getDb();
  const tables = [
    'login_rewards', 'messages', 'game_stats', 'balances',
    'game_logs', 'game_sessions', 'transactions',
    'verification', 'account', 'session', 'users',
  ];
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  for (const table of tables) {
    await db.execute(sql.raw(`TRUNCATE TABLE \`${table}\``));
  }
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
