/**
 * liveGamesHandler.ts
 * Handles events related to live games listing and status
 * Provides real-time information about active game sessions
 */

import { eq, desc } from 'drizzle-orm';
import db from '../../drizzle/db.js';
import { gameSessions, users } from '../../drizzle/schema.js';
import LoggingService from '../services/loggingService.js';
import { socketAuth } from '../../middleware/socket/socketAuth.js';

const GAME_TYPES = ['crash', 'roulette', 'blackjack', 'plinko', 'wheel', 'landmines'];

/**
 * Initialize live games socket handlers
 * @param {Object} io - Socket.io instance
 */
const initLiveGamesHandlers = (io) => {
  const liveNsp = io.of('/live-games');
  liveNsp.use(socketAuth);

  liveNsp.on('connection', (socket) => {
    socket.on('get_live_games', async () => {
      try {
        // Fetch active sessions joined with user info
        const activeSessions = await db
          .select({
            id: gameSessions.id,
            gameType: gameSessions.gameType,
            username: users.username,
          })
          .from(gameSessions)
          .leftJoin(users, eq(gameSessions.userId, users.id))
          .where(eq(gameSessions.isCompleted, false))
          .orderBy(desc(gameSessions.updatedAt))
          .limit(50);

        // Group sessions by game type
        const grouped: Record<string, { players: number; recentPlayers: string[] }> = {};
        for (const session of activeSessions) {
          const type = session.gameType;
          if (!grouped[type]) {
            grouped[type] = { players: 0, recentPlayers: [] };
          }
          grouped[type].players++;
          if (grouped[type].recentPlayers.length < 3 && session.username) {
            grouped[type].recentPlayers.push(session.username);
          }
        }

        // Build response with all game types represented
        const liveGames = GAME_TYPES.map(type => ({
          id: grouped[type] ? `${type}_live` : `${type}_placeholder`,
          type,
          players: grouped[type]?.players ?? 0,
          recentPlayers: grouped[type]?.recentPlayers ?? [],
        }));

        socket.emit('live_games', liveGames);
      } catch (error) {
        LoggingService.logSystemEvent('live_games_fetch_error', { error: (error as Error)?.message }, 'error');
        socket.emit('live_games', []);
      }
    });
  });
};

export default initLiveGamesHandlers;
