# Performance

## Overview

This document covers performance optimization strategies for Platinum Casino, including database indexing, query optimization with Drizzle ORM, Socket.IO scaling, connection pooling, caching, frontend optimization, and load testing.

---

## Database Indexing Strategy

All indexes are defined in `server/drizzle/schema.ts` using Drizzle ORM's `index()` function. The following tables summarize every index in the schema.

### users

| Index Name | Column(s) | Purpose |
|---|---|---|
| `users_username_idx` | `username` | Fast lookup for login, uniqueness checks, and profile queries |
| `users_role_idx` | `role` | Filter users by role (`user`, `admin`) in admin panel |

Note: `username` also has a `.unique()` constraint, which MySQL implements as a unique index.

### transactions

| Index Name | Column(s) | Purpose |
|---|---|---|
| `transactions_user_id_idx` | `user_id` | User transaction history lookups |
| `transactions_type_idx` | `type` | Filter by transaction type (deposit, withdrawal, game_win, etc.) |
| `transactions_game_type_idx` | `game_type` | Filter transactions by game |
| `transactions_status_idx` | `status` | Filter by status (pending, completed, failed, voided) |
| `transactions_amount_idx` | `amount` | Range queries on transaction amounts (admin reporting) |
| `transactions_created_by_idx` | `created_by` | Audit trail -- find transactions created by a specific admin |
| `transactions_game_session_id_idx` | `game_session_id` | Join transactions to their game session |
| `transactions_created_at_idx` | `created_at` | Time-range queries for reporting and cleanup |

### game_sessions

| Index Name | Column(s) | Purpose |
|---|---|---|
| `game_sessions_user_id_idx` | `user_id` | User game history lookups |
| `game_sessions_game_type_idx` | `game_type` | Filter sessions by game type |
| `game_sessions_start_time_idx` | `start_time` | Time-range queries for analytics |
| `game_sessions_is_completed_idx` | `is_completed` | Find active (incomplete) sessions |

### game_logs

| Index Name | Column(s) | Purpose |
|---|---|---|
| `game_logs_session_id_idx` | `session_id` | Get all log entries for a game session |
| `game_logs_user_id_idx` | `user_id` | User activity log lookups |
| `game_logs_game_type_idx` | `game_type` | Filter logs by game type |
| `game_logs_event_type_idx` | `event_type` | Filter by event type (bet_placed, game_result, etc.) |
| `game_logs_timestamp_idx` | `timestamp` | Time-range queries, log cleanup, ordering |

### balances

| Index Name | Column(s) | Purpose |
|---|---|---|
| `balances_user_id_idx` | `user_id` | User balance history lookups |
| `balances_type_idx` | `type` | Filter by balance change type (deposit, win, loss, etc.) |
| `balances_game_type_idx` | `game_type` | Filter balance changes by game |
| `balances_related_session_id_idx` | `related_session_id` | Link balance changes to game sessions |
| `balances_transaction_id_idx` | `transaction_id` | Link balance changes to transactions |

### game_stats

| Index Name | Column(s) | Purpose |
|---|---|---|
| `game_stats_game_type_idx` | `game_type` | Lookup stats for a specific game type |

Note: `game_type` also has a `.unique()` constraint (one row per game type).

### messages

| Index Name | Column(s) | Purpose |
|---|---|---|
| `messages_user_id_idx` | `user_id` | Get messages by user |
| `messages_created_at_idx` | `created_at` | Chronological ordering, recent message queries |

### login_rewards

| Index Name | Column(s) | Purpose |
|---|---|---|
| `login_rewards_user_id_idx` | `user_id` | Check if user already claimed today's reward |
| `login_rewards_created_at_idx` | `created_at` | Time-range queries for daily reward checks |

### Recommended Composite Indexes

The current schema uses single-column indexes. For high-traffic queries, the following composite indexes would improve performance:

```typescript
// game_logs: common query pattern is (userId + timestamp) or (gameType + timestamp)
index('game_logs_user_timestamp_idx').on(table.userId, table.timestamp),
index('game_logs_game_type_timestamp_idx').on(table.gameType, table.timestamp),

// transactions: common query pattern is (userId + createdAt) for paginated history
index('transactions_user_created_at_idx').on(table.userId, table.createdAt),

// balances: common query pattern is (userId + createdAt) for balance history
index('balances_user_created_at_idx').on(table.userId, table.createdAt),
```

---

## Query Optimization with Drizzle ORM

### Select Only Needed Columns

Avoid `SELECT *` by specifying columns explicitly. The codebase already follows this pattern in `GameLog.ts`:

```typescript
// Good: select only needed columns
const logs = await db
  .select({
    id: gameLogs.id,
    gameType: gameLogs.gameType,
    eventType: gameLogs.eventType,
    timestamp: gameLogs.timestamp,
    username: users.username,
  })
  .from(gameLogs)
  .leftJoin(users, eq(gameLogs.userId, users.id))
  .orderBy(desc(gameLogs.timestamp))
  .limit(100);

// Avoid: selecting all columns when you only need a few
const logs = await db.select().from(gameLogs);
```

### Use Pagination with Limit and Offset

All log retrieval methods accept a `limit` parameter. Always enforce pagination:

```typescript
// Paginated query
const logs = await db
  .select()
  .from(gameLogs)
  .where(eq(gameLogs.userId, userId))
  .orderBy(desc(gameLogs.timestamp))
  .limit(50)
  .offset(page * 50);
```

### Avoid N+1 Queries

Use `leftJoin` to load related data in a single query instead of making separate queries per row:

```typescript
// Good: single query with join
const logs = await db
  .select({
    id: gameLogs.id,
    eventType: gameLogs.eventType,
    username: users.username,
    sessionStartTime: gameSessions.startTime,
  })
  .from(gameLogs)
  .leftJoin(users, eq(gameLogs.userId, users.id))
  .leftJoin(gameSessions, eq(gameLogs.sessionId, gameSessions.id));

// Bad: N+1 -- fetching user for each log entry separately
for (const log of logs) {
  const [user] = await db.select().from(users).where(eq(users.id, log.userId));
}
```

### Use Conditional Where Clauses

Build dynamic queries with the `and()` combinator instead of running multiple queries:

```typescript
import { eq, and, gte, lte, desc } from 'drizzle-orm';

const conditions = [];

if (gameType) conditions.push(eq(gameLogs.gameType, gameType));
if (startDate) conditions.push(gte(gameLogs.timestamp, new Date(startDate)));
if (endDate)   conditions.push(lte(gameLogs.timestamp, new Date(endDate)));

let query = db.select().from(gameLogs);

if (conditions.length > 0) {
  query = query.where(conditions.length > 1 ? and(...conditions) : conditions[0]);
}

const results = await query.orderBy(desc(gameLogs.timestamp)).limit(1000);
```

### Batch Inserts

For bulk operations (e.g., seeding, migrations), use batch inserts:

```typescript
await db.insert(gameLogs).values([
  { userId: 1, gameType: 'crash', eventType: 'bet_placed', eventDetails: {}, timestamp: new Date() },
  { userId: 2, gameType: 'crash', eventType: 'bet_placed', eventDetails: {}, timestamp: new Date() },
  // ... more rows
]);
```

---

## Socket.IO Scaling with Redis Adapter

### Single-Instance Deployment (Current)

The current deployment uses a single Node.js instance with `instances: 1` in PM2. Socket.IO works correctly because all connected clients share the same in-memory state.

### Multi-Instance Deployment (Future)

To scale to multiple Node.js processes, Socket.IO requires the Redis adapter so that events are broadcast across all instances.

#### Install Dependencies

```bash
npm install @socket.io/redis-adapter redis
```

#### Configure the Redis Adapter

```typescript
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
  adapter: createAdapter(pubClient, subClient),
});
```

#### Sticky Sessions with nginx

When running multiple instances, nginx must route all requests from the same client to the same backend instance:

```nginx
upstream casino_backend {
    ip_hash;                      # Sticky sessions based on client IP
    server 127.0.0.1:5001;
    server 127.0.0.1:5002;
    server 127.0.0.1:5003;
}
```

#### PM2 Cluster Mode

```javascript
// ecosystem.config.js for multi-instance
module.exports = {
  apps: [{
    name: 'platinum-casino',
    script: 'dist/server.js',
    cwd: './server',
    instances: 3,                // Run 3 worker processes
    exec_mode: 'cluster',       // PM2 cluster mode
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      REDIS_URL: 'redis://localhost:6379',
    },
  }]
};
```

---

## Connection Pooling

### MySQL2 Pool Configuration

The database connection pool is configured in `server/drizzle/db.ts`:

```typescript
const poolConfig = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  waitForConnections: true,       // Queue requests when all connections are in use
  connectionLimit: 20,            // Maximum simultaneous connections
  maxIdle: 20,                    // Maximum idle connections in the pool
  idleTimeout: 60000,             // Close idle connections after 60 seconds
  queueLimit: 0,                  // Unlimited queue (0 = no limit)
  enableKeepAlive: true,          // TCP keep-alive to prevent connection drops
  keepAliveInitialDelay: 0,       // Send keep-alive immediately
};
```

### Pool Sizing Guidelines

| Deployment | `connectionLimit` | Rationale |
|---|---|---|
| Development | 5-10 | Minimal connections needed |
| Single instance, low traffic | 10-20 | Default configuration |
| Single instance, high traffic | 20-50 | More concurrent game sessions |
| Multi-instance (3 workers) | 10 per worker | Total = 30 across all workers, within MySQL's default `max_connections` (151) |

### Monitoring Pool Health

Track these connection pool metrics:

- **Active connections**: Number of connections currently executing a query
- **Idle connections**: Number of connections waiting in the pool
- **Queue length**: Number of requests waiting for a connection (should be 0 under normal load)
- **Connection errors**: Failed connection attempts

```typescript
// Expose pool stats in health endpoint
const pool = poolConnection;
const stats = {
  totalConnections: pool.pool?._allConnections?.length ?? 0,
  freeConnections: pool.pool?._freeConnections?.length ?? 0,
  queuedRequests: pool.pool?._connectionQueue?.length ?? 0,
};
```

---

## Caching Strategy

### Recommended: Redis Cache Layers

For production deployments, introduce Redis for caching frequently accessed data.

#### Session Cache

Store JWT session metadata in Redis instead of querying the database on every authenticated request:

```typescript
import { createClient } from 'redis';
const redis = createClient({ url: process.env.REDIS_URL });

// After JWT verification, cache user data
async function cacheUserSession(userId: number, userData: object, ttl = 3600) {
  await redis.setEx(`session:${userId}`, ttl, JSON.stringify(userData));
}

// Check cache before DB lookup
async function getCachedUser(userId: number) {
  const cached = await redis.get(`session:${userId}`);
  return cached ? JSON.parse(cached) : null;
}
```

#### Game State Cache

Cache active game state for real-time games (crash, roulette) to reduce database writes during active rounds:

```typescript
// Store active crash game state
async function cacheGameState(gameType: string, state: object) {
  await redis.setEx(`game:${gameType}:state`, 60, JSON.stringify(state));
}

// Retrieve cached game state
async function getCachedGameState(gameType: string) {
  const cached = await redis.get(`game:${gameType}:state`);
  return cached ? JSON.parse(cached) : null;
}
```

#### Leaderboard Cache

Cache leaderboard data with a short TTL to avoid expensive aggregation queries on every request:

```typescript
// Cache leaderboard for 30 seconds
async function cacheLeaderboard(gameType: string, data: object[]) {
  await redis.setEx(`leaderboard:${gameType}`, 30, JSON.stringify(data));
}
```

#### Game Stats Cache

The `game_stats` table is read frequently but updated infrequently. Cache it with a moderate TTL:

```typescript
// Cache game stats for 5 minutes
async function cacheGameStats(gameType: string, stats: object) {
  await redis.setEx(`stats:${gameType}`, 300, JSON.stringify(stats));
}
```

### Cache Invalidation

| Cache Key Pattern | TTL | Invalidation Trigger |
|---|---|---|
| `session:{userId}` | 1 hour | User logout, role change, balance update |
| `game:{gameType}:state` | 60 seconds | Game round ends, new round starts |
| `leaderboard:{gameType}` | 30 seconds | TTL expiry only (eventual consistency is acceptable) |
| `stats:{gameType}` | 5 minutes | TTL expiry, or explicit invalidation after game round |

---

## Frontend Performance

### Vite Build Optimization

The client uses Vite (`vite.config.js`) with React and Tailwind CSS. Vite's production build automatically provides:

- **Tree shaking**: Removes unused code from bundles
- **Minification**: Compresses JavaScript and CSS (via esbuild)
- **Asset hashing**: Adds content hashes to filenames for cache busting

### Code Splitting

Use React's `lazy()` and `Suspense` for route-based code splitting:

```tsx
import { lazy, Suspense } from 'react';

// Split each game page into its own chunk
const CrashGame = lazy(() => import('./pages/CrashGame'));
const RouletteGame = lazy(() => import('./pages/RouletteGame'));
const BlackjackGame = lazy(() => import('./pages/BlackjackGame'));
const PlinkoGame = lazy(() => import('./pages/PlinkoGame'));
const WheelGame = lazy(() => import('./pages/WheelGame'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/crash" element={<CrashGame />} />
        <Route path="/roulette" element={<RouletteGame />} />
        <Route path="/blackjack" element={<BlackjackGame />} />
        <Route path="/plinko" element={<PlinkoGame />} />
        <Route path="/wheel" element={<WheelGame />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Suspense>
  );
}
```

### Vite Manual Chunks (Advanced)

For finer control over bundle splitting, configure `manualChunks` in `vite.config.js`:

```javascript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          state: ['@reduxjs/toolkit', 'react-redux'],
          socket: ['socket.io-client'],
        },
      },
    },
  },
});
```

### Static Asset Caching

Configure nginx to serve Vite's hashed assets with long cache lifetimes:

```nginx
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Socket.IO Client Optimization

- Use namespace-specific connections (already implemented) so clients only connect to the game they are playing.
- Disconnect from namespaces when leaving a game page.
- Use `transports: ['websocket']` to skip the HTTP long-polling upgrade phase when WebSocket is available:

```typescript
const socket = io('/crash', {
  transports: ['websocket'],   // Skip long-polling probe
  auth: { token },
});
```

---

## Load Testing Recommendations

### Tools

| Tool | Best For | Notes |
|---|---|---|
| **Artillery** | HTTP + WebSocket load testing | Native Socket.IO support via plugin |
| **k6** | HTTP load testing | Scriptable in JavaScript, good for CI |
| **autocannon** | Raw HTTP throughput | Lightweight, Node.js-based |

### Artillery Configuration for Socket.IO

```yaml
# artillery-config.yml
config:
  target: "http://localhost:5000"
  phases:
    - duration: 60
      arrivalRate: 10          # 10 new users per second
      name: "Warm up"
    - duration: 120
      arrivalRate: 50          # 50 new users per second
      name: "Sustained load"
    - duration: 30
      arrivalRate: 100         # 100 new users per second
      name: "Spike"
  engines:
    socketio-v3:
      transports: ["websocket"]

scenarios:
  - name: "Crash game player"
    engine: socketio-v3
    flow:
      - namespace: "/crash"
        emit:
          channel: "place_bet"
          data: { "amount": 10 }
      - think: 5
      - emit:
          channel: "cash_out"
          data: {}
      - think: 2
```

### Load Testing Targets

| Metric | Target | Measured By |
|---|---|---|
| HTTP API p95 latency | < 200ms | Artillery / k6 report |
| WebSocket connection time | < 500ms | Artillery Socket.IO plugin |
| Concurrent WebSocket clients | 500+ per instance | Socket.IO connection count |
| Database query p95 latency | < 50ms | Application health endpoint |
| Sustained throughput | 1000 req/s (HTTP) | k6 / autocannon |
| Error rate under load | < 0.1% | Load test error count |

### Running Load Tests

```bash
# Install Artillery with Socket.IO support
npm install -g artillery artillery-engine-socketio-v3

# Run the test
artillery run artillery-config.yml

# Generate HTML report
artillery run --output report.json artillery-config.yml
artillery report report.json
```

---

## Performance Monitoring Metrics

### Key Metrics to Track

| Layer | Metric | Tool | Alert Threshold |
|---|---|---|---|
| **Node.js** | Event loop lag | `prom-client` | > 100ms |
| **Node.js** | Heap used / heap total | `prom-client` | > 80% of `max_memory_restart` |
| **Node.js** | Active handles / requests | `prom-client` | Sustained growth indicates leak |
| **HTTP** | Request duration (p50, p95, p99) | Prometheus histogram | p95 > 500ms |
| **HTTP** | Request rate | Prometheus counter | Baseline-dependent |
| **HTTP** | 5xx error rate | Prometheus counter | > 1% of total requests |
| **Socket.IO** | Connected clients per namespace | Custom gauge | 0 during expected activity |
| **Socket.IO** | Events per second | Custom counter | Baseline-dependent |
| **MySQL** | Query duration (p95) | Slow query log / Prometheus | > 100ms |
| **MySQL** | Connection pool utilization | Custom gauge | > 80% of `connectionLimit` |
| **MySQL** | Threads connected | MySQL `SHOW STATUS` | > 80% of `max_connections` |
| **Redis** (future) | Memory usage | Redis `INFO` | > 80% of `maxmemory` |
| **Redis** (future) | Hit rate | Redis `INFO` | < 80% indicates poor caching |

---

## Related Documents

- [Deployment Guide](../06-devops/deployment.md) -- Docker, PM2, and nginx configuration
- [Monitoring](./monitoring.md) -- Health checks, alerting, and dashboards
- [Logging](./logging.md) -- LoggingService and log management
- [Database Schema](../09-database/schema.md) -- Full schema reference
- [Socket.IO Architecture](../02-architecture/socket-architecture.md) -- Namespace design and event flow
- [System Architecture](../02-architecture/system-architecture.md) -- Overall architecture overview
