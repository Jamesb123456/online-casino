import express, { Request, Response } from 'express';
import { db } from '../drizzle/db.js';
import { transactions } from '../drizzle/schema.js';
import UserModel from '../drizzle/models/User.js';
import LoginRewardModel from '../drizzle/models/LoginReward.js';
import { authenticate } from '../middleware/auth.js';
import { eq, desc } from 'drizzle-orm';
import LoggingService from '../src/services/loggingService.js';

const router = express.Router();

// Check if daily reward is available
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasClaimedToday = await LoginRewardModel.hasClaimedToday(userId);
    
    return res.json({
      canClaim: !hasClaimedToday,
      nextRewardTime: hasClaimedToday ? getNextRewardTime() : null
    });
  } catch (error: any) {
    LoggingService.logSystemEvent('reward_status_check_error', { error: (error as Error)?.message }, 'error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Claim daily reward
router.post('/claim', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if the user has already claimed a reward today
    const hasClaimedToday = await LoginRewardModel.hasClaimedToday(userId);
    
    if (hasClaimedToday) {
      return res.status(400).json({ 
        error: 'Daily reward already claimed',
        nextClaimTime: getNextRewardTime()
      });
    }

    // Generate random reward amount (0-100)
    const rewardAmount = LoginRewardModel.generateRewardAmount();

    // Get current user balance
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const balanceBefore = parseFloat(user.balance);
    const balanceAfter = balanceBefore + rewardAmount;

    // Start a transaction to ensure data consistency
    await db.transaction(async (tx) => {
      // Create transaction record
      const result = await tx.insert(transactions).values({
        userId,
        type: 'login_reward',
        amount: rewardAmount.toString(),
        balanceBefore: balanceBefore.toString(),
        balanceAfter: balanceAfter.toString(),
        description: `Daily login reward: $${rewardAmount.toFixed(2)}`,
        status: 'completed',
      });
      
      // Get the inserted transaction
      const [transaction] = await tx
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.createdAt))
        .limit(1);

      if (!transaction) {
        throw new Error('Failed to create transaction record');
      }

      // Create login reward record
      await LoginRewardModel.create({
        userId,
        amount: rewardAmount,
        transactionId: transaction.id
      });

      // Update user balance
      await UserModel.updateById(userId, {
        balance: balanceAfter.toString()
      });
    });

    return res.json({ 
      success: true, 
      rewardAmount,
      newBalance: balanceAfter
    });
  } catch (error: any) {
    LoggingService.logSystemEvent('reward_claim_error', { error: (error as Error)?.message }, 'error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reward history for the current user
router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rawLimit = req.query.limit ? parseInt(req.query.limit as string) : 30;
    const safeLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 30;
    const rewards = await LoginRewardModel.getHistoryByUserId(userId, safeLimit);
    const totalRewards = await LoginRewardModel.getTotalRewardsByUserId(userId);
    
    return res.json({
      rewards,
      totalRewards
    });
  } catch (error: any) {
    LoggingService.logSystemEvent('reward_history_fetch_error', { error: (error as Error)?.message }, 'error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper to calculate when the next reward will be available
function getNextRewardTime(): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

export default router;
