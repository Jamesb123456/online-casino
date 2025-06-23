import mongoose from 'mongoose';

const GameLogSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameSession',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  gameType: {
    type: String,
    enum: ['crash', 'plinko', 'wheel', 'roulette', 'chicken', 'blackjack'],
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: [
      'session_start', 
      'bet_placed', 
      'bet_updated', 
      'game_result', 
      'win', 
      'loss', 
      'cashout', 
      'error',
      'game_state_change'
    ],
    required: true,
    index: true
  },
  eventDetails: {
    type: Object,
    required: true
  },
  amount: {
    type: Number
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Add static method to get recent logs for a user
GameLogSchema.statics.getRecentUserLogs = async function(userId, limit = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('sessionId');
};

// Add static method to get logs by game type
GameLogSchema.statics.getLogsByGameType = async function(gameType, limit = 100) {
  return this.find({ gameType })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'username');
};

// Add static method to search logs by date range
GameLogSchema.statics.searchByDateRange = async function(
  startDate, 
  endDate, 
  gameType = null, 
  eventType = null,
  limit = 1000
) {
  const query = {};
  
  // Add date range
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  // Add optional filters
  if (gameType) query.gameType = gameType;
  if (eventType) query.eventType = eventType;
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'username')
    .populate('sessionId');
};

const GameLog = mongoose.model('GameLog', GameLogSchema);

export default GameLog;