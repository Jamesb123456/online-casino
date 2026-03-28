# Getting Started

This guide walks through setting up the Platinum Casino development environment from scratch.

## Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|----------------|-------|
| Node.js | v18+ | v20 recommended (used in CI) |
| npm | v9+ | Ships with Node.js |
| MySQL | 8.0+ | Local or remote instance |
| Docker (optional) | v20+ | For containerized setup |

Verify your installations:

```bash
node -v   # Should print v18.x.x or higher
npm -v    # Should print 9.x.x or higher
```

## Clone the Repository

```bash
git clone https://github.com/<your-org>/online-casino.git
cd online-casino
```

---

## Setup Options

Choose one of the following setup methods:

1. [Manual Setup](#manual-setup) -- Install and configure everything step by step
2. [Docker Setup](#docker-setup) -- Use Docker Compose for a containerized environment
3. [Makefile Setup](#makefile-setup) -- Use Make targets for common operations
4. [Quick Start Scripts](#quick-start-scripts) -- One-command startup for Windows/Linux

---

## Manual Setup

### Server Setup

#### 1. Install dependencies

```bash
cd server
npm install
```

#### 2. Configure environment variables

Copy the example file and edit it:

```bash
cp .env.example .env
```

Open `.env` and set each variable:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Port the Express server listens on |
| `BETTER_AUTH_SECRET` | *(change me)* | Secret key for session signing (32+ characters). Generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `BETTER_AUTH_URL` | `http://localhost:5000` | Base URL for the Better Auth server |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin for the Vite dev server |
| `DATABASE_URL` | `mysql://root:password@localhost:3306/casino` | MySQL connection string in the format `mysql://user:password@host:port/database` |

#### 3. Encode special characters in your database password

If your MySQL password contains special characters (`<`, `>`, `&`, `@`, etc.), they must be URL-encoded in `DATABASE_URL`. Use the included helper script:

```bash
node encode-db-password.js
```

The script will prompt you for the username, password, host, port, and database name, then output a properly encoded `DATABASE_URL` to paste into your `.env` file.

#### 4. Run database migrations

```bash
npm run db:migrate
```

This uses Drizzle Kit to apply all pending migrations from `drizzle/migrations/` to your MySQL database.

#### 5. Seed the database

```bash
npm run seed
```

This populates the database with initial data including admin and player accounts, game statistics, and sample data.

#### 6. Start the server

Using Bun (faster, recommended if installed):

```bash
npm run dev
```

Using Node.js (no Bun required):

```bash
npm run start:ts
```

The server will start on **http://localhost:5000**.

### Client Setup

#### 1. Install dependencies

```bash
cd client
npm install
```

#### 2. Configure environment variables

Create a `.env` file in the `client/` directory:

```bash
cp .env.example .env
```

The file should contain:

```
VITE_API_URL=http://localhost:5000/api
```

#### 3. Start the client

```bash
npm run dev
```

Vite will start the development server on **http://localhost:5173** with hot module replacement enabled.

---

## Docker Setup

Docker Compose files are provided for both production-like and development-only workflows.

### Full Stack with Docker (Production-like)

Start the entire stack (server, client, MySQL, and optionally Redis) using the production Docker Compose file:

```bash
docker-compose up --build
```

This builds and starts:
- **MySQL** database container
- **Server** container (Express API + Socket.IO)
- **Client** container (Nginx serving the built React app)

Environment variables for Docker are defined in `.env.docker` at the project root.

### Development Database Only

If you want to run only MySQL in Docker and run the server/client locally, use the dev compose file:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

This starts only a MySQL container with the connection details matching the defaults in `.env.example`. You can then run the server and client locally using the [Manual Setup](#manual-setup) instructions, pointing `DATABASE_URL` at `localhost:3306`.

### Stopping Docker Containers

```bash
# Stop and remove containers (preserves data volumes)
docker-compose down

# Stop and remove containers AND volumes (destroys data)
docker-compose down -v
```

---

## Makefile Setup

The project includes a `Makefile` with common development targets. These wrap the npm commands with sensible defaults.

```bash
# Install all dependencies (server + client)
make install

# Start both server and client in development mode
make dev

# Run database migrations
make migrate

# Seed the database
make seed

# Build both server and client for production
make build

# Run all tests
make test

# Run linting
make lint
```

Run `make help` (or just `make`) to see all available targets.

---

## Quick Start Scripts

### Linux / macOS

The `start.sh` script automates the full setup process -- installing dependencies, running migrations, seeding the database, and starting both server and client:

```bash
chmod +x start.sh
./start.sh
```

### Windows (PowerShell)

```powershell
.\start.ps1
```

The PowerShell script uses `npm run start:ts` (Node.js) for the server.

### Windows (Command Prompt)

```cmd
start.bat
```

The batch script uses `npm run dev` (Bun) for the server.

Both Windows scripts open the server and client in separate terminal windows.

---

## Running Tests

### Server Tests

```bash
cd server

# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Client Tests

```bash
cd client

# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

Both server and client use [Vitest](https://vitest.dev/) as the test runner. Configuration files are at `server/vitest.config.ts` and `client/vitest.config.js` respectively.

---

## Default Credentials

After seeding, the following accounts are available:

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Player | `player1` | `password123` |
| Player | `player2` | `password123` |
| Player | `player3` | `password123` |

## Access Points

| Service | URL |
|---------|-----|
| Client (Vite dev server) | http://localhost:5173 |
| Server (Express API) | http://localhost:5000 |
| API base path | http://localhost:5000/api |

## Troubleshooting

### Common issues

**`DATABASE_URL` connection refused** -- Ensure MySQL is running and the credentials in your `.env` are correct. If your password has special characters, run `node encode-db-password.js`.

**Port already in use** -- Another process is using port 5000 or 5173. Either stop the conflicting process or change the port in the respective `.env` / config file.

**`bun` not found** -- The `npm run dev` server script requires Bun. Use `npm run start:ts` instead to run with Node.js, or install Bun from https://bun.sh.

**Migration errors** -- If the database schema is already up to date, migration warnings can be safely ignored. For a fresh database, ensure the target database exists before running migrations.

**Docker MySQL not ready** -- If the server fails to connect on first `docker-compose up`, the MySQL container may still be initializing. Wait a few seconds and restart the server, or use `docker-compose up -d` and check logs with `docker-compose logs mysql`.

---

## Related Documents

- [NPM Scripts Reference](./npm-scripts.md) -- detailed explanation of every available script
- [Project Structure](./project-structure.md) -- directory layout and file descriptions
- [Coding Standards](./coding-standards.md) -- conventions and patterns used in the codebase
- [Technology Stack](../01-overview/technology-stack.md) -- full list of dependencies and versions
- [System Architecture](../02-architecture/system-architecture.md) -- high-level architecture overview
