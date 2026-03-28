# Deployment Guide

## Overview

This document covers the full production deployment process for Platinum Casino, including Docker containerization, PM2 process management, nginx reverse proxy configuration, and a production readiness checklist.

## Production Build

### Server Build

The server is a TypeScript application that compiles to JavaScript:

```bash
cd server
npm ci
npm run build
```

This produces compiled output in `server/dist/`. The production server runs from this compiled directory.

### Client Build

The client is a Vite/React application:

```bash
cd client
npm ci
npm run build
```

This produces an optimized static bundle in `client/dist/`, which can be served by any static file server or reverse proxy.

## Environment Configuration for Production

Create a `.env` file in the `server/` directory with production values:

```env
# Server
PORT=5000
NODE_ENV=production

# Authentication (Better Auth session-based)
BETTER_AUTH_SECRET=<32+-char-random-secret>
BETTER_AUTH_URL=https://yourdomain.com:5000

# Client URL (for CORS -- must match the actual client domain)
CLIENT_URL=https://yourdomain.com

# Database
DATABASE_URL=mysql://user:password@host:3306/casino_db
```

Generate a secure auth secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

See [Environment Variables](../07-security/environment-variables.md) for the full reference.

---

## Docker Deployment

### Server Dockerfile (Multi-Stage Build)

Create `server/Dockerfile`:

```dockerfile
# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for tsc)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY drizzle/ ./drizzle/
COPY middleware/ ./middleware/
COPY routes/ ./routes/
COPY src/ ./src/
COPY server.ts ./

# Compile TypeScript to JavaScript
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

# Add non-root user for security
RUN addgroup -S casino && adduser -S casino -G casino

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p logs && chown -R casino:casino /app

# Switch to non-root user
USER casino

# Expose application port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/ || exit 1

# Start the server
CMD ["node", "dist/server.js"]
```

### Client Dockerfile (nginx)

Create `client/Dockerfile`:

```dockerfile
# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and config
COPY index.html ./
COPY vite.config.js ./
COPY tailwind.config.* ./
COPY postcss.config.* ./
COPY src/ ./src/
COPY public/ ./public/

# Set production API URL at build time
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# ============================================
# Stage 2: Serve with nginx
# ============================================
FROM nginx:1.25-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Client nginx Configuration

**File:** `client/nginx.conf`

This configuration handles SPA routing, static asset caching, API proxying, and WebSocket proxying within the Docker network.

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;

    # SPA fallback -- serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache versioned static assets with 1-year immutable headers
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API requests to the server container
    location /api {
        proxy_pass http://server:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy WebSocket connections (Socket.IO)
    location /socket.io {
        proxy_pass http://server:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

#### Key nginx Features

| Feature | Details |
|---------|---------|
| **SPA routing** | `try_files $uri $uri/ /index.html` ensures client-side routes work on refresh |
| **Gzip** | Compresses text, CSS, JS, JSON, and SVG responses over 1 KB |
| **Asset caching** | 1-year `Cache-Control: public, immutable` for all static file types (JS, CSS, images, fonts) |
| **API proxy** | `/api` requests forwarded to `http://server:5000` (Docker service name) |
| **WebSocket proxy** | `/socket.io` requests forwarded with `Upgrade` and `Connection` headers for WebSocket support |

### docker-compose.yml (Production)

**File:** `docker-compose.yml` (project root)

The production compose file defines three services: `db`, `server`, and `client`.

```yaml
version: '3.8'

services:
  db:
    image: mysql:8
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:-casino_root_pass}
      MYSQL_DATABASE: ${DB_NAME:-platinum_casino}
      MYSQL_USER: ${DB_USER:-casino_user}
      MYSQL_PASSWORD: ${DB_PASSWORD:-casino_pass}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      PORT: 5000
      CLIENT_URL: http://localhost
      DATABASE_URL: mysql://${DB_USER:-casino_user}:${DB_PASSWORD:-casino_pass}@db:3306/${DB_NAME:-platinum_casino}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET:-change-this-to-a-secure-secret-in-production}
      BETTER_AUTH_URL: http://localhost:5000
      NODE_ENV: ${NODE_ENV:-production}
    depends_on:
      db:
        condition: service_healthy

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - server

volumes:
  mysql_data:
```

#### Service summary

| Service    | Image / Build   | Port  | Depends On               | Key Details                          |
|------------|-----------------|-------|--------------------------|--------------------------------------|
| **db**     | `mysql:8`       | 3306  | --                       | Health check via `mysqladmin ping`, persistent `mysql_data` volume |
| **server** | `./server`      | 5000  | `db` (service_healthy)   | Better Auth session-based auth, connects to `db` via Docker DNS  |
| **client** | `./client`      | 80    | `server`                 | nginx serves SPA, proxies `/api` and `/socket.io` to server     |

#### Environment variables

| Variable             | Default                                           | Description                    |
|----------------------|---------------------------------------------------|--------------------------------|
| `DB_ROOT_PASSWORD`   | `casino_root_pass`                                | MySQL root password            |
| `DB_NAME`            | `platinum_casino`                                 | MySQL database name            |
| `DB_USER`            | `casino_user`                                     | MySQL application user         |
| `DB_PASSWORD`        | `casino_pass`                                     | MySQL application password     |
| `BETTER_AUTH_SECRET` | `change-this-to-a-secure-secret-in-production`    | Session signing secret (32+ chars) |
| `NODE_ENV`           | `production`                                      | Node environment               |

### docker-compose.dev.yml (Development)

**File:** `docker-compose.dev.yml` (project root)

The dev compose file runs MySQL only, for use with the local dev servers (`npm run dev` in server/ and client/).

```yaml
version: '3.8'

services:
  db:
    image: mysql:8
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: platinum_casino
      MYSQL_USER: casino_user
      MYSQL_PASSWORD: casino_pass
    ports:
      - "3306:3306"
    volumes:
      - mysql_data_dev:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mysql_data_dev:
```

#### Dev credentials

| Setting            | Value              |
|--------------------|--------------------|
| Root password      | `root`             |
| Database           | `platinum_casino`  |
| Application user   | `casino_user`      |
| Application password | `casino_pass`    |

### Docker Environment File

For production, create a `.env` file at the project root to override defaults:

```env
# Authentication
BETTER_AUTH_SECRET=<generated-64-char-hex-secret>

# Database
DB_ROOT_PASSWORD=<strong-root-password>
DB_PASSWORD=<strong-user-password>

# Optional overrides
NODE_ENV=production
```

### .dockerignore

Create `.dockerignore` files in both `server/` and `client/` directories.

**`server/.dockerignore`**:

```
node_modules
dist
npm-debug.log*
.env
.env.*
*.md
.git
.gitignore
tests
coverage
.vscode
```

**`client/.dockerignore`**:

```
node_modules
dist
npm-debug.log*
.env
.env.*
*.md
.git
.gitignore
tests
coverage
.vscode
```

### Docker Commands

```bash
# Build and start all services
docker compose up -d --build

# View running containers and health status
docker compose ps

# View logs (follow mode)
docker compose logs -f
docker compose logs -f server    # server only
docker compose logs -f db        # database only

# Restart a single service
docker compose restart server

# Stop all services (preserves volumes)
docker compose down

# Stop all services and remove volumes (DESTROYS DATA)
docker compose down -v

# Rebuild a single service
docker compose up -d --build server

# Execute a command inside a running container
docker compose exec server sh
docker compose exec db mysql -u casino_user -p casino
```

### Step-by-Step Docker Deployment

1. **Clone the repository** on the production server.
2. **Create the `.env` file** at the project root with production values (see above).
3. **Build and start** all services:
   ```bash
   docker compose up -d --build
   ```
4. **Verify health** of all containers:
   ```bash
   docker compose ps
   ```
   All services should show `(healthy)` status.
5. **Run database migrations** (if needed):
   ```bash
   docker compose exec server npx drizzle-kit push
   ```
6. **Seed initial data** (first deployment only):
   ```bash
   docker compose exec server node dist/scripts/seedDatabase.js
   docker compose exec server node dist/scripts/initGameStats.js
   ```
7. **Verify the application** by visiting the client URL and testing login, game connections, and WebSocket connectivity.

### Makefile Commands

**File:** `Makefile` (project root)

The project includes a Makefile that wraps common development and deployment commands.

| Command | Description |
|---------|-------------|
| `make dev` | Start both server and client dev servers |
| `make dev-server` | Start server dev server only (`npm run dev` in `server/`) |
| `make dev-client` | Start client dev server only (`npm run dev` in `client/`) |
| `make install` | Install dependencies for both server and client |
| `make build` | Build both server and client for production |
| `make test` | Run test suites for both server and client |
| `make test-coverage` | Run tests with coverage reports for both |
| `make lint` | Run ESLint on client (server lint is best-effort) |
| `make seed` | Seed the database with test data |
| `make migrate` | Run Drizzle database migrations |
| `make db-push` | Push Drizzle schema directly (dev shortcut) |
| `make init-stats` | Initialize the game stats table |
| `make docker` | Build and start all Docker services |
| `make docker-down` | Stop all Docker services |
| `make docker-dev` | Start dev MySQL container only (`docker-compose.dev.yml`) |
| `make clean` | Remove `dist/` and `node_modules/` from both server and client |

---

## PM2 Deployment

PM2 is recommended for production Node.js process management when not using Docker.

### Installation

```bash
npm install -g pm2
```

### ecosystem.config.js

Create `ecosystem.config.js` at the project root:

```javascript
module.exports = {
  apps: [
    {
      // ---- Casino API Server ----
      name: 'platinum-casino',
      script: 'dist/server.js',
      cwd: './server',

      // Process management
      instances: 1,            // Socket.IO requires sticky sessions for >1
      exec_mode: 'fork',       // Use 'fork' for single instance
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,

      // Memory management
      max_memory_restart: '500M',
      node_args: '--max-old-space-size=512',

      // Environment
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-output.log',
      merge_logs: true,
      log_type: 'json',

      // Shutdown
      kill_timeout: 10000,       // 10s grace period for graceful shutdown
      listen_timeout: 8000,
      shutdown_with_message: true,

      // Health monitoring
      exp_backoff_restart_delay: 100,
    },
  ],
};
```

> **Note**: Because the application uses Socket.IO, running multiple instances requires sticky sessions via `@socket.io/sticky` and the Redis adapter. For a single-server deployment, use `instances: 1`.

### PM2 Commands

```bash
# ---- Lifecycle ----
pm2 start ecosystem.config.js --env production    # Start with production env
pm2 stop platinum-casino                           # Stop the process
pm2 restart platinum-casino                        # Hard restart
pm2 reload platinum-casino                         # Zero-downtime reload (fork mode)
pm2 delete platinum-casino                         # Remove from PM2 process list

# ---- Monitoring ----
pm2 status                      # List all processes with status, CPU, memory
pm2 monit                       # Real-time terminal dashboard
pm2 show platinum-casino        # Detailed process information
pm2 env platinum-casino         # Show environment variables

# ---- Logs ----
pm2 logs                        # Tail all process logs
pm2 logs platinum-casino        # Tail logs for this process
pm2 logs --lines 200            # Show last 200 lines
pm2 flush                       # Clear all log files

# ---- Startup ----
pm2 startup                     # Generate OS startup script
pm2 save                        # Save current process list for resurrection
pm2 unstartup                   # Remove startup script

# ---- Deployment updates ----
pm2 stop platinum-casino
cd server && npm ci && npm run build
pm2 start platinum-casino
```

### Step-by-Step PM2 Deployment

1. **Install PM2 globally** on the production server:
   ```bash
   npm install -g pm2
   ```
2. **Build the server**:
   ```bash
   cd server
   npm ci
   npm run build
   ```
3. **Build the client** and deploy static files to your web server:
   ```bash
   cd client
   npm ci
   npm run build
   # Copy client/dist/ to your nginx web root
   ```
4. **Create the `.env` file** in `server/` with production values.
5. **Create the logs directory**:
   ```bash
   mkdir -p server/logs
   ```
6. **Start the application**:
   ```bash
   pm2 start ecosystem.config.js --env production
   ```
7. **Enable startup persistence** so PM2 restarts the process after a server reboot:
   ```bash
   pm2 startup
   pm2 save
   ```
8. **Verify** the process is running:
   ```bash
   pm2 status
   ```

---

## Running in Production (Direct Node.js)

For simple deployments without Docker or PM2:

```bash
cd server
NODE_ENV=production node dist/server.js
```

The server listens on `PORT` (default `5000`) and connects to MySQL via `DATABASE_URL`.

### Graceful Shutdown

The server handles `SIGINT` and `SIGTERM` signals to close the database connection pool cleanly before exiting. Any process manager or container runtime that sends these signals will trigger a graceful shutdown.

---

## Reverse Proxy Configuration

A reverse proxy is required in front of the Node.js server for production deployments.

### nginx (Recommended)

```nginx
upstream casino_backend {
    server 127.0.0.1:5000;

    # If scaling to multiple instances with Socket.IO sticky sessions:
    # ip_hash;
    # server 127.0.0.1:5001;
    # server 127.0.0.1:5002;
}

server {
    listen 80;
    server_name yourdomain.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # TLS certificates
    ssl_certificate     /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    # TLS hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # Serve client static files
    location / {
        root /var/www/casino/client/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location /assets/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Proxy REST API requests
    location /api/ {
        proxy_pass http://casino_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://casino_backend;
        proxy_http_version 1.1;

        # Required for WebSocket upgrade
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket-specific timeouts
        proxy_read_timeout 86400s;   # Keep WebSocket connections alive for 24h
        proxy_send_timeout 86400s;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }
}
```

### Key Reverse Proxy Requirements

| Requirement | Reason |
|---|---|
| **WebSocket proxying** | Socket.IO uses WebSocket for real-time game communication. The `Upgrade` and `Connection` headers must be forwarded. |
| **HTTPS termination** | TLS is terminated at the proxy layer; the Node.js server runs plain HTTP internally on port 5000. |
| **Static file serving** | Serving the client `dist/` bundle directly from nginx offloads work from Node.js. |
| **`X-Forwarded-*` headers** | `express-rate-limit` reads `X-Forwarded-For` to identify client IPs correctly behind the proxy. |
| **Long read timeout on `/socket.io/`** | WebSocket connections are long-lived. The default 60s proxy timeout would drop idle game connections. |

---

## Windows Server with IIS (Planned)

As noted in the project roadmap, deployment to Windows Server with IIS is a planned target.

### Approach

1. **iisnode** -- Use the iisnode module to host the Node.js application behind IIS.
2. **URL Rewrite** -- Configure IIS URL Rewrite rules to proxy requests to the Node.js server.
3. **WebSocket support** -- Ensure the IIS WebSocket Protocol feature is enabled for Socket.IO.
4. **Static files** -- Serve the client `dist/` directory directly from IIS for better performance.

### Considerations

- IIS requires the WebSocket Protocol feature to be installed via Server Manager.
- Socket.IO long-polling fallback works without WebSocket support but is less efficient.
- Application pools should be configured with "No Managed Code" for Node.js.

---

## Production Environment Checklist

### Security

- [ ] Generate a strong `BETTER_AUTH_SECRET` (32+ characters via `openssl rand -base64 32`)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CLIENT_URL` to the exact client domain (CORS)
- [ ] Enable HTTPS with valid TLS certificates
- [ ] Configure firewall rules (only expose ports 80 and 443 publicly)
- [ ] Verify `.env` files are not committed to version control
- [ ] Review [Security Checklist](../07-security/security-overview.md#production-security-checklist)

### Database

- [ ] Configure `DATABASE_URL` with production MySQL credentials
- [ ] Use a dedicated MySQL user with minimal privileges
- [ ] Run database migrations (`npx drizzle-kit push`)
- [ ] Set up automated database backups
- [ ] Verify connection pool settings (`connectionLimit: 20` in `db.ts`)

### Infrastructure

- [ ] Configure reverse proxy with WebSocket support
- [ ] Set up log rotation (PM2 logs, application logs)
- [ ] Configure monitoring and alerting (see [Monitoring](../10-operations/monitoring.md))
- [ ] Enable PM2 startup persistence or Docker restart policies
- [ ] Set memory limits (PM2 `max_memory_restart` or Docker `deploy.resources.limits`)

### Verification

- [ ] Test all game namespaces (crash, roulette, blackjack, plinko, wheel, landmines)
- [ ] Test WebSocket connections through the reverse proxy
- [ ] Test authentication flow (register, login, session refresh)
- [ ] Test rate limiting (`120 requests/minute` on `/api`)
- [ ] Verify graceful shutdown (`SIGTERM` closes DB connections)
- [ ] Load test with expected concurrent user count

---

## Related Documents

- [CI/CD Pipeline](./ci-cd.md) -- Continuous integration workflow
- [Monitoring](../10-operations/monitoring.md) -- Health checks, alerting, and dashboards
- [Logging](../10-operations/logging.md) -- Structured logging and log management
- [Performance](../10-operations/performance.md) -- Database indexing, caching, and optimization
- [Security Overview](../07-security/security-overview.md) -- Security middleware and production requirements
- [Environment Variables](../07-security/environment-variables.md) -- Full environment variable reference
