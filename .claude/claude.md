# Agent Instructions

## Required Reading Order

Agents MUST read these files in this order before starting work:

1. `.claude/memories.md` — Core project knowledge (architecture, constraints, decisions)
2. `.claude/learning.md` — Debugging discoveries, failed attempts, lessons learned
3. `.claude/claude.md` — This file (agent operating rules)
4. `/docs/` — Project documentation
5. Repository source code as needed

---

## Knowledge Logging Rules

### Debugging Discoveries
Agents **must** log debugging discoveries in `.claude/learning.md` whenever they encounter:
- Bugs or unexpected behaviour
- Build errors or CI failures
- Hidden dependencies or surprising interactions
- Complex debugging sessions
- Performance problems or bottlenecks
- Environment or tooling issues

### Failed Attempts
If an attempted fix **fails**, it **must** be recorded in the Failed Attempts section of `.claude/learning.md`. This prevents future agents from repeating the same mistake.

### Long-Term Knowledge
Agents **must** log stable, long-term knowledge in `.claude/memories.md` when they discover:
- Architecture insights
- Important workflows or processes
- Project conventions or patterns
- Infrastructure details
- Permanent design decisions
- Repository structure explanations

### Quality Standards
All entries must be:
- **Clear** — written so any agent can understand without additional context
- **Concise** — no unnecessary padding or filler
- **Root-cause focused** — explain WHY the issue happened, not just what was done
- **Actionable** — include prevention steps so the issue doesn't recur

Avoid vague entries like "fixed bug". Always explain the root cause.

---

## Agent Operating Rules

1. **Read before writing.** Always read existing code before modifying it.
2. **ESM imports.** Use `.js` extensions in all server-side TypeScript imports.
3. **Balance safety.** All balance mutations must go through `balanceService`.
4. **No strict types.** Server `tsconfig.json` has `strict: false`. Do not add strict annotations.
5. **Run from correct directory.** Server commands from `server/`, client commands from `client/`.
6. **Verify before committing.** Run `npx tsc --noEmit` in `server/` to catch type errors.
7. **Do not break CI.** CI runs type-check + build for server, then build for client.
8. **Log everything.** Never silently fix complex issues without documenting the learning.
9. **Check wired handlers.** Not all game socket handlers are connected — verify in `server/server.ts`.
10. **No root package.json.** Always `cd` into `client/` or `server/` before running npm commands.
