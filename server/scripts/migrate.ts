import dotenv from 'dotenv';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db, closeDB } from '../drizzle/db.js';

dotenv.config();

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    await migrate(db, { 
      migrationsFolder: './drizzle/migrations' 
    });
    
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await closeDB();
    process.exit(0);
  }
}

runMigrations(); 