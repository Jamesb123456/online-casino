// @ts-nocheck
import { eq, desc, and, gt, lt, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { loginRewards, type LoginReward, type NewLoginReward } from '../schema.js';

class LoginRewardModel {
  // Create a new login reward record
  static async create(rewardData: { userId: number; amount: number | string; transactionId?: number }): Promise<LoginReward> {
    try {
      // Make sure userId and amount are provided as they are required fields
      if (!rewardData.userId || !rewardData.amount) {
        throw new Error('userId and amount are required fields for login rewards');
      }

      // Insert with validation to ensure all required fields are provided
      await db.insert(loginRewards).values({
        userId: rewardData.userId,
        amount: typeof rewardData.amount === 'number' ? rewardData.amount.toString() : rewardData.amount,
        transactionId: rewardData.transactionId,
        // CreatedAt is handled by the database's defaultNow()
      });

      // Get the latest reward for this user (we don't have insertId in the type)
      const [reward] = await db.select()
        .from(loginRewards)
        .where(eq(loginRewards.userId, rewardData.userId))
        .orderBy(desc(loginRewards.createdAt))
        .limit(1);
        
      return reward;
    } catch (error: any) { // Type error as 'any' for error handling
      throw new Error(`Error creating login reward: ${error.message}`);
    }
  }

  // Check if user has claimed a reward today
  static async hasClaimedToday(userId: number): Promise<boolean> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [reward] = await db.select()
        .from(loginRewards)
        .where(
          and(
            eq(loginRewards.userId, userId),
            gt(loginRewards.createdAt, today),
            lt(loginRewards.createdAt, tomorrow)
          )
        );
      
      return !!reward;
    } catch (error: any) {
      throw new Error(`Error checking reward claim status: ${error.message}`);
    }
  }

  // Get a user's reward history
  static async getHistoryByUserId(userId: number, limit: number = 30): Promise<LoginReward[]> {
    try {
      const rewards = await db.select()
        .from(loginRewards)
        .where(eq(loginRewards.userId, userId))
        .orderBy(desc(loginRewards.createdAt))
        .limit(limit);
      
      return rewards;
    } catch (error: any) {
      throw new Error(`Error getting reward history: ${error.message}`);
    }
  }

  // Get total rewards claimed by a user
  static async getTotalRewardsByUserId(userId: number): Promise<number> {
    try {
      const [result] = await db.select({
        total: sql<string>`SUM(${loginRewards.amount})`
      })
      .from(loginRewards)
      .where(eq(loginRewards.userId, userId));
      
      return parseFloat(result.total || '0');
    } catch (error: any) {
      throw new Error(`Error calculating total rewards: ${error.message}`);
    }
  }

  // Get total rewards claimed today (across all users)
  static async getTotalRewardsToday(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [result] = await db.select({
        total: sql<string>`SUM(${loginRewards.amount})`
      })
      .from(loginRewards)
      .where(
        and(
          gt(loginRewards.createdAt, today),
          lt(loginRewards.createdAt, tomorrow)
        )
      );
      
      return parseFloat(result.total || '0');
    } catch (error: any) {
      throw new Error(`Error calculating today's rewards: ${error.message}`);
    }
  }

  // Generate a random reward amount between 0-100
  static generateRewardAmount(): number {
    return Math.floor(Math.random() * 101); // 0-100 inclusive
  }
}

export default LoginRewardModel;
