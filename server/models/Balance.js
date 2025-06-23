import mongoose from 'mongoose';

const BalanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  previousBalance: {
    type: Number,
    required: true
  },
  changeAmount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'win', 'loss', 'admin_adjustment'],
    required: true,
    index: true
  },
  gameType: {
    type: String,
    enum: ['crash', 'plinko', 'wheel', 'roulette', 'blackjack', null],
    default: null,
    index: true
  },
  relatedSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameSession',
    index: true
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    index: true
  },
  note: {
    type: String
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Add static method to get current balance
BalanceSchema.statics.getCurrentBalance = async function(userId) {
  const latestBalance = await this.findOne({ userId }).sort({ createdAt: -1 });
  return latestBalance ? latestBalance.amount : 0;
};

// Add static method to get balance history
BalanceSchema.statics.getBalanceHistory = async function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('adminId', 'username')
    .populate('transactionId');
};

// Add method to check if this was a positive or negative change
BalanceSchema.methods.isPositiveChange = function() {
  return this.changeAmount > 0;
};

const Balance = mongoose.model('Balance', BalanceSchema);

export default Balance;