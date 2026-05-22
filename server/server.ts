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
import { socketAuth } from './middleware/socket/socketAuth.js';

// Drizzle Database Connection
import { connectDB, closeDB } from './drizzle/db.js';

// Better Auth
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { parseOrigins } from './lib/env.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import gameRoutes from './routes/games.js';
import adminRoutes from './routes/admin.js';
import adminAnalyticsRoutes from './routes/adminAnalytics.js';
// Admin routes for the pre-existing feature work (alerts, snapshots,
// tournaments, chat moderation, settings, etc.). Schema tables for these
// live in `drizzle/schema.ts` (added with Phase E-3 schema mirror).
import adminGamesRoutes from './routes/adminGames.js';
import adminHouseRoutes from './routes/adminHouse.js';
import loginRewardsRoutes from './routes/login-rewards.js';
import verifyRoutes from './routes/verify.js';
import leaderboardRoutes from './routes/leaderboard.js';
import responsibleGamingRoutes from './routes/responsible-gaming.js';
import adminSnapshotsRoutes from './routes/adminSnapshots.js';
import adminLoginRewardsRoutes from './routes/adminLoginRewards.js';
import adminChatRoutes, { setIo as setAdminChatIo } from './routes/adminChat.js';
import adminAlertsRoutes from './routes/adminAlerts.js';
import adminSettingsRoutes from './routes/adminSettings.js';
import adminUserLimitsRoutes from './routes/adminUserLimits.js';
import adminTournamentsRoutes from './routes/adminTournaments.js';
import tournamentsRoutes from './routes/tournaments.js';
import userLimitsService from './src/services/userLimitsService.js';

// Scheduled jobs
import { startDailySnapshotJob, stopDailySnapshotJob } from './src/jobs/dailySnapshot.js';
import { startTournamentSweeperJob, stopTournamentSweeperJob } from './src/jobs/tournamentSweeper.js';

// New engines (Phase B + C rebuild). Legacy handlers in
// `src/socket/{crashHandler,rouletteHandler,wheelHandler,blackjackHandler,
// plinkoHandler,landminesHandler,diceHandler,slotsHandler}.ts` are intentionally
// left on disk for rollback but are no longer wired into the namespace.
import { registerGameNamespace } from './src/games/_engine/registerNamespace.js';
import { CrashEngine } from './src/games/crash/engine.js';
import { RouletteEngine } from './src/games/roulette/engine.js';
import { WheelEngine } from './src/games/wheel/engine.js';
import { BlackjackEngine } from './src/games/blackjack/engine.js';
import { PlinkoEngine } from './src/games/plinko/engine.js';
import { LandminesEngine } from './src/games/landmines/engine.js';
import { DiceEngine } from './src/games/dice/engine.js';
import { SlotsEngine } from './src/games/slots/engine.js';
import balanceService from './src/services/balanceService.js';

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

  const allowedOrigins = parseOrigins(process.env.CLIENT_URL);
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

  // Private casino: block public sign-up. Integration tests still need to
  // create users via Better Auth, so we allow it when NODE_ENV === 'test'.
  // In production, only admin-created users can log in.
  app.use('/api/auth/sign-up', (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    if (process.env.NODE_ENV !== 'production') return next();
    return res.status(404).json({ message: 'Not found' });
  });

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

  // Global API rate limiting. In production a tight cap protects against abuse;
  // in dev/test the e2e suite legitimately makes >120 requests per minute, so
  // raise the cap dramatically so test runs are not throttled.
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isProduction ? 120 : 5000,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api', apiLimiter);

  // Routes (auth is handled by Better Auth above)
  app.use('/api/users', userRoutes);
  app.use('/api/games', gameRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/admin/analytics', adminAnalyticsRoutes);
  app.use('/api/admin/games', adminGamesRoutes);
  app.use('/api/admin/house', adminHouseRoutes);
  app.use('/api/admin/snapshots', adminSnapshotsRoutes);
  app.use('/api/admin/login-rewards', adminLoginRewardsRoutes);
  app.use('/api/admin/chat', adminChatRoutes);
  app.use('/api/admin/alerts', adminAlertsRoutes);
  app.use('/api/admin/settings', adminSettingsRoutes);
  app.use('/api/admin/user-limits', adminUserLimitsRoutes);
  app.use('/api/admin/tournaments', adminTournamentsRoutes);
  setAdminChatIo(io);
  app.use('/api/rewards', loginRewardsRoutes);
  app.use('/api/verify', verifyRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/responsible-gaming', responsibleGamingRoutes);
  app.use('/api/tournaments', tournamentsRoutes);

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

  // Crash game namespace — new engine wiring (Phase B).
  // The engine drives its own round cycle; `bindEvents` wires the legacy
  // ack-callback contract for `placeBet` / `cashOut`. `registerGameNamespace`
  // handles auth, join handshake (`gameState`), disconnect cleanup, and
  // `userLimitsService.clearSession`.
  registerGameNamespace(
    io,
    'crash',
    () => {
      const engine = new CrashEngine();
      engine.startCycle();
      return engine;
    },
    (engine, ctx) => {
      ctx.socket.on('placeBet', async (payload: any, ack?: (resp: any) => void) => {
        try {
          const result = await engine.onBet(ctx, payload);
          ack?.({ success: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          ack?.({ success: false, error: message });
        }
      });
      ctx.socket.on('cashOut', async (_payload: any, ack?: (resp: any) => void) => {
        try {
          const result = await engine.cashOut(ctx);
          ack?.({ success: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          ack?.({ success: false, error: message });
        }
      });
    },
  );

  // Roulette game namespace — new engine wiring (Phase B).
  // The engine binds its own `roulette:join` / `roulette:place_bet` /
  // `roulette:spin` / `roulette:get_history` listeners inside `onJoin`, so
  // `bindEvents` is a no-op here.
  registerGameNamespace(
    io,
    'roulette',
    () => {
      const engine = new RouletteEngine();
      engine.start();
      return engine;
    },
    () => {
      /* event listeners bound in RouletteEngine.onJoin */
    },
  );

  // Blackjack game namespace — new engine wiring (Phase C).
  // The engine emits `blackjack_game_state` + `balanceUpdate` itself. The
  // bindEvents layer only routes the four inbound action events into the
  // engine. Engine errors surface as `blackjack_error: { message }` — the
  // legacy outbound contract used by the existing client.
  registerGameNamespace(
    io,
    'blackjack',
    () => new BlackjackEngine(),
    (engine, ctx) => {
      const safeEmitError = (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        ctx.socket.emit('blackjack_error', { message });
      };
      ctx.socket.on('blackjack_start', async (payload: any) => {
        try { await engine.onBet(ctx, payload); } catch (err) { safeEmitError(err); }
      });
      ctx.socket.on('blackjack_hit', async (payload: any) => {
        try { await engine.onAction(ctx, 'hit', payload); } catch (err) { safeEmitError(err); }
      });
      ctx.socket.on('blackjack_stand', async (payload: any) => {
        try { await engine.onAction(ctx, 'stand', payload); } catch (err) { safeEmitError(err); }
      });
      ctx.socket.on('blackjack_double', async (payload: any) => {
        try { await engine.onAction(ctx, 'double', payload); } catch (err) { safeEmitError(err); }
      });
    },
  );

  // Plinko game namespace — new engine wiring (Phase C).
  // Single-shot: `plinko:drop_ball` runs `onBet`, which packages the legacy
  // ack-shape onto `resultDetails.ack`. `plinko:get_history` reads the
  // engine's in-memory ring buffer. `plinko:join` / `plinko:leave` are
  // no-ops because per-user state is already pushed via `onJoin`.
  registerGameNamespace(
    io,
    'plinko',
    () => new PlinkoEngine(),
    (engine, ctx) => {
      ctx.socket.on('plinko:drop_ball', async (payload: any, ack?: (resp: any) => void) => {
        try {
          const result = await engine.onBet(ctx, payload);
          const ackPayload = (result.resultDetails as any)?.ack ?? null;
          if (ack) {
            if (ackPayload) ack(ackPayload);
            else ack({ success: true, gameId: String(result.sessionId), balance: result.balance });
          }
        } catch (err) {
          if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
      ctx.socket.on('plinko:get_history', (data: any, ack?: (resp: any) => void) => {
        try {
          const limit = data?.limit || 10;
          const history = engine.getHistory(limit);
          if (ack) ack({ success: true, userHistory: [], globalHistory: history });
        } catch (err) {
          if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
      // Legacy no-op events kept for backwards compatibility with old clients.
      ctx.socket.on('plinko:join', (_data: any, ack?: (resp: any) => void) => {
        if (ack) ack({ success: true });
      });
      ctx.socket.on('plinko:leave', () => { /* state cleared by base.onDisconnect */ });
    },
  );

  // Landmines game namespace — new engine wiring (Phase C).
  // Multi-step: `landmines:start` opens a session via `onBet`,
  // `landmines:pick` / `landmines:cashout` route to `onAction`. The engine
  // returns rich result objects; we translate to the legacy ack shapes.
  registerGameNamespace(
    io,
    'landmines',
    () => new LandminesEngine(),
    (engine, ctx) => {
      ctx.socket.on('landmines:start', async (payload: any, ack?: (resp: any) => void) => {
        try {
          const result = await engine.onBet(ctx, payload);
          const details = (result.resultDetails ?? {}) as any;
          if (ack) ack({
            success: true,
            gameId: details.gameId,
            mines: details.mines,
            gridSize: details.gridSize ?? 5,
            balance: result.balance,
          });
        } catch (err) {
          if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
      ctx.socket.on('landmines:pick', async (payload: any, ack?: (resp: any) => void) => {
        try {
          const result = await engine.onAction(ctx, 'reveal', payload);
          const details = (result.resultDetails ?? {}) as any;
          if (details.hit === true) {
            if (ack) ack({
              success: true,
              hit: true,
              position: details.position,
              gameOver: true,
              fullGrid: details.fullGrid,
              winAmount: 0,
            });
          } else {
            if (ack) ack({
              success: true,
              hit: false,
              position: details.position,
              multiplier: details.multiplier,
              potentialWin: details.potentialWin,
              winAmount: details.winAmount,
              profit: details.profit,
              gameOver: !!details.gameOver,
              fullGrid: details.fullGrid,
              remainingSafeCells: details.remainingSafeCells,
              autoCashout: details.autoCashout,
            });
          }
        } catch (err) {
          if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
      ctx.socket.on('landmines:cashout', async (payload: any, ack?: (resp: any) => void) => {
        try {
          const result = await engine.onAction(ctx, 'cashout', payload);
          const details = (result.resultDetails ?? {}) as any;
          if (ack) ack({
            success: true,
            winAmount: details.winAmount,
            multiplier: details.multiplier,
            profit: details.profit,
            cashedOut: !!details.cashedOut,
            balance: result.balance,
            fullGrid: details.fullGrid,
          });
        } catch (err) {
          if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  );

  // Dice game namespace — new engine wiring (Phase C).
  // Single-shot: `dice:roll` runs `onBet`, translates to `{ ok, gameId,
  // result, target, direction, win, multiplier, winAmount, newBalance }`.
  // `dice:join` returns the player's current balance for the lightweight
  // client-mount handshake.
  registerGameNamespace(
    io,
    'dice',
    () => new DiceEngine(),
    (engine, ctx) => {
      ctx.socket.on('dice:roll', async (payload: any, ack?: (resp: any) => void) => {
        try {
          const result = await engine.onBet(ctx, payload);
          const details = (result.resultDetails ?? {}) as any;
          if (ack) ack({
            ok: true,
            gameId: String(result.sessionId),
            result: details.result,
            target: details.target,
            direction: details.direction,
            win: details.win,
            multiplier: result.finalMultiplier ?? 0,
            winAmount: result.outcome,
            newBalance: result.balance,
          });
        } catch (err) {
          if (ack) ack({ ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
      ctx.socket.on('dice:join', async (_data: any, ack?: (resp: any) => void) => {
        try {
          const balance = await balanceService.getBalance(ctx.user.userId);
          if (ack) ack({ success: true, balance, history: [] });
        } catch (err) {
          if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
      ctx.socket.on('dice:leave', () => { /* per-user state lives in seed cache only */ });
    },
  );

  // Slots game namespace — new engine wiring (Phase C).
  // Single-shot: `slots:spin` runs `onBet`, translates to `{ ok, gameId,
  // reels, hits, totalPayout, multiplier, newBalance }`. `slots:join`
  // returns the current balance for the lightweight handshake.
  registerGameNamespace(
    io,
    'slots',
    () => new SlotsEngine(),
    (engine, ctx) => {
      ctx.socket.on('slots:spin', async (payload: any, ack?: (resp: any) => void) => {
        try {
          const result = await engine.onBet(ctx, payload);
          const details = (result.resultDetails ?? {}) as any;
          if (ack) ack({
            ok: true,
            gameId: String(result.sessionId),
            reels: details.reels,
            hits: details.hits,
            totalPayout: result.outcome,
            multiplier: result.finalMultiplier ?? 0,
            newBalance: result.balance,
          });
        } catch (err) {
          if (ack) ack({ ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
      ctx.socket.on('slots:join', async (_data: any, ack?: (resp: any) => void) => {
        try {
          const balance = await balanceService.getBalance(ctx.user.userId);
          if (ack) ack({ success: true, balance });
        } catch (err) {
          if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
      ctx.socket.on('slots:leave', () => { /* no per-connection state */ });
    },
  );

  // Wheel game namespace — new engine wiring (Phase B).
  // The engine owns the round loop and `onBet` logic; `bindEvents` wires the
  // legacy ack-callback contract for `wheel:place_bet` and forwards the
  // `wheel:get_history` request. Error messages are mapped back to the
  // legacy strings so existing client code + integration tests keep matching.
  registerGameNamespace(
    io,
    'wheel',
    () => {
      const engine = new WheelEngine();
      engine.start();
      return engine;
    },
    (engine, ctx) => {
      ctx.socket.on('wheel:place_bet', async (payload: any, ack?: (resp: any) => void) => {
        try {
          const result = await engine.onBet(ctx, payload);
          ack?.({ success: true, balance: result.balance, sessionId: result.sessionId });
        } catch (err) {
          const raw = err instanceof Error ? err.message : String(err);
          const error = (() => {
            switch (raw) {
              case 'not_betting_phase':
                return 'Betting is closed';
              case 'already_placed_bet':
                return 'You already placed a bet this round';
              case 'invalid_bet':
              case 'invalid_payload':
                return 'Invalid bet';
              case 'invalid_difficulty':
                return 'Invalid difficulty';
              default:
                if (raw.startsWith('limit_')) return `Bet blocked: ${raw.slice(6)}`;
                return raw;
            }
          })();
          ack?.({ success: false, error });
        }
      });
      ctx.socket.on('wheel:get_history', (_data: any, ack?: (resp: any) => void) => {
        // History is engine-internal; expose via a tiny accessor on the engine.
        const history = (engine as any).history ?? [];
        const limit = _data?.limit || 10;
        ack?.({ success: true, globalHistory: history.slice(-limit) });
      });
    },
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
      const userId = (socket as any).user?.userId;
      LoggingService.logSystemEvent('socket_disconnected', { username, socketId: socket.id });
      if (userId != null) {
        userLimitsService.clearSession(userId);
      }
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

  // Start scheduled jobs (skip in test environment to keep unit tests deterministic)
  if (process.env.NODE_ENV !== 'test') {
    startDailySnapshotJob();
    startTournamentSweeperJob();
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    LoggingService.logSystemEvent('sigint_received', {});
    stopDailySnapshotJob();
    stopTournamentSweeperJob();
    await RedisService.close();
    await closeDB();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    LoggingService.logSystemEvent('sigterm_received', {});
    stopDailySnapshotJob();
    stopTournamentSweeperJob();
    await RedisService.close();
    await closeDB();
    process.exit(0);
  });
}

if (!process.env.VITEST) {
  startServer();
}
