import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate as auth } from '../middleware/auth.js';

// Import Drizzle models
import UserModel from '../drizzle/models/User.js';
import Transaction from '../drizzle/models/Transaction.js';
import GameStatModel from '../drizzle/models/GameStat.js';
import Balance from '../drizzle/models/Balance.js';

// Define custom request type with user property
interface AuthRequest extends Request {
  user: {
    userId: number;
    role: string;
    username: string;
  };
}

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

// Helper function to check admin role
const checkAdminRole = (req: Request, res: Response): boolean => {
  const authReq = req as AuthRequest;
  if (!authReq.user || authReq.user.role !== 'admin') {
    res.status(403).json({ message: 'Access denied' });
    return false;
  }
  return true;
};

// Get all users (admin only)
router.get('/users', auth, (async (req: Request, res: Response, next: NextFunction) => {
  if (!checkAdminRole(req, res)) return;
  
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
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
}) as RequestHandler);

// Create new user (admin only)
router.post('/users', auth, (async (req: Request, res: Response, next: NextFunction) => {
  if (!checkAdminRole(req, res)) return;
  
  try {
    const { username, password, role, isActive } = req.body;

    // Check if user already exists
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await UserModel.create({
      username,
      passwordHash,
      role: role || 'user',
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
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
}) as RequestHandler);

// Update user (admin only)
router.put('/users/:id', auth, (async (req: Request, res: Response, next: NextFunction) => {
  if (!checkAdminRole(req, res)) return;
  
  try {
    const { id } = req.params;
    const { username, password, role, isActive } = req.body;

    // Check if user exists
    const user = await UserModel.findById(parseInt(id));
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prepare update data
    const updateData: any = {
      username: username || user.username,
      role: role || user.role,
      isActive: isActive !== undefined ? isActive : user.isActive,
      updatedAt: new Date()
    };

    // If password provided, hash it
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
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
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
}) as RequestHandler);

// Delete user (admin only)
router.delete('/users/:id', auth, (async (req: Request, res: Response, next: NextFunction) => {
  if (!checkAdminRole(req, res)) return;
  
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await UserModel.findById(parseInt(id));
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete user
    await UserModel.deleteById(parseInt(id));

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
}) as RequestHandler);

// Get dashboard stats (admin only)
router.get('/dashboard', auth, (async (req: Request, res: Response, next: NextFunction) => {
  if (!checkAdminRole(req, res)) return;
  
  try {
    // Get recent transactions (last 10)
    const recentTransactions = await Transaction.find(
      {},
      { 
        limit: 10, 
        sortBy: 'createdAt', 
        sortOrder: 'desc',
        populate: ['userId']
      }
    );
    
    // Get game stats
    const gameStatistics = await GameStatModel.getGameStatistics();
    
    // Get total stats
    const totalStats = await UserModel.getTotalStats();
    
      houseProfit: 0
    })) as RequestHandler;

    res.json({
      recentTransactions,
      gameStats,
      totalStats
    })) as RequestHandler;
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Error fetching dashboard data' })) as RequestHandler;
  }
})) as RequestHandler;

// Get game statistics (admin only)
router.get('/games', auth, async (req: Request, res: Response) => {
  if (!checkAdminRole(req, res)) return;
  
  try {
    // Use appropriate method to get game stats based on available API
    // This might need to be adjusted based on the actual GameStatModel implementation
    const gameStats = await GameStatModel.findAll();
    
    // Sort the results manually if needed
    gameStats.sort((a, b) => Number(b.totalGamesPlayed) - Number(a.totalGamesPlayed));
    res.json(gameStats);
  } catch (error) {
    console.error('Error fetching game stats:', error);
    res.status(500).json({ message: 'Error fetching game stats' })) as RequestHandler;
  }
})) as RequestHandler;

// Get transactions with filters (admin only)
router.get('/transactions', auth, async (req: Request, res: Response) => {
  if (!checkAdminRole(req, res)) return;
  
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
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Safely convert pagination parameters
    const pageNumber = typeof page === 'string' ? parseInt(page) : 1;
    const limitNumber = typeof limit === 'string' ? parseInt(limit) : 20;
    const sortByStr = typeof sortBy === 'string' ? sortBy : 'createdAt';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'desc';
    
    const transactions = await Transaction.find(filter, {
      populate: ['userId', 'createdBy'],
      page: pageNumber,
      limit: limitNumber,
      sortBy: sortByStr,
      sortOrder: sortOrderStr
    })) as RequestHandler;

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Error fetching transactions' })) as RequestHandler;
  }
})) as RequestHandler;

// Manual transaction (admin only)
router.post('/transactions', auth, async (req: Request, res: Response) => {
  if (!checkAdminRole(req, res)) return;
  
  try {
    const { userId, type, amount, description } = req.body;

    // Validate input
    if (!userId || !type || !amount || !description) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    if (!['credit', 'debit'].includes(type)) {
      res.status(400).json({ message: 'Invalid transaction type' });
      return;
    }

    // Check if user exists
    const user = await UserModel.findById(typeof userId === 'string' ? parseInt(userId) : userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' })) as RequestHandler;
      return;
    }

    // Get current balance
    const currentBalance = await Balance.getLatestBalance(userId);
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
      // @ts-ignore - req.user is available from auth middleware
      userId,
      type,
      amount,
      status: 'completed',
      description,
      createdBy: (req as AuthRequest).user.userId,
      processedAt: new Date(),
      createdAt: new Date()
    })) as RequestHandler;

    // Create balance record
    await Balance.create({
      // @ts-ignore - req.user is available from auth middleware
      userId,
      amount: newAmount,
      prevAmount,
      changeAmount,
      changeType: type,
      reason: 'admin_adjustment',
      description,
      adminId: (req as AuthRequest).user.userId,
      transactionId: transaction.id,
      createdAt: new Date()
    })) as RequestHandler;

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction,
      newBalance: newAmount
    })) as RequestHandler;
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Error creating transaction' })) as RequestHandler;
  }
})) as RequestHandler;

// Void transaction (admin only)
router.put('/transactions/:id/void', auth, async (req: Request, res: Response) => {
  if (!checkAdminRole(req, res)) return;
  
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
      voidedBy: (req as AuthRequest).user.userId,
      voidedAt: new Date()
    })) as RequestHandler;

    res.json({
      message: 'Transaction voided successfully',
      transaction: voidedTransaction
    })) as RequestHandler;
  } catch (error) {
    console.error('Error voiding transaction:', error);
    res.status(500).json({ message: 'Error voiding transaction' })) as RequestHandler;
  }
})) as RequestHandler;

export default router;