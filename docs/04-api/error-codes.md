# Error Codes Reference

This document catalogs all error responses returned by the Platinum Casino API, including HTTP REST endpoints and Socket.IO events.

---

## Error Response Format

### REST API Errors

All REST API error responses return a JSON body with the following shape:

```json
{
  "message": "Human-readable error description",
  "errors": {}
}
```

| Field | Type | Always present | Description |
|---|---|---|---|
| `message` | `string` | Yes | A short, human-readable description of what went wrong |
| `errors` | `object` | No | Additional structured error details. Present on Zod validation failures. |

Some endpoints in the Rewards group use `error` instead of `message`:

```json
{
  "error": "Daily reward already claimed",
  "nextClaimTime": "2025-03-28T00:00:00.000Z"
}
```

### Socket.IO Errors

Socket.IO error callbacks follow this pattern:

```json
{
  "success": false,
  "error": "Description of the error"
}
```

For Blackjack, errors are emitted as events rather than callbacks:

```json
{
  "message": "Description of the error"
}
```

---

## HTTP Status Codes

### 400 Bad Request

Returned when the request payload is invalid or the operation cannot be performed.

| Context | Message | Details |
|---|---|---|
| Auth (register/login) | `"Invalid payload"` | Includes Zod `errors` object (see Validation Errors below) |
| Auth (register) | `"Username already exists"` | Duplicate username |
| Admin (create user) | `"User already exists"` | Duplicate username |
| Admin (create transaction) | `"Missing required fields"` | `userId`, `type`, `amount`, or `description` not provided |
| Admin (create transaction) | `"Invalid transaction type"` | Type must be `"credit"` or `"debit"` |
| Admin (create transaction) | `"Insufficient balance"` | Debit would produce a negative balance |
| Admin (void transaction) | `"Transaction already voided"` | Transaction was already voided |
| Games (place bet) | `"Invalid gameId"` | `gameId` URL param not in `[crash, plinko, wheel, roulette, blackjack]` |
| Games (place bet) | `"Invalid bet amount"` | `betAmount` failed Zod validation |
| Users (update profile) | `"Current password is incorrect"` | Password verification failed |
| Rewards (claim) | `"Daily reward already claimed"` | Already claimed today; includes `nextClaimTime` |

---

### 401 Unauthorized

Returned when no valid authentication credentials are provided.

| Context | Message | Details |
|---|---|---|
| Auth middleware | `"No token, authorization denied"` | No `authToken` cookie present |
| Auth middleware | `"Token is not valid"` | JWT expired, malformed, or user account is inactive |
| Auth (login) | `"Invalid credentials"` | Wrong username or password |
| Auth (login) | `"Account is disabled"` | User's `isActive` flag is `false` |
| Auth (verify) | `"No token provided"` | No `authToken` cookie for verification |
| Auth (verify) | `"Invalid token"` | Token verification failed |
| Rewards | `"Authentication required"` | No user ID in the request |

---

### 403 Forbidden

Returned when the user is authenticated but lacks the required role.

| Context | Message | Details |
|---|---|---|
| Admin endpoints | `"Access denied"` | User role is not `admin` |
| Admin middleware | `"Access denied. Admin only."` | Used by the `adminOnly` middleware |
| General | `"Access denied."` | Used by the `userOrAdmin` middleware when role is neither `user` nor `admin` |

---

### 404 Not Found

Returned when the requested resource does not exist.

| Context | Message | Details |
|---|---|---|
| Users | `"User not found"` | User ID not found in database |
| Admin (update/delete user) | `"User not found"` | Target user ID does not exist |
| Admin (create transaction) | `"User not found"` | Target user for transaction does not exist |
| Admin (void transaction) | `"Transaction not found"` | Transaction ID does not exist |
| Rewards | `"User not found"` | User not found when claiming reward |

---

### 429 Too Many Requests

Returned when a rate limit is exceeded.

| Rate Limiter | Scope | Limit | Window | Message |
|---|---|---|---|---|
| Global API | All `/api/*` routes | 120 requests | 1 minute | Standard rate limit response |
| Auth limiter | `/api/auth/register`, `/api/auth/login` | 5 requests | 15 minutes | `"Too many authentication attempts, please try again later"` |
| Bet limiter | `/api/games/:gameId/bet` | 60 requests | 1 minute | Standard rate limit response |

Rate limit responses include the following headers:

| Header | Description |
|---|---|
| `RateLimit-Limit` | Maximum requests allowed in the window |
| `RateLimit-Remaining` | Remaining requests in the current window |
| `RateLimit-Reset` | Seconds until the rate limit window resets |

**Example 429 response**:

```json
{
  "message": "Too many authentication attempts, please try again later"
}
```

---

### 500 Internal Server Error

Returned when an unexpected server error occurs. These should be reported as bugs.

| Context | Message |
|---|---|
| Auth (register) | `"Error creating user"` |
| Auth (login) | `"Error during login"` |
| Users (me) | `"Error fetching user data"` |
| Users (profile GET) | `"Error fetching profile"` |
| Users (profile PUT) | `"Error updating profile"` |
| Users (balance) | `"Error fetching balance"` |
| Users (balance history) | `"Error fetching balance history"` |
| Users (transactions) | `"Error fetching transactions"` |
| Admin (list users) | `"Error fetching users"` |
| Admin (create user) | `"Error creating user"` |
| Admin (update user) | `"Error updating user"` |
| Admin (delete user) | `"Error deleting user"` |
| Admin (dashboard) | `"Error fetching dashboard data"` |
| Admin (game stats) | `"Error fetching game stats"` |
| Admin (list transactions) | `"Error fetching transactions"` |
| Admin (create transaction) | `"Error creating transaction"` |
| Admin (void transaction) | `"Error voiding transaction"` |
| Games (place bet) | `"Server error while placing bet"` |
| Rewards | `"Internal server error"` |

---

## Validation Errors (Zod Format)

When a request body fails Zod schema validation, the response includes a `400` status with an `errors` field using the Zod `flatten()` format.

**Example**: Registering with an invalid username and password.

Request:

```json
{
  "username": "ab",
  "password": "123"
}
```

Response (`400 Bad Request`):

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

### Validation Rules by Endpoint

**POST `/api/auth/register`** and **POST `/api/auth/login`**:

| Field | Rule |
|---|---|
| `username` | `string`, min 3, max 32 |
| `password` | `string`, min 6, max 128 |

**POST `/api/games/:gameId/bet`**:

| Field | Rule |
|---|---|
| `gameId` (URL param) | Must be one of: `crash`, `plinko`, `wheel`, `roulette`, `blackjack` |
| `betAmount` (body) | `number`, must be positive |

---

## Socket.IO Connection Errors

When socket authentication fails during the handshake, the client receives a `connect_error` event with an `Error` object.

| Error Message | Cause |
|---|---|
| `"Authentication error: No cookies provided"` | No cookies in handshake headers and no `auth.token` provided |
| `"Authentication error: No auth token"` | Cookies present but no `authToken` cookie found |
| `"Authentication error: User not found"` | JWT is valid but user no longer exists in database |
| `"Authentication error: Account inactive"` | JWT is valid but user's `isActive` is `false` |
| `"Authentication error: Invalid token"` | JWT verification failed (expired, malformed, wrong secret) |
| `"Authentication error"` | Catch-all for unexpected authentication errors |

**Handling connection errors on the client**:

```js
socket.on('connect_error', (err) => {
  if (err.message.includes('Authentication error')) {
    // Redirect to login page
    window.location.href = '/login';
  } else {
    // Retry or show connection error UI
    console.error('Connection error:', err.message);
  }
});
```

---

## Socket.IO Game Errors

### Crash Game Errors

Returned via callback to `placeBet` or `cashOut`:

| Error | Trigger |
|---|---|
| `"Invalid bet amount"` | Amount is null, undefined, or <= 0 |
| `"Cannot bet while game is running"` | Attempted to bet during the flying phase |
| `"You already have an active bet"` | Player already has a bet for this round |
| `"Insufficient balance"` | Balance too low for the bet amount |
| `"Could not verify balance"` | Error communicating with balance service |
| `"Failed to place bet"` | Transaction recording failed |
| `"Game is not running"` | Attempted to cash out when no game is active |
| `"No active bet found"` | Player does not have a bet to cash out |
| `"Already cashed out"` | Player already cashed out this round |
| `"Failed to process cashout"` | Win transaction recording failed |
| `"Authentication required"` | Socket user data is missing |

### Blackjack Game Errors

Emitted via the `blackjack_error` event:

| Error | Trigger |
|---|---|
| `"Invalid game parameters"` | Missing or invalid `userId` or `betAmount` |
| `"User not found"` | User ID not found in database |
| `"Insufficient balance"` | Balance too low for the bet |
| `"You already have an active game"` | Player has an ongoing game |
| `"No game found"` | No game exists for this user |
| `"No active game found"` | Game exists but status is not `active` |
| `"Cannot double down"` | Not in initial hand state or game inactive |
| `"Insufficient balance to double"` | Balance too low to double the bet |
| `"Invalid user ID"` | Missing userId in the event payload |

### Roulette, Plinko, Wheel, and Landmines Errors

Returned via callback:

| Error | Trigger |
|---|---|
| `"Invalid bet type"` | (Roulette) Bet type not in valid types |
| `"Invalid bet amount"` | Amount is null, NaN, or <= 0 |
| `"Insufficient balance"` | Balance too low for the bet |
| `"No bets placed"` | (Roulette) Attempted to spin with no bets |
| `"Wheel is already spinning"` | (Roulette) Spin requested during active spin |
| `"Invalid cell selection"` | (Landmines) Row or column out of bounds (0-4) |
| `"No active game found"` | (Landmines) No game in progress |
| `"This cell has already been revealed"` | (Landmines) Cell already picked |
| `"You already have an active game..."` | (Landmines) Must finish or cash out first |
| `"Number of mines must be between 1 and 24"` | (Landmines) Invalid mine count |

---

## Related Documents

- [REST API Reference](./rest-api.md) -- Full endpoint documentation with request/response schemas
- [Socket Events Reference](./socket-events.md) -- Real-time WebSocket event documentation
- [Security](../07-security/) -- Authentication and authorization architecture
