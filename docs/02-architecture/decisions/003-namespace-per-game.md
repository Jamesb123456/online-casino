# ADR-003: Socket.IO Namespace per Game

**Date:** 2025-09-20 (approximate)
**Status:** Accepted
**Deciders:** Development team

---

## Context

Platinum Casino supports multiple real-time games: crash, roulette, blackjack, plinko, wheel, and landmines. Each game has distinct event schemas, tick rates, and lifecycle requirements:

- **Crash** runs a global round with a rising multiplier that all connected players observe. It needs a server-side game loop that broadcasts to all participants.
- **Roulette** runs timed betting rounds followed by a spin result broadcast.
- **Blackjack** is per-player with individual hand state.
- **Plinko** and **Wheel** are single-player games resolved per bet.
- **Landmines** is a progressive-reveal game with per-session state.

Socket.IO offers two isolation mechanisms:

1. **Rooms** within the default namespace -- Clients join named rooms (`socket.join('crash')`). All events flow through a single namespace, and the server must route events to the correct room manually.
2. **Namespaces** -- Each game gets its own namespace (`io.of('/crash')`). Connections, middleware, and event handlers are fully independent.

## Decision

Use a **dedicated Socket.IO namespace for each game**. The namespaces are defined in `server/server.ts`:

| Namespace     | Game       |
|---------------|------------|
| `/crash`      | Crash      |
| `/roulette`   | Roulette   |
| `/blackjack`  | Blackjack  |
| `/plinko`     | Plinko     |
| `/wheel`      | Wheel      |
| `/landmines`  | Landmines  |

Each namespace applies the `socketAuth` middleware independently via `namespace.use(socketAuth)` and registers its own `connection` event handler.

Game handlers are loaded via dynamic `import()` calls to avoid loading unused game logic at startup.

## Consequences

### Positive

- **Independent middleware** -- Each namespace applies `socketAuth` separately. If a game needs additional middleware in the future (e.g., rate limiting bets, anti-cheat validation), it can be added to that namespace without affecting others.
- **Handler isolation** -- The crash handler manages a global game loop with timers and broadcast events. This logic is completely separate from blackjack's per-player hand management. There is no risk of event name collisions (e.g., both games using a `'result'` event).
- **Connection lifecycle** -- A player connecting to `/crash` does not receive roulette events. If the crash namespace encounters an error and disconnects clients, roulette connections are unaffected.
- **Monitoring granularity** -- Server logs include the namespace in connection/disconnection events, making it straightforward to track per-game connection counts and debug issues in a specific game.
- **Scalable architecture** -- If a game needs to be moved to a separate server instance (e.g., crash becomes high-traffic), the namespace can be proxied to a dedicated process with minimal client-side changes (just updating the namespace URL).

### Negative

- **Connection overhead** -- Each namespace requires a separate WebSocket connection (or at minimum a separate multiplexed channel). A player who plays crash and then switches to roulette creates two connections. The Socket.IO client library handles multiplexing over a single transport, but each namespace still has its own handshake and authentication roundtrip.
- **Authentication per namespace** -- The `socketAuth` middleware runs on every namespace connection. This means a player connecting to three games will have their JWT verified and their user record fetched from the database three times. This could be optimized with a shared auth cache.
- **Handler initialization patterns differ** -- The crash handler is initialized once at the namespace level (it attaches its own `connection` listener). The roulette handler is initialized per connection inside the `connection` callback. This inconsistency exists because the crash game manages global state (the current round) while roulette initializes per-player state. This should be documented and potentially standardized.
- **ESM conversion required** -- Some handlers (landmines, plinko, wheel) still use `module.exports` (CommonJS) and are currently disabled with TODO comments. They need to be converted to ES module `export default` before they can be loaded via dynamic `import()`. See ADR-004.

---

## Related Documents

- [Socket.IO Architecture](../socket-architecture.md) -- namespace diagram and event flow
- [Data Flow](../data-flow.md) -- real-time game data flow
- [ADR-002: JWT HTTP-Only Cookies](./002-jwt-httponly-cookies.md) -- how authentication works in socket middleware
- [ADR-004: ES Modules over CommonJS](./004-esm-modules.md) -- module system that affects handler loading
- `server/server.ts` -- namespace definitions and handler initialization
- `server/middleware/socket/socketAuth.ts` -- shared authentication middleware
- `server/src/socket/crashHandler.ts` -- example of namespace-level handler
- `server/src/socket/rouletteHandler.ts` -- example of per-connection handler
