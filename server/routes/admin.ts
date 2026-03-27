// @ts-nocheck -- TODO: fix Drizzle/Express type errors and remove this directive
import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate as auth, adminOnly } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';
import LoggingService from '../src/services/loggingService.js';

// Import Drizzle models
import UserModel from '../drizzle/models/User.js';
import Transaction from '../drizzle/models/Transaction.js';
import GameStatModel from '../drizzle/models/GameStat.js';
import Balance from '../drizzle/models/Balance.js';

// Define filter types for queries
interface TransactionFilter {
  userId?: number;
  type?: string;
  status?: string;
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
}

const router = express.Router();

// Get all users (admin only)
router.get('/users', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const users = await UserModel.find();

    const safeUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      role: user.role,
      balance: user.balance || 0,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));

    res.json({ players: safeUsers, totalCount: safeUsers.length });
  } catch (error) {
    LoggingService.logSystemEvent('admin_fetch_users_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Create new user (admin only)
router.post('/users', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { username, password, role, isActive } = req.body;

    // Validate username
    if (typeof username !== 'string' || username.trim().length < 3) {
      res.status(400).json({ message: 'Username must be a string with at least 3 characters' });
      return;
    }

    // Validate password (required for POST)
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ message: 'Password must be a string with at least 6 characters' });
      return;
    }

    // Validate role if provided
    const validRoles = ['user', 'admin'];
    const safeRole = role && validRoles.includes(role) ? role : 'user';

    // Validate isActive if provided
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      res.status(400).json({ message: 'isActive must be a boolean' });
      return;
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ username: username.trim() });
    if (existingUser) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await UserModel.create({
      username: username.trim(),
      passwordHash,
      role: safeRole,
      isActive: isActive !== undefined ? isActive : true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    });
  } catch (error) {
    LoggingService.logSystemEvent('admin_create_user_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Update user (admin only)
router.put('/users/:id', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, password, role, isActive } = req.body;

    // Validate username if provided
    if (username !== undefined && (typeof username !== 'string' || username.trim().length < 3)) {
      res.status(400).json({ message: 'Username must be a string with at least 3 characters' });
      return;
    }

    // Validate password if provided (optional for PUT)
    if (password !== undefined && (typeof password !== 'string' || password.length < 6)) {
      res.status(400).json({ message: 'Password must be a string with at least 6 characters' });
      return;
    }

    // Validate role if provided
    const validRoles = ['user', 'admin'];
    if (role !== undefined && !validRoles.includes(role)) {
      res.status(400).json({ message: 'Role must be one of: user, admin' });
      return;
    }

    // Validate isActive if provided
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      res.status(400).json({ message: 'isActive must be a boolean' });
      return;
    }

    // Check if user exists
    const user = await UserModel.findById(parseInt(id));
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prepare update data
    const updateData: any = {
      username: username ? username.trim() : user.username,
      role: role || user.role,
      isActive: isActive !== undefined ? isActive : user.isActive,
      updatedAt: new Date()
    };

    // If password provided, hash it
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    // Update user
    const updatedUser = await UserModel.updateById(parseInt(id), updateData);

    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      updatedAt: updatedUser.updatedAt
    });
  } catch (error) {
    LoggingService.logSystemEvent('admin_update_user_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await UserModel.findById(parseInt(id));
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete user
    await UserModel.delete(parseInt(id));

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    LoggingService.logSystemEvent('admin_delete_user_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Get dashboard stats (admin only)
router.get('/dashboard', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    // Get recent transactions (last 10)
    const recentTransactions = await Transaction.find(
      {},
      {
        limit: 10,
        sort: { createdAt: -1 },
        populate: ['userId']
      }
    );

    // Get game stats
    const gameStats = await GameStatModel.findAll();

    // Get total stats
    const allUsers = await UserModel.findAll();
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(u => u.isActive).length;
    const totalGames = gameStats.reduce((sum, s) => sum + Number(s.totalGamesPlayed || 0), 0);
    const houseProfit = gameStats.reduce((sum, s) => sum + Number(s.houseProfit || 0), 0);
    const totalStats = {
      totalUsers,
      activeUsers,
      totalGames,
      houseProfit
    };

    res.json({
      recentTransactions,
      gameStats,
      totalStats
    });
  } catch (error) {
    LoggingService.logSystemEvent('admin_dashboard_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching dashboard data' });
  }
});

// Get game statistics (admin only)
router.get('/games', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    // Use findAll() method to get game statistics
    const gameStats = await GameStatModel.findAll();

    // Sort the results manually if needed
    gameStats.sort((a, b) => Number(b.totalGamesPlayed) - Number(a.totalGamesPlayed));
    res.json(gameStats);
  } catch (error) {
    LoggingService.logSystemEvent('admin_fetch_game_stats_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching game stats' });
  }
});

// Get transactions with filters (admin only)
router.get('/transactions', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const {
      userId,
      type,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter: TransactionFilter = {};

    // Safely convert query parameters
    if (userId) {
      const parsedUserId = typeof userId === 'string' ? parseInt(userId) : null;
      if (parsedUserId !== null) filter.userId = parsedUserId;
    }

    if (type && typeof type === 'string') filter.type = type;
    if (status && typeof status === 'string') filter.status = status;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate && typeof startDate === 'string') {
        const parsedStart = new Date(startDate);
        if (!isNaN(parsedStart.getTime())) filter.createdAt.$gte = parsedStart;
      }
      if (endDate && typeof endDate === 'string') {
        const parsedEnd = new Date(endDate);
        if (!isNaN(parsedEnd.getTime())) filter.createdAt.$lte = parsedEnd;
      }
    }

    // Safely convert pagination parameters
    const pageNumber = typeof page === 'string' ? parseInt(page) : 1;
    const rawLimit = typeof limit === 'string' ? parseInt(limit as string) : 20;
    const safeLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
    const sortByStr = typeof sortBy === 'string' ? sortBy : 'createdAt';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'desc';

    const transactions = await Transaction.find(filter, {
      limit: safeLimit
    });

    res.json(transactions);
  } catch (error) {
    LoggingService.logSystemEvent('admin_fetch_transactions_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

// Manual transaction (admin only)
router.post('/transactions', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { userId, type, amount, description } = req.body;

    // Validate userId
    const parsedUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    if (typeof parsedUserId !== 'number' || !Number.isFinite(parsedUserId) || parsedUserId <= 0) {
      res.status(400).json({ message: 'userId must be a positive integer' });
      return;
    }

    // Validate type
    if (!type || !['credit', 'debit'].includes(type)) {
      res.status(400).json({ message: 'Type must be one of: credit, debit' });
      return;
    }

    // Validate amount
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      res.status(400).json({ message: 'Amount must be a finite number' });
      return;
    }
    if (amount <= 0) {
      res.status(400).json({ message: 'Amount must be a positive number' });
      return;
    }

    // Validate description
    if (typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({ message: 'Description must be a non-empty string' });
      return;
    }

    // Check if user exists
    const user = await UserModel.findById(parsedUserId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Get current balance
    const currentBalance = await Balance.getLatestBalance(parsedUserId);
    const prevAmount = currentBalance ? currentBalance.amount : 0;

    // Calculate new balance
    const changeAmount = type === 'credit' ? amount : -amount;
    const newAmount = prevAmount + changeAmount;

    if (newAmount < 0) {
      res.status(400).json({ message: 'Insufficient balance' });
      return;
    }

    // Create transaction
    const transaction = await Transaction.create({
      userId: parsedUserId,
      type,
      amount,
      status: 'completed',
      description: description.trim(),
      createdBy: (req as AuthenticatedRequest).user.userId,
      processedAt: new Date(),
      createdAt: new Date()
    });

    // Create balance record
    await Balance.create({
      userId: parsedUserId,
      amount: newAmount,
      prevAmount,
      changeAmount,
      changeType: type,
      reason: 'admin_adjustment',
      description: description.trim(),
      adminId: (req as AuthenticatedRequest).user.userId,
      transactionId: transaction.id,
      createdAt: new Date()
    });

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction,
      newBalance: newAmount
    });
  } catch (error) {
    LoggingService.logSystemEvent('admin_create_transaction_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error creating transaction' });
  }
});

// Void transaction (admin only)
router.put('/transactions/:id/void', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Find transaction
    const transaction = await Transaction.findById(parseInt(id));
    if (!transaction) {
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    if (transaction.status === 'voided') {
      res.status(400).json({ message: 'Transaction already voided' });
      return;
    }

    // Update transaction status
    const voidedTransaction = await Transaction.updateById(parseInt(id), {
      status: 'voided',
      voidReason: reason,
      voidedBy: (req as AuthenticatedRequest).user.userId,
      voidedAt: new Date()
    });

    res.json({
      message: 'Transaction voided successfully',
      transaction: voidedTransaction
    });
  } catch (error) {
    LoggingService.logSystemEvent('admin_void_transaction_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error voiding transaction' });
  }
});

export default router;
