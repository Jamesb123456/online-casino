import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate as auth } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';
import LoggingService from '../src/services/loggingService.js';

// Import Drizzle models
import UserModel from '../drizzle/models/User.js';
import Balance from '../drizzle/models/Balance.js';
import Transaction from '../drizzle/models/Transaction.js';

const router = express.Router();

// Get current user data
router.get('/me', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await UserModel.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Use balance from user record directly (same as auth routes)
    const currentBalance = parseFloat(String(user.balance || 0));

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      balance: currentBalance,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    });
  } catch (error) {
    LoggingService.logSystemEvent('fetch_current_user_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching user data' });
  }
});

// Get user profile
router.get('/profile', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await UserModel.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get current balance
    const currentBalance = await Balance.getLatestBalance(req.user.userId);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        balance: currentBalance ? currentBalance.amount : 0,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    LoggingService.logSystemEvent('fetch_user_profile_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

// Update user profile
router.put('/profile', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await UserModel.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData: any = {};

    // Update password if provided
    if (newPassword && currentPassword) {
      // Validate password strength and max length (bcrypt has internal limits; long inputs cause DoS)
      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long' });
      }
      if (newPassword.length > 128) {
        return res.status(400).json({ message: 'Password must not exceed 128 characters' });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    // Update user if there are changes
    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await UserModel.updateById(req.user.userId, updateData);
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    LoggingService.logSystemEvent('update_profile_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// Get user balance
router.get('/balance', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentBalance = await Balance.getLatestBalance(req.user.userId);
    res.json({
      balance: currentBalance ? currentBalance.amount : 0
    });
  } catch (error) {
    LoggingService.logSystemEvent('fetch_balance_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching balance' });
  }
});

// Get user balance history
router.get('/balance/history', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const balanceHistory = await Balance.getBalanceHistory(req.user.userId, 100);
    res.json(balanceHistory);
  } catch (error) {
    LoggingService.logSystemEvent('fetch_balance_history_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching balance history' });
  }
});

// Get user transactions
router.get('/transactions', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = 50, type, startDate, endDate } = req.query;

    // Validate and clamp limit
    const rawLimit = parseInt(limit as string);
    const safeLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;

    // Build filter
    const filter: any = { userId: req.user.userId };

    // Validate type against allowlist
    const allowedTypes = ['deposit', 'withdrawal', 'game_win', 'game_loss', 'admin_adjustment', 'bonus', 'login_reward'];
    if (type && allowedTypes.includes(type as string)) {
      filter.type = type;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const parsed = new Date(startDate as string);
        if (!isNaN(parsed.getTime())) filter.createdAt.$gte = parsed;
      }
      if (endDate) {
        const parsed = new Date(endDate as string);
        if (!isNaN(parsed.getTime())) filter.createdAt.$lte = parsed;
      }
    }

    const transactions = await Transaction.find(filter, {
      sort: { createdAt: -1 },
      limit: safeLimit
    });

    res.json(transactions);
  } catch (error) {
    LoggingService.logSystemEvent('fetch_transactions_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

export default router;
