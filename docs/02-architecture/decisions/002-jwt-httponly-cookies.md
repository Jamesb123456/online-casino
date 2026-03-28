# ADR-002: JWT Authentication via HTTP-Only Cookies

**Date:** 2025-09-15 (approximate)
**Status:** Superseded by [ADR-006: Migration from Custom JWT to Better Auth](./006-better-auth-migration.md)
**Deciders:** Development team

---

## Context

Platinum Casino requires authentication for two transport layers:

1. **REST API** -- Express routes for login, registration, profile management, admin operations, and game history.
2. **WebSocket** -- Socket.IO connections for real-time game state in crash, roulette, blackjack, plinko, wheel, and landmines namespaces.

The two common approaches for JWT delivery are:

- **Authorization header** (`Bearer <token>`) -- The client stores the token (typically in `localStorage` or `sessionStorage`) and attaches it to every request manually.
- **HTTP-only cookie** -- The server sets the token in a cookie with `httpOnly`, `secure`, and `sameSite` flags. The browser sends it automatically on every same-origin request.

Key constraints:

- The casino handles virtual currency balances. A stolen token allows an attacker to place bets and drain a user's balance.
- Socket.IO clients need to authenticate on connection. The `handshake.headers.cookie` header is sent automatically by the browser during the WebSocket upgrade.
- The frontend is a React SPA served from the same origin (or a configured `CLIENT_URL`), so cross-origin cookie issues are manageable with `sameSite: 'lax'`.

## Decision

Use **HTTP-only cookies** to deliver JWT tokens. The cookie is set on login and registration, read on every REST request and Socket.IO handshake, and cleared on logout.

Cookie configuration (from `server/routes/auth.ts`):

```typescript
res.cookie('authToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
});
```

Socket.IO authentication middleware (from `server/middleware/socket/socketAuth.ts`):

1. Parse `socket.handshake.headers.cookie` using the `cookie` package.
2. Extract the `authToken` value.
3. Verify the JWT with `jwt.verify()`.
4. Look up the user in the database to confirm they still exist and are active.
5. Attach the user object to `socket.user` for downstream handlers.
6. Fall back to `socket.handshake.auth.token` if cookies are absent (programmatic clients).

## Consequences

### Positive

- **XSS protection** -- The `httpOnly` flag prevents JavaScript from reading the token. Even if an XSS vulnerability exists in the React app, the attacker cannot exfiltrate the JWT.
- **Automatic transmission** -- The browser sends the cookie on every HTTP request and WebSocket upgrade without client-side code to manage headers. This eliminates a class of bugs where the token is forgotten or mis-attached.
- **Unified auth path** -- Both REST routes (`req.cookies.authToken`) and Socket.IO middleware (`socket.handshake.headers.cookie`) read from the same source. There is one token, one expiration, and one revocation path.
- **Secure defaults in production** -- The `secure: true` flag (in production) ensures the cookie is only sent over HTTPS, preventing token interception on plain HTTP.
- **SameSite protection** -- `sameSite: 'lax'` provides baseline CSRF protection by restricting cross-origin POST requests from sending the cookie.

### Negative

- **CSRF surface** -- While `sameSite: 'lax'` mitigates most CSRF vectors, it does not block cross-origin GET requests. State-changing operations must use POST/PUT/DELETE (which they do) to remain protected. A dedicated CSRF token could be added for defense in depth.
- **Cookie size** -- JWTs containing `userId`, `username`, and `role` are relatively small (~200 bytes), but the cookie is sent on every request, including static asset requests if not scoped to `/api`. Currently the cookie path defaults to `/`, which means it is included on all requests.
- **Cross-origin complexity** -- If the client is ever served from a different domain than the API, the cookie configuration would need `sameSite: 'none'` and `secure: true`, plus explicit CORS `credentials: true` (already configured).
- **Fallback path** -- The Socket.IO middleware includes a fallback to `socket.handshake.auth.token` for programmatic clients that cannot send cookies. This dual-path auth adds code complexity and must be secured equally.

---

## Related Documents

- [Data Flow](../data-flow.md) -- authentication sequence diagram
- [System Architecture](../system-architecture.md) -- API layer overview
- [Security Documentation](../../07-security/) -- security policies and hardening
- [ADR-003: Namespace per Game](./003-namespace-per-game.md) -- how socket auth applies per namespace
- `server/routes/auth.ts` -- login, register, logout, and verify endpoints
- `server/middleware/socket/socketAuth.ts` -- Socket.IO authentication middleware
- `server/middleware/auth.ts` -- Express route authentication middleware
