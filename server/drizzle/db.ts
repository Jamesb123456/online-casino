import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.js';
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool
const poolConnection = mysql.createPool({
  uri: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/casino',
  waitForConnections: true,
  connectionLimit: 20,
  maxIdle: 20,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Create drizzle instance
export const db = drizzle(poolConnection, { 
  schema,
  mode: 'default'
});

// Test connection function
export const connectDB = async () => {
  try {
    const connection = await poolConnection.getConnection();
    console.log('MySQL connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('MySQL connection error:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
export const closeDB = async () => {
  await poolConnection.end();
  console.log('MySQL connection pool closed');
};

export default db; 