# Admin Panel

The admin panel provides casino operators with tools to monitor platform activity, manage players, review game statistics, and handle transactions. Access is restricted to users with the `admin` role, enforced by both client-side route guards and server-side middleware.

## Access Control

```mermaid
flowchart LR
    R[Request] --> AG[AdminGuard]
    AG -->|Not logged in| Login[/login]
    AG -->|role != admin| Home[/]
    AG -->|role == admin| AP[Admin Panel]
    AP --> API["/api/admin/*"]
    API --> Auth[authenticate middleware]
    Auth --> Check[checkAdminRole]
    Check -->|role != admin| 403
    Check -->|role == admin| Handler[Route Handler]
```

**Client guard:** `AdminGuard` (`client/src/components/guards/AdminGuard.jsx`)
**Server middleware:** `authenticate` + `checkAdminRole` helper (`server/routes/admin.ts`)

## Routes

| Route | Page Component | Description |
|-------|---------------|-------------|
| `/admin/dashboard` | `AdminDashboardPage.jsx` | Overview stats, recent transactions, game metrics |
| `/admin/players` | `PlayerManagementPage.jsx` | Player list with activate/deactivate and balance adjustments |
| `/admin/game-stats` | `GameStatisticsPage.jsx` | Per-game statistics (total games, bets, winnings, house profit) |
| `/admin/transactions` | `TransactionsPage.jsx` | Transaction history with filters, create/void transactions |

## Layout and Navigation

### AdminLayout

**File:** `client/src/components/admin/AdminLayout.jsx`

The root layout component for all admin pages. Provides:

- Collapsible sidebar navigation via `AdminNav`
- Auth verification (redirects non-admins)
- Consistent page structure with header and content area
- Logout functionality

### AdminNav

**File:** `client/src/components/admin/AdminNav.jsx`

Sidebar navigation component with links to all admin sections. Highlights the active route based on current location.

## Dashboard

**Component:** `client/src/components/admin/Dashboard.jsx`
**API endpoint:** `GET /api/admin/dashboard`

Displays key platform metrics:

| Metric | Description |
|--------|-------------|
| Total Players | Count of all registered users |
| Active Players | Count of currently active users |
| Total Games | Aggregate games played across all game types |
| House Profit | Cumulative house profit |
| Recent Transactions | Last 10 transactions across the platform |
| Game Stats | Per-game breakdown from the `game_stats` table |

**API response:**

```json
{
  "recentTransactions": [...],
  "gameStats": [...],
  "totalStats": {
    "totalUsers": 150,
    "activeUsers": 150,
    "totalGames": 0,
    "houseProfit": 0
  }
}
```

## Player Management

**Component:** `client/src/components/admin/PlayerManagement.jsx`

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users (id, username, role, balance, isActive, dates) |
| POST | `/api/admin/users` | Create a new user |
| PUT | `/api/admin/users/:id` | Update user details (username, password, role, isActive) |
| DELETE | `/api/admin/users/:id` | Delete a user |

### Capabilities

- **View players:** Paginated list with username, role, balance, active status, and last login.
- **Activate/Deactivate:** Toggle `isActive` via PUT. Deactivated users cannot log in or connect to game sockets.
- **Role management:** Change a user's role between `user` and `admin`.
- **Password reset:** Optionally set a new password (hashed with bcrypt, 10 rounds).

### GET /api/admin/users Response

```json
{
  "players": [
    {
      "id": 1,
      "username": "player1",
      "role": "user",
      "balance": 1500.00,
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "lastLogin": "2025-03-26T18:45:00.000Z"
    }
  ],
  "totalCount": 150
}
```

## Game Statistics

**Component:** `client/src/components/admin/GameStatistics.jsx`
**API endpoint:** `GET /api/admin/games`

Retrieves aggregate statistics from the `game_stats` table, sorted by total games played (descending).

| Statistic | Column | Description |
|-----------|--------|-------------|
| Game Type | `gameType` | crash, plinko, wheel, roulette, blackjack |
| Name | `name` | Display name for the game |
| Total Games | `totalGamesPlayed` | Number of completed rounds |
| Total Bets | `totalBetsAmount` | Sum of all wagers (decimal 20,2) |
| Total Winnings | `totalWinningsAmount` | Sum of all payouts |
| House Profit | `houseProfit` | Total bets minus total winnings |

## Transaction Management

**Component:** `client/src/components/admin/CreateTransactionForm.jsx`

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/transactions` | List transactions with filters |
| POST | `/api/admin/transactions` | Create a manual credit/debit transaction |
| PUT | `/api/admin/transactions/:id/void` | Void an existing transaction |

### GET /api/admin/transactions

Query parameters for filtering:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `userId` | number | -- | Filter by user |
| `type` | string | -- | Filter by transaction type |
| `status` | string | -- | Filter by status (completed, voided, etc.) |
| `startDate` | ISO date | -- | Filter from date |
| `endDate` | ISO date | -- | Filter to date |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Results per page |
| `sortBy` | string | `createdAt` | Sort field |
| `sortOrder` | string | `desc` | Sort direction |

### POST /api/admin/transactions

Create a manual balance adjustment.

**Request body:**

```json
{
  "userId": 1,
  "type": "credit | debit",
  "amount": 100.00,
  "description": "Promotional bonus"
}
```

**Processing:**

1. Validate all required fields are present.
2. Validate `type` is either `credit` or `debit`.
3. Look up the target user.
4. Get current balance, calculate new balance.
5. Reject if debit would result in a negative balance.
6. Create a transaction record (status: `completed`).
7. Create a balance history record (reason: `admin_adjustment`).
8. Return the transaction and new balance.

### PUT /api/admin/transactions/:id/void

Void an existing transaction.

**Request body:**

```json
{
  "reason": "Duplicate entry"
}
```

**Processing:**

1. Find the transaction by ID.
2. Reject if already voided.
3. Update status to `voided`, record `voidReason`, `voidedBy`, and `voidedAt`.

## Components Summary

| Component | File | Description |
|-----------|------|-------------|
| AdminLayout | `client/src/components/admin/AdminLayout.jsx` | Root layout with sidebar |
| AdminNav | `client/src/components/admin/AdminNav.jsx` | Sidebar navigation |
| Dashboard | `client/src/components/admin/Dashboard.jsx` | Overview statistics |
| PlayerManagement | `client/src/components/admin/PlayerManagement.jsx` | Player CRUD and status management |
| GameStatistics | `client/src/components/admin/GameStatistics.jsx` | Per-game metrics display |
| CreateTransactionForm | `client/src/components/admin/CreateTransactionForm.jsx` | Manual transaction creation form |

## Key Files

| File | Purpose |
|------|---------|
| `server/routes/admin.ts` | All admin API route handlers |
| `server/middleware/auth.ts` | `authenticate` middleware used by admin routes |
| `server/drizzle/models/GameStat.ts` | GameStat model for statistics queries |
| `server/drizzle/models/Transaction.ts` | Transaction model for CRUD operations |
| `server/drizzle/models/Balance.ts` | Balance model for history tracking |
| `client/src/pages/admin/AdminDashboardPage.jsx` | Dashboard page |
| `client/src/pages/admin/PlayerManagementPage.jsx` | Player management page |
| `client/src/pages/admin/GameStatisticsPage.jsx` | Game statistics page |
| `client/src/pages/admin/TransactionsPage.jsx` | Transactions page |

---

## Related Documents

- [Authentication](./authentication.md) -- Auth middleware and admin role verification
- [Balance System](./balance-system.md) -- Balance operations used by transaction management
- [Games Overview](./games-overview.md) -- Games tracked in game statistics
- [Database Schema](../09-database/) -- Tables: users, transactions, balances, game_stats
