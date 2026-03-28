# Common Issues

## Server Won't Start

### ESM Conversion Errors

**Symptom:** Error messages containing `require is not defined in ES module scope` or `module is not defined in ES module scope`.

**Cause:** The project uses `"type": "module"` in `package.json`, which enforces ES module syntax. Some game handler files still use CommonJS (`require()` and `module.exports`).

**Known files needing conversion:**
- `server/src/socket/landminesHandler.ts`
- `server/src/socket/plinkoHandler.ts`
- `server/src/socket/wheelHandler.ts`

**Fix:**
1. Replace all `require()` calls with `import` statements
2. Replace `module.exports` with `export default`
3. Rebuild the server

```bash
cd server
npm run build
```

**Workaround:** If you need the server running immediately, the affected handlers are already commented out in `server.ts`. The server will start with only Crash and Roulette games active.

### Missing Environment Variables

**Symptom:** Server crashes on startup or features fail silently.

**Cause:** Missing or misconfigured `.env` file.

**Fix:** Ensure `server/.env` contains all required variables:

```env
PORT=5000
BETTER_AUTH_SECRET=your_generated_secret_here
BETTER_AUTH_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173
DATABASE_URL=mysql://username:password@host:port/database_name
```

Generate a strong auth secret:
```powershell
# PowerShell (Windows)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

```bash
# Linux/macOS
openssl rand -base64 64
```

### Port Already in Use

**Symptom:** `Error: listen EADDRINUSE :::5000`

**Fix:** Kill the process using port 5000 or change the port in `.env`.

```bash
# Find process on port 5000 (Linux/macOS)
lsof -i :5000

# Find process on port 5000 (Windows PowerShell)
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

## Database Connection Errors

### MySQL Not Running

**Symptom:** `ECONNREFUSED` or `Connection refused` errors on startup.

**Fix:** Verify MySQL is running:

```bash
# Check MySQL service status (Linux)
sudo systemctl status mysql

# Check MySQL service status (Windows PowerShell)
Get-Service -Name MySQL*
```

### Invalid DATABASE_URL Format

**Symptom:** `Invalid URL` or connection parsing errors.

**Required format:**
```
mysql://username:password@host:port/database_name
```

**Common mistakes:**
- Missing protocol prefix (`mysql://`)
- Wrong port (MySQL default is 3306)
- Spaces or unencoded special characters in the password

### Special Characters in Password

**Symptom:** `URI malformed` or authentication failures when the database password contains characters like `<`, `>`, `+`, `@`, or `#`.

**Fix:** URL-encode the password. The project includes a helper script:

```bash
cd server
node encode-db-password.js
```

Then update the `DATABASE_URL` in `.env` with the encoded output. For example, `<OTN+Df6p` becomes `%3COTN%2BDf6p`.

### Database Does Not Exist

**Symptom:** `Unknown database 'casino'`

**Fix:** Create the database and run migrations:

```sql
CREATE DATABASE casino;
```

```bash
cd server
npm run db:generate
npm run db:migrate
npm run seed
```

## Games Not Loading

### Socket Handler Not Initialized

**Symptom:** Game page connects but no events are received. The game appears frozen or shows a loading state indefinitely.

**Cause:** The game's socket handler is not initialized in `server.ts`. This applies to Blackjack (TODO comment), Landmines, Plinko, and Wheel (ESM conversion needed).

**Diagnosis:** Check the server console for connection logs. You should see messages like:
```
LoggingService: crash namespace_connection { socketId: '...' }
```

If the namespace connection log appears but no game events follow, the handler is not wired.

**Fix:** See the ESM conversion section above, or check `server.ts` for commented-out handler initialization code.

### Namespace Mismatch

**Symptom:** Socket connection fails with no error, or the client connects to the wrong namespace.

**Cause:** The client-side socket URL does not match the server namespace.

**Verification:** Confirm that the client connects to the correct namespace:
```javascript
// Client should use:
const socket = io('http://localhost:5000/crash', { ... });
// Not:
const socket = io('http://localhost:5000', { ... }); // Wrong - this is the main namespace
```

Server namespaces defined in `server.ts`: `/crash`, `/roulette`, `/blackjack`, `/landmines`, `/plinko`, `/wheel`.

## Authentication Failures

### Session Authentication Errors

**Symptom:** All authenticated requests return 401 or "No valid session" errors.

**Cause:** The `BETTER_AUTH_SECRET` changed, session expired, or cookies are not being sent.

**Fix:**
1. Clear browser cookies (the session token is in an HTTP-only cookie)
2. Restart the server
3. Log in again
4. Verify `BETTER_AUTH_SECRET` in `.env` has not changed since the session was created

### Expired Session

**Symptom:** 401 responses after being logged in for a while (session lifetime is 24 hours).

**Fix:** Log out and log back in to get a fresh session. Better Auth automatically refreshes sessions accessed within their lifetime (every 1 hour).

### Missing Cookie

**Symptom:** Authentication works in some browsers but not others, or fails after deploying to a different domain.

**Cause:** HTTP-only cookies require matching domain and CORS configuration.

**Fix:** Verify these settings:
1. `CLIENT_URL` in `.env` matches the actual client URL (including port)
2. CORS credentials are enabled (they are by default in `server.ts`)
3. The client sends requests with `credentials: 'include'`

## Build Errors

### TypeScript Compilation Failures

**Symptom:** `npm run build` fails with type errors.

**Fix:**
1. Clear the build output and rebuild:
   ```bash
   cd server
   rm -rf dist/
   npm run build
   ```

2. If errors persist, check for missing type definitions:
   ```bash
   npm install
   ```

3. Review the specific TypeScript errors. Common causes:
   - Missing `.js` extension on local imports (required for ESM)
   - Type mismatches after schema changes
   - Missing `@types/*` packages

### Client Build Failures

**Symptom:** `npm run build` in the client directory fails.

**Fix:**
```bash
cd client
rm -rf node_modules dist
npm install
npm run build
```

Check for unused imports or variables that Vite treats as errors in production builds.

## Socket Connection Refused

### CORS Configuration

**Symptom:** Browser console shows `Access to XMLHttpRequest... has been blocked by CORS policy` or WebSocket connection fails.

**Cause:** The `CLIENT_URL` environment variable does not match the URL the client is served from.

**Fix:** Update `server/.env`:
```env
CLIENT_URL=http://localhost:5173
```

The CORS origin is configured in `server.ts`:
```typescript
cors: {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}
```

Make sure the value matches exactly -- including protocol, hostname, and port. No trailing slash.

### Firewall or Network Issues

**Symptom:** Connection timeout errors. The client cannot reach the server at all.

**Fix:**
- Verify the server is running and listening on the expected port
- Check firewall rules allow traffic on port 5000 (or your configured port)
- If server and client are on different machines, ensure `CLIENT_URL` uses the correct network address (not `localhost`)

## Rate Limiting (429 Errors)

### API Rate Limit

**Symptom:** `429 Too Many Requests` on API calls.

**Cause:** The global API rate limiter allows 120 requests per minute on `/api` endpoints.

**Fix:** Wait 1 minute for the window to reset. If you are hitting this during development, you can temporarily increase the limit in `server.ts`:

```typescript
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // Increase this value for development
});
```

### Auth Rate Limit (Planned)

When auth-specific rate limiting is implemented, login and registration endpoints will be limited to 5 attempts per 15-minute window. Wait 15 minutes if locked out, or restart the server during development.

## Migration Failures

### Generating Migrations

**Symptom:** Schema changes are not reflected in the database.

**Fix:** Generate a new migration from the current schema, then apply it:

```bash
cd server
npm run db:generate
npm run db:migrate
```

### Migration Conflicts

**Symptom:** Migration fails with "table already exists" or "column already exists" errors.

**Fix:** Check the migration files in `server/drizzle/migrations/` and compare with the actual database state. You may need to:
1. Manually resolve the conflict in the migration SQL
2. Or drop and recreate the database (development only):
   ```sql
   DROP DATABASE casino;
   CREATE DATABASE casino;
   ```
   Then re-run migrations and seed:
   ```bash
   npm run db:migrate
   npm run seed
   ```

### Seed Data

**Symptom:** No users, games, or statistics after a fresh database setup.

**Fix:**
```bash
cd server
npm run seed
```

This creates default users (admin and player accounts) and initial game statistics.

## Related Documents

- [FAQ](./faq.md)
- [Logging](../10-operations/logging.md)
- [Monitoring](../10-operations/monitoring.md)
- [Current Status](../11-roadmap/current-status.md)
- [Development Roadmap](../11-roadmap/roadmap.md)
