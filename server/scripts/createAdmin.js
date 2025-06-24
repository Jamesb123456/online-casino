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
    console.log('=== Admin User Creation ===\n');

    // Check if admin already exists
    const existingAdmin = await UserModel.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('An admin user already exists.');
      const overwrite = await askQuestion('Do you want to create another admin? (y/N): ');
      
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Admin creation cancelled.');
        return;
      }
    }

    // Get admin details
    const username = await askQuestion('Enter admin username: ');
    const email = await askQuestion('Enter admin email: ');
    const password = await askQuestion('Enter admin password: ');

    if (!username || !email || !password) {
      console.log('All fields are required.');
      return;
    }

    // Check if username already exists
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
      console.log('Username already exists. Please choose a different username.');
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin user
    const adminUser = await UserModel.create({
      username,
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
      createdAt: new Date()
    });

    // Create initial balance
    await Balance.create({
      userId: adminUser.id,
      amount: 100000, // Admin starts with 100k
      prevAmount: 0,
      changeAmount: 100000,
      changeType: 'credit',
      reason: 'initial_balance',
      description: 'Admin account creation',
      createdAt: new Date()
    });

    console.log('\n✅ Admin user created successfully!');
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
    console.log(`ID: ${adminUser.id}`);
    console.log(`Initial Balance: 100,000`);

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