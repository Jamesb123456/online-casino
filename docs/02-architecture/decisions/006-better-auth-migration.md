# ADR-006: Migration from Custom JWT to Better Auth

**Date:** 2026-03 (approximate)
**Status:** Accepted (supersedes [ADR-002](./002-jwt-httponly-cookies.md))
**Deciders:** Development team

---

## Context

Platinum Casino originally used a custom JWT authentication system (documented in [ADR-002](./002-jwt-httponly-cookies.md)). Tokens were issued on login/registration, stored in HTTP-only cookies, and verified by hand-written middleware for both Express routes and Socket.IO connections.

While functional, the custom implementation carried several limitations:

1. **Maintenance burden.** Every auth concern -- token generation, cookie configuration, session expiration, password hashing, user creation hooks -- was hand-rolled code that the team had to maintain and secure. Any change to session lifetime, cookie flags, or token claims required coordinated updates across multiple files.

2. **No session revocation.** JWTs are stateless. Revoking a user's access (e.g., banning or deactivating an account) required waiting for token expiration or adding a token blacklist, which was not implemented.

3. **Missing features.** The custom system lacked built-in support for session management (listing active sessions, forced logout), account linking, email verification flows, admin impersonation, and other features that mature auth libraries provide out of the box.

4. **Security surface.** Rolling custom auth increases the risk of subtle security bugs -- incorrect cookie flags, timing-safe comparison omissions, or session fixation. A well-maintained library with community review reduces this risk.

5. **Dual auth paths.** The Socket.IO middleware had a fallback path (`socket.handshake.auth.token`) alongside cookie-based auth, adding complexity and a second verification code path to audit.

## Decision

Adopt **Better Auth** (`better-auth` package) as the authentication framework, replacing the custom JWT implementation entirely. The migration uses session-based authentication instead of stateless JWT tokens.

### Configuration

Better Auth is configured in `server/lib/auth.ts` with:

- **Drizzle adapter** for MySQL, pointing at the existing `users` table via `schema.users`.
- **Email-and-password** authentication with bcrypt (cost factor 12) for password hashing and verification, preserving compatibility with existing password hashes.
- **Username plugin** (`better-auth/plugins`) with 3-30 character limits, enabling username-based login alongside email.
- **Admin plugin** (`better-auth/plugins`) with `defaultRole: "user"` and `adminRoles: ["admin"]`, replacing the manual role check in the old auth middleware.
- **Session configuration:** 24-hour session lifetime, 1-hour refresh interval, and 5-minute cookie caching for reduced database lookups on rapid requests.
- **Database hooks:** On user creation, the `after` hook sets the initial balance to 1,000 and creates a corresponding `balances` record -- logic previously embedded in the registration route handler.
- **Trusted origins:** Configured from `CLIENT_URL` environment variable (default `http://localhost:5173`).
- **Serial ID generation:** `advanced.database.generateId: "serial"` to match the existing auto-increment integer primary keys.

### Key Changes

| Before (Custom JWT) | After (Better Auth) |
|---|---|
| `jsonwebtoken` package for token signing/verification | `better-auth` package with session-based auth |
| Manual `res.cookie('authToken', token, {...})` | Better Auth manages session cookies automatically |
| `jwt.verify()` in Express middleware | `auth.api.getSession({ headers })` in middleware |
| `jwt.verify()` + cookie parsing in Socket.IO middleware | `auth.api.getSession({ headers })` with cookie forwarding |
| Custom user creation logic in route handler | Better Auth handles signup with database hooks for post-creation logic |
| Stateless JWT (no revocation) | Server-side sessions stored in `session` table (revocable) |
| `socket.handshake.auth.token` fallback | Removed; cookies-only for Socket.IO auth |
| No session listing or management | Better Auth provides session management API |

### Route Mounting Order

The server registers auth routes in a specific order in `server/server.ts`:

1. **CORS middleware** -- must come before Better Auth handler.
2. **Custom auth routes** (`/api/auth`) -- e.g., `/api/auth/refresh-session` for returning fresh user data; registered first so they take priority.
3. **Better Auth catch-all** (`/api/auth/*`) via `toNodeHandler(auth)` -- handles sign-up, sign-in, sign-out, session management, and all plugin endpoints.
4. **`express.json()` middleware** -- must come after Better Auth, which parses its own request bodies.

### REST Middleware

The `authenticate` middleware (`server/middleware/auth.ts`) now calls `auth.api.getSession()` with the request headers converted via `fromNodeHeaders()`. It attaches the same `{ userId, username, role }` shape to `req.user` that all downstream route handlers expect, so no route handler changes were needed.

### Socket.IO Middleware

The `socketAuth` middleware (`server/middleware/socket/socketAuth.ts`) constructs a `Headers` object from `socket.handshake.headers.cookie` and passes it to `auth.api.getSession()`. It attaches `{ userId, username, role, balance, isActive }` to `socket.user`, preserving the interface that all six game handlers depend on. The old `socket.handshake.auth.token` fallback was removed.

### Client Integration

The client uses `better-auth/react` (`client/src/lib/auth-client.js`) with:

- `usernameClient()` plugin for username-based sign-up and sign-in.
- `adminClient()` plugin for admin-specific API calls.
- `baseURL` derived from `VITE_API_URL`, stripped of the `/api` suffix.

### New Database Tables

Better Auth requires three additional tables, created by the migration script:

- **`session`** -- server-side session storage with token, user reference, expiry, IP address, and user agent.
- **`account`** -- credential and OAuth provider records; stores the hashed password for credential-based auth.
- **`verification`** -- email verification and password reset tokens.

### Schema Changes to `users` Table

The migration added several columns to the existing `users` table to satisfy Better Auth's user model:

- `name` (VARCHAR 255) -- Better Auth's required display name field.
- `email` (VARCHAR 255, unique) -- required by Better Auth; existing users received generated emails (`username@platinum.local`).
- `email_verified` (BOOLEAN) -- set to `TRUE` for migrated users.
- `image` (TEXT) -- optional avatar URL field.
- `display_username` (VARCHAR 30) -- Better Auth username plugin field.
- `banned`, `ban_reason`, `ban_expires` -- admin plugin fields for user banning.
- `role` changed from ENUM to VARCHAR(20) -- required for Better Auth's admin plugin flexibility.
- `password_hash` made nullable -- Better Auth stores passwords in the `account` table instead.

## Consequences

### Positive

- **Reduced custom auth code.** The registration, login, and logout route handlers were replaced by Better Auth's built-in endpoints. Password hashing, cookie management, and session lifecycle are handled by the library.
- **Session revocation.** Sessions are stored server-side in the `session` table. Banning a user or deleting their sessions takes effect immediately, without waiting for token expiration.
- **Cookie caching.** The 5-minute cookie cache (`session.cookieCache`) reduces database queries on high-frequency requests (common in real-time casino games), while still allowing session changes to propagate within a bounded window.
- **Plugin ecosystem.** The username and admin plugins provide pre-built functionality for username-based auth and role management. Future needs (OAuth providers, two-factor auth, magic links) can be added via plugins rather than custom code.
- **Consistent auth interface.** Both REST and Socket.IO middleware call the same `auth.api.getSession()` method, eliminating the divergent verification code paths from the JWT implementation.
- **Admin capabilities.** The admin plugin provides user banning, impersonation, and role management endpoints that were previously unimplemented.

### Negative

- **New dependency.** The project now depends on `better-auth`, a third-party package. Updates, breaking changes, or abandonment of the library would require migration effort. This is mitigated by Better Auth's active maintenance and the fact that the auth interface (`getSession`) is wrapped behind the project's own middleware.
- **Learning curve.** Developers need to understand Better Auth's plugin system, database adapter, and route handling conventions. The non-obvious route ordering requirement (custom routes before catch-all, Better Auth before `express.json()`) is a source of potential bugs.
- **Migration complexity.** Existing users required a data migration script (`server/scripts/migrateToBetterAuth.ts`) to populate new columns, generate placeholder emails, and create `account` records with their existing password hashes. New deployments still need to run this script if upgrading from the JWT-based version.
- **Generated emails.** Existing users without real email addresses received `username@platinum.local` placeholders. If email-based features (password reset, email verification) are added later, these users will need to update their email addresses.
- **Session table growth.** Unlike stateless JWTs, server-side sessions accumulate in the database. Expired session cleanup must be handled (Better Auth handles this automatically, but it adds database write load).

---

## Migration Details

The migration from custom JWT to Better Auth is handled by `server/scripts/migrateToBetterAuth.ts`. The script performs five steps:

1. **Alter `users` table** -- adds Better Auth columns (`name`, `email`, `email_verified`, `image`, `display_username`, `banned`, `ban_reason`, `ban_expires`) and modifies `role` to VARCHAR and `password_hash` to nullable. Uses `IF NOT EXISTS` / error suppression for idempotency.
2. **Create `session` table** -- with token, user reference, expiry, IP, user agent, and impersonation fields.
3. **Create `account` table** -- with provider, tokens, and password fields.
4. **Create `verification` table** -- for email verification and password reset flows.
5. **Migrate existing users** -- sets `name` and `display_username` to the existing `username`, generates `username@platinum.local` emails, and creates `account` records with `providerId: 'credential'` containing the existing password hash.

Run the migration:

```bash
cd server
node --loader ts-node/esm scripts/migrateToBetterAuth.ts
```

The script is idempotent -- it skips columns, tables, and account records that already exist.

---

## Related Documents

- [ADR-002: JWT in HTTP-Only Cookies](./002-jwt-httponly-cookies.md) -- the previous auth approach, now superseded
- [ADR-003: Namespace per Game](./003-namespace-per-game.md) -- how socket auth middleware applies per namespace
- [System Architecture](../system-architecture.md) -- API layer overview
- [Data Flow](../data-flow.md) -- authentication sequence diagram (may need updating)
- [Security Documentation](../../07-security/) -- security policies and hardening
- `server/lib/auth.ts` -- Better Auth configuration
- `server/middleware/auth.ts` -- Express route authentication middleware
- `server/middleware/socket/socketAuth.ts` -- Socket.IO authentication middleware
- `server/routes/auth.ts` -- custom auth routes (registered before Better Auth catch-all)
- `server/scripts/migrateToBetterAuth.ts` -- data migration script
- `client/src/lib/auth-client.js` -- client-side Better Auth setup
