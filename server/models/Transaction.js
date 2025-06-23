import mongoose from 'mongoose';

/**
 * Transaction Model
 * Handles all financial transactions including deposits, withdrawals, game wins/losses, and admin adjustments
 * Maintains transaction history with detailed audit trail
 */
const TransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'game_win', 'game_loss', 'admin_adjustment', 'bonus'],
    required: true,
    index: true
  },
  gameType: {
    type: String,
    enum: ['crash', 'plinko', 'wheel', 'roulette', 'blackjack', null],
    default: null,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    index: true
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'voided', 'processing'],
    default: 'completed',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  reference: {
    type: String,
    index: true
  },
  description: {
    type: String,
  },
  gameSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameSession',
    index: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  notes: [{
    text: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  voidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  voidedReason: {
    type: String
  },
  voidedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Update the updatedAt field before saving
TransactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add static method to get user transaction history
TransactionSchema.statics.getUserTransactionHistory = async function(userId, limit = 50, offset = 0) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .populate('createdBy', 'username')
    .populate('voidedBy', 'username');
};

// Add static method to get transaction stats by date range
TransactionSchema.statics.getTransactionStatsByDate = async function(startDate, endDate) {
  const query = {};
  
  // Add date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: query },
    { $group: {
      _id: "$type",
      count: { $sum: 1 },
      totalAmount: { $sum: "$amount" }
    }},
    { $project: {
      _id: 0,
      type: "$_id",
      count: 1,
      totalAmount: 1
    }}
  ]);
};

// Method to void a transaction
TransactionSchema.methods.voidTransaction = async function(adminId, reason) {
  if (this.status === 'voided') {
    throw new Error('Transaction already voided');
  }
  
  // Update transaction status
  this.status = 'voided';
  this.voidedBy = adminId;
  this.voidedReason = reason;
  this.voidedAt = new Date();
  
  // Add note about void
  this.notes.push({
    text: `Transaction voided: ${reason}`,
    addedBy: adminId,
    timestamp: new Date()
  });
  
  return this.save();
};

const Transaction = mongoose.model('Transaction', TransactionSchema);

export default Transaction;