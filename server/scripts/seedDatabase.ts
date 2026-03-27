// @ts-nocheck -- TODO: fix Drizzle/Express type errors and remove this directive
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

// Import Drizzle database and schema
import { db, closeDB } from '../drizzle/db.js';
import { users, balances, gameStats, account } from '../drizzle/schema.js';

dotenv.config();

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    // Check if admin user already exists
    const existingAdmin = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
    
    if (existingAdmin.length === 0) {
      console.log('Creating admin user...');
      
      // Hash the password
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      // Create admin user with Better Auth fields
      await db.insert(users).values({
        username: 'admin',
        name: 'admin',
        email: 'admin@platinum.local',
        emailVerified: true,
        displayUsername: 'admin',
        passwordHash: hashedPassword,
        role: 'admin',
        balance: '100000',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Get the created admin user
      const createdAdmin = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
      const adminId = createdAdmin[0].id;

      // Create Better Auth account record
      await db.insert(account).values({
        userId: adminId,
        accountId: String(adminId),
        providerId: 'credential',
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create admin balance record
      await db.insert(balances).values({
        userId: adminId,
        amount: '100000',
        previousBalance: '0',
        changeAmount: '100000',
        type: 'deposit',
        note: 'Admin account creation - initial balance',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }

    // Create some test player accounts
    const testPlayers = [
      { username: 'player1' },
      { username: 'player2' },
      { username: 'player3' }
    ];

    for (const playerData of testPlayers) {
      const existingPlayer = await db.select().from(users).where(eq(users.username, playerData.username)).limit(1);
      
      if (existingPlayer.length === 0) {
        console.log(`Creating test player: ${playerData.username}...`);
        
        // Hash the password
        const hashedPassword = await bcrypt.hash('password123', 12);
        
        // Create player user with Better Auth fields
        await db.insert(users).values({
          username: playerData.username,
          name: playerData.username,
          email: `${playerData.username}@platinum.local`,
          emailVerified: true,
          displayUsername: playerData.username,
          passwordHash: hashedPassword,
          role: 'user',
          balance: '1000',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Get the created player user
        const createdPlayer = await db.select().from(users).where(eq(users.username, playerData.username)).limit(1);
        const playerId = createdPlayer[0].id;

        // Create Better Auth account record
        await db.insert(account).values({
          userId: playerId,
          accountId: String(playerId),
          providerId: 'credential',
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Create player balance record
        await db.insert(balances).values({
          userId: playerId,
          amount: '1000',
          previousBalance: '0',
          changeAmount: '1000',
          type: 'deposit',
          note: 'Player account creation - initial balance',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        console.log(`Test player ${playerData.username} created successfully`);
      } else {
        console.log(`Test player ${playerData.username} already exists`);
      }
    }

    // Initialize game statistics
    console.log('Initializing game statistics...');
    
    const gameTypes = [
      { type: 'roulette', name: 'Roulette' },
      { type: 'blackjack', name: 'Blackjack' },
      { type: 'crash', name: 'Crash' },
      { type: 'plinko', name: 'Plinko' },
      { type: 'wheel', name: 'Wheel' }
    ];

    for (const game of gameTypes) {
      const existingStat = await db.select().from(gameStats).where(eq(gameStats.gameType, game.type)).limit(1);
      
      if (existingStat.length === 0) {
        await db.insert(gameStats).values({
          gameType: game.type,
          name: game.name,
          totalGamesPlayed: 0,
          totalBetsAmount: '0',
          totalWinningsAmount: '0',
          houseProfit: '0',
          dailyStats: JSON.stringify([]),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`Created game stats for ${game.name}`);
      } else {
        console.log(`Game stats for ${game.name} already exist`);
      }
    }

    console.log('Database seeding completed successfully!');
    
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await closeDB();
    process.exit(0);
  }
}

// Run the seeding
seedDatabase();