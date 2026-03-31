/**
 * Integration test server bootstrap.
 * Starts a real Express + Socket.IO server backed by a test MySQL database.
 */
import http from 'http';
import type { Server as SocketIOServer } from 'socket.io';
import type { Express } from 'express';

// Set test env vars BEFORE any app code is imported
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://test_user:test_pass@localhost:3307/platinum_casino_test';
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'integration-test-secret-that-is-at-least-32-chars-long';
process.env.BETTER_AUTH_URL = 'http://localhost:0';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';

// Fast game timers for integration tests
process.env.CRASH_COUNTDOWN_MS = process.env.CRASH_COUNTDOWN_MS || '500';
process.env.CRASH_NEXT_GAME_MS = process.env.CRASH_NEXT_GAME_MS || '500';
process.env.ROULETTE_BETTING_DURATION = process.env.ROULETTE_BETTING_DURATION || '2';
process.env.ROULETTE_SPIN_DURATION = process.env.ROULETTE_SPIN_DURATION || '1000';
process.env.ROULETTE_RESULT_DISPLAY = process.env.ROULETTE_RESULT_DISPLAY || '500';
process.env.WHEEL_BETTING_DURATION = process.env.WHEEL_BETTING_DURATION || '2';
process.env.WHEEL_SPIN_DURATION = process.env.WHEEL_SPIN_DURATION || '1000';
process.env.WHEEL_RESULT_DISPLAY = process.env.WHEEL_RESULT_DISPLAY || '500';

export interface TestServer {
  app: Express;
  httpServer: http.Server;
  io: SocketIOServer;
  port: number;
  baseUrl: string;
}

let cachedServer: TestServer | null = null;

/**
 * Start the test server. Reuses the same instance if called multiple times.
 */
export async function startTestServer(): Promise<TestServer> {
  if (cachedServer) return cachedServer;

  const { createApp } = await import('../../../server.js');
  const { connectDB } = await import('../../../drizzle/db.js');

  // Connect to test database
  await connectDB();

  const { app, httpServer, io } = await createApp();

  // Listen on port 0 (OS picks a free port)
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });

  const addr = httpServer.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  cachedServer = {
    app,
    httpServer,
    io,
    port,
    baseUrl: `http://localhost:${port}`,
  };

  return cachedServer;
}

/**
 * Stop the test server and close all connections.
 */
export async function stopTestServer(): Promise<void> {
  if (!cachedServer) return;

  const { io, httpServer } = cachedServer;

  // Close all socket connections
  io.close();

  // Close HTTP server
  await new Promise<void>((resolve, reject) => {
    httpServer.close((err) => (err ? reject(err) : resolve()));
  });

  // Close DB pool
  try {
    const { closeDB } = await import('../../../drizzle/db.js');
    await closeDB();
  } catch {
    // DB may already be closed
  }

  cachedServer = null;
}
