import mongoose from 'mongoose';

const GameSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  gameType: {
    type: String,
    enum: ['crash', 'plinko', 'wheel', 'roulette', 'blackjack'],
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    default: Date.now,
    index: true
  },
  endTime: {
    type: Date
  },
  initialBet: {
    type: Number,
    required: true
  },
  totalBet: {
    type: Number,
    default: function() {
      return this.initialBet;
    }
  },
  outcome: {
    type: Number,
    default: 0
  },
  finalMultiplier: {
    type: Number
  },
  gameState: {
    type: Object
  },
  isCompleted: {
    type: Boolean,
    default: false,
    index: true
  },
  resultDetails: {
    type: Object
  },
  transactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  logs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameLog'
  }]
}, {
  timestamps: true
});

// Add method to calculate profit/loss
GameSessionSchema.methods.calculateProfit = function() {
  return this.outcome - this.totalBet;
};

// Add static method to get stats for a specific gameType
GameSessionSchema.statics.getGameStats = async function(gameType, startDate, endDate) {
  const query = { gameType };
  
  if (startDate || endDate) {
    query.startTime = {};
    if (startDate) query.startTime.$gte = new Date(startDate);
    if (endDate) query.startTime.$lte = new Date(endDate);
  }
  
  const results = await this.aggregate([
    { $match: query },
    { $group: {
      _id: "$gameType",
      totalSessions: { $sum: 1 },
      totalBets: { $sum: "$totalBet" },
      totalOutcome: { $sum: "$outcome" },
      avgBet: { $avg: "$totalBet" }
    }},
    { $project: {
      _id: 0,
      gameType: "$_id",
      totalSessions: 1,
      totalBets: 1,
      totalOutcome: 1,
      houseEdge: { 
        $subtract: [1, { $divide: ["$totalOutcome", "$totalBets"] }]
      },
      avgBet: 1,
      profit: { $subtract: ["$totalBets", "$totalOutcome"] }
    }}
  ]);
  
  return results[0] || {
    gameType,
    totalSessions: 0,
    totalBets: 0,
    totalOutcome: 0,
    houseEdge: 0,
    avgBet: 0,
    profit: 0
  };
};

const GameSession = mongoose.model('GameSession', GameSessionSchema);

export default GameSession;