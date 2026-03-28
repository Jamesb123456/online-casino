# NPM Scripts Reference

All available npm scripts for the server and client packages.

## Server Scripts

Defined in `server/package.json`.

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc` | Compiles all TypeScript files to JavaScript in the `dist/` directory using the project's `tsconfig.json`. |
| `start` | `node dist/server.js` | Runs the compiled production build from `dist/`. Requires `npm run build` first. |
| `start:ts` | `node --loader ts-node/esm server.ts` | Runs the TypeScript server directly using ts-node's ESM loader. No Bun required. |
| `dev` | `bun run --watch server.ts` | Starts the server with Bun in watch mode. Automatically restarts on file changes. Requires Bun to be installed. |
| `dev:full` | `nodemon --exec "node --loader ts-node/esm" server.ts` | Starts the server with nodemon and ts-node. Restarts on file changes using Node.js (no Bun required). |
| `dev:js` | `nodemon server.js` | Starts the plain JavaScript server entry point with nodemon. Useful when working without TypeScript compilation. |
| `test` | `vitest run` | Runs all server tests once using Vitest. |
| `test:watch` | `vitest` | Runs server tests in watch mode, re-running on file changes. |
| `test:coverage` | `vitest run --coverage` | Runs all server tests and generates a coverage report. |
| `seed` | `node --loader ts-node/esm scripts/seedDatabase.ts` | Seeds the database with initial data: admin account, player accounts, and game statistics records. |
| `init-stats` | `node --loader ts-node/esm scripts/initGameStats.ts` | Initializes game statistics records in the `game_stats` table for all supported game types. |
| `db:generate` | `drizzle-kit generate` | Generates a new SQL migration file from changes detected in the Drizzle schema (`drizzle/schema.ts`). Migration files are written to `drizzle/migrations/`. |
| `db:migrate` | `drizzle-kit migrate` | Applies all pending migrations to the database. Reads the `DATABASE_URL` from `.env` via `drizzle.config.js`. |
| `db:push` | `drizzle-kit push` | Pushes the current schema directly to the database without generating migration files. Useful during rapid prototyping but not recommended for production. |

### Server development workflow

For day-to-day development, choose the appropriate dev command based on your runtime:

```bash
# If Bun is installed (fastest)
npm run dev

# If using Node.js only
npm run start:ts

# If using Node.js with auto-restart on changes
npm run dev:full
```

### Server testing workflow

```bash
# Run tests once (CI-friendly)
npm test

# Watch mode for active development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Database workflow

When modifying the Drizzle schema:

```bash
# 1. Edit drizzle/schema.ts
# 2. Generate a migration
npm run db:generate

# 3. Apply the migration
npm run db:migrate
```

## Client Scripts

Defined in `client/package.json`.

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Starts the Vite development server on port 5173 with hot module replacement (HMR). |
| `build` | `vite build` | Creates a production-optimized build in the `dist/` directory. Bundles, minifies, and tree-shakes all assets. |
| `lint` | `eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0` | Runs ESLint across all `.js` and `.jsx` files. Fails on any warnings (zero-tolerance policy). Reports unused `eslint-disable` directives. |
| `preview` | `vite preview` | Serves the production build locally for testing. Run `npm run build` first, then use this to verify the output before deployment. |
| `test` | `vitest run` | Runs all client tests once using Vitest. |
| `test:watch` | `vitest` | Runs client tests in watch mode, re-running on file changes. |
| `test:coverage` | `vitest run --coverage` | Runs all client tests and generates a coverage report. |

### Client development workflow

```bash
# Start development server
npm run dev

# Before committing, check for lint errors
npm run lint

# Build and preview production output
npm run build
npm run preview
```

### Client testing workflow

```bash
# Run tests once (CI-friendly)
npm test

# Watch mode for active development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

---

## Related Documents

- [Getting Started](./getting-started.md) -- full setup walkthrough using these scripts
- [Project Structure](./project-structure.md) -- where each script's entry point lives in the file tree
- [Technology Stack](../01-overview/technology-stack.md) -- versions of Vite, TypeScript, Drizzle Kit, and other tools
