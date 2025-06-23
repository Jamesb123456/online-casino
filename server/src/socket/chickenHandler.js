/**
 * Chicken Game Socket Handler
 * Manages real-time communication and game logic for the Chicken game
 */

const balanceService = require('../services/balanceService');
const loggingService = require('../services/loggingService');
const { generateGameResult } = require('../utils/gameUtils');

// Store active games and player states
const activeGames = new Map();
const playerStates = new Map();
const gameHistory = new Map();

// Maximum history entries per player
const MAX_HISTORY_PER_PLAYER = 50;

/**
 * Initialize the Chicken socket handler
 * 
 * @param {Object} io - Socket.io server instance
 * @param {Object} db - Database connection
 */
const initChickenHandler = (io, db) => {
  const chickenNamespace = io.of('/chicken');
  
  chickenNamespace.on('connection', (socket) => {
    console.log(`Player connected to chicken game: ${socket.id}`);
    const userId = socket.request.session?.user?._id || socket.id;
    
    // Initialize player state if new
    if (!playerStates.has(userId)) {
      playerStates.set(userId, {
        balance: 1000, // Default balance, should be fetched from DB
        activeBet: null,
        autoCashOut: null
      });
      
      // Log session initialization
      loggingService.logGameEvent('chicken', 'session_start', {
        userId,
        initialBalance: 1000, // Will be updated if user is authenticated
        timestamp: new Date()
      }, userId);
    }
    
    // Initialize game history for user
    if (!gameHistory.has(userId)) {
      gameHistory.set(userId, []);
    }
    
    // Fetch player balance from DB if authenticated
    if (socket.request.session?.user) {
      db.collection('users').findOne(
        { _id: userId },
        { projection: { balance: 1 } }
      ).then(user => {
        if (user) {
          const playerState = playerStates.get(userId);
          playerState.balance = user.balance;
          playerStates.set(userId, playerState);
        }
      }).catch(err => {
        console.error(`Error fetching user balance: ${err}`);
      });
    }
    
    /**
     * Handle player placing a bet
     */
    socket.on('place_bet', async (data, callback) => {
      try {
        const { betAmount, autoCashOutMultiplier, difficulty } = data;
        const playerState = playerStates.get(userId);
        
        // Validate bet
        if (!betAmount || betAmount <= 0) {
          return callback({ success: false, error: 'Invalid bet amount' });
        }
        
        if (playerState.activeBet) {
          return callback({ success: false, error: 'Already have an active bet' });
        }
        
        if (betAmount > playerState.balance) {
          return callback({ success: false, error: 'Insufficient balance' });
        }
        
        // Create the game
        const gameId = `chicken_${Date.now()}_${userId}`;
        const validDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
        
        // Generate game result - in a real implementation this would use provably fair algorithms
        // with server seed revealed after the game completes
        const serverSeed = `server_${Date.now()}`;
        const clientSeed = `client_${socket.id}`;
        const gameResult = generateGameResult(serverSeed, clientSeed, validDifficulty);
        
        // Record bet
        playerState.balance -= betAmount;
        playerState.activeBet = {
          gameId,
          amount: betAmount,
          autoCashOut: autoCashOutMultiplier,
          difficulty: validDifficulty,
          timestamp: new Date(),
          crashPoint: gameResult.crashPoint
        };
        playerStates.set(userId, playerState);
        
        // Use balanceService to record the bet transaction
        await balanceService.placeBet(userId, betAmount, 'chicken', {
          gameId,
          difficulty: validDifficulty,
          autoCashOut: autoCashOutMultiplier
        });
        
        // Log bet placement with loggingService
        loggingService.logBetPlaced('chicken', gameId, userId, betAmount, {
          difficulty: validDifficulty,
          autoCashOut: autoCashOutMultiplier,
          timestamp: new Date()
        });
        
        // Store game in active games
        activeGames.set(gameId, {
          id: gameId,
          userId,
          betAmount,
          autoCashOut: autoCashOutMultiplier,
          difficulty: validDifficulty,
          result: gameResult,
          cashOutMultiplier: null,
          isComplete: false,
          startTime: new Date()
        });
        
        // Update user balance in database if authenticated
        if (socket.request.session?.user) {
          await db.collection('users').updateOne(
            { _id: userId },
            { $inc: { balance: -betAmount } }
          );
        }
        
        // Return success to client
        callback({
          success: true,
          gameId,
          balance: playerState.balance
        });
        
        // Start the game
        startGame(gameId, chickenNamespace, socket);
      } catch (error) {
        console.error(`Error in place_bet: ${error}`);
        callback({ success: false, error: 'Server error' });
      }
    });
    
    /**
     * Handle player cashing out
     */
    socket.on('cash_out', async (data, callback) => {
      try {
        const playerState = playerStates.get(userId);
        
        if (!playerState.activeBet) {
          return callback({ success: false, error: 'No active bet' });
        }
        
        const game = activeGames.get(playerState.activeBet.gameId);
        if (!game) {
          return callback({ success: false, error: 'Game not found' });
        }
        
        if (game.isComplete) {
          return callback({ success: false, error: 'Game already complete' });
        }
        
        // Calculate current multiplier based on elapsed time
        const elapsedMs = new Date() - game.startTime;
        const currentTick = Math.floor(elapsedMs / 100); // Assuming 100ms per tick
        const currentMultiplier = game.result.timeline[currentTick]?.multiplier || 1;
        
        // Check if cash out is valid
        if (currentMultiplier >= game.result.crashPoint) {
          return callback({ success: false, error: 'Too late to cash out' });
        }
        
        // Process cash out
        const winAmount = playerState.activeBet.amount * currentMultiplier;
        const betAmount = playerState.activeBet.amount;
        playerState.balance += winAmount;
        
        // Use balanceService to record the win transaction
        await balanceService.recordWin(userId, betAmount, winAmount, 'chicken', {
          gameId: game.id,
          difficulty: game.difficulty,
          multiplier: currentMultiplier,
          profit: winAmount - betAmount
        });
        
        // Record cash out
        game.cashOutMultiplier = currentMultiplier;
        game.isComplete = true;
        activeGames.set(playerState.activeBet.gameId, game);
        
        // Record game result in history
        const gameResult = {
          id: game.id,
          timestamp: new Date(),
          betAmount: playerState.activeBet.amount,
          difficulty: game.difficulty,
          crashPoint: game.result.crashPoint,
          cashOutMultiplier: currentMultiplier,
          won: true,
          profit: winAmount - playerState.activeBet.amount
        };
        
        const userHistory = gameHistory.get(userId);
        userHistory.unshift(gameResult);
        
        // Trim history if needed
        if (userHistory.length > MAX_HISTORY_PER_PLAYER) {
          userHistory.length = MAX_HISTORY_PER_PLAYER;
        }
        gameHistory.set(userId, userHistory);
        
        // Clear active bet
        playerState.activeBet = null;
        playerStates.set(userId, playerState);
        
        // Update user balance in database if authenticated
        if (socket.request.session?.user) {
          await db.collection('users').updateOne(
            { _id: userId },
            { $set: { balance: playerState.balance } }
          );
          
          // Log game result
          await db.collection('game_logs').insertOne({
            userId,
            game: 'chicken',
            betAmount: gameResult.betAmount,
            result: 'win',
            profit: gameResult.profit,
            details: {
              difficulty: gameResult.difficulty,
              crashPoint: gameResult.crashPoint,
              cashOutMultiplier: gameResult.cashOutMultiplier
            },
            timestamp: new Date()
          });
        }
        
        // Return success to client
        callback({
          success: true,
          cashOutMultiplier: currentMultiplier,
          winAmount,
          balance: playerState.balance
        });
        
        // Emit to all clients that this player cashed out
        socket.to(game.id).emit('player_cashed_out', {
          playerId: userId,
          cashOutMultiplier: currentMultiplier
        });
      } catch (error) {
        console.error(`Error in cash_out: ${error}`);
        callback({ success: false, error: 'Server error' });
      }
    });
    
    /**
     * Handle request for game history
     */
    socket.on('get_history', (data, callback) => {
      try {
        const count = data.count || 10;
        const userHistory = gameHistory.get(userId) || [];
        const playerState = playerStates.get(userId);
        
        callback({
          success: true,
          userHistory: userHistory.slice(0, count),
          balance: playerState.balance
        });
      } catch (error) {
        console.error(`Error in get_history: ${error}`);
        callback({ success: false, error: 'Server error' });
      }
    });
    
    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      console.log(`Player disconnected from chicken game: ${socket.id}`);
      
      // If player has active bet, process as loss
      const playerState = playerStates.get(userId);
      if (playerState && playerState.activeBet) {
        const game = activeGames.get(playerState.activeBet.gameId);
        
        if (game && !game.isComplete) {
          // Record as a loss
          const gameResult = {
            id: game.id,
            timestamp: new Date(),
            betAmount: playerState.activeBet.amount,
            difficulty: game.difficulty,
            crashPoint: game.result.crashPoint,
            cashOutMultiplier: null,
            won: false,
            profit: -playerState.activeBet.amount
          };
          
          const userHistory = gameHistory.get(userId) || [];
          userHistory.unshift(gameResult);
          
          // Trim history if needed
          if (userHistory.length > MAX_HISTORY_PER_PLAYER) {
            userHistory.length = MAX_HISTORY_PER_PLAYER;
          }
          gameHistory.set(userId, userHistory);
          
          // Mark game as complete
          game.isComplete = true;
          activeGames.set(playerState.activeBet.gameId, game);
          
          // Clear active bet
          playerState.activeBet = null;
          playerStates.set(userId, playerState);
          
          // Log game result in database if authenticated
          if (socket.request.session?.user) {
            db.collection('game_logs').insertOne({
              userId,
              game: 'chicken',
              betAmount: gameResult.betAmount,
              result: 'loss',
              profit: gameResult.profit,
              details: {
                difficulty: gameResult.difficulty,
                crashPoint: gameResult.crashPoint,
                disconnected: true
              },
              timestamp: new Date()
            }).catch(err => {
              console.error(`Error logging game result: ${err}`);
            });
          }
        }
      }
    });
  });
};

/**
 * Start a new game and handle its lifecycle
 * 
 * @param {string} gameId - ID of the game to start
 * @param {Object} namespace - Socket.io namespace
 * @param {Object} socket - Player's socket connection
 */
function startGame(gameId, namespace, socket) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  const userId = game.userId;
  const playerState = playerStates.get(userId);
  
  // Send game started event
  socket.emit('game_started', {
    gameId,
    difficulty: game.difficulty,
    betAmount: game.betAmount
  });
  
  // Initialize game variables
  let currentTick = 0;
  let currentMultiplier = 1;
  const tickInterval = 100; // milliseconds
  const gameResult = game.result;
  
  // Auto cash out check function
  const checkAutoCashOut = () => {
    if (game.autoCashOut && 
        currentMultiplier >= game.autoCashOut && 
        currentMultiplier < gameResult.crashPoint &&
        !game.cashOutMultiplier) {
      
      // Process auto cash out
      const winAmount = game.betAmount * game.autoCashOut;
      playerState.balance += winAmount;
      
      // Record cash out
      game.cashOutMultiplier = game.autoCashOut;
      game.isComplete = true;
      activeGames.set(gameId, game);
      
      // Record game result
      const result = {
        id: gameId,
        timestamp: new Date(),
        betAmount: game.betAmount,
        difficulty: game.difficulty,
        crashPoint: gameResult.crashPoint,
        cashOutMultiplier: game.autoCashOut,
        won: true,
        profit: winAmount - game.betAmount
      };
      
      const userHistory = gameHistory.get(userId) || [];
      userHistory.unshift(result);
      
      // Trim history if needed
      if (userHistory.length > MAX_HISTORY_PER_PLAYER) {
        userHistory.length = MAX_HISTORY_PER_PLAYER;
      }
      gameHistory.set(userId, userHistory);
      
      // Clear active bet
      playerState.activeBet = null;
      playerStates.set(userId, playerState);
      
      // Notify player of auto cash out
      socket.emit('auto_cash_out', {
        cashOutMultiplier: game.autoCashOut,
        winAmount,
        balance: playerState.balance
      });
      
      // Update user balance in database if authenticated
      if (socket.request.session?.user) {
        db.collection('users').updateOne(
          { _id: userId },
          { $set: { balance: playerState.balance } }
        ).catch(err => {
          console.error(`Error updating user balance: ${err}`);
        });
        
        // Log game result
        db.collection('game_logs').insertOne({
          userId,
          game: 'chicken',
          betAmount: result.betAmount,
          result: 'win',
          profit: result.profit,
          details: {
            difficulty: result.difficulty,
            crashPoint: result.crashPoint,
            cashOutMultiplier: result.cashOutMultiplier,
            autoCashOut: true
          },
          timestamp: new Date()
        }).catch(err => {
          console.error(`Error logging game result: ${err}`);
        });
        
        // Log win via loggingService
        loggingService.logBetResult(
          'chicken', 
          gameId, 
          userId, 
          result.betAmount, 
          result.betAmount + result.profit, // winAmount
          true, // isWin
          {
            difficulty: result.difficulty,
            crashPoint: result.crashPoint,
            cashOutMultiplier: result.cashOutMultiplier,
            autoCashOut: true,
            timestamp: new Date()
          }
        );
      }
      
      clearInterval(gameInterval);
    }
  };
  
  // Start game loop
  const gameInterval = setInterval(() => {
    if (currentTick >= gameResult.timeline.length - 1 || game.isComplete) {
      clearInterval(gameInterval);
      
      // If game completed without a cash out
      if (!game.isComplete) {
        // Game crashed, player lost
        game.isComplete = true;
        activeGames.set(gameId, game);
        
        // Record game result
        const result = {
          id: gameId,
          timestamp: new Date(),
          betAmount: game.betAmount,
          difficulty: game.difficulty,
          crashPoint: gameResult.crashPoint,
          cashOutMultiplier: null,
          won: false,
          profit: -game.betAmount
        };
        
        const userHistory = gameHistory.get(userId) || [];
        userHistory.unshift(result);
        
        // Trim history if needed
        if (userHistory.length > MAX_HISTORY_PER_PLAYER) {
          userHistory.length = MAX_HISTORY_PER_PLAYER;
        }
        gameHistory.set(userId, userHistory);
        
        // Clear active bet
        playerState.activeBet = null;
        playerStates.set(userId, playerState);
        
        // Notify player of crash
        socket.emit('game_ended', {
          crashPoint: gameResult.crashPoint,
          betAmount: game.betAmount
        });
        
        // Log game result in database if authenticated
        if (socket.request.session?.user) {
          db.collection('game_logs').insertOne({
            userId,
            game: 'chicken',
            betAmount: result.betAmount,
            result: 'loss',
            profit: result.profit,
            details: {
              difficulty: result.difficulty,
              crashPoint: result.crashPoint
            },
            timestamp: new Date()
          }).catch(err => {
            console.error(`Error logging game result: ${err}`);
          });
        }
        
        // Log loss via loggingService
        loggingService.logBetResult(
          'chicken', 
          gameId, 
          userId, 
          result.betAmount, 
          0, // winAmount (0 for loss)
          false, // isWin
          {
            difficulty: result.difficulty,
            crashPoint: result.crashPoint,
            timestamp: new Date()
          }
        );
      }
      
      return;
    }
    
    // Update multiplier
    currentMultiplier = gameResult.timeline[currentTick].multiplier;
    
    // Send multiplier update to client
    socket.emit('multiplier_update', {
      multiplier: currentMultiplier,
      tick: currentTick
    });
    
    // Check for auto cash out
    checkAutoCashOut();
    
    // Increment tick
    currentTick++;
  }, tickInterval);
}

module.exports = initChickenHandler;