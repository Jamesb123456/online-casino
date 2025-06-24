import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticate as auth } from '../middleware/auth.js';

// Import Drizzle models
import UserModel from '../drizzle/models/User.js';
import Transaction from '../drizzle/models/Transaction.js';
import GameStat from '../drizzle/models/GameStat.js';
import Balance from '../drizzle/models/Balance.js';

const router = express.Router();

// Get all users (admin only)
router.get('/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const users = await UserModel.find();
    
    // Remove password hashes from response
    const safeUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));

    res.json(safeUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Create new user (admin only)
router.post('/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { username, email, password, role = 'user' } = req.body;

    // Check if user already exists
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create new user
    const newUser = await UserModel.create({
      username,
      email,
      passwordHash,
      role,
      isActive: true,
      createdAt: new Date(),
      createdBy: req.user.userId
    });

    // Create initial balance if user role
    if (role === 'user') {
      await Balance.create({
        userId: newUser.id,
        amount: 0,
        prevAmount: 0,
        changeAmount: 0,
        changeType: 'credit',
        reason: 'account_creation',
        description: 'Account created by admin',
        adminId: req.user.userId,
        createdAt: new Date()
      });
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Update user (admin only)
router.put('/users/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { id } = req.params;
    const { username, email, role, isActive, password } = req.body;

    // Check if user exists
    const existingUser = await UserModel.findById(id);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prepare update data
    const updateData = {
      username,
      email,
      role,
      isActive,
      updatedAt: new Date()
    };

    // Hash new password if provided
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    // Update user
    const updatedUser = await UserModel.updateById(id, updateData);

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        updatedAt: updatedUser.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Deactivate user (admin only)
router.delete('/users/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { id } = req.params;

    // Check if user exists
    const existingUser = await UserModel.findById(id);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Deactivate instead of delete
    const updatedUser = await UserModel.updateById(id, { 
      isActive: false,
      updatedAt: new Date()
    });

    res.json({
      message: 'User deactivated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        isActive: updatedUser.isActive
      }
    });
  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({ message: 'Error deactivating user' });
  }
});

// Get dashboard stats (admin only)
router.get('/dashboard', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get recent transactions (last 10)
    const recentTransactions = await Transaction.find(
      {},
      { 
        populate: ['userId'],
        sort: { createdAt: -1 },
        limit: 10
      }
    );

    // Get all game stats
    const gameStats = await GameStat.find();

    // Calculate total stats
    const totalStats = gameStats.reduce((acc, stat) => {
      acc.totalGames += stat.totalGamesPlayed;
      acc.totalBets += stat.totalBetsAmount;
      acc.totalWinnings += stat.totalWinningsAmount;
      acc.totalProfit += stat.houseProfit;
      return acc;
    }, {
      totalGames: 0,
      totalBets: 0,
      totalWinnings: 0,
      totalProfit: 0
    });

    res.json({
      recentTransactions,
      gameStats,
      totalStats
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Error fetching dashboard data' });
  }
});

// Get game statistics (admin only)
router.get('/games', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const gameStats = await GameStat.find().sort({ totalGamesPlayed: -1 });
    res.json(gameStats);
  } catch (error) {
    console.error('Error fetching game stats:', error);
    res.status(500).json({ message: 'Error fetching game stats' });
  }
});

// Get transactions with filters (admin only)
router.get('/transactions', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { 
      userId, 
      type, 
      status, 
      startDate, 
      endDate, 
      limit = 100 
    } = req.query;

    // Build filter
    const filter = {};
    
    if (userId) filter.userId = userId;
    if (type) filter.type = type;
    if (status) filter.status = status;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter, {
      populate: ['userId', 'createdBy'],
      sort: { createdAt: -1 },
      limit: parseInt(limit)
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

// Manual transaction (admin only)
router.post('/transactions', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { userId, type, amount, description } = req.body;

    // Validate input
    if (!userId || !type || !amount || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!['credit', 'debit'].includes(type)) {
      return res.status(400).json({ message: 'Invalid transaction type' });
    }

    // Check if user exists
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get current balance
    const currentBalance = await Balance.getLatestBalance(userId);
    const prevAmount = currentBalance ? currentBalance.amount : 0;

    // Calculate new balance
    const changeAmount = type === 'credit' ? amount : -amount;
    const newAmount = prevAmount + changeAmount;

    if (newAmount < 0) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Create transaction
    const transaction = await Transaction.create({
      userId,
      type,
      amount,
      status: 'completed',
      description,
      createdBy: req.user.userId,
      processedAt: new Date(),
      createdAt: new Date()
    });

    // Create balance record
    await Balance.create({
      userId,
      amount: newAmount,
      prevAmount,
      changeAmount,
      changeType: type,
      reason: 'admin_adjustment',
      description,
      adminId: req.user.userId,
      transactionId: transaction.id,
      createdAt: new Date()
    });

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction,
      newBalance: newAmount
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Error creating transaction' });
  }
});

// Void transaction (admin only)
router.put('/transactions/:id/void', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { id } = req.params;
    const { reason } = req.body;

    // Find transaction
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.status === 'voided') {
      return res.status(400).json({ message: 'Transaction already voided' });
    }

    // Update transaction status
    const voidedTransaction = await Transaction.updateById(id, {
      status: 'voided',
      voidReason: reason,
      voidedBy: req.user.userId,
      voidedAt: new Date()
    });

    res.json({
      message: 'Transaction voided successfully',
      transaction: voidedTransaction
    });
  } catch (error) {
    console.error('Error voiding transaction:', error);
    res.status(500).json({ message: 'Error voiding transaction' });
  }
});

export default router;