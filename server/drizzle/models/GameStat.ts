// @ts-nocheck -- TODO: fix Drizzle/Express type errors and remove this directive
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import db from '../db.js';
import { gameStats } from '../schema.js';

class GameStatModel {
  // Create a new game stat
  static async create(statData) {
    try {
      const result = await db.insert(gameStats).values({
        ...statData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const [stat] = await db.select().from(gameStats).where(eq(gameStats.id, (result as any).insertId));
      return stat;
    } catch (error) {
      throw new Error(`Error creating game stat: ${error.message}`);
    }
  }

  // Find stat by ID
  static async findById(id) {
    try {
      const [stat] = await db.select().from(gameStats).where(eq(gameStats.id, id));
      if (stat && stat.dailyStats) {
        stat.dailyStats = JSON.parse(stat.dailyStats);
      }
      return stat || null;
    } catch (error) {
      throw new Error(`Error finding game stat by ID: ${error.message}`);
    }
  }

  // Find stat by game type
  static async findByGameType(gameType) {
    try {
      const [stat] = await db.select().from(gameStats).where(eq(gameStats.gameType, gameType));
      if (stat && stat.dailyStats) {
        stat.dailyStats = JSON.parse(stat.dailyStats);
      }
      return stat || null;
    } catch (error) {
      throw new Error(`Error finding game stat by game type: ${error.message}`);
    }
  }

  // Get all game stats
  static async findAll() {
    try {
      const stats = await db.select().from(gameStats);
      return stats;
    } catch (error) {
      throw new Error(`Error finding all game stats: ${error.message}`);
    }
  }

  // Update game statistics after a game is played
  static async updateStats(gameType, betAmount, winAmount) {
    try {
      const gameName = gameType.charAt(0).toUpperCase() + gameType.slice(1);
      
      // Get today's date (without time) for daily stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Calculate profit for this game
      const profit = betAmount - winAmount;
      
      // Find existing stats
      const existingStat = await this.findByGameType(gameType);
      
      if (existingStat) {
        // Get existing daily stats
        const dailyStats = existingStat.dailyStats || [];
        
        // Find or create today's daily stats
        const todayStatsIndex = dailyStats.findIndex(
          stats => new Date(stats.date).toDateString() === today.toDateString()
        );
        
        if (todayStatsIndex !== -1) {
          // Update today's stats
          dailyStats[todayStatsIndex].gamesPlayed += 1;
          dailyStats[todayStatsIndex].betsAmount += betAmount;
          dailyStats[todayStatsIndex].winningsAmount += winAmount;
          dailyStats[todayStatsIndex].profit += profit;
        } else {
          // Create today's stats
          dailyStats.push({
            date: today,
            gamesPlayed: 1,
            betsAmount: betAmount,
            winningsAmount: winAmount,
            profit
          });
        }
        
        // Keep only the last 30 days of daily stats
        if (dailyStats.length > 30) {
          dailyStats.sort((a, b) => new Date(b.date) - new Date(a.date));
          dailyStats.splice(30);
        }
        
        // Update overall stats
        await db
          .update(gameStats)
          .set({
            totalGamesPlayed: existingStat.totalGamesPlayed + 1,
            totalBetsAmount: existingStat.totalBetsAmount + betAmount,
            totalWinningsAmount: existingStat.totalWinningsAmount + winAmount,
            houseProfit: existingStat.houseProfit + profit,
            dailyStats: JSON.stringify(dailyStats),
            updatedAt: new Date()
          })
          .where(eq(gameStats.id, existingStat.id));
      } else {
        // Create new game stats
        const newStat = await this.create({
          gameType,
          name: gameName,
          totalGamesPlayed: 1,
          totalBetsAmount: betAmount,
          totalWinningsAmount: winAmount,
          houseProfit: profit,
          dailyStats: JSON.stringify([{
            date: today,
            gamesPlayed: 1,
            betsAmount: betAmount,
            winningsAmount: winAmount,
            profit
          }]),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error(`Error updating game stats for ${gameType}:`, error);
      throw new Error(`Error updating game stats: ${error.message}`);
    }
  }

  // Update stat
  static async update(id, updateData) {
    try {
      await db
        .update(gameStats)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(gameStats.id, id));

      const [updatedStat] = await db.select().from(gameStats).where(eq(gameStats.id, id));
      return updatedStat;
    } catch (error) {
      throw new Error(`Error updating game stat: ${error.message}`);
    }
  }

  // Update stat by game type
  static async updateByGameType(gameType, updateData) {
    try {
      await db
        .update(gameStats)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(gameStats.gameType, gameType));

      const [updatedStat] = await db.select().from(gameStats).where(eq(gameStats.gameType, gameType));
      return updatedStat;
    } catch (error) {
      throw new Error(`Error updating game stat by game type: ${error.message}`);
    }
  }

  // Delete stat
  static async delete(id) {
    try {
      const [deletedStat] = await db.select().from(gameStats).where(eq(gameStats.id, id));
      await db.delete(gameStats).where(eq(gameStats.id, id));

      return deletedStat;
    } catch (error) {
      throw new Error(`Error deleting game stat: ${error.message}`);
    }
  }

  // Initialize game stats for all game types
  static async initializeAllGameTypes() {
    try {
      const gameTypes = ['roulette', 'blackjack', 'crash', 'slots', 'landmines', 'plinko', 'wheel'];
      const initializedStats = [];

      for (const gameType of gameTypes) {
        const existing = await this.findByGameType(gameType);
        if (!existing) {
          const gameName = gameType.charAt(0).toUpperCase() + gameType.slice(1);
          const newStat = await this.create({
            gameType,
            name: gameName,
            totalGamesPlayed: 0,
            totalBetsAmount: '0',
            totalWinningsAmount: '0',
            houseProfit: '0',
            dailyStats: [],
          });
          initializedStats.push(newStat);
        }
      }

      return initializedStats;
    } catch (error) {
      throw new Error(`Error initializing game types: ${error.message}`);
    }
  }

  // Get game statistics summary
  static async getStatsSummary() {
    try {
      const allStats = await this.findAll();
      
      let totalGames = 0;
      let totalBets = 0;
      let totalWinnings = 0;
      let totalProfit = 0;

      allStats.forEach(stat => {
        totalGames += stat.totalGamesPlayed;
        totalBets += parseFloat(stat.totalBetsAmount || 0);
        totalWinnings += parseFloat(stat.totalWinningsAmount || 0);
        totalProfit += parseFloat(stat.houseProfit || 0);
      });

      return {
        totalGames,
        totalBets,
        totalWinnings,
        totalProfit,
        gameCount: allStats.length,
        averageBetPerGame: totalGames > 0 ? totalBets / totalGames : 0,
        houseEdgePercentage: totalBets > 0 ? (totalProfit / totalBets) * 100 : 0,
      };
    } catch (error) {
      throw new Error(`Error getting stats summary: ${error.message}`);
    }
  }

  // Get daily stats for a specific game type
  static async getDailyStats(gameType, days = 30) {
    try {
      const stat = await this.findByGameType(gameType);
      if (!stat || !Array.isArray(stat.dailyStats)) {
        return [];
      }

      // Sort by date and return the most recent days
      const sortedStats = stat.dailyStats
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, days);

      return sortedStats;
    } catch (error) {
      throw new Error(`Error getting daily stats: ${error.message}`);
    }
  }
}

export default GameStatModel; 