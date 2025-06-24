import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate as auth } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';

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
    const currentBalance = parseFloat(user.balance || 0);

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
    console.error('Error fetching current user:', error);
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
    console.error('Error fetching user profile:', error);
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

    const updateData = {};

    // Update password if provided
    if (newPassword && currentPassword) {
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
    console.error('Error updating profile:', error);
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
    console.error('Error fetching balance:', error);
    res.status(500).json({ message: 'Error fetching balance' });
  }
});

// Get user balance history
router.get('/balance/history', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const balanceHistory = await Balance.getBalanceHistory(req.user.userId);
    res.json(balanceHistory);
  } catch (error) {
    console.error('Error fetching balance history:', error);
    res.status(500).json({ message: 'Error fetching balance history' });
  }
});

// Get user transactions
router.get('/transactions', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = 50, type, startDate, endDate } = req.query;
    
    // Build filter
    const filter = { userId: req.user.userId };
    
    if (type) filter.type = type;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter, {
      sort: { createdAt: -1 },
      limit: parseInt(limit)
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

export default router;