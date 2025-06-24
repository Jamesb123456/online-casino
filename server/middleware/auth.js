import jwt from 'jsonwebtoken';
import UserModel from '../drizzle/models/User.js';

// Middleware to verify JWT token from HTTP-only cookie
export const authenticate = async (req, res, next) => {
  try {
    // Get token from HTTP-only cookie instead of Authorization header
    const token = req.cookies.authToken;
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await UserModel.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    // Add user to request
    req.user = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Middleware to check if user is admin
export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin only.' });
  }
};

// User or admin middleware
export const userOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'user' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied.' });
  }
};