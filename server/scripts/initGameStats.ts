/**
 * Initialize game statistics in the database
 * This script creates default entries for all game types
 * Run this script when setting up the database for the first time
 */
import dotenv from 'dotenv';

// Import Drizzle models
import GameStatModel from '../drizzle/models/GameStat.js';
import { db } from '../drizzle/db.js';
import LoggingService from '../src/services/loggingService.js';

const logger = LoggingService.logger;

dotenv.config();

/**
 * Initialize game statistics for all supported games
 */
async function initializeGameStats() {
  try {
    logger.info('Initializing game statistics...');

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
      const existingStat = await GameStatModel.findByGameType(game.type);

      if (!existingStat) {
        // Create new game stats
        await GameStatModel.create({
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

        logger.info(`Created game stats for ${game.name}`);
        created++;
      } else {
        logger.info(`Game stats for ${game.name} already exist`);
        existing++;
      }
    }

    logger.info('=== Summary ===');
    logger.info(`Created: ${created} new game stat records`);
    logger.info(`Existing: ${existing} game stat records`);
    logger.info(`Total games: ${gameTypes.length}`);

    if (created > 0) {
      logger.info('Game statistics initialization completed successfully!');
    } else {
      logger.info('All game statistics were already initialized.');
    }

  } catch (error) {
    logger.error('Error initializing game statistics', { error: String(error) });
    process.exit(1);
  } finally {
    // Close database connection
    await db.$client.end();
    logger.info('Database connection closed.');
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Operation cancelled.');
  await db.$client.end();
  process.exit(0);
});

// Run the initialization
initializeGameStats();
