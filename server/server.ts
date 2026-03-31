import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { sql } from 'drizzle-orm';
import LoggingService from './src/services/loggingService.js';
import RedisService from './src/services/redisService.js';
import type { Socket } from 'socket.io';

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
import adminAnalyticsRoutes from './routes/adminAnalytics.js';
import loginRewardsRoutes from './routes/login-rewards.js';
import verifyRoutes from './routes/verify.js';
import leaderboardRoutes from './routes/leaderboard.js';
import responsibleGamingRoutes from './routes/responsible-gaming.js';

// Config
dotenv.config();

// ── App Factory ───────────────────────────────────────────────────────
// Extracted so integration tests can spin up a real server without side effects.

export interface AppInstance {
  app: express.Express;
  httpServer: http.Server;
  io: SocketIOServer;
}

export async function createApp(): Promise<AppInstance> {
  const app = express();
  const httpServer = http.createServer(app);

  // Support comma-separated CLIENT_URL for multiple allowed origins
  // e.g. CLIENT_URL=http://localhost,http://localhost:5173
  const rawOrigins = process.env.CLIENT_URL || 'http://localhost';
  const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);
  const corsOrigin = allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins;

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Optional Redis adapter for horizontal scaling
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

  // CORS must be before Better Auth handler
  app.use(cors({
    origin: corsOrigin,
    credentials: true
  }));

  // Dedicated auth rate limiter — must be registered before auth handlers
  // to prevent brute-force attacks on login/register endpoints.
  // In production mode, strictly limit to 20 per 15 minutes.
  // In development/test (or when NODE_ENV is unset), allow a higher limit
  // so that e2e tests and local development are not throttled.
  const isProduction = process.env.NODE_ENV === 'production';
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 20 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many authentication attempts, please try again later' }
  });
  app.use('/api/auth', authLimiter);

  // Custom auth routes (registered before Better Auth catch-all so they take priority)
  app.use('/api/auth', authRoutes);

  // Better Auth handler - must be before express.json()
  app.all("/api/auth/*", toNodeHandler(auth));

  // Middleware
  app.use(helmet({
    contentSecurityPolicy: false // Disabled because client is served from different origin in dev/production
  }));
  app.use(compression());
  app.use(requestIdMiddleware); // Assign request ID early so all downstream middleware/routes can use it
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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
  app.use('/api/admin/analytics', adminAnalyticsRoutes);
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

  // ── Socket.IO Namespaces & Game Handlers ────────────────────────────
  // Collect handler init promises so callers can await full readiness.
  const handlerPromises: Promise<any>[] = [];

  // Crash game namespace
  const crashNamespace = io.of('/crash');
  crashNamespace.use(socketAuth);

  handlerPromises.push(
    import('./src/socket/crashHandler.js')
      .then((mod: any) => {
        const init = mod?.default || mod;
        if (typeof init === 'function') init(crashNamespace);
      })
      .catch((err) => LoggingService.logSystemEvent('crash_handler_init_failed', { error: String(err) }, 'error'))
  );

  crashNamespace.on('connection', (socket) => {
    LoggingService.logGameEvent('crash', 'namespace_connection', { socketId: socket.id });

    const user = getAuthenticatedUser(socket);
    if (!user) {
      LoggingService.logSystemEvent('unauthenticated_crash_namespace', { socketId: socket.id }, 'warning');
      socket.disconnect();
      return;
    }

    LoggingService.logGameEvent('crash', 'namespace_authenticated', { username: user.username, userId: user.userId });

    socket.on('disconnect', () => {
      LoggingService.logGameEvent('crash', 'namespace_disconnected', { username: user.username, userId: user.userId });
    });
  });

  // Roulette game namespace (namespace-level init with automated game loop)
  const rouletteNamespace = io.of('/roulette');
  rouletteNamespace.use(socketAuth);

  handlerPromises.push(
    import('./src/socket/rouletteHandler.js')
      .then((mod: any) => {
        const init = mod?.default || mod;
        if (typeof init === 'function') init(rouletteNamespace);
      })
      .catch((err) => LoggingService.logSystemEvent('roulette_handler_init_failed', { error: String(err) }, 'error'))
  );

  // Landmines game namespace
  const landminesNamespace = io.of('/landmines');
  landminesNamespace.use(socketAuth);

  landminesNamespace.on('connection', (socket) => {
    LoggingService.logGameEvent('landmines', 'namespace_connection', { socketId: socket.id });

    const user = getAuthenticatedUser(socket);
    if (!user) {
      LoggingService.logSystemEvent('unauthenticated_landmines_namespace', { socketId: socket.id }, 'warning');
      socket.disconnect();
      return;
    }

    LoggingService.logGameEvent('landmines', 'namespace_authenticated', { username: user.username, userId: user.userId });

    import('./src/socket/landminesHandler.js')
      .then((mod: any) => {
        const init = mod?.initLandminesHandlers || mod?.default?.initLandminesHandlers || mod?.default;
        if (typeof init === 'function') init(io, socket, user);
      })
      .catch((err) => LoggingService.logSystemEvent('landmines_handler_init_failed', { error: String(err) }, 'error'));

    socket.on('disconnect', () => {
      LoggingService.logGameEvent('landmines', 'namespace_disconnected', { username: user.username, userId: user.userId });
    });
  });

  // Blackjack game namespace
  const blackjackNamespace = io.of('/blackjack');
  blackjackNamespace.use(socketAuth);

  let blackjackHandler: any = null;
  handlerPromises.push(
    import('./src/socket/blackjackHandler.js')
      .then((mod: any) => {
        const HandlerClass = mod?.default || mod?.BlackjackHandler;
        if (HandlerClass && typeof HandlerClass === 'function') {
          blackjackHandler = new HandlerClass(blackjackNamespace);
          LoggingService.logSystemEvent('blackjack_handler_initialized', {});
        }
      })
      .catch((err) => LoggingService.logSystemEvent('blackjack_handler_init_failed', { error: String(err) }, 'error'))
  );

  blackjackNamespace.on('connection', (socket) => {
    LoggingService.logGameEvent('blackjack', 'namespace_connection', { socketId: socket.id });

    const user = getAuthenticatedUser(socket);
    if (!user) {
      LoggingService.logSystemEvent('unauthenticated_blackjack_namespace', { socketId: socket.id }, 'warning');
      socket.disconnect();
      return;
    }

    LoggingService.logGameEvent('blackjack', 'namespace_authenticated', { username: user.username, userId: user.userId });

    if (blackjackHandler) {
      blackjackHandler.handleConnection(socket);
    } else {
      LoggingService.logSystemEvent('blackjack_handler_not_ready', { socketId: socket.id }, 'warning');
      socket.emit('blackjack_error', { message: 'Game handler is initializing, please reconnect shortly' });
    }

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

  // Wheel game namespace (namespace-level init with automated game loop)
  const wheelNamespace = io.of('/wheel');
  wheelNamespace.use(socketAuth);

  handlerPromises.push(
    import('./src/socket/wheelHandler.js')
      .then((mod: any) => {
        const init = mod?.default || mod;
        if (typeof init === 'function') init(wheelNamespace);
      })
      .catch((err) => LoggingService.logSystemEvent('wheel_handler_init_failed', { error: String(err) }, 'error'))
  );

  // Apply authentication middleware to main namespace
  io.use(socketAuth);

  // Socket.io main namespace connection
  io.on('connection', (socket: Socket) => {
    LoggingService.logSystemEvent('socket_connected', { socketId: socket.id });

    socket.on('joinGame', (gameType, callback) => {
      if (!(socket as any).user) {
        LoggingService.logSystemEvent('unauthenticated_join_attempt', { socketId: socket.id, gameType }, 'warning');

        if (callback) {
          callback({
            success: false,
            error: 'Authentication required to join games'
          });
        }

        socket.disconnect();
        return;
      }

      socket.join(gameType);
      const username = (socket as any).user?.username || socket.id;
      LoggingService.logSystemEvent('join_game', { username, gameType, socketId: socket.id });

      if (callback) {
        callback({ success: true });
      }
    });

    socket.on('disconnect', () => {
      const username = (socket as any).user?.username || socket.id;
      LoggingService.logSystemEvent('socket_disconnected', { username, socketId: socket.id });
    });
  });

  // Initialize chat handlers
  handlerPromises.push(
    import('./src/socket/chatHandler.js')
      .then((mod: any) => {
        const init = mod?.default || mod?.initChatHandlers;
        if (typeof init === 'function') init(io);
      })
      .catch((err) => LoggingService.logSystemEvent('chat_handler_init_failed', { error: String(err) }, 'error'))
  );

  // Initialize live games handlers
  handlerPromises.push(
    import('./src/socket/liveGamesHandler.js')
      .then((mod: any) => {
        const init = mod?.default || mod?.initLiveGamesHandlers;
        if (typeof init === 'function') init(io);
      })
      .catch((err) => LoggingService.logSystemEvent('live_games_handler_init_failed', { error: String(err) }, 'error'))
  );

  // Wait for all handler imports to complete
  await Promise.allSettled(handlerPromises);

  return { app, httpServer, io };
}

// ── Production Startup ────────────────────────────────────────────────
// Only runs when executed directly (vitest sets VITEST env var automatically).

async function startServer() {
  // Validate required environment variables
  const requiredEnvVars = ['DATABASE_URL', 'BETTER_AUTH_SECRET'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }

  // Global error handlers
  process.on('uncaughtException', (error) => {
    LoggingService.logSystemEvent('uncaught_exception', { error: String(error), stack: error.stack }, 'error');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    LoggingService.logSystemEvent('unhandled_rejection', { reason: String(reason) }, 'error');
    // In production, exit to prevent undefined state.
    // In development, log and continue so the dev server stays up.
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  const { httpServer, io } = await createApp();

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

  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    LoggingService.logSystemEvent('server_started', { port: PORT });
  });

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
}

if (!process.env.VITEST) {
  startServer();
}
