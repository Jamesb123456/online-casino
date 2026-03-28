# Logging

## Overview

Platinum Casino uses a dual-layer logging approach: a custom `LoggingService` class for structured game and system event persistence to the MySQL database, and Morgan for HTTP request logging to the console. Winston is installed as a dependency (`winston@^3.11.0`) but is not yet integrated as a transport layer.

---

## LoggingService

**File:** `server/src/services/loggingService.ts`

`LoggingService` is a static class that writes structured log entries to the `game_logs` table via the `GameLog` Drizzle model (`server/drizzle/models/GameLog.ts`). It is imported and actively used throughout the application -- primarily in `server/server.ts` for socket connections, game events, authentication, and system lifecycle events.

All methods are `static async` and return `Promise<void>` (write methods) or `Promise<ParsedLogEntry[]>` (read methods). Every write method wraps its database call in a try/catch and logs failures to `console.error`, ensuring that a logging failure never interrupts game flow or crashes the server.

---

## Log Entry Format

Each log entry stored in the `game_logs` table contains:

| Field | Type | Description | Example |
|---|---|---|---|
| `id` | `int` (auto) | Primary key | `42` |
| `sessionId` | `int \| null` | Reference to `game_sessions.id` | `17` |
| `userId` | `int \| null` | User associated with the event; `null` for system events | `5` |
| `gameType` | `enum` | Game identifier or `system` / `admin` | `'crash'`, `'system'` |
| `eventType` | `enum` | Specific event name, optionally prefixed with level | `'bet_placed'`, `'info_server_started'` |
| `eventDetails` | `json` | Arbitrary JSON payload with event-specific data | `{ "amount": 100 }` |
| `amount` | `decimal(15,2) \| null` | Monetary amount associated with the event | `50.00` |
| `metadata` | `json \| null` | Additional metadata | `{ "ip": "1.2.3.4" }` |
| `timestamp` | `timestamp` | When the event occurred | `2026-03-27T12:00:00` |
| `createdAt` | `timestamp` | Row creation time (auto) | `2026-03-27T12:00:00` |
| `updatedAt` | `timestamp` | Last update time (auto) | `2026-03-27T12:00:00` |

### Indexes on game_logs

| Index | Column | Purpose |
|---|---|---|
| `game_logs_session_id_idx` | `session_id` | Fetch all logs for a game session |
| `game_logs_user_id_idx` | `user_id` | Fetch all logs for a user |
| `game_logs_game_type_idx` | `game_type` | Filter by game type |
| `game_logs_event_type_idx` | `event_type` | Filter by event type |
| `game_logs_timestamp_idx` | `timestamp` | Time-range queries and ordering |

---

## Core Write Methods

### logGameAction

General-purpose game action logging. Takes a `userId` as the first parameter, unlike `logGameEvent` which takes `gameType` first.

```typescript
static async logGameAction(
  userId: string,
  gameType: string,
  eventType: string,
  eventDetails: any = {},
  sessionId: number | null = null
): Promise<void>
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `userId` | `string` | Yes | User ID (parsed to `int` internally) |
| `gameType` | `string` | Yes | Game identifier (`crash`, `roulette`, `plinko`, etc.) |
| `eventType` | `string` | Yes | Event name (stored as-is) |
| `eventDetails` | `any` | No | JSON-serializable event data (default `{}`) |
| `sessionId` | `number \| null` | No | Game session reference (default `null`) |

**Database record produced:**

```json
{
  "userId": 5,
  "gameType": "crash",
  "eventType": "custom_action",
  "eventDetails": { "someKey": "someValue" },
  "sessionId": 17,
  "timestamp": "2026-03-27T12:00:00.000Z"
}
```

---

### logGameEvent

Convenience wrapper used by socket handlers in `server.ts`. The parameter order differs from `logGameAction` -- `gameType` comes first, and `userId` and `sessionId` are optional.

```typescript
static async logGameEvent(
  gameType: string,
  eventType: string,
  eventDetails: any = {},
  userId?: string | number,
  sessionId?: string | number
): Promise<void>
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `gameType` | `string` | Yes | Game identifier or `system` |
| `eventType` | `string` | Yes | Event name (stored as-is) |
| `eventDetails` | `any` | No | JSON-serializable event data (default `{}`) |
| `userId` | `string \| number` | No | User ID (converted to `Number`; `null` if omitted) |
| `sessionId` | `string \| number` | No | Game session ID (stored inside `eventDetails`) |

**Note:** The `sessionId` is merged into `eventDetails` as `{ ...eventDetails, sessionId }` rather than stored in the `sessionId` column directly.

**Active usage in `server.ts`:**

```typescript
LoggingService.logGameEvent('crash', 'namespace_connection', { socketId: socket.id });
LoggingService.logGameEvent('crash', 'namespace_authenticated', { username: user.username, userId: user.userId });
LoggingService.logGameEvent('roulette', 'namespace_disconnected', { username: user.username, userId: user.userId });
```

---

### logAuthAction

Records authentication events with an `auth_` prefix prepended to the event type.

```typescript
static async logAuthAction(
  userId: string,
  eventType: string,
  metadata: any = {}
): Promise<void>
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `userId` | `string` | Yes | User ID (parsed to `int`) |
| `eventType` | `string` | Yes | Auth event name (prefixed with `auth_`) |
| `metadata` | `any` | No | Additional data such as IP, user agent, failure reason |

**Database record produced:**

```json
{
  "userId": 5,
  "gameType": "system",
  "eventType": "auth_login",
  "eventDetails": { "ip": "192.168.1.1", "userAgent": "Mozilla/5.0..." },
  "timestamp": "2026-03-27T12:00:00.000Z"
}
```

**Event type examples:** `auth_login`, `auth_register`, `auth_failed_login`, `auth_logout`.

---

### logSystemEvent

Logs infrastructure and system-level events. The severity `level` is prepended to the event name.

```typescript
static async logSystemEvent(
  event: string,
  data: any = {},
  level: string = 'info'
): Promise<void>
```

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `event` | `string` | Yes | -- | System event name |
| `data` | `any` | No | `{}` | JSON-serializable event data |
| `level` | `string` | No | `'info'` | Severity level: `info`, `warning`, `error` |

**Database record produced:**

```json
{
  "userId": null,
  "gameType": "system",
  "eventType": "info_server_started",
  "eventDetails": { "port": 5000 },
  "timestamp": "2026-03-27T12:00:00.000Z"
}
```

**Active usage in `server.ts`:**

```typescript
// Info level (default)
LoggingService.logSystemEvent('server_started', { port: PORT });
LoggingService.logSystemEvent('sigint_received', {});
LoggingService.logSystemEvent('socket_connected', { socketId: socket.id });

// Warning level
LoggingService.logSystemEvent('unauthenticated_crash_namespace', { socketId: socket.id }, 'warning');

// Error level
LoggingService.logSystemEvent('crash_handler_init_failed', { error: String(err) }, 'error');
```

**Event type naming convention:** `{level}_{event_name}`, e.g., `info_server_started`, `warning_unauthenticated_crash_namespace`, `error_crash_handler_init_failed`.

---

### logAdminAction

Records administrative operations for audit purposes.

```typescript
static async logAdminAction(
  adminId: string,
  eventType: string,
  targetData: any = {}
): Promise<void>
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `adminId` | `string` | Yes | Admin user ID (parsed to `int`) |
| `eventType` | `string` | Yes | Admin action name (stored as-is, no prefix) |
| `targetData` | `any` | No | Data about what was affected (target user, amounts, etc.) |

**Database record produced:**

```json
{
  "userId": 1,
  "gameType": "admin",
  "eventType": "balance_adjustment",
  "eventDetails": { "targetUserId": 5, "amount": 1000, "reason": "bonus" },
  "timestamp": "2026-03-27T12:00:00.000Z"
}
```

---

## Convenience Methods

These methods provide semantic wrappers around `logGameEvent` for common game lifecycle events.

### logBetPlaced

```typescript
static async logBetPlaced(
  gameType: string,
  sessionId: string | number | null,
  userId: string | number,
  amount: number,
  metadata: any = {}
): Promise<void>
```

Records a bet being placed. Calls `logGameEvent` with `eventType: 'bet_placed'` and `eventDetails: { amount, ...metadata }`.

### logBetResult

```typescript
static async logBetResult(
  gameType: string,
  sessionId: string | number | null,
  userId: string | number,
  betAmount: number,
  winAmount: number,
  isWin: boolean,
  metadata: any = {}
): Promise<void>
```

Records the outcome of a bet. Calls `logGameEvent` with `eventType: 'game_result'` and `eventDetails: { betAmount, winAmount, isWin, ...metadata }`.

### logGameStart

```typescript
static async logGameStart(
  gameType: string,
  sessionId: string | number | null,
  metadata: any = {}
): Promise<void>
```

Records the start of a game round. Calls `logGameEvent` with `eventType: 'game_start'`. No `userId` is set (system-level event).

### logGameEnd

```typescript
static async logGameEnd(
  gameType: string,
  sessionId: string | number | null,
  metadata: any = {}
): Promise<void>
```

Records the end of a game round. Calls `logGameEvent` with `eventType: 'game_end'`. No `userId` is set.

---

## Log Retrieval Methods

### getLogs

Filtered search supporting date range, game type, and user ID filters.

```typescript
static async getLogs(filters: LogFilters = {}): Promise<ParsedLogEntry[]>
```

**`LogFilters` interface:**

```typescript
interface LogFilters {
  userId?: string;
  gameType?: string;
  eventType?: string | RegExp;
  startDate?: string | Date;
  endDate?: string | Date;
  limit?: number;               // Default: 100
}
```

**Filter priority:** The method evaluates filters in this order and returns the first match:
1. If `startDate` or `endDate` is provided, calls `GameLog.searchByDateRange()`.
2. If `gameType` is provided, calls `GameLog.getLogsByGameType()`.
3. If `userId` is provided, calls `GameLog.getRecentUserLogs()`.
4. Otherwise, calls `GameLog.findWithDetails()` to return recent logs.

### getUserLogs

```typescript
static async getUserLogs(userId: string, limit: number = 50): Promise<ParsedLogEntry[]>
```

Returns activity logs for a specific user, ordered by timestamp descending.

### getGameTypeLogs

```typescript
static async getGameTypeLogs(gameType: string, limit: number = 100): Promise<ParsedLogEntry[]>
```

Returns logs filtered by game type, ordered by timestamp descending.

### ParsedLogEntry Interface

```typescript
interface ParsedLogEntry {
  id?: number;
  userId?: number | null;
  gameType: string;
  eventType: string;
  eventDetails: any;
  sessionId?: number | null;
  timestamp: Date;
  username?: string | null;
}
```

---

## Log Cleanup

```typescript
static async cleanupOldLogs(daysToKeep: number = 30): Promise<number>
```

**Current status:** Stub implementation. Calculates the cutoff date and logs intent to `console.log`, but does **not** delete any records. Returns `0`.

**Planned implementation:**

```typescript
static async cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await db
    .delete(gameLogs)
    .where(lte(gameLogs.timestamp, cutoffDate));

  return result.rowsAffected;
}
```

---

## Game Event Logging Coverage

The following events are logged through `LoggingService.logGameEvent` in `server.ts`:

| Game | Events |
|---|---|
| Crash | `namespace_connection`, `namespace_authenticated`, `namespace_disconnected` |
| Roulette | `namespace_connection`, `namespace_authenticated`, `namespace_disconnected` |
| Blackjack | `namespace_connection`, `namespace_authenticated`, `namespace_disconnected` |
| Plinko | `namespace_connection`, `namespace_authenticated`, `namespace_disconnected` |
| Wheel | `namespace_connection`, `namespace_authenticated`, `namespace_disconnected` |
| Landmines | `namespace_connection`, `namespace_authenticated`, `namespace_disconnected` |

Individual game handlers (e.g., `crashHandler.ts`) log additional events using the convenience methods: `bet_placed`, `game_start`, `game_result`, `game_end`.

System events logged in `server.ts`:

| Event | Level | Trigger |
|---|---|---|
| `socket_connected` | info | Main namespace connection |
| `socket_disconnected` | info | Main namespace disconnection |
| `join_game` | info | Authenticated user joins a game room |
| `unauthenticated_join_attempt` | warning | Unauthenticated socket tries to join a game |
| `unauthenticated_{game}_namespace` | warning | Unauthenticated connection to a game namespace |
| `server_started` | info | Server begins listening |
| `sigint_received` | info | SIGINT signal received |
| `sigterm_received` | info | SIGTERM signal received |
| `{game}_handler_init_failed` | error | Dynamic import of game handler fails |

---

## HTTP Request Logging (Morgan)

Morgan is configured in `server.ts` with the `dev` format for console output:

```typescript
app.use(morgan('dev'));
```

This logs each HTTP request to stdout with method, URL, status code, response time, and content length. Example output:

```
GET /api/auth/me 200 12.345 ms - 256
POST /api/auth/login 200 45.678 ms - 128
GET /api/games/stats 304 2.345 ms - -
POST /api/admin/balance 200 89.012 ms - 64
```

### Production Morgan Format

For production, switch to the `combined` format for standard access log output, or use JSON format for structured logging:

```typescript
// Combined format (standard access log)
app.use(morgan('combined'));

// JSON format (for log aggregation tools)
app.use(morgan(JSON.stringify({
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time ms',
  contentLength: ':res[content-length]',
  userAgent: ':user-agent',
  remoteAddr: ':remote-addr',
})));
```

---

## Error Handling in Logging

All `LoggingService` write methods wrap their database calls in try/catch blocks and log failures to `console.error`. This design ensures that a logging failure never interrupts game flow or crashes the server.

```typescript
try {
  await GameLog.create({ ... });
} catch (error) {
  console.error('Error logging game action:', error);
  // Don't throw error to avoid breaking game flow
}
```

Read methods (`getLogs`, `getUserLogs`, `getGameTypeLogs`) also catch errors and return empty arrays on failure.

---

## Winston Transport Configuration (Planned)

Winston is installed (`winston@^3.11.0`) but not yet configured. The following configuration is recommended for production:

### Recommended Configuration

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'platinum-casino' },
  transports: [
    // Console transport (colorized for development)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        }),
      ),
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024,   // 10MB per file
      maxFiles: 10,                  // Keep 10 rotated files
      tailable: true,
    }),

    // File transport for errors only
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});
```

### Winston Log Levels

| Level | Priority | Usage |
|---|---|---|
| `error` | 0 | Application errors, handler init failures, uncaught exceptions |
| `warn` | 1 | Unauthenticated access attempts, deprecated usage |
| `info` | 2 | Server start/stop, socket connections, game events |
| `http` | 3 | HTTP request logs (replace Morgan) |
| `debug` | 4 | Detailed diagnostic information |

---

## Log Rotation Recommendations

### File-Based Rotation (Winston)

Winston's `File` transport supports built-in rotation via `maxsize` and `maxFiles`:

```typescript
new winston.transports.File({
  filename: 'logs/combined.log',
  maxsize: 10 * 1024 * 1024,   // Rotate at 10MB
  maxFiles: 10,                  // Keep 10 files (100MB max)
  tailable: true,                // Always write to combined.log (not combined1.log)
})
```

### Database Log Rotation

Schedule `cleanupOldLogs` via a cron job or PM2 cron:

```javascript
// ecosystem.config.js -- log cleanup cron job
module.exports = {
  apps: [
    {
      name: 'platinum-casino',
      script: 'dist/server.js',
      // ...
    },
    {
      name: 'casino-log-cleanup',
      script: 'dist/scripts/cleanupLogs.js',
      cron_restart: '0 3 * * *',     // Run daily at 3 AM
      autorestart: false,
      watch: false,
    },
  ],
};
```

### PM2 Log Rotation

Install the PM2 log rotation module:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M       # Rotate at 10MB
pm2 set pm2-logrotate:retain 10          # Keep 10 rotated files
pm2 set pm2-logrotate:compress true      # Gzip old logs
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'  # Daily rotation
```

---

## Structured Logging Patterns

### Request Context

Attach a request ID to every log entry for end-to-end tracing:

```typescript
import { v4 as uuid } from 'uuid';

app.use((req, res, next) => {
  req.requestId = uuid();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// Then in LoggingService or Winston:
logger.info('Request processed', {
  requestId: req.requestId,
  method: req.method,
  url: req.url,
  statusCode: res.statusCode,
  responseTimeMs: duration,
});
```

### Game Event Context

Standardize game event log entries for consistency:

```typescript
// Structured game event format
{
  "timestamp": "2026-03-27T12:00:00.000Z",
  "level": "info",
  "service": "platinum-casino",
  "gameType": "crash",
  "eventType": "bet_placed",
  "userId": 5,
  "sessionId": 17,
  "data": {
    "amount": 100,
    "multiplier": 1.5
  }
}
```

### Error Context

Include stack traces and error metadata in error logs:

```typescript
try {
  await processGameRound();
} catch (error) {
  logger.error('Game round processing failed', {
    gameType: 'crash',
    sessionId: session.id,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : String(error),
  });
}
```

---

## Integration with Monitoring

### Log-Based Alerting

Configure alerts on specific log patterns:

| Pattern | Alert |
|---|---|
| `eventType` starts with `error_` | High-severity alert |
| `eventType` is `auth_failed_login` > 10/min | Possible brute force attack |
| `console.error` output | Application error (check stderr) |
| PM2 restart event | Process crash |

### Log Aggregation

For production deployments with multiple instances, ship logs to a centralized system:

| Tool | Integration |
|---|---|
| **ELK Stack** | Winston Elasticsearch transport |
| **Datadog** | Winston Datadog transport or log file tailing |
| **CloudWatch** | Winston CloudWatch transport |
| **Grafana Loki** | Promtail sidecar reads log files |

---

## Current Limitations

1. **No file-based logging** -- Winston is installed but not configured as a transport. All structured logs go to the database only.
2. **Console.log remnants** -- Several files still use `console.log` instead of `LoggingService` (scripts, middleware, some handlers).
3. **No log rotation** -- Database logs accumulate without automated cleanup. `cleanupOldLogs` is a stub.
4. **No log levels in console** -- Console output does not distinguish between info, warning, and error severity.
5. **Event type enum mismatch** -- `LoggingService` writes event types like `namespace_connection` and `auth_login`, but the `eventTypeEnum` in `schema.ts` only allows: `session_start`, `bet_placed`, `bet_updated`, `game_result`, `win`, `loss`, `cashout`, `error`, `game_state_change`. This may cause insert failures for non-enum values.

---

## Related Documents

- [Monitoring](./monitoring.md) -- Health checks, alerting, and dashboards
- [Performance](./performance.md) -- Database indexing and query optimization
- [Deployment Guide](../06-devops/deployment.md) -- PM2 log configuration and Docker logging
- [System Architecture](../02-architecture/system-architecture.md) -- Overall architecture overview
- [Socket.IO Architecture](../02-architecture/socket-architecture.md) -- WebSocket namespace design and event flow
- [Common Issues](../12-troubleshooting/common-issues.md) -- Troubleshooting guide
- [Database Schema](../09-database/schema.md) -- Full schema reference including game_logs table
