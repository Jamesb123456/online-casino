import dotenv from 'dotenv';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db, closeDB } from '../drizzle/db.js';
import LoggingService from '../src/services/loggingService.js';

const logger = LoggingService.logger;

dotenv.config();

async function runMigrations() {
  try {
    logger.info('Running database migrations...');

    await migrate(db, {
      migrationsFolder: './drizzle/migrations'
    });

    logger.info('Migrations completed successfully!');
  } catch (error) {
    logger.error('Migration failed', { error: String(error) });
    process.exit(1);
  } finally {
    await closeDB();
    process.exit(0);
  }
}

runMigrations();
