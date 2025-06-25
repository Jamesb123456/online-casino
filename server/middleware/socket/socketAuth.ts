import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import UserModel from '../../drizzle/models/User.js';

// For debugging
const DEBUG_AUTH = true;

/**
 * Socket.io authentication middleware
 * Verifies if the connecting client is authenticated using the JWT token from cookies
 * Prevents unauthorized users from connecting to game namespaces
 */
export const socketAuth = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    // Log for debugging
    if (DEBUG_AUTH) {
      console.log('Socket auth - headers:', socket.handshake.headers);
      console.log('Socket auth - auth data:', socket.handshake.auth);
    }
    
    // First check if cookies exist in handshake headers
    const cookies = socket.handshake.headers.cookie;
    
    if (!cookies) {
      if (DEBUG_AUTH) console.log('Socket auth failed: No cookies provided');
      
      // If no cookies but auth is in handshake, try that instead (alternative authentication)
      const handshakeAuth = socket.handshake.auth;
      if (handshakeAuth && handshakeAuth.token) {
        if (DEBUG_AUTH) console.log('Socket auth: trying auth from handshake instead');
        return verifyTokenFromHandshake(socket, handshakeAuth.token, next);
      }
      
      return next(new Error('Authentication error: No cookies provided'));
    }

    // Parse cookies
    const parsedCookies = cookie.parse(cookies);
    const token = parsedCookies.authToken;

    if (DEBUG_AUTH) {
      console.log('Socket auth - parsed cookies:', Object.keys(parsedCookies));
      console.log('Socket auth - authToken present:', !!token);
    }

    if (!token) {
      return next(new Error('Authentication error: No auth token'));
    }

    return verifyAndAttachUser(socket, token, next);
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
};

/**
 * Verify a token from handshake.auth
 */
const verifyTokenFromHandshake = async (socket: Socket, token: string, next: (err?: Error) => void) => {
  try {
    return await verifyAndAttachUser(socket, token, next);
  } catch (error) {
    console.error('Token verification from handshake failed:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};

/**
 * Verify JWT token and attach user to socket
 */
const verifyAndAttachUser = async (socket: Socket, token: string, next: (err?: Error) => void) => {
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
    
    if (DEBUG_AUTH) {
      console.log('Socket auth - token verified, userId:', decoded.userId);
    }
    
    // Get user from database
    const user = await UserModel.findById(decoded.userId);
    
    if (!user) {
      if (DEBUG_AUTH) console.log('Socket auth - user not found in database');
      return next(new Error('Authentication error: User not found'));
    }
    
    if (!user.isActive) {
      if (DEBUG_AUTH) console.log('Socket auth - user account inactive');
      return next(new Error('Authentication error: Account inactive'));
    }

    if (DEBUG_AUTH) {
      console.log('Socket auth - successful authentication for user:', user.username);
    }

    // Add authenticated user to socket
    (socket as any).user = {
      userId: user.id,
      username: user.username,
      role: user.role,
      balance: parseFloat(user.balance || '0')
    };

    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
};

/**
 * Get authenticated user from socket
 * @param {Socket} socket - Socket.io socket
 * @returns {Object|null} User object or null if not authenticated
 */
export const getAuthenticatedUser = (socket: Socket): { userId: number, username: string, role: string } | null => {
  return (socket as any).user || null;
};