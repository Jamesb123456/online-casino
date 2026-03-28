# System Architecture

## High-Level Overview

Platinum Casino follows a classic client-server architecture with real-time communication via WebSockets. The system is divided into four primary layers.

```mermaid
graph TD
    subgraph Client["Client Layer (React SPA)"]
        UI[UI Components]
        Pages[Page Router]
        GameUI[Game Components]
        SocketClient[Socket.IO Client]
        HTTPClient[Fetch API Client]
        AuthCtx[Auth Context]
        BetterAuth[Better Auth Client]
    end

    subgraph Server["Server Layer (Express + Socket.IO)"]
        Express[Express Server]
        SocketServer[Socket.IO Server]
        AuthMW[Auth Middleware]
        RateLimiter[Rate Limiter]
        Routes[REST Routes]
        Handlers[Socket Handlers]
    end

    subgraph Services["Service Layer"]
        BalanceSvc[Balance Service]
        LoggingSvc[Logging Service]
        GameLogic[Game Logic]
    end

    subgraph Data["Data Layer (MySQL)"]
        Drizzle[Drizzle ORM]
        Models[Data Models]
        DB[(MySQL Database)]
    end

    UI --> Pages
    Pages --> GameUI
    GameUI --> SocketClient
    Pages --> HTTPClient
    HTTPClient --> AuthCtx

    HTTPClient -->|REST API| Express
    SocketClient -->|WebSocket| SocketServer

    Express --> AuthMW
    Express --> RateLimiter
    AuthMW --> Routes
    SocketServer --> AuthMW
    SocketServer --> Handlers

    Routes --> BalanceSvc
    Routes --> LoggingSvc
    Handlers --> BalanceSvc
    Handlers --> GameLogic
    Handlers --> LoggingSvc

    BalanceSvc --> Drizzle
    GameLogic --> Drizzle
    Drizzle --> Models
    Models --> DB
```

## Component Architecture

### 1. Client Layer

The frontend is a React Single Page Application built with Vite, using React Router v6 for navigation and Tailwind CSS v4 for styling.

**Key patterns:**
- **Context-based auth** - `AuthContext` manages user state, login/logout
- **Route guards** - `AuthGuard` and `AdminGuard` protect routes
- **Per-game socket services** - Each game has its own socket service module
- **Error boundaries** - Global `ErrorBoundary` wraps the app
- **Toast notifications** - `ToastContext` for user feedback

### 2. Server Layer

The Express server handles both REST API requests and Socket.IO WebSocket connections.

**Key patterns:**
- **Namespace isolation** - Each game has its own Socket.IO namespace (`/crash`, `/roulette`, etc.)
- **Middleware chain** - CORS, Helmet, Morgan, Rate Limiting, Better Auth sessions
- **Dynamic imports** - Game handlers loaded via `import()` for modularity
- **Graceful shutdown** - SIGINT/SIGTERM handlers close DB connections

### 3. Service Layer

Business logic is encapsulated in service classes.

| Service | Responsibility |
|---------|---------------|
| `BalanceService` | All balance operations: bets, wins, adjustments, history |
| `LoggingService` | Structured logging via Winston (game events, auth, system) |
| Game Handlers | Per-game logic (crash multiplier, plinko physics, etc.) |

### 4. Data Layer

MySQL database accessed through Drizzle ORM with typed schemas.

**11 tables:** users, session, account, verification, transactions, gameSessions, gameLogs, balances, gameStats, messages, loginRewards

## Optional Services

```mermaid
graph LR
    subgraph Optional["Optional (Graceful Degradation)"]
        Redis[(Redis)]
    end

    subgraph Required
        MySQL[(MySQL)]
        Express[Express + Socket.IO]
    end

    Express -->|Drizzle ORM| MySQL
    Express -.->|Cache & Pub/Sub| Redis
```

- **Redis** is optional. When available, it provides balance caching (5s TTL), game stats caching (60s TTL), and Socket.IO pub/sub for horizontal scaling.
- Without Redis, the application functions normally using database-only operations.

## Related Documents

- [Data Flow](./data-flow.md)
- [Socket Architecture](./socket-architecture.md)
- [Technology Stack](../01-overview/technology-stack.md)
- [Database Schema](../09-database/schema.md)
- [Better Auth Integration](../13-integrations/better-auth-integration.md)
- [Redis Integration](../13-integrations/redis-integration.md)
