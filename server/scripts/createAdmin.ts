// @ts-nocheck
require('dotenv').config();
const bcrypt = require('bcryptjs');
const readline = require('readline');

// Import Drizzle models
const UserModel = require('../drizzle/models/User');
const Balance = require('../drizzle/models/Balance');
const { db } = require('../drizzle/db');

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

    // Create admin user
    const newAdmin = await UserModel.create({
      username,
      passwordHash: hashedPassword,
      role: 'admin',
      balance: '100000', // Starting balance
      isActive: true,
      createdAt: new Date()
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('Admin Details:');
    console.log(`Username: ${username}`);

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
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