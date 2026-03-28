# Legacy Documents Index

This index catalogs the root-level planning documents from early development. These files remain at the repository root and have **not** been moved. This document serves as a reference guide explaining what each file covers and whether its content is still current.

---

## Document Inventory

### ACTION_PLAN.md

| Field | Value |
|-------|-------|
| **Location** | `/ACTION_PLAN.md` (repository root) |
| **Created** | October 2025 |
| **Purpose** | Comprehensive development action plan organizing all remaining work into prioritized task groups |
| **Content** | Multi-phase task list covering ESM conversion, game handler fixes, logging improvements, security hardening, Docker/PM2 setup, Redis caching, and testing infrastructure |
| **Relevance** | Partially outdated |

**Details:** The action plan was written immediately after the MongoDB-to-MySQL migration and before the current documentation system existed. Many Phase 1 items (ESM conversion of crash and roulette handlers) have been completed. The overall task structure has been superseded by [docs/11-roadmap/roadmap.md](../11-roadmap/roadmap.md), which provides updated timelines, dependency chains, and success criteria. However, some specific task details (file paths, exact code changes needed) may still be useful as implementation reference.

**What was completed from this plan:**
- Crash handler ESM conversion
- Roulette handler ESM conversion
- LoggingService implementation
- Rate limiting configuration
- Drizzle ORM migration
- CI pipeline setup

**What remains open:**
- ESM conversion for Landmines, Plinko, Wheel (tracked in roadmap Phase 1)
- Blackjack handler wiring (tracked in roadmap Phase 1)
- Docker and PM2 setup (tracked in roadmap Phase 4)
- Redis integration (tracked in roadmap Phase 5)

---

### QUICK_FIXES.md

| Field | Value |
|-------|-------|
| **Location** | `/QUICK_FIXES.md` (repository root) |
| **Created** | October 2025 |
| **Purpose** | Checklist of small, quick-win fixes that could be done independently |
| **Content** | Short list of items including console.log cleanup, error handling improvements, unused import removal, and minor UI fixes |
| **Relevance** | Partially outdated |

**Details:** This document was a companion to ACTION_PLAN.md, listing tasks that could be tackled in under 30 minutes each. Some items (like adding Morgan HTTP logging) have been completed. The remaining quick fixes are now tracked as part of Phase 2 tasks in the roadmap. The specific file/line references may be outdated due to code changes since October 2025.

---

### FIXES_NEEDED.md

| Field | Value |
|-------|-------|
| **Location** | `/FIXES_NEEDED.md` (repository root) |
| **Created** | October 2025 |
| **Purpose** | ESM conversion tracker listing every file that needed migration from CommonJS to ES Modules |
| **Content** | File-by-file checklist of `require()` to `import` conversions needed after the project switched to `"type": "module"` |
| **Relevance** | Mostly outdated |

**Details:** This document was created during the MongoDB-to-MySQL migration when the project also switched to ES Modules. Most server files have been converted. The remaining ESM issues (Landmines, Plinko, Wheel handlers) are tracked in [docs/11-roadmap/current-status.md](../11-roadmap/current-status.md) with more current detail. The file-level checklist format has been superseded by the per-handler status tables in the current status document.

---

### PROJECT_REVIEW.md

| Field | Value |
|-------|-------|
| **Location** | `/PROJECT_REVIEW.md` (repository root) |
| **Created** | October 2025 |
| **Purpose** | Comprehensive code review of the entire project, identifying issues, inconsistencies, and improvement opportunities |
| **Content** | Multi-section review covering: server architecture, database layer, authentication, game handlers, client structure, security posture, logging, error handling, and code quality. Includes severity ratings and specific code references. |
| **Relevance** | Partially outdated |

**Details:** This was the most thorough of the root documents, providing a snapshot of every aspect of the codebase at a point in time. Many findings have been addressed (MongoDB references removed, LoggingService implemented, auth rate limiting added). The document remains valuable as a historical audit but should not be used as a current issue tracker. Current issues are maintained in [docs/11-roadmap/current-status.md](../11-roadmap/current-status.md) and [docs/12-troubleshooting/common-issues.md](../12-troubleshooting/common-issues.md).

**Key findings that were addressed:**
- MongoDB/Mongoose references cleaned up
- Auth middleware standardized
- LoggingService created and integrated
- Rate limiting added to auth endpoints
- Drizzle ORM schema fully defined

**Key findings still open:**
- Game handlers needing ESM conversion
- console.log usage in production code
- Missing test infrastructure
- Winston not fully configured

---

### project.md

| Field | Value |
|-------|-------|
| **Location** | `/project.md` (repository root) |
| **Created** | Pre-development (project planning phase) |
| **Purpose** | Original project plan and feature specification written before development began |
| **Content** | High-level feature list, technology choices, game descriptions, and initial architecture ideas. Written as a project proposal/specification. |
| **Relevance** | Superseded |

**Details:** This was the original project specification document, written before any code existed. It describes the vision for the platform including all six games, the admin panel, and the tech stack. While the vision has been largely realized, the specific implementation details differ significantly from what was proposed. The current architecture, features, and API are accurately documented in the `docs/` directory structure. This file is preserved purely as a historical record of the original project concept.

---

## Relevance Summary

| Document | Status | Replacement |
|----------|--------|------------|
| `ACTION_PLAN.md` | Partially outdated | [roadmap.md](../11-roadmap/roadmap.md) |
| `QUICK_FIXES.md` | Partially outdated | [roadmap.md](../11-roadmap/roadmap.md) Phase 2 |
| `FIXES_NEEDED.md` | Mostly outdated | [current-status.md](../11-roadmap/current-status.md) |
| `PROJECT_REVIEW.md` | Partially outdated | [current-status.md](../11-roadmap/current-status.md), [common-issues.md](../12-troubleshooting/common-issues.md) |
| `project.md` | Superseded | [project-summary.md](../01-overview/project-summary.md) |

---

## Recommendation

These root documents should **not** be deleted. They provide valuable historical context about the project's evolution, especially the MongoDB-to-MySQL migration decision and the ESM conversion process. However, developers should always consult the `docs/` directory for current, accurate information.

If you are a new developer joining the project, start with:
1. [docs/01-overview/project-summary.md](../01-overview/project-summary.md)
2. [docs/05-development/getting-started.md](../05-development/getting-started.md)
3. [docs/11-roadmap/current-status.md](../11-roadmap/current-status.md)

---

## Related Documents

- [Archive README](./README.md)
- [Current Status](../11-roadmap/current-status.md)
- [Development Roadmap](../11-roadmap/roadmap.md)
- [Project Summary](../01-overview/project-summary.md)
- [Getting Started](../05-development/getting-started.md)
- [Documentation TODO](../DOC_TODO.md)
