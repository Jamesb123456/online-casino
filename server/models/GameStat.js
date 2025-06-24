import mongoose from 'mongoose';

/**
 * Game Statistics Schema
 * Stores aggregate statistics for each game type
 */
const gameStatSchema = new mongoose.Schema({
  gameType: {
    type: String,
    required: true,
    enum: ['roulette', 'blackjack', 'crash', 'slots', 'landmines', 'plinko', 'wheel'],
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  totalGamesPlayed: {
    type: Number,
    default: 0
  },
  totalBetsAmount: {
    type: Number,
    default: 0
  },
  totalWinningsAmount: {
    type: Number,
    default: 0
  },
  houseProfit: {
    type: Number,
    default: 0
  },
  // Daily stats for charts
  dailyStats: [{
    date: {
      type: Date,
      required: true
    },
    gamesPlayed: {
      type: Number,
      default: 0
    },
    betsAmount: {
      type: Number,
      default: 0
    },
    winningsAmount: {
      type: Number,
      default: 0
    },
    profit: {
      type: Number,
      default: 0
    }
  }],
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add index for faster lookups
gameStatSchema.index({ gameType: 1 });
gameStatSchema.index({ 'dailyStats.date': 1 });

/**
 * Update game statistics after a game is played
 * @param {String} gameType - The type of game
 * @param {Number} betAmount - The bet amount
 * @param {Number} winAmount - The amount won (0 if lost)
 */
gameStatSchema.statics.updateStats = async function(gameType, betAmount, winAmount) {
  try {
    const gameName = gameType.charAt(0).toUpperCase() + gameType.slice(1); // Capitalize first letter
    
    // Get today's date (without time) for daily stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate profit for this game
    const profit = betAmount - winAmount;
    
    // Find existing stats or create new one
    const existingStat = await this.findOne({ gameType });
    
    if (existingStat) {
      // Update overall stats
      existingStat.totalGamesPlayed += 1;
      existingStat.totalBetsAmount += betAmount;
      existingStat.totalWinningsAmount += winAmount;
      existingStat.houseProfit += profit;
      existingStat.updatedAt = new Date();
      
      // Find or create today's daily stats
      const todayStats = existingStat.dailyStats.find(
        stats => new Date(stats.date).toDateString() === today.toDateString()
      );
      
      if (todayStats) {
        // Update today's stats
        todayStats.gamesPlayed += 1;
        todayStats.betsAmount += betAmount;
        todayStats.winningsAmount += winAmount;
        todayStats.profit += profit;
      } else {
        // Create today's stats
        existingStat.dailyStats.push({
          date: today,
          gamesPlayed: 1,
          betsAmount: betAmount,
          winningsAmount: winAmount,
          profit
        });
      }
      
      // Keep only the last 30 days of daily stats
      if (existingStat.dailyStats.length > 30) {
        existingStat.dailyStats.sort((a, b) => new Date(b.date) - new Date(a.date));
        existingStat.dailyStats = existingStat.dailyStats.slice(0, 30);
      }
      
      await existingStat.save();
    } else {
      // Create new game stats
      await this.create({
        gameType,
        name: gameName,
        totalGamesPlayed: 1,
        totalBetsAmount: betAmount,
        totalWinningsAmount: winAmount,
        houseProfit: profit,
        dailyStats: [{
          date: today,
          gamesPlayed: 1,
          betsAmount: betAmount,
          winningsAmount: winAmount,
          profit
        }],
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error(`Error updating game stats for ${gameType}:`, error);
  }
};

const GameStat = mongoose.model('GameStat', gameStatSchema);
export default GameStat;
