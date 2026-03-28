# Project Learning & Knowledge Log

## Purpose

This file stores **discoveries, debugging knowledge, failed attempts, and performance insights** discovered while working in the repository.

It acts as a **knowledge base of lessons learned** so future agents do not repeat the same mistakes.

**When to add entries:** Whenever an agent encounters bugs, unexpected behaviour, architecture discoveries, workflow improvements, performance problems, build errors, hidden dependencies, complex debugging, or failed fixes.

**Rule:** Agents must NEVER silently fix complex issues without documenting the learning here.

---

## Entry Format

Each entry must follow this format:

```
### Learning Entry

- **Date:**
- **Agent:**
- **Category:** (Architecture | Debugging | Failed Attempt | Performance | Workflow | Environment)

- **Context:**
- **Problem:**
- **Root Cause:**
- **Solution:**
- **Prevention:**
- **Affected Files:**
- **Notes:**
```

---

## Architecture Learnings

_Discoveries about system design or structure._

### Learning Entry

- **Date:** 2026-03-27
- **Agent:** Claude Code (Opus 4.6)
- **Category:** Architecture

- **Context:** Initial repository analysis during knowledge system setup (updated 2026-03-28).
- **Problem:** Originally, multiple game socket handlers existed but only Crash and Roulette were wired. This has since been resolved.
- **Root Cause:** Incomplete migration/implementation at the time of initial analysis.
- **Solution:** All 6 game handlers (Crash, Roulette, Landmines, Blackjack, Plinko, Wheel) are now wired in `server/server.ts`.
- **Prevention:** Check `server/server.ts` to verify which handlers are actually wired before assuming a game endpoint is live.
- **Affected Files:** `server/server.ts`, `server/src/socket/*.ts`
- **Notes:** All game namespaces are now fully connected and operational.

---

## Debugging Learnings

_Problems encountered and how they were solved._

### Learning Entry

- **Date:** 2026-03-27
- **Agent:** Claude Code (Opus 4.6)
- **Category:** Debugging

- **Context:** CI pipeline was failing with TypeScript build errors (commit `7088b01`).
- **Problem:** TypeScript compilation failed in CI.
- **Root Cause:** Type errors introduced during the MongoDB-to-MySQL migration were not caught locally.
- **Solution:** Fixed TypeScript build failures (commit `7088b01`).
- **Prevention:** Always run `npx tsc --noEmit` in `server/` before committing to catch type errors early.
- **Affected Files:** Various server TypeScript files.
- **Notes:** CI runs `npx tsc --noEmit` + `npm run build` for server, then `npm run build` for client.

---

## Failed Attempts

_Solutions that were tried but failed. Recording these prevents future agents from repeating mistakes._

_(No entries yet — agents must add failed attempts here as they occur.)_

---

## Performance Learnings

_Performance improvements or bottlenecks discovered._

_(No entries yet — agents must add performance findings here as they occur.)_

---

## Agent Workflow Improvements

_Better ways agents should operate in this repository._

### Learning Entry

- **Date:** 2026-03-27
- **Agent:** Claude Code (Opus 4.6)
- **Category:** Workflow

- **Context:** Setting up agent knowledge system.
- **Problem:** Agents starting fresh sessions have no context about prior debugging or project state.
- **Root Cause:** No persistent knowledge sharing mechanism between agent sessions.
- **Solution:** Created `.claude/memories.md` (core knowledge) and `.claude/learning.md` (this file) as persistent memory.
- **Prevention:** All agents must read both files at session start and log discoveries during work.
- **Affected Files:** `.claude/memories.md`, `.claude/learning.md`, `.claude/claude.md`
- **Notes:** Zero-maintenance system — agents automatically maintain these files.

---

## Environment / Tooling Issues

_Build problems, dependency conflicts, runtime issues, etc._

### Learning Entry

- **Date:** 2026-03-27
- **Agent:** Claude Code (Opus 4.6)
- **Category:** Environment

- **Context:** Repository uses ESM modules throughout.
- **Problem:** Server TypeScript imports require `.js` extensions even though source files are `.ts`.
- **Root Cause:** Node.js ESM resolution does not automatically resolve `.ts` to `.js`. TypeScript compiles `.ts` to `.js` but import paths must already reference `.js`.
- **Solution:** Always use `.js` extensions in server import statements.
- **Prevention:** When adding new server imports, always use the `.js` extension (e.g., `import { foo } from './bar.js'`).
- **Affected Files:** All `server/**/*.ts` files.
- **Notes:** This is by design, not a bug. Forgetting `.js` extensions will cause runtime errors.
