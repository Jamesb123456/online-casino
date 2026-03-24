import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import UserModel from '../drizzle/models/User.js';
import type { AuthenticatedRequest } from '../types/index.js';

// Middleware to verify JWT token from HTTP-only cookie
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    // Get token from HTTP-only cookie instead of Authorization header
    const token = req.cookies.authToken;
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    
    // Get user from database
    const user = await UserModel.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    // Add user to request
    (req as AuthenticatedRequest).user = {
      id: user.id,
      userId: user.id,
      username: user.username,
      role: user.role
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Middleware to check if user is admin
export const adminOnly = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin only.' });
  }
};

// User or admin middleware
export const userOrAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (req.user && (req.user.role === 'user' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied.' });
  }
};