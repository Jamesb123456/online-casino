# ADR-004: ES Modules over CommonJS

**Date:** 2025-09-15 (approximate)
**Status:** Accepted (partially implemented)
**Deciders:** Development team

---

## Context

The project uses TypeScript on the server and JSX on the client. Both need a module system to resolve imports and exports. The two options in the Node.js ecosystem are:

1. **CommonJS (CJS)** -- `require()` / `module.exports`. The historical Node.js default. Synchronous module loading.
2. **ES Modules (ESM)** -- `import` / `export`. The JavaScript language standard (ES2015+). Asynchronous module loading. Supported natively in Node.js 14+ and all modern browsers.

The project's dependencies have varying module support:

- **Drizzle ORM** -- Fully ESM-compatible, and its documentation uses `import` syntax exclusively.
- **Socket.IO** -- Provides both CJS and ESM entry points.
- **Express** -- CJS internally but importable via ESM with Node.js module interop.
- **Vite** (client bundler) -- ESM-native; it requires `"type": "module"` in the client `package.json`.

## Decision

Adopt **ES Modules** as the standard module system for both client and server.

Configuration:

- Both `client/package.json` and `server/package.json` set `"type": "module"`.
- TypeScript is configured to emit ESM-compatible output.
- All new files use `import`/`export` syntax.
- Dynamic `import()` is used in `server/server.ts` to load game handlers at runtime, enabling lazy initialization and error isolation per handler.

Example from `server/server.ts`:

```typescript
import('./src/socket/crashHandler.js')
  .then((mod: any) => {
    const init = mod?.default || mod;
    if (typeof init === 'function') init(crashNamespace);
  })
  .catch((err) => LoggingService.logSystemEvent(
    'crash_handler_init_failed', { error: String(err) }, 'error'
  ));
```

## Consequences

### Positive

- **Modern standard** -- ES Modules are the official JavaScript module system. New libraries increasingly ship ESM-only. Adopting ESM now avoids future compatibility issues.
- **Static analysis** -- `import`/`export` declarations are statically analyzable, enabling better tree-shaking, IDE autocompletion, and TypeScript type inference compared to `require()` calls.
- **Vite compatibility** -- The client uses Vite, which is built around ESM. Having `"type": "module"` in the client `package.json` ensures seamless integration.
- **Top-level await** -- ESM enables `await` at the module top level, useful for async initialization (database connections, configuration loading).
- **Dynamic imports for isolation** -- Loading game handlers via `import()` means a syntax error or missing dependency in one handler does not crash the entire server. The `.catch()` handler logs the failure and the server continues running other games.

### Negative

- **File extension requirement** -- ESM in Node.js requires `.js` extensions in import paths, even when the source files are `.ts`. This is a common source of confusion (e.g., `import UserModel from '../drizzle/models/User.js'` refers to a `.ts` source file).
- **Incomplete migration** -- Three game handlers still use `module.exports` (CommonJS):
  - `server/src/socket/wheelHandler.ts`
  - `server/src/socket/plinkoHandler.ts`
  - `server/src/socket/landminesHandler.ts`

  These handlers are currently disabled in `server/server.ts` with `// TODO: Temporarily disabled - needs ESM conversion` comments. They cannot be loaded via dynamic `import()` until converted to `export default`.
- **Mixed module interop** -- Some dependencies (e.g., `cookie`, `bcryptjs`) are CJS-only packages. Node.js handles interop transparently for default exports, but named exports from CJS modules sometimes require workarounds.
- **Tooling friction** -- Some development tools (e.g., certain test runners, linting configurations) have incomplete ESM support and may require additional configuration flags.

---

## Related Documents

- [System Architecture](../system-architecture.md) -- technology stack overview
- [ADR-003: Namespace per Game](./003-namespace-per-game.md) -- dynamic import pattern for game handlers
- [ADR-001: MongoDB to MySQL](./001-mongodb-to-mysql.md) -- Drizzle ORM requires ESM imports
- `server/package.json` -- `"type": "module"` configuration
- `client/package.json` -- `"type": "module"` configuration
- `server/server.ts` -- dynamic import examples
- `PROJECT_REVIEW.md` section 3.2 -- mixed module systems issue tracking
