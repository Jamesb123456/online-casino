# Validation Schemas

## Overview

The Platinum Casino server uses [Zod](https://zod.dev/) for runtime validation of all incoming data. Schemas are centralized in a single file and shared across HTTP routes and Socket.IO event handlers.

**File:** `server/src/validation/schemas.ts`

### Design Principles

- **Single source of truth** -- All validation rules live in one file, preventing drift between routes and socket handlers.
- **Parse, don't validate** -- Schemas use Zod's `.transform()` to normalize data (e.g., rounding bet amounts, coercing user IDs to strings). The parsed output is the canonical shape used by business logic.
- **Readable error messages** -- Every constraint includes a human-readable message surfaced to the client.
- **Composable** -- Common schemas like `betAmountSchema` are reused across game-specific schemas to enforce consistent limits.

---

## Common Schemas

### betAmountSchema

Validates and normalizes a bet amount.

| Constraint | Value   | Description                            |
|------------|---------|----------------------------------------|
| Type       | number  | Must be a number                       |
| Min        | > 0     | Must be positive                       |
| Max        | 10,000  | Cannot exceed 10,000                   |
| Transform  | round   | Rounded to 2 decimal places            |

```ts
import { betAmountSchema } from '../validation/schemas.js';

betAmountSchema.parse(50.999); // => 51.00
betAmountSchema.parse(-1);     // throws: "Bet amount must be positive"
betAmountSchema.parse(99999);  // throws: "Bet amount cannot exceed 10,000"
```

### userIdSchema

Accepts either a string or number and normalizes to a string.

| Input     | Output    |
|-----------|-----------|
| `"42"`    | `"42"`    |
| `42`      | `"42"`    |

```ts
import { userIdSchema } from '../validation/schemas.js';

userIdSchema.parse(42);    // => "42"
userIdSchema.parse("abc"); // => "abc"
```

---

## Game Schemas

### Crash

#### crashPlaceBetSchema

Validates a bet placement in the Crash game.

| Field          | Type             | Required | Constraints                   |
|----------------|------------------|----------|-------------------------------|
| `amount`       | `betAmountSchema`| Yes      | Positive, max 10,000          |
| `autoCashoutAt`| `number`         | No       | Min 1.01, max 1,000,000       |

#### crashCashoutSchema

Validates a cashout request.

| Field   | Type     | Required | Constraints |
|---------|----------|----------|-------------|
| `betId` | `string` | No       | --          |

### Roulette

#### roulettePlaceBetSchema

Validates a single roulette bet. The handler receives one bet object per event (not an array).

| Field    | Type                    | Required | Constraints              |
|----------|-------------------------|----------|--------------------------|
| `type`   | `string`                | Yes      | Non-empty (min length 1) |
| `value`  | `string` or `number`    | No       | --                       |
| `amount` | `betAmountSchema`       | Yes      | Positive, max 10,000     |

### Landmines

#### landminesStartSchema

Validates a new Landmines game session.

| Field       | Type             | Required | Constraints                     |
|-------------|------------------|----------|---------------------------------|
| `betAmount` | `betAmountSchema`| Yes      | Positive, max 10,000            |
| `mines`     | `number`         | Yes      | Integer, min 1, max 24          |

#### landminesPickSchema

Validates a cell pick on the 5x5 Landmines grid.

| Field | Type     | Required | Constraints           |
|-------|----------|----------|-----------------------|
| `row` | `number` | Yes      | Integer, min 0, max 4 |
| `col` | `number` | Yes      | Integer, min 0, max 4 |

### Plinko

#### plinkoDropBallSchema

Validates a Plinko ball drop.

| Field       | Type             | Required | Default    | Constraints                        |
|-------------|------------------|----------|------------|------------------------------------|
| `betAmount` | `betAmountSchema`| Yes      | --         | Positive, max 10,000               |
| `risk`      | `enum`           | No       | `'medium'` | `'low'`, `'medium'`, or `'high'`   |
| `rows`      | `number`         | No       | `16`       | Integer, min 8, max 16             |

### Wheel

#### wheelPlaceBetSchema

Validates a Wheel game bet.

| Field        | Type             | Required | Default    | Constraints                        |
|--------------|------------------|----------|------------|------------------------------------|
| `betAmount`  | `betAmountSchema`| Yes      | --         | Positive, max 10,000               |
| `difficulty` | `enum`           | No       | `'medium'` | `'easy'`, `'medium'`, or `'hard'`  |

### Blackjack

#### blackjackStartSchema

Validates the start of a Blackjack hand.

| Field       | Type             | Required | Constraints          |
|-------------|------------------|----------|----------------------|
| `betAmount` | `betAmountSchema`| Yes      | Positive, max 10,000 |

---

## Admin Schemas

### adminCreateUserSchema

Validates admin user creation requests.

| Field      | Type      | Required | Default  | Constraints                           |
|------------|-----------|----------|----------|---------------------------------------|
| `username` | `string`  | Yes      | --       | 3-30 characters, trimmed              |
| `password` | `string`  | Yes      | --       | 6-100 characters                      |
| `role`     | `enum`    | No       | `'user'` | `'user'` or `'admin'`                 |
| `isActive` | `boolean` | No       | --       | --                                    |

### adminUpdateUserSchema

Validates admin user update requests. All fields are optional.

| Field      | Type      | Required | Constraints                           |
|------------|-----------|----------|---------------------------------------|
| `username` | `string`  | No       | 3-30 characters, trimmed              |
| `password` | `string`  | No       | 6-100 characters                      |
| `role`     | `enum`    | No       | `'user'` or `'admin'`                 |
| `isActive` | `boolean` | No       | --                                    |

### adminTransactionSchema

Validates admin-initiated balance transactions.

| Field         | Type             | Required | Constraints                         |
|---------------|------------------|----------|-------------------------------------|
| `userId`      | `userIdSchema`   | Yes      | String or number, normalized to string |
| `type`        | `enum`           | Yes      | `'credit'` or `'debit'`            |
| `amount`      | `number`         | Yes      | Positive, max 1,000,000            |
| `description` | `string`         | Yes      | 1-500 characters, trimmed          |

---

## Utility Schemas

### paginationSchema

Validates pagination parameters for list endpoints.

| Field   | Type     | Required | Default | Constraints           |
|---------|----------|----------|---------|-----------------------|
| `limit` | `number` | No       | `10`    | Integer, min 1, max 100 |

---

## Utility Function

### validateSocketData

A generic helper that validates incoming Socket.IO event data against a Zod schema. Returns the parsed (and potentially transformed) data on success, or throws an `Error` with a human-readable message on failure.

```ts
function validateSocketData<T>(schema: z.ZodType<T>, data: unknown): T
```

#### Behavior

1. Calls `schema.safeParse(data)`.
2. On success, returns `result.data` (the transformed output).
3. On failure, concatenates all Zod issue messages into a single string and throws an `Error`:
   ```
   Validation error: amount: Bet amount must be positive, mines: Minimum 1 mine
   ```

#### Usage in Socket Handlers

```ts
import { validateSocketData, crashPlaceBetSchema } from '../validation/schemas.js';

socket.on('place_bet', (data) => {
  try {
    const { amount, autoCashoutAt } = validateSocketData(crashPlaceBetSchema, data);
    // amount is already rounded to 2 decimal places
    // autoCashoutAt is validated or undefined
  } catch (err) {
    socket.emit('error', { message: err.message });
  }
});
```

---

## Related Documents

- [API Reference](../04-api/) -- HTTP endpoints that consume these schemas
- [Games Overview](./games-overview.md) -- Game-specific logic using the game schemas
- [Admin Panel](./admin-panel.md) -- Admin routes using admin schemas
- [Security Overview](../07-security/security-overview.md) -- Input validation as a security layer
