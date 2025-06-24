/**
 * Initialize game statistics in the database
 * This script creates default entries for all game types 
 * Run this script when setting up the database for the first time
 */
import mongoose from 'mongoose';
import GameStat from '../models/GameStat.js';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected for initializing game stats'))
.catch(err => console.error('MongoDB connection error:', err));

// Game types with their display names
const gameTypes = [
  { type: 'roulette', name: 'Roulette' },
  { type: 'blackjack', name: 'Blackjack' },
  { type: 'crash', name: 'Crash' },
  { type: 'slots', name: 'Slots' },
  { type: 'landmines', name: 'Landmines' },
  { type: 'plinko', name: 'Plinko' },
  { type: 'wheel', name: 'Wheel' }
];

// Create a date for today at midnight
const today = new Date();
today.setHours(0, 0, 0, 0);

/**
 * Initialize game statistics
 */
async function initGameStats() {
  try {
    console.log('Initializing game statistics...');
    
    // Check if stats already exist
    const existingStats = await GameStat.countDocuments();
    
    if (existingStats > 0) {
      console.log(`Game statistics already exist: ${existingStats} entries found`);
      process.exit(0);
    }
    
    // Create default entries for each game type
    const promises = gameTypes.map(game => {
      return GameStat.create({
        gameType: game.type,
        name: game.name,
        totalGamesPlayed: 0,
        totalBetsAmount: 0,
        totalWinningsAmount: 0,
        houseProfit: 0,
        dailyStats: [{
          date: today,
          gamesPlayed: 0,
          betsAmount: 0,
          winningsAmount: 0,
          profit: 0
        }],
        updatedAt: new Date()
      });
    });
    
    await Promise.all(promises);
    console.log(`Successfully initialized ${gameTypes.length} game statistics entries`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error initializing game statistics:', error);
    process.exit(1);
  }
}

// Run the initialization
initGameStats();
