import { Socket } from 'socket.io';
import { auth } from '../../lib/auth.js';
import LoggingService from '../../src/services/loggingService.js';

/**
 * Socket.io authentication middleware
 * Verifies if the connecting client is authenticated using Better Auth session cookies
 */
export const socketAuth = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const cookies = socket.handshake.headers.cookie;

    if (!cookies) {
      return next(new Error('Authentication error: No cookies provided'));
    }

    // Build a Headers object from the socket handshake for Better Auth
    const headers = new Headers();
    headers.set('cookie', cookies);

    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      return next(new Error('Authentication error: Invalid session'));
    }

    if ((session.user as any).isActive === false) {
      return next(new Error('Authentication error: Account inactive'));
    }

    // Attach user to socket in the shape game handlers expect
    (socket as any).user = {
      userId: Number(session.user.id),
      username: (session.user as any).username || session.user.name,
      role: (session.user.role as string) || 'user',
      balance: parseFloat((session.user as any).balance || '0'),
      isActive: (session.user as any).isActive,
    };

    next();
  } catch (error) {
    LoggingService.logSystemEvent('socket_auth_error', { error: String(error) }, 'error');
    next(new Error('Authentication error'));
  }
};

/**
 * Get authenticated user from socket
 */
export const getAuthenticatedUser = (socket: Socket): { userId: number; username: string; role: string; balance: number; isActive: boolean } | null => {
  return (socket as any).user || null;
};
