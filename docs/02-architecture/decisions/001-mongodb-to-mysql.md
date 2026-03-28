# ADR-001: Migration from MongoDB to MySQL with Drizzle ORM

**Date:** 2025-10-01 (approximate)
**Status:** Accepted
**Deciders:** Development team

---

## Context

The original project plan (`project.md`) specified MongoDB with Mongoose as the data layer. The schema design included collections for users, game sessions, transactions, and system logs modeled as document-oriented data.

During early development, several problems with the document approach became apparent:

1. **Relational data** -- Transactions reference users, game sessions reference users, balance history references both transactions and game sessions, and login rewards reference both users and transactions. These are fundamentally relational patterns that require foreign key integrity.
2. **Financial accuracy** -- Casino balances and transaction amounts need exact decimal arithmetic. MongoDB's default number handling (IEEE 754 doubles) introduces floating-point drift on currency values. MySQL's `DECIMAL(15,2)` type guarantees exact precision.
3. **Query complexity** -- Admin reporting requires joining users to their transactions, game sessions, and balance history. MongoDB's `$lookup` aggregation pipeline is verbose and difficult to optimize compared to SQL joins.
4. **Type safety** -- Mongoose schemas provide runtime validation but do not integrate with TypeScript's type system at compile time.

## Decision

Replace MongoDB and Mongoose with **MySQL** and **Drizzle ORM**.

- Use MySQL as the relational database engine.
- Use Drizzle ORM for type-safe schema definitions, query building, and migrations.
- Define all tables in a single `server/drizzle/schema.ts` file with explicit column types, indexes, and relations.
- Use Drizzle Kit (`drizzle-kit`) for migration generation and application.
- Wrap Drizzle queries in model classes (`server/drizzle/models/`) that expose a Mongoose-like API (`findOne`, `findById`, `create`, `updateById`) to minimize refactoring in route handlers.

## Consequences

### Positive

- **Referential integrity** -- Foreign keys between `users`, `transactions`, `game_sessions`, `balances`, `game_logs`, `login_rewards`, and `messages` are enforced at the database level. Orphaned records are no longer possible.
- **Typed schemas** -- `InferSelectModel` and `InferInsertModel` produce TypeScript types directly from table definitions, eliminating manual type duplication.
- **Exact decimal handling** -- `decimal('amount', { precision: 15, scale: 2 })` ensures no floating-point rounding on currency fields.
- **Efficient joins** -- Admin endpoints can query a user's transactions, game sessions, and balance history with standard SQL joins rather than aggregation pipelines.
- **Migration tooling** -- `drizzle-kit generate` produces SQL migration files that are version-controlled in `server/drizzle/migrations/`. Rollbacks are explicit SQL files rather than ad-hoc scripts.
- **Index definitions** -- Indexes are declared inline in the schema (e.g., `usernameIdx`, `createdAtIdx`) and applied through migrations, making query optimization visible in code review.

### Negative

- **Migration overhead** -- The initial migration required rewriting all data access code. Model wrapper classes were created to maintain backward compatibility with route handlers that used Mongoose-style calls.
- **Documentation drift** -- Some project documentation (`README.md`, `server/README.md`, `.env` template) still references MongoDB/Mongoose or PostgreSQL. These need to be updated (tracked in `PROJECT_REVIEW.md` section 1.2).
- **Connection management** -- MySQL requires explicit connection pool management (`connectDB`/`closeDB` in `server/drizzle/db.ts`) compared to Mongoose's built-in reconnection logic.
- **Enum constraints** -- MySQL enums are defined at the column level and require a migration to add new values (e.g., adding `'landmines'` to `game_type`), whereas MongoDB schema-less documents allowed arbitrary strings.

---

## Related Documents

- [System Architecture](../system-architecture.md) -- overall system layers including the data layer
- [Data Flow](../data-flow.md) -- authentication and transaction data flows
- [Database Schema Reference](../../09-database/) -- full table and column documentation
- [ADR-004: ES Modules over CommonJS](./004-esm-modules.md) -- module system choice that affects Drizzle imports
- `server/drizzle/schema.ts` -- canonical schema definition
- `server/drizzle/db.ts` -- connection pool setup
- `server/drizzle/models/` -- model wrapper classes
- `PROJECT_REVIEW.md` section 1.2 -- documentation mismatch tracking
