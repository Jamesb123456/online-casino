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
    
    // Create sample players if they don't exist
    const playerNames = [
      { username: 'player1', email: 'player1@example.com', initialBalance: 1000 },
      { username: 'player2', email: 'player2@example.com', initialBalance: 2000 },
      { username: 'player3', email: 'player3@example.com', initialBalance: 5000 },
      { username: 'highroller', email: 'highroller@example.com', initialBalance: 10000 },
      { username: 'newbie', email: 'newbie@example.com', initialBalance: 500 }
    ];
    
    const adminUser = adminExists || await User.findOne({ role: 'admin' });
    const samplePlayers = [];
    
    for (const player of playerNames) {
      const existingPlayer = await User.findOne({ username: player.username });
      
      if (!existingPlayer) {
        // Create new player
        const password = 'password123'; // Change this in production!
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const newPlayer = await User.create({
          username: player.username,
          email: player.email,
          passwordHash: hashedPassword,
          role: 'user',
          balance: player.initialBalance,
          isActive: true
        });
        
        console.log(`Created player: ${player.username}`);
        samplePlayers.push(newPlayer);
        
        // Create initial balance record for player
        await Balance.create({
          userId: newPlayer._id,
          amount: player.initialBalance,
          previousBalance: 0,
          changeAmount: player.initialBalance,
          type: 'admin_adjustment',
          note: 'Initial player balance',
          adminId: adminUser._id
        });
        
        // Create initial transaction for the player
        await Transaction.create({
          userId: newPlayer._id,
          type: 'deposit',
          amount: player.initialBalance,
          balanceBefore: 0,
          balanceAfter: player.initialBalance,
          status: 'completed',
          createdBy: adminUser._id,
          description: 'Initial account funding',
          notes: [{
            text: 'System generated initial balance',
            addedBy: adminUser._id
          }]
        });
      } else {
        console.log(`Player ${player.username} already exists.`);
        samplePlayers.push(existingPlayer);
      }
    }
    
    // Generate sample game sessions and logs if none exist
    const existingGameSessions = await GameSession.countDocuments();
    
    if (existingGameSessions === 0 && samplePlayers.length > 0) {
      console.log('Generating sample game data...');
      
      const gameTypes = ['crash', 'plinko', 'wheel', 'roulette', 'chicken', 'blackjack'];
      
      // Generate between 3-5 game sessions for each player for each game type
      for (const player of samplePlayers) {
        for (const gameType of gameTypes) {
          const sessionCount = Math.floor(Math.random() * 3) + 3; // 3-5 sessions
          
          for (let i = 0; i < sessionCount; i++) {
            // Create a game session with random data
            const initialBet = Math.floor(Math.random() * 500) + 50; // Bet between $50-$550
            const isWin = Math.random() > 0.4; // 60% chance of winning
            let multiplier = 1.0;
            let outcome = 0;
            
            switch (gameType) {
              case 'crash':
                multiplier = isWin ? (Math.random() * 3) + 1 : 0;
                break;
              case 'plinko':
                multiplier = isWin ? (Math.random() * 2) + 1 : 0.5;
                break;
              case 'wheel':
                multiplier = isWin ? (Math.random() * 5) + 1 : 0;
                break;
              case 'roulette':
                multiplier = isWin ? 2 : 0;
                break;
              case 'chicken':
                multiplier = isWin ? (Math.random() * 3) + 1 : 0;
                break;
              case 'blackjack':
                multiplier = isWin ? 2 : 0;
                break;
            }
            
            outcome = isWin ? initialBet * multiplier : 0;
            
            // Randomize dates within last 30 days
            const daysAgo = Math.floor(Math.random() * 30);
            const hours = Math.floor(Math.random() * 24);
            const startTime = new Date();
            startTime.setDate(startTime.getDate() - daysAgo);
            startTime.setHours(hours, Math.floor(Math.random() * 60));
            
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + Math.floor(Math.random() * 10) + 1);
            
            // Create game session
            const session = await GameSession.create({
              userId: player._id,
              gameType,
              startTime,
              endTime,
              initialBet,
              totalBet: initialBet,
              outcome,
              finalMultiplier: multiplier,
              isCompleted: true,
              gameState: {
                result: isWin ? 'win' : 'loss',
                finalValue: multiplier
              },
              resultDetails: {
                isWin,
                multiplier,
                payout: outcome
              }
            });
            
            // Create transaction for the game
            const transaction = await Transaction.create({
              userId: player._id,
              type: isWin ? 'game_win' : 'game_loss',
              gameType,
              amount: isWin ? outcome - initialBet : -initialBet,
              balanceBefore: player.balance,
              balanceAfter: player.balance + (isWin ? outcome - initialBet : -initialBet),
              status: 'completed',
              gameSessionId: session._id,
              description: `${gameType} game ${isWin ? 'win' : 'loss'}`
            });
            
            // Update session with transaction reference
            session.transactions = [transaction._id];
            await session.save();
            
            // Create logs for the session
            const sessionStartLog = await GameLog.create({
              sessionId: session._id,
              userId: player._id,
              gameType,
              eventType: 'session_start',
              eventDetails: {
                initialBet
              },
              timestamp: startTime
            });
            
            const betPlacedLog = await GameLog.create({
              sessionId: session._id,
              userId: player._id,
              gameType,
              eventType: 'bet_placed',
              eventDetails: {
                amount: initialBet
              },
              amount: initialBet,
              timestamp: new Date(startTime.getTime() + 10000) // 10 seconds after start
            });
            
            const gameResultLog = await GameLog.create({
              sessionId: session._id,
              userId: player._id,
              gameType,
              eventType: 'game_result',
              eventDetails: {
                result: isWin ? 'win' : 'loss',
                multiplier,
                payout: outcome
              },
              amount: isWin ? outcome : 0,
              timestamp: endTime
            });
            
            const resultTypeLog = await GameLog.create({
              sessionId: session._id,
              userId: player._id,
              gameType,
              eventType: isWin ? 'win' : 'loss',
              eventDetails: {
                multiplier,
                payout: outcome,
                betAmount: initialBet
              },
              amount: isWin ? outcome : 0,
              timestamp: new Date(endTime.getTime() + 1000)
            });
            
            // Add logs to session
            session.logs = [
              sessionStartLog._id,
              betPlacedLog._id,
              gameResultLog._id,
              resultTypeLog._id
            ];
            await session.save();
            
            // Create balance record
            await Balance.create({
              userId: player._id,
              amount: player.balance + (isWin ? outcome - initialBet : -initialBet),
              previousBalance: player.balance,
              changeAmount: isWin ? outcome - initialBet : -initialBet,
              type: isWin ? 'win' : 'loss',
              gameType,
              relatedSessionId: session._id,
              transactionId: transaction._id
            });
            
            // Update player balance
            player.balance += isWin ? outcome - initialBet : -initialBet;
            await player.save();
          }
        }
      }
    }
    
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