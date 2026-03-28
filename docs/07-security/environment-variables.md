# Environment Variables

## Overview

Platinum Casino uses environment variables for all configuration that varies between environments (development, staging, production) and for sensitive values that must not be committed to version control.

Environment variables are loaded using `dotenv` in the server (`dotenv.config()`) and through Vite's built-in env support in the client.

## Server Variables

All server environment variables are defined in `server/.env`. Use `server/.env.example` as a template.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `5000` | No | HTTP port the server listens on |
| `BETTER_AUTH_SECRET` | -- | **Yes** | Secret key for session signing. Must be 32+ characters. |
| `BETTER_AUTH_URL` | `http://localhost:5000` | No | Base URL for Better Auth callbacks |
| `CLIENT_URL` | `http://localhost:5173` | No | Allowed CORS origin. Must match the URL where the client is served. |
| `DATABASE_URL` | -- | **Yes** | MySQL connection string in the format `mysql://user:password@host:port/database` |
| `REDIS_URL` | -- | No | Redis connection URL for caching and Socket.IO scaling |
| `NODE_ENV` | -- | No | Set to `production` in production to enable secure cookies |

### `PORT`

The port on which the Express/Socket.IO server listens.

```env
PORT=5000
```

In development, the default of `5000` works alongside the Vite dev server on port `5173`. In production, the port may be different depending on your reverse proxy configuration.

### `BETTER_AUTH_SECRET`

The secret used by Better Auth to sign and verify session tokens.

```env
# Development (any string works, but should be 32+ characters)
BETTER_AUTH_SECRET=dev-secret-change-this-in-production-32chars

# Production (generate a strong random value)
BETTER_AUTH_SECRET=<generated-base64-string>
```

Generate a production-grade secret:

```bash
openssl rand -base64 32
```

**Security**: A weak or leaked `BETTER_AUTH_SECRET` allows an attacker to forge session tokens for any user, including admin accounts.

### `BETTER_AUTH_URL`

The base URL for Better Auth. Used for generating callback URLs and cookie configuration.

```env
# Development
BETTER_AUTH_URL=http://localhost:5000

# Production
BETTER_AUTH_URL=https://api.yourdomain.com
```

### `CLIENT_URL`

The URL of the client application, used to configure CORS for both Express and Socket.IO, and as a trusted origin for Better Auth.

```env
# Development
CLIENT_URL=http://localhost:5173

# Production
CLIENT_URL=https://yourdomain.com
```

If this value does not match the actual client origin, the browser will block API requests and WebSocket connections due to CORS policy.

### `DATABASE_URL`

The MySQL connection string used by Drizzle ORM.

```env
DATABASE_URL=mysql://username:password@host:port/database
```

Examples:

```env
# Local development
DATABASE_URL=mysql://root:password@localhost:3306/casino

# Remote production
DATABASE_URL=mysql://casino_user:s3cur3P%40ss@db.example.com:3306/casino_prod
```

#### Password Encoding for Special Characters

If your MySQL password contains special characters, they must be URL-encoded in the connection string:

| Character | Encoded |
|-----------|---------|
| `@` | `%40` |
| `#` | `%23` |
| `<` | `%3C` |
| `>` | `%3E` |
| `&` | `%26` |
| `%` | `%25` |
| `:` | `%3A` |
| `/` | `%2F` |
| `?` | `%3F` |
| `=` | `%3D` |
| ` ` (space) | `%20` |

### `REDIS_URL`

Optional Redis connection URL. When provided, enables balance caching, game stats caching, and Socket.IO Redis adapter for horizontal scaling.

```env
# Local Redis
REDIS_URL=redis://localhost:6379

# Production with authentication
REDIS_URL=redis://user:password@redis.example.com:6379
```

The application works without Redis (graceful degradation).

### `NODE_ENV`

Controls environment-specific behavior.

```env
NODE_ENV=production
```

When set to `production`:
- Better Auth sets session cookies with `secure: true` (HTTPS only)
- Express may enable performance optimizations (view caching, etc.)

## Client Variables

Client environment variables are defined in `client/.env`. Vite requires client-side variables to be prefixed with `VITE_`.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `VITE_API_URL` | `http://localhost:5000/api` | No | Base URL of the server API |
| `VITE_SOCKET_URL` | `http://localhost:5000` | No | WebSocket server URL (no `/api` suffix) |

### `VITE_API_URL`

The full URL to the server API, including the `/api` path segment.

```env
# Development
VITE_API_URL=http://localhost:5000/api

# Production
VITE_API_URL=https://yourdomain.com/api
```

### `VITE_SOCKET_URL`

The URL for Socket.IO connections. Does not include the `/api` path.

```env
# Development
VITE_SOCKET_URL=http://localhost:5000

# Production
VITE_SOCKET_URL=https://yourdomain.com
```

**Note**: Vite embeds `VITE_*` variables into the client bundle at build time. Changing these values requires rebuilding the client.

## Template Files

### `server/.env.example`

```env
# Server Configuration
PORT=5000

# Client URL (for CORS)
CLIENT_URL=http://localhost:5173

# Better Auth Configuration
# Generate a strong secret: openssl rand -base64 32
BETTER_AUTH_SECRET=your-secret-key-change-this-in-production
BETTER_AUTH_URL=http://localhost:5000

# Database Configuration
# Format: mysql://username:password@host:port/database
DATABASE_URL=mysql://root:password@localhost:3306/casino

# Redis (optional - for caching and Socket.IO scaling)
# REDIS_URL=redis://localhost:6379
```

### `client/.env.example`

```env
# API URL
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## Security Notes

1. **Never commit `.env` files** -- They are excluded via `.gitignore`. If you accidentally commit one, rotate all secrets immediately and purge the file from git history.
2. **Use `.env.example` as a template** -- Copy it to `.env` and fill in real values. The `.example` files contain only placeholder values and are safe to commit.
3. **Use different secrets per environment** -- Development, staging, and production should each have unique `BETTER_AUTH_SECRET` and database credentials.
4. **Restrict database access** -- Use IP allowlists and dedicated database users with minimal required privileges.
5. **Rotate secrets regularly** -- Rotating `BETTER_AUTH_SECRET` will invalidate all active sessions (existing session tokens will fail verification).
6. **CI/CD secrets** -- When deploying via GitHub Actions, store production environment variables as [GitHub Actions encrypted secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions), not in the repository.

## Quick Setup

```bash
# Server
cp server/.env.example server/.env
# Edit server/.env with your values

# Client
cp client/.env.example client/.env
# Edit client/.env with your values
```

---

## Related Documents

- [Security Overview](./security-overview.md) -- Authentication, authorization, and middleware configuration
- [Deployment Guide](../06-devops/deployment.md) -- Production deployment and environment setup
- [CI/CD Pipeline](../06-devops/ci-cd.md) -- Continuous integration workflow
- [Better Auth Integration](../13-integrations/better-auth-integration.md) -- Detailed Better Auth setup
