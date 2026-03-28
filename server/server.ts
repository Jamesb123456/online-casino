import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { sql } from 'drizzle-orm';
import LoggingService from './src/services/loggingService.js';
import RedisService from './src/services/redisService.js';
import type { Socket } from 'socket.io';
// import initChatHandlers from './src/socket/chatHandler.js';
// import initLiveGamesHandlers from './src/socket/liveGamesHandler.js';

// Request ID Middleware
import { requestIdMiddleware } from './middleware/requestId.js';

// Socket Authentication Middleware
import { socketAuth, getAuthenticatedUser } from './middleware/socket/socketAuth.js';

// Drizzle Database Connection
import { connectDB, closeDB } from './drizzle/db.js';

// Better Auth
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import gameRoutes from './routes/games.js';
import adminRoutes from './routes/admin.js';
import loginRewardsRoutes from './routes/login-rewards.js';
import verifyRoutes from './routes/verify.js';
import leaderboardRoutes from './routes/leaderboard.js';
import responsibleGamingRoutes from './routes/responsible-gaming.js';

// Config
dotenv.config();

// Validate required environment variables at startup
const requiredEnvVars = ['DATABASE_URL'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Add global error handlers
process.on('uncaughtException', (error) => {
  LoggingService.logSystemEvent('uncaught_exception', { error: String(error), stack: error.stack }, 'error');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  LoggingService.logSystemEvent('unhandled_rejection', { reason: String(reason) }, 'error');
  process.exit(1);
});

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Optional Redis adapter for horizontal scaling
(async () => {
  try {
    const pubClient = RedisService.getClient();
    const subClient = RedisService.getSubscriber();
    if (pubClient && subClient) {
      const { createAdapter } = await import('@socket.io/redis-adapter');
      io.adapter(createAdapter(pubClient, subClient));
      LoggingService.logSystemEvent('redis_adapter_enabled', {});
    }
  } catch (err) {
    LoggingService.logSystemEvent('redis_adapter_skipped', { reason: String(err) });
  }
})();

// CORS must be before Better Auth handler
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Custom auth routes (registered before Better Auth catch-all so they take priority)
app.use('/api/auth', authRoutes);

// Better Auth handler - must be before express.json()
app.all("/api/auth/*", toNodeHandler(auth));

// Middleware
app.use(requestIdMiddleware); // Assign request ID early so all downstream middleware/routes can use it
app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(morgan('dev'));

// Global API rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// Routes (auth is handled by Better Auth above)
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rewards', loginRewardsRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/responsible-gaming', responsibleGamingRoutes);

// Health check - basic
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Health check - database
app.get('/api/health/db', async (req: express.Request, res: express.Response) => {
  try {
    // Test database connection with a simple query
    const { db } = await import('./drizzle/db.js');
    await db.execute(sql`SELECT 1`);
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// Root route
app.get('/', (req: express.Request, res: express.Response) => {
  res.send('Platinum Casino API is running');
});

// Define all namespaces outside the main connection handler
// Apply authentication middleware to all game namespaces
// Crash game namespace
const crashNamespace = io.of('/crash');

// Apply authentication middleware to crash namespace
crashNamespace.use(socketAuth);

// Initialize crash handlers once at startup (handler attaches its own connection listener)
import('./src/socket/crashHandler.js')
  .then((mod: any) => {
    const init = mod?.default || mod;
    if (typeof init === 'function') init(crashNamespace);
  })
  .catch((err) => LoggingService.logSystemEvent('crash_handler_init_failed', { error: String(err) }, 'error'));

crashNamespace.on('connection', (socket) => {
  LoggingService.logGameEvent('crash', 'namespace_connection', { socketId: socket.id });
  
  // Get authenticated user from socket
  const user = getAuthenticatedUser(socket);
  if (!user) {
    LoggingService.logSystemEvent('unauthenticated_crash_namespace', { socketId: socket.id }, 'warning');
    socket.disconnect();
    return;
  }
  
  LoggingService.logGameEvent('crash', 'namespace_authenticated', { username: user.username, userId: user.userId });
  
  // Crash handler is initialized at namespace level above
  
  // Handle disconnection
  socket.on('disconnect', () => {
    LoggingService.logGameEvent('crash', 'namespace_disconnected', { username: user.username, userId: user.userId });
  });
});

// Roulette game namespace
const rouletteNamespace = io.of('/roulette');

// Apply authentication middleware to roulette namespace
rouletteNamespace.use(socketAuth);

rouletteNamespace.on('connection', (socket) => {
  LoggingService.logGameEvent('roulette', 'namespace_connection', { socketId: socket.id });
  
  // Get authenticated user from socket
  const user = getAuthenticatedUser(socket);
  if (!user) {
    LoggingService.logSystemEvent('unauthenticated_roulette_namespace', { socketId: socket.id }, 'warning');
    socket.disconnect();
    return;
  }
  
  LoggingService.logGameEvent('roulette', 'namespace_authenticated', { username: user.username, userId: user.userId });
  
  // Initialize roulette handlers
  import('./src/socket/rouletteHandler.js')
    .then((mod: any) => {
      const init = mod?.initRouletteHandlers || mod?.default?.initRouletteHandlers;
      if (typeof init === 'function') init(io, socket, user);
    })
    .catch((err) => LoggingService.logSystemEvent('roulette_handler_init_failed', { error: String(err) }, 'error'));
  
  // Handle disconnection
  socket.on('disconnect', () => {
    LoggingService.logGameEvent('roulette', 'namespace_disconnected', { username: user.username, userId: user.userId });
  });
});

// Landmines game namespace
const landminesNamespace = io.of('/landmines');

// Apply authentication middleware to landmines namespace
landminesNamespace.use(socketAuth);

landminesNamespace.on('connection', (socket) => {
  LoggingService.logGameEvent('landmines', 'namespace_connection', { socketId: socket.id });
  
  // Get authenticated user from socket
  const user = getAuthenticatedUser(socket);
  if (!user) {
    LoggingService.logSystemEvent('unauthenticated_landmines_namespace', { socketId: socket.id }, 'warning');
    socket.disconnect();
    return;
  }
  
  LoggingService.logGameEvent('landmines', 'namespace_authenticated', { username: user.username, userId: user.userId });
  
  // Initialize landmines handlers
  import('./src/socket/landminesHandler.js')
    .then((mod: any) => {
      const init = mod?.initLandminesHandlers || mod?.default?.initLandminesHandlers || mod?.default;
      if (typeof init === 'function') init(io, socket, user);
    })
    .catch((err) => LoggingService.logSystemEvent('landmines_handler_init_failed', { error: String(err) }, 'error'));
  
  // Handle disconnection
  socket.on('disconnect', () => {
    LoggingService.logGameEvent('landmines', 'namespace_disconnected', { username: user.username, userId: user.userId });
  });
});

// Blackjack game namespace
const blackjackNamespace = io.of('/blackjack');

// Apply authentication middleware to blackjack namespace
blackjackNamespace.use(socketAuth);

blackjackNamespace.on('connection', (socket) => {
  LoggingService.logGameEvent('blackjack', 'namespace_connection', { socketId: socket.id });
  
  // Get authenticated user from socket
  const user = getAuthenticatedUser(socket);
  if (!user) {
    LoggingService.logSystemEvent('unauthenticated_blackjack_namespace', { socketId: socket.id }, 'warning');
    socket.disconnect();
    return;
  }
  
  LoggingService.logGameEvent('blackjack', 'namespace_authenticated', { username: user.username, userId: user.userId });
  
  // Initialize blackjack handlers
  import('./src/socket/blackjackHandler.js')
    .then((mod: any) => {
      const HandlerClass = mod?.default || mod?.BlackjackHandler;
      if (HandlerClass && typeof HandlerClass === 'function') {
        const handler = new HandlerClass(blackjackNamespace);
        handler.handleConnection(socket);
      }
    })
    .catch((err) => LoggingService.logSystemEvent('blackjack_handler_init_failed', { error: String(err) }, 'error'));

  // Handle disconnection
  socket.on('disconnect', () => {
    LoggingService.logGameEvent('blackjack', 'namespace_disconnected', { username: user.username, userId: user.userId });
  });
});

// Plinko game namespace
const plinkoNamespace = io.of('/plinko');
plinkoNamespace.use(socketAuth);
plinkoNamespace.on('connection', (socket) => {
  LoggingService.logGameEvent('plinko', 'namespace_connection', { socketId: socket.id });
  const user = getAuthenticatedUser(socket);
  if (!user) {
    LoggingService.logSystemEvent('unauthenticated_plinko_namespace', { socketId: socket.id }, 'warning');
    socket.disconnect();
    return;
  }
  LoggingService.logGameEvent('plinko', 'namespace_authenticated', { username: user.username, userId: user.userId });
  // Initialize plinko handlers per-connection
  import('./src/socket/plinkoHandler.js')
    .then((mod: any) => {
      const init = mod?.initPlinkoHandlers || mod?.default?.initPlinkoHandlers || mod?.default;
      if (typeof init === 'function') init(io, socket, user);
    })
    .catch((err) => LoggingService.logSystemEvent('plinko_handler_init_failed', { error: String(err) }, 'error'));
  socket.on('disconnect', () => {
    LoggingService.logGameEvent('plinko', 'namespace_disconnected', { username: user.username, userId: user.userId });
  });
});

// Wheel game namespace
const wheelNamespace = io.of('/wheel');
wheelNamespace.use(socketAuth);
wheelNamespace.on('connection', (socket) => {
  LoggingService.logGameEvent('wheel', 'namespace_connection', { socketId: socket.id });
  const user = getAuthenticatedUser(socket);
  if (!user) {
    LoggingService.logSystemEvent('unauthenticated_wheel_namespace', { socketId: socket.id }, 'warning');
    socket.disconnect();
    return;
  }
  LoggingService.logGameEvent('wheel', 'namespace_authenticated', { username: user.username, userId: user.userId });
  // Initialize wheel handlers per-connection
  import('./src/socket/wheelHandler.js')
    .then((mod: any) => {
      const init = mod?.initWheelHandlers || mod?.default?.initWheelHandlers || mod?.default;
      if (typeof init === 'function') init(io, socket, user);
    })
    .catch((err) => LoggingService.logSystemEvent('wheel_handler_init_failed', { error: String(err) }, 'error'));
  socket.on('disconnect', () => {
    LoggingService.logGameEvent('wheel', 'namespace_disconnected', { username: user.username, userId: user.userId });
  });
});

// Socket.io main namespace connection
io.on('connection', (socket: Socket) => {
  LoggingService.logSystemEvent('socket_connected', { socketId: socket.id });
  
  // Check authentication before allowing game room joins
  socket.on('joinGame', (gameType, callback) => {
    // Only authenticated sockets can join game rooms
    if (!(socket as any).user) {
      LoggingService.logSystemEvent('unauthenticated_join_attempt', { socketId: socket.id, gameType }, 'warning');
      
      if (callback) {
        callback({ 
          success: false, 
          error: 'Authentication required to join games' 
        });
      }
      
      // Prevent join and disconnect the socket
      socket.disconnect();
      return;
    }
    
    // If authenticated, allow join
    socket.join(gameType);
    const username = (socket as any).user?.username || socket.id;
    LoggingService.logSystemEvent('join_game', { username, gameType, socketId: socket.id });
    
    if (callback) {
      callback({ success: true });
    }
  });
  
  // Handle disconnection from main namespace
  socket.on('disconnect', () => {
    const username = (socket as any).user?.username || socket.id;
    LoggingService.logSystemEvent('socket_disconnected', { username, socketId: socket.id });
  });
});

// Initialize chat handlers
import('./src/socket/chatHandler.js')
  .then((mod: any) => {
    const init = mod?.default || mod?.initChatHandlers;
    if (typeof init === 'function') init(io);
  })
  .catch((err) => LoggingService.logSystemEvent('chat_handler_init_failed', { error: String(err) }, 'error'));

// Initialize live games handlers
import('./src/socket/liveGamesHandler.js')
  .then((mod: any) => {
    const init = mod?.default || mod?.initLiveGamesHandlers;
    if (typeof init === 'function') init(io);
  })
  .catch((err) => LoggingService.logSystemEvent('live_games_handler_init_failed', { error: String(err) }, 'error'));

// Graceful shutdown
process.on('SIGINT', async () => {
  LoggingService.logSystemEvent('sigint_received', {});
  await RedisService.close();
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  LoggingService.logSystemEvent('sigterm_received', {});
  await RedisService.close();
  await closeDB();
  process.exit(0);
});

// Start server with DB verification
const PORT = process.env.PORT || 5000; // Default port 5000

const startServer = async () => {
  // Verify database connection with retry
  let dbConnected = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await connectDB();
      dbConnected = true;
      LoggingService.logSystemEvent('database_connected', { attempt });
      break;
    } catch (error) {
      LoggingService.logSystemEvent('database_connection_failed', {
        attempt,
        maxAttempts: 5,
        error: String(error)
      }, 'error');
      if (attempt < 5) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  if (!dbConnected) {
    LoggingService.logSystemEvent('database_connection_exhausted', {}, 'error');
    process.exit(1);
  }

  server.listen(PORT, () => {
    LoggingService.logSystemEvent('server_started', { port: PORT });
  });
};

startServer();

export { io };