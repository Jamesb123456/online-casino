// @ts-nocheck
/**
 * Initialize game statistics in the database
 * This script creates default entries for all game types 
 * Run this script when setting up the database for the first time
 */
require('dotenv').config();

// Import Drizzle models
const GameStat = require('../drizzle/models/GameStat');
const { db } = require('../drizzle/db');

/**
 * Initialize game statistics for all supported games
 */
async function initializeGameStats() {
  try {
    console.log('Initializing game statistics...');

    const gameTypes = [
      { type: 'roulette', name: 'Roulette' },
      { type: 'blackjack', name: 'Blackjack' },
      { type: 'crash', name: 'Crash' },
      { type: 'landmines', name: 'Landmines' },
      { type: 'plinko', name: 'Plinko' },
      { type: 'wheel', name: 'Wheel' }
    ];

    let created = 0;
    let existing = 0;

    for (const game of gameTypes) {
      // Check if game stats already exist
      const existingStat = await GameStat.findOne({ gameType: game.type });
      
      if (!existingStat) {
        // Create new game stats
        await GameStat.create({
          gameType: game.type,
          name: game.name,
          totalGamesPlayed: 0,
          totalBetsAmount: 0,
          totalWinningsAmount: 0,
          houseProfit: 0,
          dailyStats: JSON.stringify([]),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`✅ Created game stats for ${game.name}`);
        created++;
      } else {
        console.log(`⚪ Game stats for ${game.name} already exist`);
        existing++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Created: ${created} new game stat records`);
    console.log(`Existing: ${existing} game stat records`);
    console.log(`Total games: ${gameTypes.length}`);
    
    if (created > 0) {
      console.log('\n✅ Game statistics initialization completed successfully!');
    } else {
      console.log('\n⚪ All game statistics were already initialized.');
    }

  } catch (error) {
    console.error('❌ Error initializing game statistics:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await db.$client.end();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\nOperation cancelled.');
  await db.$client.end();
  process.exit(0);
});

// Run the initialization
initializeGameStats();
