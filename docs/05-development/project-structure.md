# Project Structure

Complete directory tree of the Platinum Casino monorepo with descriptions of each file and directory.

## Root Level

```
online-casino/
├── .github/                    # GitHub configuration
│   └── workflows/
│       └── ci.yml              # CI pipeline: typecheck, build server, build client
├── .claude/                    # Claude Code agent configuration
├── .vscode/                    # VS Code workspace settings
├── client/                     # React frontend application
├── server/                     # Express backend application
├── docs/                       # Project documentation (you are here)
├── tests/                      # Root-level test directory (integration / E2E tests)
├── .editorconfig               # Editor settings (indent style, charset, EOL)
├── .env.docker                 # Docker-specific environment variables
├── .gitattributes              # Git line-ending and diff configuration
├── .gitignore                  # Root-level ignore rules
├── ACTION_PLAN.md              # Development action plan and roadmap
├── CLAUDE.md                   # AI assistant project context
├── docker-compose.yml          # Production Docker Compose (server, client, MySQL, Redis)
├── docker-compose.dev.yml      # Dev Docker Compose (MySQL only for local dev)
├── FIXES_NEEDED.md             # Known issues and required fixes
├── LICENSE                     # Project license
├── Makefile                    # Build automation (make dev, make install, make build, etc.)
├── PROJECT_REVIEW.md           # Detailed project review notes
├── QUICK_FIXES.md              # Quick-fix reference for common issues
├── README.md                   # Project overview and quick start
├── SECURITY.md                 # Security considerations and guidelines
├── project.md                  # Extended project description
├── start.sh                    # Cross-platform startup script (installs deps, runs migrations, starts both)
├── start.bat                   # Windows CMD startup script
├── start.ps1                   # Windows PowerShell startup script
└── start-safely.bat            # Safe-mode startup variant
```

## Client (`client/`)

The frontend is a React single-page application built with Vite and styled with Tailwind CSS.

```
client/
├── src/
│   ├── App.jsx                 # Root component with route definitions
│   ├── main.jsx                # Application entry point, renders App into DOM
│   ├── index.css               # Global styles and Tailwind imports
│   │
│   ├── __tests__/              # Client-side test files
│   │
│   ├── assets/                 # Static assets
│   │   └── pattern.png         # Background pattern image
│   │
│   ├── components/             # Shared UI and layout components
│   │   ├── Header.jsx          # Top navigation bar
│   │   ├── Footer.jsx          # Page footer
│   │   ├── SidebarNav.jsx      # Sidebar navigation menu
│   │   ├── LiveGamesList.jsx   # Live games activity feed
│   │   ├── TopGamesCarousel.jsx# Featured games carousel
│   │   ├── ErrorBoundary.jsx   # React error boundary wrapper
│   │   ├── GameErrorBoundary.jsx # Game-specific error boundary with retry
│   │   ├── MobileBottomNav.jsx # Mobile bottom navigation bar
│   │   │
│   │   ├── admin/              # Admin panel components
│   │   │   ├── AdminLayout.jsx         # Admin page layout wrapper
│   │   │   ├── AdminNav.jsx            # Admin navigation sidebar
│   │   │   ├── Dashboard.jsx           # Admin dashboard overview
│   │   │   ├── PlayerManagement.jsx    # Player list and management
│   │   │   ├── GameStatistics.jsx      # Game analytics display
│   │   │   └── CreateTransactionForm.jsx # Manual transaction form
│   │   │
│   │   ├── chat/               # Chat components
│   │   │   └── ChatBox.jsx     # Real-time chat widget
│   │   │
│   │   ├── guards/             # Route guard components
│   │   │   ├── AuthGuard.jsx   # Redirects unauthenticated users
│   │   │   └── AdminGuard.jsx  # Restricts access to admin role
│   │   │
│   │   └── ui/                 # Reusable UI primitives
│   │       ├── ApiStatus.jsx   # API connection status indicator
│   │       ├── Badge.jsx       # Status/label badge
│   │       ├── Button.jsx      # Styled button
│   │       ├── Card.jsx        # Content card container
│   │       ├── Input.jsx       # Form input field
│   │       ├── Loading.jsx     # Loading spinner
│   │       ├── Modal.jsx       # Modal dialog
│   │       ├── Table.jsx       # Data table
│   │       └── Toast.jsx       # Toast notification
│   │
│   ├── contexts/               # React context providers
│   │   ├── AuthContext.jsx     # Authentication state and login/logout
│   │   └── ToastContext.jsx    # Toast notification state (moved from context/)
│   │
│   ├── games/                  # Game modules (primary location)
│   │   ├── blackjack/          # Blackjack
│   │   │   ├── BlackjackGame.jsx
│   │   │   ├── BlackjackTable.jsx
│   │   │   ├── BlackjackHand.jsx
│   │   │   ├── BlackjackBettingPanel.jsx
│   │   │   └── blackjackUtils.js
│   │   ├── crash/              # Crash
│   │   │   ├── CrashGame.jsx
│   │   │   ├── CrashBettingPanel.jsx
│   │   │   ├── CrashActiveBets.jsx
│   │   │   ├── CrashHistory.jsx
│   │   │   ├── CrashPlayersList.jsx
│   │   │   ├── crashSocketService.js
│   │   │   └── crashUtils.js
│   │   ├── landmines/          # Landmines
│   │   │   ├── LandminesGame.jsx
│   │   │   ├── LandminesBoard.jsx
│   │   │   ├── LandminesBettingPanel.jsx
│   │   │   └── landminesUtils.js
│   │   ├── plinko/             # Plinko
│   │   │   ├── PlinkoGame.jsx
│   │   │   ├── PlinkoBoard.jsx
│   │   │   ├── PlinkoBettingPanel.jsx
│   │   │   ├── plinkoSocketService.js
│   │   │   └── plinkoUtils.js
│   │   ├── roulette/           # Roulette
│   │   │   ├── RouletteGame.jsx
│   │   │   ├── RouletteWheel.jsx
│   │   │   ├── RouletteBettingPanel.jsx
│   │   │   ├── RouletteActiveBets.jsx
│   │   │   ├── RoulettePlayersList.jsx
│   │   │   ├── rouletteSocketService.js
│   │   │   └── rouletteUtils.js
│   │   └── wheel/              # Wheel of Fortune
│   │       ├── WheelGame.jsx
│   │       ├── WheelBoard.jsx
│   │       ├── WheelBettingPanel.jsx
│   │       ├── WheelActiveBets.jsx
│   │       ├── WheelPlayersList.jsx
│   │       ├── wheelSocketService.js
│   │       └── wheelUtils.js
│   │
│   ├── hooks/                  # Custom React hooks
│   │   └── useAuth.js          # Hook to consume AuthContext
│   │
│   ├── layouts/                # Page layout wrappers
│   │   └── MainLayout.jsx     # Primary layout with header, sidebar, footer
│   │
│   ├── lib/                    # Third-party library integrations
│   │   └── auth-client.js      # Better Auth client instance
│   │
│   ├── pages/                  # Route-level page components
│   │   ├── HomePage.jsx        # Landing page
│   │   ├── GamesPage.jsx       # Game lobby / game list
│   │   ├── LeaderboardPage.jsx # Player leaderboard rankings
│   │   ├── LoginPage.jsx       # Login form
│   │   ├── NotFoundPage.jsx    # 404 not found page
│   │   ├── ProfilePage.jsx     # User profile and settings
│   │   ├── RegisterPage.jsx    # Registration form
│   │   ├── ResponsibleGamingPage.jsx # Responsible gaming information and tools
│   │   ├── RewardsPage.jsx     # Daily login rewards
│   │   ├── VerifyPage.jsx      # Provably fair game verification
│   │   ├── admin/              # Admin pages
│   │   │   ├── AdminDashboardPage.jsx
│   │   │   ├── GameStatisticsPage.jsx
│   │   │   ├── PlayerManagementPage.jsx
│   │   │   └── TransactionsPage.jsx
│   │   └── games/              # Individual game pages
│   │       ├── BlackjackPage.jsx
│   │       ├── CrashPage.jsx
│   │       ├── LandminesPage.jsx
│   │       ├── PlinkoPage.jsx
│   │       ├── RoulettePage.jsx
│   │       └── WheelPage.jsx
│   │
│   ├── services/               # API and socket service layer
│   │   ├── api.js              # Fetch-based API client with cookie credentials
│   │   ├── authService.js      # Login, register, logout, getCurrentUser
│   │   ├── gameService.js      # Game-related API calls
│   │   ├── socketService.js    # Core Socket.IO connection manager
│   │   ├── admin/              # Admin-specific services
│   │   │   ├── adminService.js       # Admin API calls (users, stats)
│   │   │   └── transactionService.js # Transaction management API
│   │   └── socket/             # Per-game socket services
│   │       ├── blackjackSocketService.js
│   │       ├── chatSocketService.js
│   │       ├── crashSocketService.js
│   │       ├── landminesSocketService.js
│   │       ├── plinkoSocketService.js
│   │       ├── rouletteSocketService.js
│   │       └── wheelSocketService.js
│   │
│   └── test/                   # Test utilities
│       └── setup.js            # Vitest test setup (DOM environment, global mocks)
│
├── public/                     # Static public assets (favicon, icons)
├── .dockerignore               # Docker build exclusions
├── .env.example                # Example environment variables
├── .gitignore                  # Client-specific ignore rules
├── Dockerfile                  # Multi-stage Docker build (build + nginx serve)
├── index.html                  # HTML shell (Vite entry point)
├── nginx.conf                  # Nginx configuration for production container
├── package.json                # Dependencies and scripts
├── package-lock.json           # Lockfile
├── vite.config.js              # Vite configuration (port, plugins, aliases)
└── vitest.config.js            # Vitest test configuration
```

## Server (`server/`)

The backend is an Express application written in TypeScript with Socket.IO for real-time game communication and Drizzle ORM for MySQL data access.

```
server/
├── src/
│   ├── __tests__/              # Server-side test files
│   │
│   ├── services/               # Business logic services
│   │   ├── balanceService.ts   # Centralized balance operations (bets, wins, adjustments)
│   │   ├── loggingService.ts   # Structured game and system event logging
│   │   ├── provablyFairService.ts # HMAC-SHA256 provably fair game verification
│   │   └── redisService.ts     # Optional Redis caching layer
│   │
│   ├── socket/                 # Socket.IO namespace handlers (one per game)
│   │   ├── blackjackHandler.ts # Blackjack game logic
│   │   ├── chatHandler.ts      # Real-time chat
│   │   ├── crashHandler.ts     # Crash game (multiplayer, shared state)
│   │   ├── landminesHandler.ts # Landmines game logic
│   │   ├── liveGamesHandler.ts # Live games activity feed
│   │   ├── plinkoHandler.ts    # Plinko game logic
│   │   ├── rouletteHandler.ts  # Roulette game (multiplayer, shared state)
│   │   └── wheelHandler.ts     # Wheel of Fortune game logic
│   │
│   ├── utils/                  # Shared utility functions
│   │   ├── gameUtils.ts        # House edge calculation, random helpers
│   │   └── plinkoUtils.ts      # Plinko-specific math and physics
│   │
│   └── validation/             # Input validation
│       └── schemas.ts          # Zod validation schemas for API and socket payloads
│
├── drizzle/                    # Drizzle ORM layer
│   ├── db.ts                   # Database connection pool setup
│   ├── schema.ts               # Complete schema definition (tables, relations, types)
│   ├── models/                 # Active Record-style model wrappers
│   │   ├── User.ts             # User CRUD operations
│   │   ├── Transaction.ts      # Transaction queries
│   │   ├── Balance.ts          # Balance history queries
│   │   ├── GameSession.ts      # Game session management
│   │   ├── GameLog.ts          # Game event log queries
│   │   ├── GameStat.ts         # Aggregated game statistics
│   │   ├── LoginReward.ts      # Daily login reward tracking
│   │   └── Message.ts          # Chat message persistence
│   └── migrations/             # SQL migration files
│       ├── 0000_fancy_bug.sql
│       ├── 0001_dapper_mandrill.sql
│       ├── 0002_bent_imperial_guard.sql
│       └── meta/               # Drizzle Kit migration metadata
│           ├── 0000_snapshot.json
│           ├── 0001_snapshot.json
│           ├── 0002_snapshot.json
│           └── _journal.json
│
├── lib/                        # Library configuration
│   └── auth.ts                 # Better Auth configuration (session-based auth with username + admin plugins)
│
├── middleware/                  # Express and socket middleware
│   ├── auth.ts                 # Better Auth HTTP authentication middleware
│   ├── requestId.ts            # Request ID assignment (X-Request-Id header)
│   └── socket/
│       ├── socketAuth.ts       # Socket.IO connection authentication
│       └── socketRateLimit.ts  # Socket event rate limiting per connection
│
├── routes/                     # Express route handlers
│   ├── admin.ts                # Admin endpoints (user management, stats)
│   ├── auth.ts                 # Custom auth routes (refresh-session, etc.)
│   ├── games.ts                # Game data and history endpoints
│   ├── leaderboard.ts          # Leaderboard data endpoint (top players by balance/wins)
│   ├── login-rewards.ts        # Daily reward claiming
│   ├── responsible-gaming.ts   # Responsible gaming endpoints (limits, self-exclusion)
│   ├── users.ts                # User profile and balance endpoints
│   └── verify.ts               # Provably fair verification endpoints
│
├── scripts/                    # One-off utility scripts
│   ├── seedDatabase.ts         # Seeds users, game stats, initial data
│   ├── initGameStats.ts        # Initializes game_stats rows
│   ├── createAdmin.ts          # Creates an admin user
│   ├── migrate.ts              # Programmatic migration runner
│   └── migrateToBetterAuth.ts  # Migration script from JWT to Better Auth
│
├── types/                      # TypeScript type definitions
│   ├── express.d.ts            # Express request augmentation
│   ├── index.ts                # Shared type exports
│   └── index.js                # Compiled type file
│
├── .dockerignore               # Docker build exclusions
├── .eslintrc.json              # ESLint configuration
├── server.ts                   # Main entry point (TypeScript)
├── server.js                   # Alternative JS entry point
├── drizzle.config.js           # Drizzle Kit configuration (dialect, paths, credentials)
├── tsconfig.json               # TypeScript compiler options
├── vitest.config.ts            # Vitest test configuration
├── Dockerfile                  # Docker build (Node.js runtime)
├── encode-db-password.js       # Interactive helper to URL-encode DB passwords
├── fix-env.js                  # Environment file repair utility
├── update-env.js               # Environment variable updater
├── .env.example                # Example environment variables
├── .gitignore                  # Server-specific ignore rules
├── package.json                # Dependencies and scripts
├── package-lock.json           # Lockfile
└── README.md                   # Server-specific documentation
```

## CI/CD (`.github/`)

```
.github/
└── workflows/
    └── ci.yml                  # Runs on push/PR to main:
                                #   1. Install server deps + typecheck (tsc --noEmit)
                                #   2. Build server (tsc)
                                #   3. Install client deps
                                #   4. Build client (vite build)
```

## Documentation (`docs/`)

```
docs/
├── 01-overview/                # Project summary and technology stack
├── 02-architecture/            # System architecture, data flow, socket design
├── 03-features/                # Feature documentation
├── 04-api/                     # API endpoint reference
├── 05-development/             # Development guides (this section)
├── 06-devops/                  # Deployment and CI/CD
├── 07-security/                # Security practices
├── 08-testing/                 # Testing strategy
├── 09-database/                # Database schema and ERD
├── 10-operations/              # Operational procedures
├── 11-roadmap/                 # Future plans
└── 12-troubleshooting/         # Common issues and fixes
```

---

## Related Documents

- [Getting Started](./getting-started.md) -- how to set up and run the project
- [Coding Standards](./coding-standards.md) -- naming conventions and patterns reflected in this structure
- [System Architecture](../02-architecture/system-architecture.md) -- how these directories map to architectural layers
- [Socket Architecture](../02-architecture/socket-architecture.md) -- details on the socket handler namespace pattern
- [Technology Stack](../01-overview/technology-stack.md) -- frameworks and libraries used across the tree
