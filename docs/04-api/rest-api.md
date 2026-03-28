# REST API Reference

Base URL: `http://localhost:5000/api`

~31 endpoints across authentication, users, games, admin, rewards, verification, leaderboard, responsible gaming, and health checks.

All API endpoints are subject to a **global rate limit of 120 requests per minute** per IP address. Rate limit headers are returned in responses via the `RateLimit-*` standard headers.

Authentication is handled via **Better Auth sessions** stored in HTTP-only cookies. After a successful login or registration, the server sets a session cookie automatically. Clients do not need to manually send an `Authorization` header; the cookie is sent automatically with each request when `credentials: true` is set in the fetch/axios configuration.

---

## Common Response Format

### Success responses

Success responses vary by endpoint but always return a JSON body with the relevant data.

### Error responses

All error responses follow a consistent shape:

```json
{
  "message": "Human-readable error description",
  "errors": {}  // Optional. Present on Zod validation failures.
}
```

The `errors` field uses the Zod `flatten()` format when present:

```json
{
  "message": "Invalid payload",
  "errors": {
    "formErrors": [],
    "fieldErrors": {
      "username": ["String must contain at least 3 character(s)"],
      "password": ["String must contain at least 6 character(s)"]
    }
  }
}
```

---

## Auth Endpoints (`/api/auth/*`)

### POST `/api/auth/register`

Register a new user account.

| Detail | Value |
|---|---|
| **Auth required** | No |
| **Rate limit** | 5 requests per 15 minutes (per IP) |

**Request body** (validated with Zod):

| Field | Type | Constraints |
|---|---|---|
| `username` | `string` | min 3, max 32 characters |
| `password` | `string` | min 6, max 128 characters |

**Success response** -- `201 Created`:

```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "username": "player1",
    "role": "user",
    "balance": 1000
  }
}
```

The response also sets a session cookie (managed by Better Auth).

New accounts receive a starting balance of 1000.

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 400 | `"Invalid payload"` | Zod validation failure (includes `errors` field) |
| 400 | `"Username already exists"` | Duplicate username |
| 500 | `"Error creating user"` | Server error |

---

### POST `/api/auth/login`

Authenticate an existing user.

| Detail | Value |
|---|---|
| **Auth required** | No |
| **Rate limit** | 5 requests per 15 minutes (per IP) |

**Request body** (validated with Zod):

| Field | Type | Constraints |
|---|---|---|
| `username` | `string` | min 3, max 32 characters |
| `password` | `string` | min 6, max 128 characters |

**Success response** -- `200 OK`:

```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "player1",
    "role": "user",
    "balance": 1500.50
  }
}
```

Sets a session cookie (managed by Better Auth). Updates the user's `lastLogin` timestamp.

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 400 | `"Invalid payload"` | Zod validation failure (includes `errors` field) |
| 401 | `"Invalid credentials"` | Wrong username or password |
| 401 | `"Account is disabled"` | User's `isActive` is false |
| 500 | `"Error during login"` | Server error |

---

### POST `/api/auth/logout`

Log out the current user by clearing the session cookie.

| Detail | Value |
|---|---|
| **Auth required** | No (cookie is cleared regardless) |
| **Rate limit** | Global only (120/min) |

**Request body**: None

**Success response** -- `200 OK`:

```json
{
  "message": "Logged out successfully"
}
```

---

### GET `/api/auth/refresh-session`

Validate the current Better Auth session and return fresh user data. Better Auth's `session.updateAge` handles the actual token refresh automatically when the session is accessed via the `authenticate` middleware.

| Detail | Value |
|---|---|
| **Auth required** | Yes (via session cookie) |
| **Rate limit** | Global only (120/min) |

**Request body**: None

**Success response** -- `200 OK`:

```json
{
  "id": 1,
  "username": "player1",
  "role": "user",
  "balance": 1500.50,
  "isActive": true
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"Not authenticated"` | No valid session or session cookie missing |
| 404 | `"User not found"` | User ID from session not found in database |
| 500 | `"Session refresh failed"` | Server error |

**Implementation:** `server/routes/auth.ts`

---

## User Endpoints (`/api/users/*`)

All user endpoints require authentication via session cookie.

### GET `/api/users/me`

Get the current authenticated user's data.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Success response** -- `200 OK`:

```json
{
  "id": 1,
  "username": "player1",
  "role": "user",
  "balance": 1500.50,
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "lastLogin": "2025-03-27T08:00:00.000Z"
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"No token, authorization denied"` | Not authenticated |
| 404 | `"User not found"` | User ID from token not found in database |
| 500 | `"Error fetching user data"` | Server error |

---

### GET `/api/users/profile`

Get the current user's profile with balance information.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Success response** -- `200 OK`:

```json
{
  "user": {
    "id": 1,
    "username": "player1",
    "role": "user",
    "balance": 1500.50,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "lastLogin": "2025-03-27T08:00:00.000Z"
  }
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"No token, authorization denied"` | Not authenticated |
| 404 | `"User not found"` | User not found |
| 500 | `"Error fetching profile"` | Server error |

---

### PUT `/api/users/profile`

Update the current user's profile (password change).

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `currentPassword` | `string` | Yes (if changing password) | Current password for verification |
| `newPassword` | `string` | Yes (if changing password) | New password to set |

**Success response** -- `200 OK`:

```json
{
  "message": "Profile updated successfully"
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 400 | `"Current password is incorrect"` | Password verification failed |
| 401 | `"No token, authorization denied"` | Not authenticated |
| 404 | `"User not found"` | User not found |
| 500 | `"Error updating profile"` | Server error |

---

### GET `/api/users/balance`

Get the current user's balance.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Success response** -- `200 OK`:

```json
{
  "balance": 1500.50
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"No token, authorization denied"` | Not authenticated |
| 500 | `"Error fetching balance"` | Server error |

---

### GET `/api/users/balance/history`

Get the current user's balance change history.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Success response** -- `200 OK`:

Returns an array of balance history records.

```json
[
  {
    "id": 1,
    "userId": 1,
    "amount": "1500.50",
    "previousBalance": "1000.00",
    "changeAmount": "500.50",
    "type": "win",
    "createdAt": "2025-03-27T08:00:00.000Z"
  }
]
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"No token, authorization denied"` | Not authenticated |
| 500 | `"Error fetching balance history"` | Server error |

---

### GET `/api/users/transactions`

Get the current user's transaction history with optional filters.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Query parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `50` | Maximum number of transactions to return |
| `type` | `string` | -- | Filter by transaction type |
| `startDate` | `string` (ISO date) | -- | Filter transactions from this date |
| `endDate` | `string` (ISO date) | -- | Filter transactions until this date |

**Example request**:

```
GET /api/users/transactions?limit=10&type=bet&startDate=2025-03-01
```

**Success response** -- `200 OK`:

Returns an array of transaction records sorted by `createdAt` descending.

```json
[
  {
    "id": 1,
    "userId": 1,
    "type": "bet",
    "amount": "50.00",
    "status": "completed",
    "createdAt": "2025-03-27T08:00:00.000Z"
  }
]
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"No token, authorization denied"` | Not authenticated |
| 500 | `"Error fetching transactions"` | Server error |

---

## Games Endpoints (`/api/games/*`)

### GET `/api/games/`

Get the list of all available games.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Success response** -- `200 OK`:

```json
[
  {
    "id": "crash",
    "name": "Crash",
    "description": "Watch the multiplier increase until it crashes. Cash out before it's too late!",
    "minBet": 10,
    "maxBet": 10000,
    "thumbnail": "/images/games/crash.jpg"
  },
  {
    "id": "plinko",
    "name": "Plinko",
    "description": "Drop the ball and watch it bounce through pins to determine your payout.",
    "minBet": 10,
    "maxBet": 5000,
    "thumbnail": "/images/games/plinko.jpg"
  },
  {
    "id": "wheel",
    "name": "Wheel",
    "description": "Spin the wheel and win based on where it stops!",
    "minBet": 10,
    "maxBet": 5000,
    "thumbnail": "/images/games/wheel.jpg"
  },
  {
    "id": "roulette",
    "name": "Roulette",
    "description": "Classic casino roulette with multiple betting options.",
    "minBet": 10,
    "maxBet": 5000,
    "thumbnail": "/images/games/roulette.jpg"
  },
  {
    "id": "blackjack",
    "name": "Blackjack",
    "description": "Beat the dealer by getting closer to 21 without going over.",
    "minBet": 10,
    "maxBet": 5000,
    "thumbnail": "/images/games/blackjack.jpg"
  }
]
```

---

### POST `/api/games/:gameId/bet`

Place a bet for a specific game.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | 60 requests per minute (per IP) |

**URL parameters** (validated with Zod):

| Parameter | Type | Valid values |
|---|---|---|
| `gameId` | `string` | `crash`, `plinko`, `wheel`, `roulette`, `blackjack` |

**Request body** (validated with Zod):

| Field | Type | Constraints |
|---|---|---|
| `betAmount` | `number` | Must be positive |

**Success response** -- `200 OK`:

```json
{
  "message": "Bet placed successfully",
  "gameId": "crash",
  "betAmount": 100,
  "sessionId": "crash-1711526400000"
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 400 | `"Invalid gameId"` | `gameId` not in allowed enum |
| 400 | `"Invalid bet amount"` | `betAmount` fails Zod validation |
| 401 | `"No token, authorization denied"` | Not authenticated |
| 429 | `"Too many requests..."` | Bet rate limit exceeded |
| 500 | `"Server error while placing bet"` | Server error |

---

## Verification Endpoints (`/api/verify/*`)

Endpoints for the provably fair game verification system. No authentication required -- anyone can verify a game result.

### POST `/api/verify`

Verify a provably fair game result using the server seed, server seed hash, client seed, and nonce.

| Detail | Value |
|---|---|
| **Auth required** | No |
| **Rate limit** | Global only (120/min) |

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `serverSeed` | `string` | Yes | The revealed server seed (post-game) |
| `serverSeedHash` | `string` | Yes | The SHA-256 hash shown before the game |
| `clientSeed` | `string` | Yes | The client-provided seed |
| `nonce` | `number` | Yes | The game round nonce |
| `gameType` | `string` | No | `"crash"` or `"roulette"` for game-specific results |

**Processing:**

1. Recompute the SHA-256 hash of the provided `serverSeed` and compare it against `serverSeedHash`.
2. Compute the HMAC-SHA256 result using the server seed as key and `clientSeed:nonce` as the message.
3. If `gameType` is `"crash"`, also compute the crash point (with 1% house edge).
4. If `gameType` is `"roulette"`, also compute the roulette number (0--36).

**Success response** -- `200 OK`:

```json
{
  "valid": true,
  "serverSeedHashMatch": true,
  "rawResult": 0.7234567891
}
```

With `gameType: "crash"`:

```json
{
  "valid": true,
  "serverSeedHashMatch": true,
  "rawResult": 0.7234567891,
  "crashPoint": 3.62
}
```

With `gameType: "roulette"`:

```json
{
  "valid": true,
  "serverSeedHashMatch": true,
  "rawResult": 0.7234567891,
  "number": 26
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 400 | `"Missing required fields"` | `serverSeed`, `serverSeedHash`, `clientSeed`, or `nonce` missing |
| 500 | `"Verification error"` | Server error |

**Implementation:** `server/routes/verify.ts`

---

### GET `/api/verify/generate-client-seed`

Generate a random 16-character hexadecimal client seed for use in provably fair verification.

| Detail | Value |
|---|---|
| **Auth required** | No |
| **Rate limit** | Global only (120/min) |

**Request body**: None

**Success response** -- `200 OK`:

```json
{
  "clientSeed": "a1b2c3d4e5f6a7b8"
}
```

The seed is generated by taking the first 16 characters of a 32-byte random hex string (via `ProvablyFairService.generateServerSeed().substring(0, 16)`).

**Implementation:** `server/routes/verify.ts`

---

## Leaderboard Endpoints (`/api/leaderboard/*`)

### GET `/api/leaderboard`

Get the leaderboard of top winners ranked by total `game_win` transaction amounts. Only active users are included.

| Detail | Value |
|---|---|
| **Auth required** | No |
| **Rate limit** | Global only (120/min) |

**Query parameters**:

| Parameter | Type | Default | Valid values | Description |
|---|---|---|---|---|
| `period` | `string` | `"allTime"` | `daily`, `weekly`, `allTime` | Time period filter |
| `limit` | `number` | `10` | 1--50 | Maximum number of entries to return |

**Example requests**:

```
GET /api/leaderboard
GET /api/leaderboard?period=daily&limit=20
GET /api/leaderboard?period=weekly
```

**Success response** -- `200 OK`:

```json
{
  "period": "allTime",
  "leaderboard": [
    {
      "id": 3,
      "username": "highroller",
      "totalWinnings": "5230.50",
      "totalGames": 142
    },
    {
      "id": 7,
      "username": "luckyseven",
      "totalWinnings": "3100.00",
      "totalGames": 89
    }
  ]
}
```

**Period filter behavior**:

| Period | Date filter |
|--------|------------|
| `daily` | Transactions from midnight today (server time) |
| `weekly` | Transactions from 7 days ago |
| `allTime` | No date filter (all transactions) |

Only users with `totalWinnings > 0` appear on the leaderboard.

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 400 | `"Invalid period. Must be daily, weekly, or allTime."` | Period not in allowed values |
| 500 | `"Error fetching leaderboard"` | Server error |

**Implementation:** `server/routes/leaderboard.ts`

---

## Responsible Gaming Endpoints (`/api/responsible-gaming/*`)

Endpoints for responsible gaming features including self-exclusion and activity summaries. All endpoints require authentication.

### GET `/api/responsible-gaming/limits`

Get the current user's responsible gaming status and limits.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Request body**: None

**Success response** -- `200 OK`:

```json
{
  "isActive": true,
  "selfExcluded": false,
  "dailyDepositLimit": null,
  "dailyLossLimit": null,
  "sessionTimeLimit": null,
  "cooldownUntil": null
}
```

The limit fields (`dailyDepositLimit`, `dailyLossLimit`, `sessionTimeLimit`, `cooldownUntil`) are placeholders for future implementation. They always return `null` in the current version but are included in the response contract so the frontend can bind to them immediately.

The `selfExcluded` field is derived from the user's `isActive` status: `selfExcluded = !isActive`.

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"Authentication required"` | Not authenticated |
| 404 | `"User not found"` | User not found in database |
| 500 | `"Error fetching responsible gaming limits"` | Server error |

**Implementation:** `server/routes/responsible-gaming.ts`

---

### POST `/api/responsible-gaming/self-exclude`

Self-exclude the authenticated user for a specified number of days. Sets `isActive = false` on the user record, which prevents login via the auth middleware.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Request body**:

| Field | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| `days` | `number` | No | `1` | 1--365 | Number of days to self-exclude |

If `days` is missing, not a valid integer, or outside the 1--365 range, the server defaults to 1 day.

**Success response** -- `200 OK`:

```json
{
  "success": true,
  "message": "Account self-excluded for 7 day(s). You will be logged out.",
  "reactivateAt": "2026-04-04T14:30:00.000Z"
}
```

**Side effects:**

- Sets `users.isActive = false` in the database
- Sets `users.updatedAt` to the current timestamp
- Logs a `self_exclusion` system event with the userId, days, and cooldownUntil
- The client logs the user out after displaying the confirmation

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"Authentication required"` | Not authenticated |
| 500 | `"Error processing self-exclusion"` | Server error |

**Implementation:** `server/routes/responsible-gaming.ts`

---

### GET `/api/responsible-gaming/activity-summary`

Get a summary of the user's recent gambling activity over two time periods (last 7 days and last 30 days). Useful for helping users make informed decisions about their gaming habits.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Request body**: None

**Success response** -- `200 OK`:

```json
{
  "last7Days": {
    "totalGames": 23,
    "totalWins": 450.00,
    "totalLosses": 320.00,
    "netResult": 130.00
  },
  "last30Days": {
    "totalGames": 87,
    "totalWins": 1250.00,
    "totalLosses": 980.00,
    "netResult": 270.00
  }
}
```

**Field descriptions**:

| Field | Description |
|---|---|
| `totalGames` | Count of `game_win` and `game_loss` transactions in the period |
| `totalWins` | Sum of `game_win` transaction amounts |
| `totalLosses` | Sum of `game_loss` transaction amounts |
| `netResult` | `totalWins - totalLosses` (positive = net winner, negative = net loser) |

The summary is computed via raw SQL queries against the `transactions` table, filtering by `transaction_type IN ('game_win', 'game_loss')` and the appropriate date range using `DATE_SUB(NOW(), INTERVAL N DAY)`.

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"Authentication required"` | Not authenticated |
| 500 | `"Error fetching activity summary"` | Server error |

**Implementation:** `server/routes/responsible-gaming.ts`

---

## Admin Endpoints (`/api/admin/*`)

All admin endpoints require authentication with the `admin` role. A `403 Access denied` response is returned if the authenticated user does not have admin privileges.

### GET `/api/admin/users`

Get all registered users.

| Detail | Value |
|---|---|
| **Auth required** | Yes (admin only) |
| **Rate limit** | Global only (120/min) |

**Success response** -- `200 OK`:

```json
{
  "players": [
    {
      "id": 1,
      "username": "player1",
      "role": "user",
      "balance": 1500.50,
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "lastLogin": "2025-03-27T08:00:00.000Z"
    }
  ],
  "totalCount": 1
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"No token, authorization denied"` | Not authenticated |
| 403 | `"Access denied"` | Not an admin |
| 500 | `"Error fetching users"` | Server error |

---

### POST `/api/admin/users`

Create a new user account (admin-created).

| Detail | Value |
|---|---|
| **Auth required** | Yes (admin only) |
| **Rate limit** | Global only (120/min) |

**Request body**:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `username` | `string` | Yes | -- | Unique username |
| `password` | `string` | Yes | -- | Plain-text password (hashed server-side) |
| `role` | `string` | No | `"user"` | User role (`user` or `admin`) |
| `isActive` | `boolean` | No | `true` | Whether the account is active |

**Success response** -- `201 Created`:

```json
{
  "id": 2,
  "username": "player2",
  "role": "user",
  "isActive": true,
  "createdAt": "2025-03-27T08:00:00.000Z"
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 400 | `"User already exists"` | Duplicate username |
| 401 | `"No token, authorization denied"` | Not authenticated |
| 403 | `"Access denied"` | Not an admin |
| 500 | `"Error creating user"` | Server error |

---

### PUT `/api/admin/users/:id`

Update an existing user.

| Detail | Value |
|---|---|
| **Auth required** | Yes (admin only) |
| **Rate limit** | Global only (120/min) |

**URL parameters**:

| Parameter | Type | Description |
|---|---|---|
| `id` | `number` | User ID |

**Request body** (all fields optional):

| Field | Type | Description |
|---|---|---|
| `username` | `string` | New username |
| `password` | `string` | New password (hashed server-side) |
| `role` | `string` | New role |
| `isActive` | `boolean` | Active status |

**Success response** -- `200 OK`:

```json
{
  "id": 2,
  "username": "player2_updated",
  "role": "user",
  "isActive": true,
  "updatedAt": "2025-03-27T09:00:00.000Z"
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"No token, authorization denied"` | Not authenticated |
| 403 | `"Access denied"` | Not an admin |
| 404 | `"User not found"` | Invalid user ID |
| 500 | `"Error updating user"` | Server error |

---

### DELETE `/api/admin/users/:id`

Delete a user account.

| Detail | Value |
|---|---|
| **Auth required** | Yes (admin only) |
| **Rate limit** | Global only (120/min) |

**URL parameters**:

| Parameter | Type | Description |
|---|---|---|
| `id` | `number` | User ID |

**Success response** -- `200 OK`:

```json
{
  "message": "User deleted successfully"
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"No token, authorization denied"` | Not authenticated |
| 403 | `"Access denied"` | Not an admin |
| 404 | `"User not found"` | Invalid user ID |
| 500 | `"Error deleting user"` | Server error |

---

### GET `/api/admin/dashboard`

Get dashboard statistics including recent transactions, game stats, and totals.

| Detail | Value |
|---|---|
| **Auth required** | Yes (admin only) |
| **Rate limit** | Global only (120/min) |

**Success response** -- `200 OK`:

```json
{
  "recentTransactions": [],
  "gameStats": [],
  "totalStats": {
    "totalUsers": 42,
    "activeUsers": 42,
    "totalGames": 0,
    "houseProfit": 0
  }
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"No token, authorization denied"` | Not authenticated |
| 403 | `"Access denied"` | Not an admin |
| 500 | `"Error fetching dashboard data"` | Server error |

---

### GET `/api/admin/games`

Get game statistics sorted by total games played (descending).

| Detail | Value |
|---|---|
| **Auth required** | Yes (admin only) |
| **Rate limit** | Global only (120/min) |

**Success response** -- `200 OK`:

Returns an array of game stat records.

```json
[
  {
    "id": 1,
    "gameName": "crash",
    "totalGamesPlayed": "150",
    "totalBetAmount": "25000.00",
    "totalPayoutAmount": "22000.00"
  }
]
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"No token, authorization denied"` | Not authenticated |
| 403 | `"Access denied"` | Not an admin |
| 500 | `"Error fetching game stats"` | Server error |

---

### GET `/api/admin/transactions`

Get transactions with filtering and pagination (admin view across all users).

| Detail | Value |
|---|---|
| **Auth required** | Yes (admin only) |
| **Rate limit** | Global only (120/min) |

**Query parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `userId` | `number` | -- | Filter by user ID |
| `type` | `string` | -- | Filter by transaction type |
| `status` | `string` | -- | Filter by status |
| `startDate` | `string` (ISO date) | -- | Filter from date |
| `endDate` | `string` (ISO date) | -- | Filter until date |
| `page` | `number` | `1` | Page number |
| `limit` | `number` | `20` | Results per page |
| `sortBy` | `string` | `"createdAt"` | Sort field |
| `sortOrder` | `string` | `"desc"` | Sort direction (`asc` or `desc`) |

**Example request**:

```
GET /api/admin/transactions?userId=1&type=bet&limit=10&sortOrder=desc
```

**Success response** -- `200 OK`:

Returns an array of transaction records.

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"No token, authorization denied"` | Not authenticated |
| 403 | `"Access denied"` | Not an admin |
| 500 | `"Error fetching transactions"` | Server error |

---

### POST `/api/admin/transactions`

Create a manual credit or debit transaction for a user.

| Detail | Value |
|---|---|
| **Auth required** | Yes (admin only) |
| **Rate limit** | Global only (120/min) |

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | `number` | Yes | Target user ID |
| `type` | `string` | Yes | `"credit"` or `"debit"` |
| `amount` | `number` | Yes | Transaction amount |
| `description` | `string` | Yes | Reason for the transaction |

**Success response** -- `201 Created`:

```json
{
  "message": "Transaction created successfully",
  "transaction": {
    "id": 5,
    "userId": 1,
    "type": "credit",
    "amount": 500,
    "status": "completed",
    "description": "Bonus reward",
    "createdBy": 2,
    "processedAt": "2025-03-27T09:00:00.000Z",
    "createdAt": "2025-03-27T09:00:00.000Z"
  },
  "newBalance": 2000
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 400 | `"Missing required fields"` | Missing userId, type, amount, or description |
| 400 | `"Invalid transaction type"` | Type not `credit` or `debit` |
| 400 | `"Insufficient balance"` | Debit would result in negative balance |
| 401 | `"No token, authorization denied"` | Not authenticated |
| 403 | `"Access denied"` | Not an admin |
| 404 | `"User not found"` | Target user does not exist |
| 500 | `"Error creating transaction"` | Server error |

---

### PUT `/api/admin/transactions/:id/void`

Void (cancel) an existing transaction.

| Detail | Value |
|---|---|
| **Auth required** | Yes (admin only) |
| **Rate limit** | Global only (120/min) |

**URL parameters**:

| Parameter | Type | Description |
|---|---|---|
| `id` | `number` | Transaction ID |

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `reason` | `string` | No | Reason for voiding |

**Success response** -- `200 OK`:

```json
{
  "message": "Transaction voided successfully",
  "transaction": {
    "id": 5,
    "status": "voided",
    "voidReason": "Duplicate transaction",
    "voidedBy": 2,
    "voidedAt": "2025-03-27T10:00:00.000Z"
  }
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 400 | `"Transaction already voided"` | Transaction status is already `voided` |
| 401 | `"No token, authorization denied"` | Not authenticated |
| 403 | `"Access denied"` | Not an admin |
| 404 | `"Transaction not found"` | Invalid transaction ID |
| 500 | `"Error voiding transaction"` | Server error |

---

## Rewards Endpoints (`/api/rewards/*`)

### GET `/api/rewards/status`

Check if the daily login reward is available for the current user.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Success response** -- `200 OK`:

```json
{
  "canClaim": true,
  "nextRewardTime": null
}
```

When already claimed today:

```json
{
  "canClaim": false,
  "nextRewardTime": "2025-03-28T00:00:00.000Z"
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"Authentication required"` | Not authenticated |
| 500 | `"Internal server error"` | Server error |

---

### POST `/api/rewards/claim`

Claim the daily login reward. Awards a random amount (0-100) to the user's balance.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Request body**: None

**Success response** -- `200 OK`:

```json
{
  "success": true,
  "rewardAmount": 47.50,
  "newBalance": 1547.50
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 400 | `"Daily reward already claimed"` | Already claimed today (includes `nextClaimTime`) |
| 401 | `"Authentication required"` | Not authenticated |
| 404 | `"User not found"` | User not found |
| 500 | `"Internal server error"` | Server error |

---

### GET `/api/rewards/history`

Get the current user's reward claim history.

| Detail | Value |
|---|---|
| **Auth required** | Yes (any role) |
| **Rate limit** | Global only (120/min) |

**Query parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `30` | Maximum number of history records |

**Success response** -- `200 OK`:

```json
{
  "rewards": [
    {
      "id": 1,
      "userId": 1,
      "amount": 47.50,
      "transactionId": 10,
      "createdAt": "2025-03-27T08:00:00.000Z"
    }
  ],
  "totalRewards": 1250.00
}
```

**Error responses**:

| Status | Message | Condition |
|---|---|---|
| 401 | `"Authentication required"` | Not authenticated |
| 500 | `"Internal server error"` | Server error |

---

## Health Check Endpoints

Health check endpoints are not behind the `/api` prefix rate limiter (except the database check which is under `/api`).

### GET `/health`

Basic health check. Returns server status, uptime, and version.

| Detail | Value |
|---|---|
| **Auth required** | No |
| **Rate limit** | None (not under `/api` prefix) |

**Request body**: None

**Success response** -- `200 OK`:

```json
{
  "status": "ok",
  "uptime": 3600.123,
  "timestamp": "2026-03-28T12:00:00.000Z",
  "version": "1.0.0"
}
```

| Field | Description |
|---|---|
| `status` | Always `"ok"` if the server is running |
| `uptime` | Server uptime in seconds (from `process.uptime()`) |
| `timestamp` | Current server time in ISO 8601 format |
| `version` | Application version string |

**Implementation:** `server/server.ts`

---

### GET `/api/health/db`

Database connectivity check. Tests the MySQL connection by executing `SELECT 1`.

| Detail | Value |
|---|---|
| **Auth required** | No |
| **Rate limit** | Global only (120/min) |

**Request body**: None

**Success response** -- `200 OK`:

```json
{
  "status": "ok",
  "database": "connected"
}
```

**Error response** -- `503 Service Unavailable`:

```json
{
  "status": "error",
  "database": "disconnected"
}
```

The 503 status indicates the database is unreachable. This is useful for load balancer health checks to remove unhealthy instances from rotation.

**Implementation:** `server/server.ts`

---

## Related Documents

- [Socket Events Reference](./socket-events.md) -- Real-time WebSocket events for game interactions
- [Error Codes Reference](./error-codes.md) -- Complete error response catalog
- [Architecture Overview](../02-architecture/) -- System design and data flow
- [Security](../07-security/) -- Authentication and authorization details
- [Provably Fair System](../03-features/provably-fair.md) -- Cryptographic fairness verification details
- [Responsible Gaming](../03-features/responsible-gaming.md) -- Self-exclusion and activity monitoring
- [Leaderboard](../03-features/leaderboard.md) -- Leaderboard system and ranking logic
