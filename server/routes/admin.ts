import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authenticate as auth, adminOnly } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';
import LoggingService from '../src/services/loggingService.js';
import { adminCreateUserSchema, adminUpdateUserSchema, adminTransactionSchema } from '../src/validation/schemas.js';
import balanceService from '../src/services/balanceService.js';
import { db } from '../drizzle/db.js';
import { sql } from 'drizzle-orm';

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
    // Validate request body with Zod
    const parseResult = adminCreateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((e: any) => e.message).join(', ');
      res.status(400).json({ message: errors });
      return;
    }
    const { username, password, role, isActive } = parseResult.data;

    // Check if user already exists
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await UserModel.create({
      username,
      passwordHash,
      role,
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
    const id = req.params.id as string;

    // Validate request body with Zod
    const parseResult = adminUpdateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((e: any) => e.message).join(', ');
      res.status(400).json({ message: errors });
      return;
    }
    const { username, password, role, isActive } = parseResult.data;

    // Check if user exists
    const user = await UserModel.findById(parseInt(id));
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prepare update data
    const updateData: any = {
      username: username ? username : user.username,
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

// Delete user (admin only) - soft delete: deactivates the user instead of removing the row
router.delete('/users/:id', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // Check if user exists
    const user = await UserModel.findById(parseInt(id));
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent double-deletion of already deactivated users
    if (!user.isActive) {
      return res.status(400).json({ message: 'User is already deactivated' });
    }

    // Soft delete: set isActive to false instead of removing the row
    await UserModel.updateById(parseInt(id), {
      isActive: false,
      updatedAt: new Date(),
    });

    LoggingService.logSystemEvent('admin_soft_delete_user', {
      userId: parseInt(id),
      deletedBy: (req as AuthenticatedRequest).user.userId,
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    LoggingService.logSystemEvent('admin_delete_user_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Adjust user balance (admin only)
router.post('/users/:id/balance', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { amount, reason } = req.body;

    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (typeof parsedAmount !== 'number' || !Number.isFinite(parsedAmount) || parsedAmount === 0) {
      return res.status(400).json({ message: 'Amount must be a non-zero finite number' });
    }

    const userId = parseInt(id);
    const adminId = (req as AuthenticatedRequest).user.userId;

    const result = await balanceService.manualAdjustment(
      userId,
      parsedAmount,
      reason || 'Admin balance adjustment',
      adminId
    );

    const newBalance = parseFloat(String(result.user.balance || 0));

    res.json({ message: 'Balance updated', newBalance });
  } catch (error) {
    const message = (error as Error)?.message;
    if (message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    if (message === 'Insufficient balance') {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    LoggingService.logSystemEvent('admin_balance_adjust_error', { error: message }, 'error');
    res.status(500).json({ message: 'Error adjusting balance' });
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

    // Get total stats via SQL aggregation (avoids loading all users into memory)
    const userStatsResult = await db.execute(sql`
      SELECT
        COUNT(*) as totalUsers,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as activeUsers,
        COALESCE(SUM(balance), 0) as totalBalance
      FROM users
    `);
    const userStats = (userStatsResult as any)[0]?.[0] || { totalUsers: 0, activeUsers: 0, totalBalance: 0 };
    const totalGames = gameStats.reduce((sum, s) => sum + Number(s.totalGamesPlayed || 0), 0);
    const houseProfit = gameStats.reduce((sum, s) => sum + Number(s.houseProfit || 0), 0);

    res.json({
      totalPlayers: Number(userStats.totalUsers),
      activePlayers: Number(userStats.activeUsers),
      totalBalance: Number(userStats.totalBalance),
      totalGames,
      recentTransactions,
      alerts: []
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
    res.json({
      games: gameStats.map(g => ({
        name: g.name || g.gameType,
        played: Number(g.totalGamesPlayed || 0),
        profit: Number(g.houseProfit || 0),
      }))
    });
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

    const skip = (pageNumber - 1) * safeLimit;
    const transactions = await Transaction.find(filter as any, {
      limit: safeLimit,
      sort: { createdAt: sortOrderStr === 'asc' ? 1 : -1 },
      populate: ['userId']
    } as any);

    const total = await Transaction.count(filter as any);

    res.json({
      transactions,
      total,
      page: pageNumber,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit)
    });
  } catch (error) {
    LoggingService.logSystemEvent('admin_fetch_transactions_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

// Manual transaction (admin only)
router.post('/transactions', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    // Validate request body with Zod
    const parseResult = adminTransactionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((e: any) => e.message).join(', ');
      res.status(400).json({ message: errors });
      return;
    }
    const { userId: rawUserId, type, amount, description } = parseResult.data;

    // userId comes back as a string from the schema transform
    const parsedUserId = parseInt(rawUserId);
    if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
      res.status(400).json({ message: 'userId must be a positive integer' });
      return;
    }

    const transactionType = type === 'credit' ? 'admin_adjustment' : 'withdrawal';
    const balanceType = type === 'credit' ? 'admin_adjustment' : 'withdrawal';

    // Check if user exists
    const user = await UserModel.findById(parsedUserId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Get current balance
    const currentBalance = await Balance.getLatestBalance(parsedUserId);
    const prevAmount = currentBalance ? parseFloat(String(currentBalance.amount)) : 0;

    // Calculate new balance
    const changeAmount = type === 'credit' ? amount : -amount;
    const newAmount = prevAmount + changeAmount;

    if (newAmount < 0) {
      res.status(400).json({ message: 'Insufficient balance' });
      return;
    }

    // Create transaction with valid enum type
    const transaction = await Transaction.create({
      userId: parsedUserId,
      type: transactionType,
      amount,
      balanceBefore: prevAmount,
      balanceAfter: newAmount,
      status: 'completed',
      description,
      createdBy: (req as AuthenticatedRequest).user.userId,
      createdAt: new Date()
    });

    // Create balance record with correct column names
    await Balance.create({
      userId: parsedUserId,
      amount: newAmount,
      previousBalance: prevAmount,
      changeAmount,
      type: balanceType,
      note: description,
      adminId: (req as AuthenticatedRequest).user.userId,
      transactionId: transaction.id,
      createdAt: new Date()
    });

    // Update user's balance
    await UserModel.updateById(parsedUserId, { balance: newAmount });

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
const voidSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must not exceed 500 characters')
});

router.put('/transactions/:id/void', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    // Validate request body
    const parseResult = voidSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((e: any) => e.message).join(', ');
      res.status(400).json({ message: errors });
      return;
    }
    const { reason } = parseResult.data;

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
      voidedReason: reason,
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
