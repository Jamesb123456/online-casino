# ADR-005: React Context API over Redux for State Management

**Date:** 2025-10-01 (approximate)
**Status:** Accepted
**Deciders:** Development team

---

## Context

The original project plan (`project.md`) listed Redux as the state management solution for the React frontend. Redux dependencies were installed during initial setup:

- `@reduxjs/toolkit`
- `react-redux`

However, during development, no Redux store, slices, or reducers were created. Instead, the team implemented state management using React's built-in Context API:

- **AuthContext** (`client/src/contexts/AuthContext.jsx`) -- Manages user authentication state (login, logout, session verification), user object, loading state, and error state. Used by `AuthGuard`, `AdminGuard`, `Header`, `LoginPage`, `RegisterPage`, `ProfilePage`, and game components.
- **ToastContext** (`client/src/context/ToastContext.jsx`) -- Manages toast notification state with helper methods (`success`, `error`, `info`, `warning`). Used throughout the application for user feedback.

The application's state management needs at the time of this decision:

1. **Authentication state** -- One user object, one loading flag, login/logout functions. Consumed by ~10 components.
2. **Toast notifications** -- A list of transient messages. Consumed by any component that needs to show feedback.
3. **Game state** -- Managed locally within each game component (e.g., `CrashGame.jsx` manages bet amount, multiplier, and game phase in local `useState` hooks). Real-time state comes from Socket.IO events, not a global store.

## Decision

Use **React Context API** for global state management instead of Redux.

- `AuthContext` provides authentication state and actions.
- `ToastContext` provides notification state and helper methods.
- Game-specific state remains local to game components, driven by Socket.IO events.
- Redux dependencies remain installed but unused.

## Consequences

### Positive

- **Simplicity** -- Context API requires no additional library concepts (actions, reducers, selectors, middleware, thunks). Each context is a single file with a provider component and a custom hook.
- **Fewer abstractions** -- Authentication state is straightforward: one user object with login/logout functions. Context provides this without the boilerplate of Redux slices, action creators, and dispatch calls.
- **Smaller bundle** -- While Redux Toolkit is installed, it is not imported anywhere, so tree-shaking excludes it from the client bundle. If the dependencies are removed from `package.json`, the install size decreases further.
- **Sufficient for current needs** -- The application has only two pieces of global state (auth and toasts). Context handles this without performance issues because auth state changes are infrequent (login/logout) and toast state changes do not trigger expensive re-renders.
- **Co-located with Socket.IO** -- Game state is driven by socket events and managed locally in game components. This would not benefit from Redux because the state does not need to be shared across unrelated components.

### Negative

- **Re-render scope** -- Context API triggers re-renders in all consumers when any part of the context value changes. For `AuthContext`, this means updating `user.balance` (which happens on every bet) re-renders all consumers. This has not been a measurable performance issue yet, but could become one as the component tree grows.
- **No devtools** -- Redux DevTools provide time-travel debugging, action logging, and state inspection. Context API has no equivalent built-in tooling, making state debugging harder.
- **Potential scalability limit** -- If the application adds features that require complex shared state (e.g., a global chat with presence indicators, a tournament leaderboard with live updates, or cross-game state like a unified bet history), Context API may become unwieldy. At that point, migrating to Redux or Zustand would be warranted.
- **Unused dependencies** -- `@reduxjs/toolkit` and `react-redux` remain in `package.json` despite not being used. These should be removed to avoid confusion (tracked in `PROJECT_REVIEW.md` section 2.1).
- **Split context directories** -- `AuthContext` lives in `client/src/contexts/` while `ToastContext` lives in `client/src/context/` (singular). This inconsistency should be resolved by consolidating into one directory.

---

## Related Documents

- [System Architecture](../system-architecture.md) -- client layer overview
- [Data Flow](../data-flow.md) -- authentication state flow
- [ADR-002: JWT HTTP-Only Cookies](./002-jwt-httponly-cookies.md) -- how auth tokens feed into AuthContext
- `client/src/contexts/AuthContext.jsx` -- authentication context implementation
- `client/src/context/ToastContext.jsx` -- toast notification context implementation
- `client/src/components/guards/AuthGuard.jsx` -- route guard consuming AuthContext
- `client/src/components/guards/AdminGuard.jsx` -- admin route guard consuming AuthContext
- `PROJECT_REVIEW.md` section 2.1 -- Redux removal recommendation
