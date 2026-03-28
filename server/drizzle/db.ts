import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.js';
import dotenv from 'dotenv';
import LoggingService from '../src/services/loggingService.js';

dotenv.config();

// Parse DATABASE_URL to handle special characters in password
function parseDBConfig() {
  const dbUrl = process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/casino';
  
  try {
    const url = new URL(dbUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      waitForConnections: true,
      connectionLimit: 20,
      maxIdle: 20,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };
  } catch (error) {
    LoggingService.logger.error('Error parsing DATABASE_URL', { error: String(error) });
    throw new Error('Invalid DATABASE_URL format');
  }
}

// Create connection pool
const poolConnection = mysql.createPool(parseDBConfig());

// Create drizzle instance
export const db = drizzle(poolConnection, { 
  schema,
  mode: 'default'
});

// Test connection function
export const connectDB = async () => {
  try {
    const connection = await poolConnection.getConnection();
    LoggingService.logger.info('MySQL connected successfully');
    connection.release();
    return true;
  } catch (error) {
    LoggingService.logger.error('MySQL connection error', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
};

// Graceful shutdown
export const closeDB = async () => {
  await poolConnection.end();
  LoggingService.logger.info('MySQL connection pool closed');
};

export default db; 