import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

// Import Drizzle models
import UserModel from '../drizzle/models/User.js';
import BalanceModel from '../drizzle/models/Balance.js';
import { db } from '../drizzle/db.js';
import { account } from '../drizzle/schema.js';
import LoggingService from '../src/services/loggingService.js';

const logger = LoggingService.logger;

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function createAdmin() {
  try {
    logger.info('Creating new admin user...');

    const username = await askQuestion('Enter admin username: ');
    const password = await askQuestion('Enter admin password: ');

    if (!username || !password) {
      logger.warn('Username and password are required!');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
      logger.warn(`User with username '${username}' already exists!`);
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password as string, 12);

    // Create admin user with Better Auth required fields
    const newAdmin = await UserModel.create({
      username: username as string,
      passwordHash: hashedPassword,
      name: username as string,
      email: `${username}@platinum.local`,
      emailVerified: true,
      displayUsername: username as string,
      role: 'admin',
      balance: '100000',
      isActive: true,
      createdAt: new Date()
    } as any);

    // Create Better Auth account record
    await db.insert(account).values({
      userId: newAdmin.id,
      accountId: String(newAdmin.id),
      providerId: 'credential',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    logger.info('Admin user created successfully!');
    logger.info('Admin Details:', { username });

  } catch (error) {
    logger.error('Error creating admin user', { error: error.message });
  } finally {
    // Close readline interface and database connection
    rl.close();
    await db.$client.end();
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Operation cancelled.');
  rl.close();
  await db.$client.end();
  process.exit(0);
});

// Run the admin creation
createAdmin();
