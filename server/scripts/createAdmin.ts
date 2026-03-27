// @ts-nocheck -- TODO: fix Drizzle/Express type errors and remove this directive
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

// Import Drizzle models
import UserModel from '../drizzle/models/User.js';
import BalanceModel from '../drizzle/models/Balance.js';
import { db } from '../drizzle/db.js';
import { account } from '../drizzle/schema.js';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function createAdmin() {
  try {
    console.log('Creating new admin user...\n');

    const username = await askQuestion('Enter admin username: ');
    const password = await askQuestion('Enter admin password: ');

    if (!username || !password) {
      console.log('Username and password are required!');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
      console.log(`User with username '${username}' already exists!`);
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin user with Better Auth required fields
    const newAdmin = await UserModel.create({
      username,
      passwordHash: hashedPassword,
      name: username,
      email: `${username}@platinum.local`,
      emailVerified: true,
      displayUsername: username,
      role: 'admin',
      balance: '100000',
      isActive: true,
      createdAt: new Date()
    });

    // Create Better Auth account record
    await db.insert(account).values({
      userId: newAdmin.id,
      accountId: String(newAdmin.id),
      providerId: 'credential',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('\nAdmin user created successfully!');
    console.log('Admin Details:');
    console.log(`Username: ${username}`);

  } catch (error) {
    console.error('Error creating admin user:', error.message);
  } finally {
    // Close readline interface and database connection
    rl.close();
    await db.$client.end();
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\nOperation cancelled.');
  rl.close();
  await db.$client.end();
  process.exit(0);
});

// Run the admin creation
createAdmin();
