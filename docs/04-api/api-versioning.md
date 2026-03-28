# API Versioning

Strategy and migration plan for introducing versioned API endpoints to Platinum Casino.

---

## Current State

All REST endpoints are served under a single, unversioned prefix:

```
/api/auth/*
/api/users/*
/api/games/*
/api/admin/*
/api/rewards/*
```

Route registration in `server/server.ts`:

```typescript
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rewards', loginRewardsRoutes);
```

There is no mechanism to evolve the API without risking breakage for existing clients. Adding versioning will allow the server to ship breaking changes behind a new version prefix while keeping older versions functional during a deprecation window.

---

## Recommended Strategy: URL Prefix Versioning

Use a URL-based version prefix (`/api/v1/`, `/api/v2/`, etc.). This is the recommended approach for Platinum Casino because:

- It is explicit and visible in every request, making debugging straightforward.
- It requires no special client configuration (no custom headers).
- It works naturally with browser dev tools, curl, and API documentation.
- It maps cleanly to Express Router mounting.

### URL-Based vs Header-Based Versioning

| Criteria | URL Prefix (`/api/v1/`) | Header (`Accept-Version: v1`) |
|---|---|---|
| Visibility | Version is obvious in every URL | Hidden in request headers |
| Browser testing | Works directly in the address bar | Requires tools like Postman or curl |
| Caching | CDN/proxy caches can key on URL naturally | Requires `Vary: Accept-Version` header |
| Client complexity | Zero -- just change the base URL | Clients must set a custom header on every request |
| Documentation | Each version gets its own URL namespace | Single URL with header variants |
| Express implementation | Mount separate routers | Middleware to parse and branch on header |
| Socket.IO compatibility | Not directly applicable (sockets use namespaces) | Not directly applicable |

**Verdict:** URL prefix versioning is simpler to implement, simpler to consume, and simpler to document. Header-based versioning is better suited to APIs with many fine-grained versions, which is not the case here.

---

## Migration Plan

### Phase 1: Introduce `/api/v1/*` (Non-Breaking)

Mount the existing route files under both the old and new prefixes simultaneously. No client changes are required yet.

```typescript
// server/server.ts

// Legacy routes (kept temporarily for backward compatibility)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rewards', loginRewardsRoutes);

// Versioned routes (same handlers, new prefix)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/games', gameRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/rewards', loginRewardsRoutes);
```

Since both prefixes point to the same router instances, behavior is identical.

### Phase 2: Update Clients

Update the client-side API service base URL:

```javascript
// client/src/services/api.js (or equivalent)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
```

Update all `fetch`/`axios` calls to use the versioned base URL. Verify that authentication cookies, CORS, and rate limiting all function correctly with the new prefix.

### Phase 3: Deprecate Legacy Prefix

Add deprecation warnings to the unversioned routes:

```typescript
// server/src/middleware/deprecation.ts
import { Request, Response, NextFunction } from 'express';

export function deprecationWarning(sunsetDate: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', sunsetDate);
    res.set('Link', '</api/v1' + req.originalUrl.replace('/api', '') + '>; rel="successor-version"');
    next();
  };
}
```

Apply to legacy routes:

```typescript
app.use('/api/auth', deprecationWarning('2026-09-01'), authRoutes);
app.use('/api/users', deprecationWarning('2026-09-01'), userRoutes);
// ... etc.
```

### Phase 4: Remove Legacy Prefix

After the sunset date, remove the unversioned route registrations entirely. Only `/api/v1/*` remains.

---

## Backward Compatibility

During the migration window (Phases 1-3), both prefixes serve identical responses. To maintain compatibility:

1. **Do not change response shapes** in `/api/v1/` until the legacy prefix is removed.
2. **Log usage of the legacy prefix** to track whether any clients still depend on it.
3. **Set a Sunset header** on legacy routes so automated tools can detect the upcoming removal.
4. **Document the migration** in release notes and in the client README.

When introducing `/api/v2/` later, `/api/v1/` continues to function unchanged. Only the new version contains breaking changes.

---

## Version Deprecation Policy

| Stage | Duration | Action |
|---|---|---|
| Active | Indefinite | Full support, bug fixes, security patches |
| Deprecated | Minimum 6 months | Sunset headers sent, no new features, security patches only |
| Retired | After sunset date | Routes return `410 Gone` for 3 months, then removed entirely |

A version moves from Active to Deprecated only when its successor is stable and clients have been notified. The 6-month minimum gives external consumers and the client application time to migrate.

### `410 Gone` Response

After retirement, removed routes should return a clear error:

```typescript
app.use('/api/v1', (req, res) => {
  res.status(410).json({
    message: 'API v1 has been retired. Please use /api/v2/.',
    documentation: 'https://docs.example.com/api/v2'
  });
});
```

---

## Example Implementation

A clean approach using a version router factory:

```typescript
// server/src/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import gameRoutes from './games.js';
import adminRoutes from './admin.js';
import loginRewardsRoutes from './loginRewards.js';

export function createVersionRouter(): Router {
  const router = Router();

  router.use('/auth', authRoutes);
  router.use('/users', userRoutes);
  router.use('/games', gameRoutes);
  router.use('/admin', adminRoutes);
  router.use('/rewards', loginRewardsRoutes);

  return router;
}
```

```typescript
// server/server.ts
import { createVersionRouter } from './src/routes/index.js';
import { deprecationWarning } from './src/middleware/deprecation.js';

const v1Router = createVersionRouter();

// Current version
app.use('/api/v1', apiLimiter, v1Router);

// Legacy alias (remove after sunset)
app.use('/api', apiLimiter, deprecationWarning('2026-09-01'), v1Router);
```

When v2 is needed, create a separate router with the new handlers:

```typescript
import { createV2Router } from './src/routes/v2/index.js';

const v2Router = createV2Router();
app.use('/api/v2', apiLimiter, v2Router);

// v1 moves to deprecated
app.use('/api/v1', apiLimiter, deprecationWarning('2027-03-01'), v1Router);
```

---

## Socket.IO Versioning

Socket.IO already uses namespace-based separation (`/crash`, `/roulette`, `/wheel`, etc.). If socket event schemas need breaking changes, use a similar pattern:

- `/v1/crash` for the original event schema
- `/v2/crash` for the updated schema

This is independent of REST API versioning and should only be introduced when a breaking socket event change is required.

---

## Related Documents

- [REST API Reference](./rest-api.md) -- current endpoint catalog at `/api/*`
- [Socket Events Reference](./socket-events.md) -- Socket.IO namespace and event documentation
- [Error Codes Reference](./error-codes.md) -- error response format that versioned APIs should follow
- [System Architecture](../02-architecture/system-architecture.md) -- overall server design
- [Coding Standards](../05-development/coding-standards.md) -- Express routing patterns and conventions
- [Roadmap](../11-roadmap/roadmap.md) -- planned feature timeline
