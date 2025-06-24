import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

// Models
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import GameSession from '../models/GameSession.js';
import GameLog from '../models/GameLog.js';
import Balance from '../models/Balance.js';

// Config
dotenv.config({ path: '../.env' });

// Define MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/casino';

/**
 * Seed database with initial data
 */
const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected for seeding...');
    
    // Clear existing data (optional - uncomment if you want to start fresh)
    // await User.deleteMany({});
    // await Transaction.deleteMany({});
    // await GameSession.deleteMany({});
    // await GameLog.deleteMany({});
    // await Balance.deleteMany({});
    
    // Check if admin exists already
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      console.log('Creating admin user...');
      
      // Create admin user
      const adminPassword = 'admin123'; // Change this in production!
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      
      const admin = await User.create({
        username: 'admin',
        email: 'admin@casino.com',
        passwordHash: hashedPassword,
        role: 'admin',
        balance: 100000, // $100,000 initial admin balance
        isActive: true
      });
      
      console.log(`Admin user created with ID: ${admin._id}`);
      
      // Create initial balance record for admin
      await Balance.create({
        userId: admin._id,
        amount: 100000,
        previousBalance: 0,
        changeAmount: 100000,
        type: 'admin_adjustment',
        note: 'Initial admin balance',
        adminId: admin._id
      });
    }
    
    // Admin user creation complete
    const adminUser = adminExists || await User.findOne({ role: 'admin' });
    
    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  }
};

// Execute the seeding function
seedDatabase();