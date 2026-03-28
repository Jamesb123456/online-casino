/**
 * Migration script: Migrate existing users to Better Auth
 *
 * This script:
 * 1. Adds Better Auth columns to the users table
 * 2. Creates session, account, and verification tables
 * 3. Migrates existing user data (email, name, account records)
 *
 * Run: node --loader ts-node/esm scripts/migrateToBetterAuth.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { db } from '../drizzle/db.js';
import { users, account } from '../drizzle/schema.js';
import { sql } from 'drizzle-orm';
import LoggingService from '../src/services/loggingService.js';

const logger = LoggingService.logger;

async function migrate() {
  logger.info('Starting Better Auth migration...');

  // Step 1: Add new columns to users table (ignore errors if they already exist)
  const alterStatements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS display_username VARCHAR(30) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_expires TIMESTAMP DEFAULT NULL`,
    // Change role from ENUM to VARCHAR if needed
    `ALTER TABLE users MODIFY COLUMN role VARCHAR(20) DEFAULT 'user'`,
    // Make password_hash nullable (Better Auth stores passwords in account table)
    `ALTER TABLE users MODIFY COLUMN password_hash TEXT DEFAULT NULL`,
  ];

  for (const stmt of alterStatements) {
    try {
      await db.execute(sql.raw(stmt));
      logger.info(`OK: ${stmt.substring(0, 60)}...`);
    } catch (err: any) {
      // Ignore "duplicate column" or similar errors
      if (err.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
        logger.info(`SKIP (already exists): ${stmt.substring(0, 60)}...`);
      } else {
        logger.warn(`WARN: ${err.message}`);
      }
    }
  }

  // Add unique index on email (ignore if exists)
  try {
    await db.execute(sql.raw(`ALTER TABLE users ADD UNIQUE INDEX users_email_idx (email)`));
    logger.info('OK: Added unique email index');
  } catch (err: any) {
    logger.info('SKIP: email index may already exist');
  }

  // Step 2: Create session table
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS session (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(255) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        ip_address VARCHAR(45) DEFAULT NULL,
        user_agent TEXT DEFAULT NULL,
        impersonated_by VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX session_token_idx (token),
        INDEX session_user_id_idx (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `));
    logger.info('OK: Created session table');
  } catch (err: any) {
    logger.info(`SKIP: session table - ${err.message}`);
  }

  // Step 3: Create account table
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS account (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        account_id VARCHAR(255) NOT NULL,
        provider_id VARCHAR(255) NOT NULL,
        access_token TEXT DEFAULT NULL,
        refresh_token TEXT DEFAULT NULL,
        access_token_expires_at TIMESTAMP DEFAULT NULL,
        refresh_token_expires_at TIMESTAMP DEFAULT NULL,
        scope TEXT DEFAULT NULL,
        id_token TEXT DEFAULT NULL,
        password TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX account_user_id_idx (user_id),
        INDEX account_account_id_idx (account_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `));
    logger.info('OK: Created account table');
  } catch (err: any) {
    logger.info(`SKIP: account table - ${err.message}`);
  }

  // Step 4: Create verification table
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS verification (
        id INT AUTO_INCREMENT PRIMARY KEY,
        identifier VARCHAR(255) NOT NULL,
        value VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `));
    logger.info('OK: Created verification table');
  } catch (err: any) {
    logger.info(`SKIP: verification table - ${err.message}`);
  }

  // Step 5: Migrate existing users
  logger.info('Migrating existing users...');
  const existingUsers = await db.select().from(users);
  logger.info(`Found ${existingUsers.length} users to migrate`);

  for (const user of existingUsers) {
    // Update user with Better Auth fields
    try {
      const email = `${user.username}@platinum.local`;
      await db.execute(
        sql.raw(
          `UPDATE users SET name = ?, email = ?, email_verified = TRUE, display_username = ? WHERE id = ? AND (email IS NULL OR email = '')`,
        ),
      );
      // Use parameterized query via raw SQL
      await db.execute(
        sql`UPDATE users SET name = ${user.username}, email = ${email}, email_verified = TRUE, display_username = ${user.username} WHERE id = ${user.id} AND (email IS NULL OR email = '')`,
      );
    } catch (err: any) {
      logger.warn(`WARN: Could not update user ${user.id}: ${err.message}`);
    }

    // Create account record if one doesn't exist
    try {
      const existingAccount = await db
        .select()
        .from(account)
        .where(sql`user_id = ${user.id} AND provider_id = 'credential'`);

      if (existingAccount.length === 0 && user.passwordHash) {
        await db.insert(account).values({
          userId: user.id,
          accountId: String(user.id),
          providerId: 'credential',
          password: user.passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        logger.info(`OK: Created account record for user ${user.id} (${user.username})`);
      } else {
        logger.info(`SKIP: Account already exists for user ${user.id}`);
      }
    } catch (err: any) {
      logger.warn(`WARN: Could not create account for user ${user.id}: ${err.message}`);
    }
  }

  logger.info('Migration complete!');
  process.exit(0);
}

migrate().catch((err) => {
  LoggingService.logger.error('Migration failed', { error: String(err) });
  process.exit(1);
});
