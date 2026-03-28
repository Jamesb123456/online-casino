# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Platinum Casino project. ADRs document significant architectural choices, the context that led to them, and their consequences.

## Format

Each ADR follows a standard structure:

- **Title** -- Short descriptive name prefixed with a sequential number.
- **Status** -- One of: `Proposed`, `Accepted`, `Deprecated`, `Superseded`.
- **Context** -- The forces and constraints that motivated the decision.
- **Decision** -- What was decided and how it is implemented.
- **Consequences** -- Positive and negative outcomes, including trade-offs and known risks.
- **Related Documents** -- Links to other docs, source files, and ADRs for cross-reference.

## Index

| ADR | Title | Status | Summary |
|-----|-------|--------|---------|
| [001](./001-mongodb-to-mysql.md) | MongoDB to MySQL with Drizzle ORM | Accepted | Migrated from MongoDB/Mongoose to MySQL/Drizzle for relational integrity, exact decimal handling, and type-safe queries. |
| [002](./002-jwt-httponly-cookies.md) | JWT in HTTP-Only Cookies | Superseded by [ADR-006](./006-better-auth-migration.md) | Deliver JWT tokens via HTTP-only cookies with secure/sameSite flags instead of Authorization headers, enabling automatic auth for both REST and WebSocket. |
| [003](./003-namespace-per-game.md) | Socket.IO Namespace per Game | Accepted | Each game operates in its own Socket.IO namespace for independent middleware, connection lifecycle, and handler isolation. |
| [004](./004-esm-modules.md) | ES Modules over CommonJS | Accepted (partial) | Full ESM adoption with `"type": "module"` in both packages; three game handlers still need conversion from CommonJS. |
| [005](./005-context-over-redux.md) | React Context API over Redux | Accepted | Use Context API for auth and toast state instead of Redux; sufficient for current needs, may revisit for complex game state. |
| [006](./006-better-auth-migration.md) | Migration from Custom JWT to Better Auth | Accepted (supersedes ADR-002) | Replaced custom JWT auth with Better Auth for session-based authentication, adding session revocation, plugin ecosystem, and reduced custom code. |

## When to Write an ADR

Create a new ADR when making a decision that:

- Changes the technology stack (database, framework, library).
- Alters the system's structural patterns (communication protocols, module boundaries, deployment topology).
- Introduces a convention that all developers must follow (coding standards, branching strategy).
- Has significant trade-offs that future developers need to understand.

## Related Documents

- [System Architecture](../system-architecture.md) -- high-level system overview
- [Socket.IO Architecture](../socket-architecture.md) -- real-time communication design
- [Data Flow](../data-flow.md) -- request and event flow diagrams
- [Documentation TODO](../../DOC_TODO.md) -- outstanding documentation tasks
