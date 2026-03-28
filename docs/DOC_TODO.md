# Documentation TODO

**Last Updated:** 2026-03-28

---

## Completed (Previous Sessions)

- [x] Document game algorithms - House edge calculations, formulas, payout tables
- [x] Update socket events for all handlers - 68+ events across 8 namespaces
- [x] Add OpenAPI/Swagger spec - 24 endpoints, 22 schemas
- [x] Add testing documentation with real examples
- [x] Document Drizzle model methods - 100+ methods across 8 models
- [x] Document chat system
- [x] Add architecture decision records (ADRs) - 6 ADRs
- [x] Add Docker/PM2 setup guides
- [x] Document health check endpoints
- [x] Add contribution guide
- [x] Document client state management
- [x] Add performance documentation
- [x] Add client component library docs
- [x] Add API versioning documentation
- [x] Add internationalization guide
- [x] Add mobile responsiveness notes
- [x] Create developer onboarding walkthrough
- [x] Add changelog

## Completed (Session 2 - 2026-03-28)

- [x] **Fix JWT references** - All docs updated from JWT to Better Auth session-based auth
- [x] **Fix tech stack inaccuracies** - Corrected Axios->fetch, Redux->Context API, version numbers
- [x] **Add ADR-006** - Better Auth migration decision record
- [x] **Mark ADR-002 as superseded** - Points to ADR-006
- [x] **Create 13-integrations section** - Redis, Better Auth, Docker, Socket.IO (4 files)
- [x] **Create 14-ai-agents section** - Claude Code setup, knowledge system, workflows (3 files)
- [x] **Create 15-compliance section** - Responsible gaming, player protection, regulatory (3 files)
- [x] **Update environment variable docs** - BETTER_AUTH_SECRET replaces JWT_SECRET
- [x] **Update security overview** - Better Auth session auth, no JWT references
- [x] **Update deployment docs** - Better Auth env vars in Docker Compose
- [x] **Rebuild meta files** - DOC_MAP, DOC_HEALTH_REPORT, DOC_TODO, portal README

## Completed (Session 3 - 2026-03-28)

- [x] **Review auto-generated docs** - `validation-schemas.md`, `provably-fair.md`, `responsible-gaming.md`, `leaderboard.md` verified against source code. All accurate, no changes needed.
- [x] **Update schema docs for Better Auth tables** - `09-database/schema.md` now documents `session`, `account`, `verification` tables with ownership labels and updated ER diagram (11 tables)
- [x] **Verify Docker setup docs** - `13-integrations/docker-setup.md` cross-checked against actual files. Fixed `.env.docker` section to show real contents, documented JWT_SECRET/variable name mismatches, added `.dockerignore` and Makefile sections.
- [x] **Add Socket.IO rate limiting docs** - Added comprehensive section to `07-security/security-overview.md` covering algorithm, data structures, configuration, integration status (not yet wired into handlers), and Mermaid diagram.
- [x] **Add provably fair verification guide** - Added user-facing guide to `03-features/provably-fair.md` with worked examples, independent JS/Python verification scripts, FAQ, and Mermaid diagram.
- [x] **Separate compliance into implemented vs aspirational** - All 3 files in `15-compliance/` updated with implementation status summary tables, status badges per section, and clear "Not yet implemented" labels.
- [x] **Add WebSocket error handling patterns** - Added ~460 lines to `04-api/socket-events.md` covering error categories, per-namespace events, payload formats, known inconsistencies, and client-side best practices.
- [x] **Add Redis monitoring guide** - Added comprehensive section to `10-operations/monitoring.md` covering key metrics, CLI debugging, troubleshooting, graceful degradation, and Prometheus alerting rules.

## Documentation Maintenance

- [ ] Keep technology version numbers current when dependencies update
- [ ] Update changelog when features are added or changed
- [ ] Re-run health scoring after each major documentation update
- [ ] Verify cross-links after any file rename or restructure

## Known Issues Documented (Not Documentation Tasks)

These are codebase issues surfaced during documentation review. They are tracked here for visibility but are development tasks, not documentation tasks:

- **Provably fair not integrated** - `ProvablyFairService` exists but no game handler imports it. Game outcomes are generated independently.
- **Socket rate limiting not wired** - `socketRateLimit` middleware exists but is not applied to any game handler.
- **`.env.docker` variable name mismatch** - Uses `MYSQL_*` names but compose uses `DB_*` substitutions. Also still has `JWT_SECRET` instead of `BETTER_AUTH_SECRET`.
- **Log cleanup too aggressive** - 30-day default cleanup in `game_logs` would delete compliance-critical self-exclusion events.

---

**Status:** ALL TODO ITEMS COMPLETE. 15/15 sections, 73 files, 29,259+ lines, 97/100 health score.
