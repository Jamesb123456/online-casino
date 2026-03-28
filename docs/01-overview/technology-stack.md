# Technology Stack

## Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.2.x | UI framework |
| React Router DOM | 6.21.x | Client-side routing |
| Tailwind CSS | 4.0.x | Utility-first CSS framework |
| Vite | 5.0.x | Build tool and dev server |
| Socket.IO Client | 4.7.x | WebSocket client for real-time games |
| Better Auth (React) | 1.5.x | Authentication client |
| React Icons | 5.5.x | Icon library (SVG icons) |

> **Note:** The client uses native `fetch` (not Axios) for HTTP requests via a custom `apiRequest` wrapper in `client/src/services/api.js`. State management uses React Context API (`AuthContext`, `ToastContext`), not Redux.

### Frontend Architecture

```
client/src/
├── __tests__/        # Test files mirroring src structure
├── assets/           # Static assets
├── components/       # Reusable UI components
│   ├── admin/        # Admin panel components
│   ├── chat/         # Chat system
│   ├── guards/       # Route guards (Auth, Admin)
│   └── ui/           # Base UI primitives (Button, Card, Modal, etc.)
├── contexts/         # React Context providers (Auth, Toast)
├── games/            # Game implementations
│   ├── blackjack/
│   ├── crash/
│   ├── landmines/
│   ├── plinko/
│   ├── roulette/
│   └── wheel/
├── hooks/            # Custom React hooks
├── layouts/          # Page layout wrappers
├── lib/              # Better Auth client configuration
├── pages/            # Route page components
│   ├── admin/        # Admin pages
│   └── games/        # Game pages (lazy-loaded)
├── services/         # API and socket services
│   ├── admin/        # Admin API services
│   └── socket/       # Per-game socket services
└── test/             # Test setup and utilities
```

## Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20+ | Runtime environment |
| Express | 4.21.x | HTTP framework |
| TypeScript | 5.8.x | Type-safe JavaScript |
| Socket.IO | 4.8.x | WebSocket server |
| Better Auth | 1.5.x | Session-based authentication |
| Drizzle ORM | 0.45.x | Database ORM |
| MySQL2 | 3.6.x | MySQL driver |
| bcryptjs | 2.4.x | Password hashing |
| Decimal.js | 10.6.x | Precision financial math |
| ioredis | 5.10.x | Redis client (optional) |
| @socket.io/redis-adapter | 8.3.x | Socket.IO horizontal scaling |
| Helmet | 7.1.x | Security headers |
| Morgan | 1.10.x | HTTP request logging |
| Winston | 3.11.x | Structured logging |
| express-rate-limit | 7.1.x | Rate limiting |
| cookie-parser | 1.4.x | Cookie handling |
| dotenv | 16.5.x | Environment variables |
| validator | 13.11.x | Input validation |

### Backend Architecture

```
server/
├── drizzle/           # Database layer
│   ├── db.ts          # Connection management (pool: 20 connections)
│   ├── schema.ts      # Table definitions & relations (11 tables)
│   ├── models/        # Data access objects (8 models)
│   └── migrations/    # SQL migration files
├── lib/               # Better Auth configuration
│   └── auth.ts        # Auth setup with plugins and hooks
├── middleware/         # Express & Socket middleware
│   ├── auth.ts        # Better Auth session middleware
│   ├── requestId.ts   # Request ID tracking
│   └── socket/        # Socket.IO auth & rate limiting
├── routes/            # REST API routes (8 route files)
├── scripts/           # CLI scripts (seed, migrate, admin)
├── src/
│   ├── __tests__/     # Server tests
│   ├── services/      # Business logic (balance, logging, redis, provably fair)
│   ├── socket/        # Game socket handlers (6 games + chat + live)
│   ├── utils/         # Helper utilities
│   └── validation/    # Zod schemas for socket input
├── server.ts          # Application entry point
└── tsconfig.json      # TypeScript config (strict: false)
```

## Database

| Technology | Version | Purpose |
|-----------|---------|---------|
| MySQL | 8.x | Relational database |
| Drizzle ORM | 0.45.x | Query builder and schema management |
| Drizzle Kit | 0.30.x | Migration tooling |

### Schema (11 Tables)

| Table | Managed By | Purpose |
|-------|-----------|---------|
| `users` | Better Auth + app | User accounts, balance, role |
| `session` | Better Auth | Session tokens and metadata |
| `account` | Better Auth | OAuth/provider accounts |
| `verification` | Better Auth | Email verification tokens |
| `transactions` | App | Financial ledger (7 types) |
| `gameSessions` | App | Game play records |
| `gameLogs` | App | Detailed event audit trail |
| `balances` | App | Balance change history |
| `gameStats` | App | Aggregate game metrics |
| `messages` | App | Chat messages |
| `loginRewards` | App | Daily login bonus tracking |

## DevOps & Tooling

| Technology | Purpose |
|-----------|---------|
| GitHub Actions | CI/CD pipeline (lint → build → test → security) |
| Docker + Docker Compose | Containerized deployment |
| Nginx | Reverse proxy for client |
| ESLint | Code linting (client) |
| Vitest | Unit and integration testing |
| React Testing Library | Component testing |
| Bun | Alternative dev runtime (server dev mode) |

## Optional Services

| Technology | Purpose | Required |
|-----------|---------|----------|
| Redis / ioredis | Balance caching, game stats caching | No (graceful degradation) |
| @socket.io/redis-adapter | Socket.IO horizontal scaling | No (single-server works fine) |

---

## Related Documents

- [Project Summary](./project-summary.md)
- [System Architecture](../02-architecture/system-architecture.md)
- [Database Schema](../09-database/schema.md)
- [Better Auth Integration](../13-integrations/better-auth-integration.md)
- [Redis Integration](../13-integrations/redis-integration.md)
