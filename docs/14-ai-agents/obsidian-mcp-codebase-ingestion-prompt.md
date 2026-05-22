# Obsidian MCP Codebase Ingestion Prompt

Use this prompt in Windsurf with your Obsidian MCP enabled.

---

## Prompt

You are an AI agent with access to this repository and the Obsidian MCP.

Your task is to ingest the **entire `online-casino` codebase knowledge system** into Obsidian so future AI review sessions have strong, linked, high-context notes.

## Primary Goal

Build an Obsidian knowledge base for this repository that:

- mirrors the real structure of the project
- captures documentation, architecture, code context, workflows, and known issues
- links everything heavily with Obsidian `[[wikilinks]]`
- separates current truth from historical or legacy information
- is optimized for future AI review, debugging, onboarding, and implementation work

Do not just dump files into notes. Create a **usable knowledge graph**.

## Source of Truth Priority

When sources conflict, prefer them in this order:

1. Actual source code in `client/`, `server/`, `e2e/`, and config files
2. `docs/README.md`
3. `docs/DOC_MAP.md`
4. Other files under `docs/`
5. Root documentation files such as `README.md`, `SECURITY.md`, `PROJECT_REVIEW.md`, `ACTION_PLAN.md`, `QUICK_FIXES.md`, `FIXES_NEEDED.md`, `project.md`

If legacy root docs conflict with current docs or code, keep them as historical notes and clearly mark them as **legacy**, **outdated**, or **superseded**.

## Important Repository Context

This repo is a monorepo with these major areas:

- `client/` - React frontend
- `server/` - Express + TypeScript backend
- `docs/` - main documentation portal and detailed technical docs
- `e2e/` - Playwright end-to-end tests
- `.claude/` - AI knowledge files and agent operating rules
- `.github/workflows/ci.yml` - CI pipeline

Important documentation entry points include:

- `docs/README.md`
- `docs/DOC_MAP.md`
- `docs/DOC_HEALTH_REPORT.md`
- `docs/DOC_TODO.md`
- `README.md`
- `SECURITY.md`
- `PROJECT_REVIEW.md`
- `ACTION_PLAN.md`
- `QUICK_FIXES.md`
- `FIXES_NEEDED.md`
- `project.md`

Important docs sections under `docs/` include:

- `01-overview/`
- `02-architecture/`
- `03-features/`
- `04-api/`
- `05-development/`
- `06-devops/`
- `07-security/`
- `08-testing/`
- `09-database/`
- `10-operations/`
- `11-roadmap/`
- `12-troubleshooting/`
- `13-integrations/`
- `14-ai-agents/`
- `15-compliance/`

## Vault Output Requirements

Create the Obsidian notes under a clear folder such as:

`Projects/Platinum Casino/`

Use this structure:

- `Projects/Platinum Casino/00 Dashboard/`
- `Projects/Platinum Casino/01 Overview/`
- `Projects/Platinum Casino/02 Architecture/`
- `Projects/Platinum Casino/03 Features/`
- `Projects/Platinum Casino/04 API/`
- `Projects/Platinum Casino/05 Development/`
- `Projects/Platinum Casino/06 DevOps/`
- `Projects/Platinum Casino/07 Security/`
- `Projects/Platinum Casino/08 Testing/`
- `Projects/Platinum Casino/09 Database/`
- `Projects/Platinum Casino/10 Operations/`
- `Projects/Platinum Casino/11 Roadmap/`
- `Projects/Platinum Casino/12 Troubleshooting/`
- `Projects/Platinum Casino/13 Integrations/`
- `Projects/Platinum Casino/14 AI Agents/`
- `Projects/Platinum Casino/15 Compliance/`
- `Projects/Platinum Casino/90 Legacy and Historical/`
- `Projects/Platinum Casino/99 Indexes/`

## Create These Hub Notes First

Create these notes before creating the detailed notes, and link everything back to them:

1. `Platinum Casino - Dashboard`
2. `Platinum Casino - System Overview`
3. `Platinum Casino - Documentation Map`
4. `Platinum Casino - Codebase Map`
5. `Platinum Casino - Architecture Index`
6. `Platinum Casino - Feature Index`
7. `Platinum Casino - API Index`
8. `Platinum Casino - Development Index`
9. `Platinum Casino - Known Issues`
10. `Platinum Casino - AI Review Starter`

## Required Note Types

Create and link the following kinds of notes:

### 1. Canonical summary notes

For each major docs section, create one summary note that explains:

- what the section covers
- the most important files
- key concepts
- related notes
- what an AI reviewer should read next

### 2. File-backed notes

For important docs and important source files, create notes that include:

- source path
- purpose
- key entities, endpoints, services, or components
- important invariants
- dependencies
- related notes
- status: current, legacy, planned, or needs verification

### 3. Concept notes

Create atomic notes for major concepts such as:

- Better Auth session authentication
- BalanceService
- Socket.IO namespace-per-game architecture
- Drizzle ORM schema
- provably fair system
- responsible gaming
- leaderboard
- login rewards
- admin analytics
- Redis optional integration
- ESM migration status
- AI knowledge system in `.claude/`

### 4. Code map notes

Create notes that map code locations to responsibilities, especially for:

- `client/src/App.jsx`
- client pages
- client contexts
- client services
- client game modules
- `server/server.ts`
- `server/routes/`
- `server/src/services/`
- `server/src/socket/`
- `server/drizzle/schema.ts`
- `server/drizzle/models/`
- `server/middleware/`
- `e2e/tests/`

### 5. Legacy notes

Create separate notes for legacy or potentially outdated material, especially:

- `PROJECT_REVIEW.md`
- `ACTION_PLAN.md`
- `QUICK_FIXES.md`
- `FIXES_NEEDED.md`
- `project.md`
- any docs that describe superseded JWT behavior

These notes must link to the newer notes that supersede them.

## Linking Rules

Every note must contain Obsidian `[[wikilinks]]`.

Minimum linking requirements:

- link each detailed note to at least 3 related notes
- link each source-file note to its parent domain hub note
- link each feature note to the relevant architecture, API, database, and code notes
- link each issue note to the affected files, services, and roadmap items
- link legacy notes to the current canonical notes that replace them

Use consistent note names. Prefer names like:

- `Platinum Casino - Authentication`
- `Platinum Casino - Balance Service`
- `Platinum Casino - Crash Game`
- `Platinum Casino - Server Routes`
- `Platinum Casino - Database Schema`
- `Platinum Casino - Socket Architecture`

## Required Metadata in Notes

Use YAML frontmatter where appropriate. Include fields like:

- `project: Platinum Casino`
- `type:` dashboard | hub | file | concept | code-map | issue | legacy | workflow
- `source_path:` repo-relative path when the note is based on a file
- `status:` current | planned | legacy | superseded | verify
- `domain:` architecture | api | feature | database | security | testing | devops | ai-agents | compliance | operations
- `tags:` relevant keywords

## Required Content Standards

For each note:

- summarize, do not blindly copy
- preserve exact names for files, folders, routes, services, and components
- capture important constraints and invariants
- explicitly call out uncertainty when a doc needs verification against code
- identify whether something is implemented, planned, optional, historical, or not wired up

## Special Instructions for This Repository

You must capture these repo-specific truths if confirmed by code/docs:

- the project is an online casino platform called Platinum Casino
- the frontend is React/Vite-based
- the backend is Express + TypeScript
- the database uses MySQL with Drizzle ORM
- auth uses Better Auth sessions, not JWT as current truth
- Socket.IO is central to game communication
- the docs portal under `docs/` is the main documentation source
- `.claude/` contains a persistent AI knowledge system
- some legacy files may describe outdated states and must be labeled carefully

Also create notes for these important review lenses:

- current architecture
- current feature coverage
- API surface
- data model
- known mismatches or risks
- testing posture
- deployment posture
- compliance posture
- AI agent operating context

## AI Review Optimization

Create one high-value note named:

`Platinum Casino - AI Review Starter`

This note should contain:

- a concise system summary
- where to start for architecture review
- where to start for bug fixing
- where to start for feature work
- where to start for auth/security review
- where to start for database review
- where to start for socket/game logic review
- where to start for deployment review
- a short list of the most authoritative notes

Also create:

`Platinum Casino - Known Issues`

This should consolidate known issues, open risks, documentation mismatches, planned work, and legacy warnings from the docs and code. Link each issue to the relevant source notes.

## Execution Order

Follow this order:

1. Read `docs/README.md` and `docs/DOC_MAP.md`
2. Read `docs/DOC_HEALTH_REPORT.md` and `docs/DOC_TODO.md`
3. Read root docs and classify each as current or legacy
4. Scan `client/`, `server/`, `e2e/`, `.claude/`, and `.github/workflows/ci.yml`
5. Create hub notes
6. Create section summary notes
7. Create concept notes
8. Create code map notes
9. Create issue and legacy notes
10. Add cross-links everywhere
11. Review the vault for orphan notes and add missing links

## Quality Bar

The final Obsidian vault should let a future AI answer questions like:

- where is authentication implemented?
- what are the main backend services?
- how are games wired from UI to socket handlers?
- which docs are authoritative versus historical?
- what known issues or risks already exist?
- what should be read first before changing balance, auth, or socket logic?

If a note would not help answer those questions, improve it.

## Final Deliverable

When done, provide a short completion report listing:

- the folders and notes created
- the main hub notes created
- any legacy or conflicting docs found
- any areas that still need manual review
- any files that appeared outdated relative to current code

Start now and build the Obsidian knowledge base for the full repository.
