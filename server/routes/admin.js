import express from 'express';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply both middleware - authenticate first, then check if admin
router.use(authenticate, isAdmin);

// Get all users (admin only)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash');
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific user by ID (admin only)
router.get('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Adjust user balance (admin only)
router.post('/users/:userId/balance', async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const { userId } = req.params;
    
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user balance
    const oldBalance = user.balance;
    user.balance += parseFloat(amount);
    await user.save();
    
    // Log transaction (will implement this when we create the Transaction model)
    const transactionData = {
      userId,
      type: 'admin_adjustment',
      amount,
      balanceBefore: oldBalance,
      balanceAfter: user.balance,
      createdBy: req.user._id,
      reference: reason || 'Admin adjustment'
    };
    
    res.status(200).json({
      message: 'Balance adjusted successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        oldBalance,
        newBalance: user.balance
      },
      transaction: transactionData
    });
  } catch (error) {
    console.error('Error adjusting balance:', error);
    res.status(500).json({ message: 'Server error during balance adjustment' });
  }
});

// Get game statistics (admin only)
router.get('/stats', (req, res) => {
  // This will be implemented when we create game models and tracking
  const mockStats = {
    totalUsers: 0,
    gamesPlayed: {
      crash: 0,
      plinko: 0,
      wheel: 0,
      roulette: 0,
      chicken: 0,
      blackjack: 0
    },
    totalBetsAmount: 0,
    totalWinningsAmount: 0,
    houseProfit: 0
  };
  
  res.status(200).json(mockStats);
});

// Transaction routes
// Get all transactions with pagination
router.get('/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Optional filters
    const filter = {};
    
    if (req.query.userId) {
      filter.userId = req.query.userId;
    }
    
    if (req.query.type) {
      filter.type = req.query.type;
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.gameType) {
      filter.gameType = req.query.gameType;
    }
    
    // Date range filters
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }
    
    // Get total count for pagination
    const total = await Transaction.countDocuments(filter);
    
    // Get transactions with pagination and populate user details
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'username email')
      .populate('createdBy', 'username')
      .lean();
    
    // Map to format expected by frontend
    const formattedTransactions = transactions.map(tx => ({
      id: tx._id,
      username: tx.userId?.username || 'Unknown User',
      userId: tx.userId?._id || null,
      type: tx.type,
      amount: tx.amount,
      date: tx.createdAt.toISOString().replace('T', ' ').substring(0, 19),
      status: tx.status,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      gameType: tx.gameType,
      reference: tx.reference,
      createdBy: tx.createdBy?.username || 'System'
    }));
    
    res.status(200).json({
      transactions: formattedTransactions,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get transaction by ID
router.get('/transactions/:transactionId', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.transactionId)
      .populate('userId', 'username email')
      .populate('createdBy', 'username');
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.status(200).json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get transaction statistics
router.get('/transactions/stats', async (req, res) => {
  try {
    // Define time range filter
    const timeRange = {};
    if (req.query.startDate && req.query.endDate) {
      timeRange.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }
    
    // Get transaction stats
    const stats = {
      total: await Transaction.countDocuments(timeRange),
      deposits: await Transaction.countDocuments({ ...timeRange, type: 'deposit' }),
      withdrawals: await Transaction.countDocuments({ ...timeRange, type: 'withdrawal' }),
      gameWins: await Transaction.countDocuments({ ...timeRange, type: 'game_win' }),
      gameLosses: await Transaction.countDocuments({ ...timeRange, type: 'game_loss' }),
      adminAdjustments: await Transaction.countDocuments({ ...timeRange, type: 'admin_adjustment' })
    };
    
    // Calculate total amounts
    const depositAmount = await Transaction.aggregate([
      { $match: { ...timeRange, type: 'deposit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const withdrawalAmount = await Transaction.aggregate([
      { $match: { ...timeRange, type: 'withdrawal' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const winAmount = await Transaction.aggregate([
      { $match: { ...timeRange, type: 'game_win' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const lossAmount = await Transaction.aggregate([
      { $match: { ...timeRange, type: 'game_loss' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Add amounts to stats
    stats.depositAmount = depositAmount[0]?.total || 0;
    stats.withdrawalAmount = withdrawalAmount[0]?.total || 0;
    stats.winAmount = winAmount[0]?.total || 0;
    stats.lossAmount = lossAmount[0]?.total || 0;
    
    // Add game-specific stats if needed
    if (req.query.includeGameStats === 'true') {
      stats.byGame = {
        crash: await Transaction.countDocuments({ ...timeRange, gameType: 'crash' }),
        plinko: await Transaction.countDocuments({ ...timeRange, gameType: 'plinko' }),
        wheel: await Transaction.countDocuments({ ...timeRange, gameType: 'wheel' }),
        roulette: await Transaction.countDocuments({ ...timeRange, gameType: 'roulette' }),
        chicken: await Transaction.countDocuments({ ...timeRange, gameType: 'chicken' }),
        blackjack: await Transaction.countDocuments({ ...timeRange, gameType: 'blackjack' })
      };
    }
    
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching transaction statistics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a manual transaction (admin initiated)
router.post('/transactions', async (req, res) => {
  try {
    const { userId, type, amount, reference } = req.body;
    
    // Validate input
    if (!userId || !type || amount === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Calculate new balance
    const balanceBefore = user.balance;
    const balanceAfter = user.balance + parseFloat(amount);
    
    // Create transaction
    const transaction = new Transaction({
      userId: user._id,
      type,
      amount: parseFloat(amount),
      balanceBefore,
      balanceAfter,
      createdBy: req.user._id,
      reference
    });
    
    // Update user balance
    user.balance = balanceAfter;
    
    // Save both transaction and user
    await Promise.all([transaction.save(), user.save()]);
    
    res.status(201).json({
      message: 'Transaction created successfully',
      transaction,
      user: {
        id: user._id,
        username: user.username,
        oldBalance: balanceBefore,
        newBalance: balanceAfter
      }
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update transaction status
router.put('/transactions/:transactionId/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    
    const transaction = await Transaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    transaction.status = status;
    await transaction.save();
    
    res.status(200).json({
      message: 'Transaction status updated',
      transaction
    });
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Void a transaction
router.post('/transactions/:transactionId/void', async (req, res) => {
  try {
    const { reason } = req.body;
    
    const transaction = await Transaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    // Can only void completed transactions
    if (transaction.status !== 'completed') {
      return res.status(400).json({ message: 'Can only void completed transactions' });
    }
    
    // Update transaction status
    transaction.status = 'voided';
    transaction.reference = `${transaction.reference || ''} - VOIDED: ${reason || 'No reason provided'}`;
    
    // If transaction affected user balance, reverse it
    if (['deposit', 'withdrawal', 'game_win', 'game_loss', 'admin_adjustment'].includes(transaction.type)) {
      const user = await User.findById(transaction.userId);
      if (user) {
        // Reverse the transaction effect on balance
        user.balance -= transaction.amount;
        await user.save();
      }
    }
    
    await transaction.save();
    
    res.status(200).json({
      message: 'Transaction voided successfully',
      transaction
    });
  } catch (error) {
    console.error('Error voiding transaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;