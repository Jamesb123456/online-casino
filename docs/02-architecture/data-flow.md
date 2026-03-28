# Data Flow

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant C as React Client
    participant S as Express Server
    participant DB as MySQL Database

    U->>C: Enter credentials
    C->>S: POST /api/auth/sign-in/email (via Better Auth client)
    S->>S: Better Auth validates input
    S->>DB: Find user by email/username
    DB-->>S: User record
    S->>S: bcrypt.compare(password, hash)
    S->>DB: Create session record
    S-->>C: Set session cookie + user data
    C->>C: Update AuthContext
    C-->>U: Redirect to dashboard
```

## Game Bet Flow (Crash Example)

```mermaid
sequenceDiagram
    participant P as Player
    participant C as Client
    participant WS as Socket.IO Server
    participant BS as Balance Service
    participant DB as MySQL

    P->>C: Place bet ($100)
    C->>WS: emit('place_bet', {amount: 100})
    WS->>WS: Validate authenticated user
    WS->>BS: placeBet(userId, 100, 'crash')
    BS->>DB: Check user balance
    DB-->>BS: Balance: $500
    BS->>DB: Create transaction (game_loss)
    BS->>DB: Update user balance ($400)
    BS->>DB: Create balance history record
    BS-->>WS: {user, transaction}
    WS-->>C: emit('bet_confirmed', {balance: 400})
    C-->>P: Update UI

    Note over WS: Game runs... multiplier increases

    P->>C: Cash out at 2.5x
    C->>WS: emit('cash_out')
    WS->>BS: recordWin(userId, 100, 250, 'crash')
    BS->>DB: Create transaction (game_win)
    BS->>DB: Update user balance ($650)
    BS-->>WS: {user, transaction}
    WS-->>C: emit('cash_out_success', {winnings: 250})
    C-->>P: Show win animation
```

## Admin Balance Adjustment Flow

```mermaid
sequenceDiagram
    participant A as Admin
    participant C as Admin Panel
    participant S as Express Server
    participant BS as Balance Service
    participant DB as MySQL

    A->>C: Adjust player balance
    C->>S: POST /api/admin/transactions
    S->>S: Verify admin session (Better Auth)
    S->>BS: manualAdjustment(userId, amount, reason, adminId)
    BS->>DB: Create transaction (admin_adjustment)
    BS->>DB: Update user balance
    BS->>DB: Create balance history
    BS-->>S: Updated data
    S-->>C: 201 Created
    C-->>A: Show success
```

## Real-time Game State Flow

```mermaid
graph LR
    subgraph Server
        GH[Game Handler] -->|game_state| NS[Socket.IO Namespace]
    end

    NS -->|broadcast| P1[Player 1]
    NS -->|broadcast| P2[Player 2]
    NS -->|broadcast| P3[Player N]

    P1 -->|place_bet| GH
    P2 -->|cash_out| GH
```

## Transaction Types

| Type | Direction | Trigger |
|------|-----------|---------|
| `deposit` | Credit (+) | Admin deposit |
| `withdrawal` | Debit (-) | Admin withdrawal |
| `game_win` | Credit (+) | Player wins game |
| `game_loss` | Debit (-) | Player places bet |
| `admin_adjustment` | Either | Admin manual change |
| `bonus` | Credit (+) | System bonus |
| `login_reward` | Credit (+) | Daily login reward |

## Related Documents

- [System Architecture](./system-architecture.md)
- [Socket Architecture](./socket-architecture.md)
- [API Reference](../04-api/rest-api.md)
- [Balance Service](../03-features/balance-system.md)
