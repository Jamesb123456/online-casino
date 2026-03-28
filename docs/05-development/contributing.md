# Contributing Guide

How to contribute to Platinum Casino -- from forking the repo to getting your pull request merged.

## Getting the Code

### Fork and clone

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/online-casino.git
   cd online-casino
   ```
3. Add the upstream remote so you can pull future changes:
   ```bash
   git remote add upstream https://github.com/<org>/online-casino.git
   ```
4. Follow the [Getting Started](./getting-started.md) guide to install dependencies, configure environment variables, and run the project locally.

## Branch Naming Conventions

Create a new branch from `main` for every change. Use one of the following prefixes:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New functionality | `feature/dice-game` |
| `bugfix/` | Fix for a reported bug | `bugfix/roulette-payout-calc` |
| `hotfix/` | Urgent production fix | `hotfix/jwt-cookie-expiry` |
| `docs/` | Documentation only | `docs/add-api-examples` |
| `refactor/` | Code restructuring (no behavior change) | `refactor/balance-service-types` |
| `chore/` | Tooling, CI, dependencies | `chore/upgrade-vite-6` |

Branch names should be lowercase, use hyphens as word separators, and be short but descriptive.

```bash
git checkout main
git pull upstream main
git checkout -b feature/dice-game
```

## Commit Message Format

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must have this structure:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore` | Build process, CI, dependency updates |
| `test` | Adding or updating tests |
| `style` | Formatting, whitespace (no logic change) |
| `perf` | Performance improvement |

### Scopes

Use the area of the codebase affected: `auth`, `crash`, `roulette`, `blackjack`, `plinko`, `wheel`, `landmines`, `admin`, `db`, `ci`, `server`, `client`, `balance`, `chat`.

### Examples

```
feat(plinko): add risk-level selector to betting panel
fix(roulette): correct payout calculation for split bets
refactor(db): migrate MongoDB to MySQL with Drizzle ORM
docs(api): add socket events reference for crash game
chore(ci): add Node 20 to CI matrix
```

## Pull Request Workflow

### 1. Create a branch

```bash
git checkout main
git pull upstream main
git checkout -b feature/your-feature
```

### 2. Make your changes

- Write code that follows the [Coding Standards](./coding-standards.md).
- Keep commits small and focused -- one logical change per commit.
- Add or update documentation when your change affects behavior.

### 3. Verify locally

Before pushing, run the full verification suite:

```bash
# Server -- type check
cd server
npx tsc --noEmit

# Server -- build
npm run build

# Client -- lint
cd ../client
npm run lint

# Client -- build
npm run build
```

### 4. Push and create a PR

```bash
git push origin feature/your-feature
```

Open a pull request against `main` on GitHub. Fill in the PR template with:
- A short summary of what changed and why.
- Steps to test the change manually.
- Screenshots or recordings for UI changes.
- Any breaking changes or migration steps.

### 5. Respond to review

Address reviewer feedback by pushing additional commits to the same branch. Do not force-push unless asked -- reviewers lose context when history is rewritten.

## Code Review Checklist

Reviewers should verify every item before approving:

### Correctness
- [ ] The change does what the PR description says.
- [ ] Edge cases are handled (empty inputs, negative amounts, disconnections).
- [ ] Error handling follows existing patterns (try/catch, proper HTTP status codes).

### Code quality
- [ ] Follows the [Coding Standards](./coding-standards.md) (naming, file structure, patterns).
- [ ] No `console.log` left in server code -- use `LoggingService` instead.
- [ ] No hardcoded secrets, URLs, or magic numbers.
- [ ] TypeScript types are used where applicable (server-side).

### Security
- [ ] User input is validated (Zod schemas on route handlers).
- [ ] Authentication checks are in place for protected endpoints.
- [ ] No sensitive data is exposed in API responses.
- [ ] Balance operations go through `BalanceService` (never direct DB writes to balances).

### Architecture
- [ ] New game modules follow the game module pattern (see [Coding Standards](./coding-standards.md)).
- [ ] Socket handlers follow the namespace-per-game pattern (see [Socket Architecture](../02-architecture/socket-architecture.md)).
- [ ] Services are singleton classes exporting a default instance.
- [ ] Database changes include a Drizzle migration.

### Documentation
- [ ] New features have corresponding documentation.
- [ ] Changed APIs are reflected in the API docs.
- [ ] The PR description explains the "why" not just the "what".

## Testing Requirements

Before submitting a PR, ensure:

1. **Type checking passes** -- `npx tsc --noEmit` in `server/` produces no errors.
2. **Server builds** -- `npm run build` in `server/` completes without errors.
3. **Client lints** -- `npm run lint` in `client/` passes with zero warnings.
4. **Client builds** -- `npm run build` in `client/` completes without errors.
5. **Manual testing** -- Run both server and client locally and verify your change works end-to-end:
   - Log in as a regular user and test the affected feature.
   - If your change affects admin features, test with the admin account.
   - If your change affects games, play at least one full round.
   - Check the browser console and server logs for errors.

> **Note:** Automated tests are not yet configured. When a test framework is added, all PRs will be required to include tests for new functionality.

## CI Checks That Must Pass

The GitHub Actions CI pipeline (`.github/workflows/ci.yml`) runs on every push and pull request to `main`. All steps must pass before a PR can be merged:

| Step | What it does |
|------|-------------|
| **Install server deps** | Installs `server/` dependencies with `npm ci` |
| **Typecheck server** | Runs `npx tsc --noEmit` to verify TypeScript types |
| **Build server** | Compiles TypeScript with `npm run build` |
| **Install client deps** | Installs `client/` dependencies with `npm ci` |
| **Build client** | Runs `vite build` to verify the production build |

If CI fails, check the workflow logs on GitHub, fix the issue locally, and push the fix to your branch.

## Issue Templates

When creating a GitHub issue, use the appropriate template:

- **Bug report** -- Describe the bug, steps to reproduce, expected vs actual behavior, and environment details.
- **Feature request** -- Describe the feature, the problem it solves, and any proposed implementation.
- **Documentation** -- Note what is missing or incorrect and suggest the improvement.

## Code Style Guidelines

This project maintains a comprehensive set of coding standards covering:

- File naming conventions (PascalCase for components, camelCase for utilities)
- Directory organization patterns (game module pattern, socket handler pattern)
- Service layer patterns (class-based singletons on server, plain objects on client)
- Authentication patterns (JWT in HTTP-only cookies)
- Validation patterns (Zod schemas)
- Database patterns (Drizzle ORM with MySQL)
- Logging standards (LoggingService, not console.log)

See the full [Coding Standards](./coding-standards.md) document for details and examples.

## How to Report Bugs

### Where to report

Open an issue on the GitHub repository using the Bug Report template.

### What to include

1. **Summary** -- A one-line description of the bug.
2. **Steps to reproduce** -- Numbered steps to trigger the bug consistently.
3. **Expected behavior** -- What should happen.
4. **Actual behavior** -- What happens instead.
5. **Environment** -- Browser, OS, Node.js version, and any relevant configuration.
6. **Screenshots or logs** -- Browser console output, server logs, or screen recordings.
7. **Severity** -- How badly it affects users:
   - **Critical** -- Application crash, data loss, security vulnerability.
   - **High** -- Feature broken, no workaround.
   - **Medium** -- Feature broken, workaround exists.
   - **Low** -- Cosmetic issue or minor inconvenience.

### Example bug report

```
Title: Roulette payout incorrect for split bets

Steps to reproduce:
1. Log in as player1
2. Navigate to the Roulette game
3. Place a $10 split bet on 1-2
4. Wait for the wheel to land on 1

Expected: Payout of $170 (17:1 odds)
Actual: Payout of $350 (35:1 odds -- using straight-up odds)

Environment: Chrome 120, Windows 11, server running locally on Node 20.11
```

---

## Related Documents

- [Getting Started](./getting-started.md) -- setup instructions for new contributors
- [Coding Standards](./coding-standards.md) -- code conventions and patterns to follow
- [Project Structure](./project-structure.md) -- directory layout and file descriptions
- [NPM Scripts Reference](./npm-scripts.md) -- available build, lint, and dev commands
- [System Architecture](../02-architecture/system-architecture.md) -- high-level architecture overview
- [Socket Architecture](../02-architecture/socket-architecture.md) -- socket handler design patterns
