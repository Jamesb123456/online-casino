/**
 * liveGamesHandler.js
 * Handles events related to live games listing and status
 * Provides real-time information about active game sessions
 */

import GameSession from '../../models/GameSession.js';
import User from '../../models/User.js';

/**
 * Initialize live games socket handlers
 * @param {Object} io - Socket.io instance
 */
const initLiveGamesHandlers = (io) => {
  // Listen for clients requesting live games data
  io.on('connection', (socket) => {
    // Handle request for live games list
    socket.on('get_live_games', async () => {
      try {
        console.log('Client requested live games data');
        
        // Get active game sessions from the database
        // Group by game type, limit to recent active sessions
        const activeSessions = await GameSession.aggregate([
          { $match: { active: true } },
          { $sort: { updatedAt: -1 } },
          { $limit: 50 }, // Limit to 50 most recent active sessions
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'userInfo'
            }
          },
          { $unwind: '$userInfo' },
          {
            $project: {
              id: '$_id',
              type: '$gameType',
              userId: '$userId',
              bet: '$currentBet',
              username: '$userInfo.username',
              createdAt: 1,
              updatedAt: 1
            }
          },
          {
            $group: {
              _id: '$type',
              players: { $sum: 1 },
              sessions: { $push: '$$ROOT' }
            }
          },
          {
            $project: {
              _id: 0,
              type: '$_id',
              players: 1,
              id: { $arrayElemAt: ['$sessions.id', 0] },
              recentUsers: { $slice: ['$sessions.username', 0, 3] }
            }
          }
        ]);

        // Transform the data for client consumption
        const liveGames = activeSessions.map(game => ({
          id: game.id,
          type: game.type,
          players: game.players,
          recentPlayers: game.recentUsers
        }));
        
        // Ensure we have all game types represented (even if no active sessions)
        const gameTypes = ['crash', 'roulette', 'blackjack', 'plinko', 'wheel'];
        const existingTypes = liveGames.map(game => game.type);
        
        // Add placeholder entries for game types with no active sessions
        gameTypes.forEach(type => {
          if (!existingTypes.includes(type)) {
            liveGames.push({
              id: `${type}_placeholder`,
              type,
              players: 0,
              recentPlayers: []
            });
          }
        });
        
        console.log(`Sending ${liveGames.length} live games to client`);
        
        // Emit the live games data to the requesting client
        socket.emit('live_games', liveGames);
      } catch (error) {
        console.error('Error fetching live games:', error);
        socket.emit('live_games', []); // Send empty array on error
      }
    });
  });
};

export default initLiveGamesHandlers;
