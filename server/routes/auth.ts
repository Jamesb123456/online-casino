// @ts-nocheck
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import LoggingService from '../src/services/loggingService.js';

const router = express.Router();

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later'
});

// Zod schemas
const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(128)
});

const loginSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(128)
});

// Register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
    }
    const { username, password } = parsed.data;

    // Check if user already exists
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const newUser = await UserModel.create({
      username,
      passwordHash: hashedPassword,
      role: 'user',
      balance: '1000', // Starting balance as string for decimal field
      isActive: true,
      createdAt: new Date()
    });

    // Create initial balance record
    await Balance.create({
      userId: newUser.id,
      amount: '1000', // Starting balance
      previousBalance: '0',
      changeAmount: '1000',
      type: 'deposit',
      note: 'Welcome bonus - account creation',
      createdAt: new Date()
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        username: newUser.username, 
        role: newUser.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set HTTP-only cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Log auth action
    LoggingService.logAuthAction(String(newUser.id), 'register', { username: newUser.username });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        balance: 1000
      }
    });
  } catch (error) {
    LoggingService.logSystemEvent('registration_error', { error: (error as any)?.message }, 'error');
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
    }
    const { username, password } = parsed.data;

    // Find user
    const user = await UserModel.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is disabled' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login using the correct method
    await UserModel.updateById(user.id, { lastLogin: new Date() });

    // Get current balance from the user record itself (since balance is stored in users table)
    const currentBalance = parseFloat(user.balance || 0);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set HTTP-only cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Log auth action
    LoggingService.logAuthAction(String(user.id), 'login', { username: user.username });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        balance: currentBalance
      }
    });
  } catch (error) {
    LoggingService.logSystemEvent('login_error', { error: (error as any)?.message }, 'error');
    res.status(500).json({ message: 'Error during login' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  // Clear the HTTP-only cookie
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  
  res.json({ message: 'Logged out successfully' });
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const token = req.cookies.authToken;
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    
    // Check if user still exists and is active
    const user = await UserModel.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Get current balance from the user record
    const currentBalance = parseFloat(user.balance || 0);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        balance: currentBalance
      }
    });
  } catch (error) {
    LoggingService.logSystemEvent('token_verification_error', { error: (error as any)?.message }, 'error');
    res.status(401).json({ message: 'Invalid token' });
  }
});

export default router;