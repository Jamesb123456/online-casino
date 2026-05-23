/**
 * AuthContext balance propagation regression.
 *
 * Locks the contract that game UIs MUST honor: balance changes flow through
 * AuthContext and reach any consumer that reads `useAuth().user.balance`.
 *
 * Why this exists
 * ----------------
 * AuthContext is the single source of truth for the player's balance.
 *   - `updateBalance(n)` mutates `user.balance` on the provider state.
 *   - The provider also subscribes to `balanceUpdate` on the main socket and
 *     forwards canonical server pushes through `updateBalance` (see
 *     AuthContext.jsx: useEffect that calls `socketService.onSocketEvent`).
 *
 * Consumers that read balance via `useAuth()` re-render correctly.
 * Consumers that snapshot balance into a local `useState(user?.balance)`
 * — as RouletteGame currently does — will NOT re-render when the canonical
 * balance changes, breaking bet-disable logic and balance displays.
 *
 * These tests:
 *   1. Pass today against any consumer that reads from context.
 *   2. Would fail against a hypothetical "broken consumer" that snapshots the
 *      initial balance into local state (we include such a consumer in the
 *      suite as a negative control to prove the assertion is load-bearing).
 *   3. Stay green after a refactor moves RouletteGame to read from context.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';

// ---- Mocks ----------------------------------------------------------------
//
// AuthProvider talks to three external modules on mount:
//   - auth-client (Better Auth session check)
//   - api (`/users/me` fetch for full user data)
//   - socketService (subscribes to `balanceUpdate` on the main namespace)
//
// We stub all three so the provider boots into an authenticated state with a
// known balance, and we capture the `balanceUpdate` handler so the test can
// fire server pushes synchronously.

const mockGetSession = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { username: vi.fn() },
    signOut: vi.fn(),
    getSession: (...args) => mockGetSession(...args),
  },
}));

const mockApiGet = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    get: (...args) => mockApiGet(...args),
  },
}));

// Capture the `balanceUpdate` handler so tests can invoke it directly to
// simulate a server-side BalanceService push.
let capturedBalanceHandler = null;

vi.mock('@/services/socketService', () => ({
  default: {
    initializeSocket: vi.fn(),
    disconnectSocket: vi.fn(),
    onSocketEvent: vi.fn((eventName, handler) => {
      if (eventName === 'balanceUpdate') {
        capturedBalanceHandler = handler;
      }
      return () => {
        if (eventName === 'balanceUpdate') capturedBalanceHandler = null;
      };
    }),
  },
}));

// ---- Test consumers -------------------------------------------------------

/**
 * GoodConsumer — reads balance straight from context every render.
 * This is the pattern BlackjackGame uses:
 *   `const balance = Number(user?.balance ?? 0);`
 * It also exposes the bet-disable computation BetPanel performs:
 *   `insufficient = balance < min`.
 */
function GoodConsumer({ minBet = 1 }) {
  const { user } = useAuth();
  const balance = Number(user?.balance ?? 0);
  const insufficient = balance < minBet;
  return (
    <div>
      <span data-testid="good-balance">{balance}</span>
      <button
        type="button"
        data-testid="good-place-bet"
        disabled={insufficient}
      >
        Place Bet
      </button>
      {insufficient ? (
        <p data-testid="good-insufficient">Insufficient balance</p>
      ) : null}
    </div>
  );
}

/**
 * BrokenConsumer — mirrors balance into local state on first render and
 * never updates it. This is the RouletteGame antipattern:
 *   `const [balance, setBalance] = useState(Number(user?.balance) || 0);`
 * Used as a negative control to prove the propagation assertions are
 * load-bearing — if we accidentally write a test that always passes, the
 * negative-control case would catch it.
 */
function BrokenConsumer({ minBet = 1 }) {
  const { user } = useAuth();
  const [balance] = React.useState(Number(user?.balance ?? 0));
  const insufficient = balance < minBet;
  return (
    <div>
      <span data-testid="broken-balance">{balance}</span>
      <button
        type="button"
        data-testid="broken-place-bet"
        disabled={insufficient}
      >
        Place Bet
      </button>
    </div>
  );
}

// ---- Helpers --------------------------------------------------------------

async function renderWithAuth(children, { initialBalance = 100 } = {}) {
  mockGetSession.mockResolvedValue({
    data: {
      user: {
        id: '1',
        username: 'tester',
        role: 'user',
        balance: String(initialBalance),
      },
    },
    error: null,
  });
  mockApiGet.mockResolvedValue({
    id: 1,
    username: 'tester',
    role: 'user',
    balance: initialBalance,
  });

  const utils = render(<AuthProvider>{children}</AuthProvider>);

  // Wait for the provider's init effect (getSession + api.get) to settle and
  // for the consumer to render with the initial balance.
  await waitFor(() => {
    expect(
      screen.queryByTestId('good-balance') ||
        screen.queryByTestId('broken-balance'),
    ).not.toBeNull();
  });

  return utils;
}

// ---- Tests ----------------------------------------------------------------

describe('AuthContext balance propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedBalanceHandler = null;
  });

  it('seeds initial balance from the authenticated session', async () => {
    await renderWithAuth(<GoodConsumer />, { initialBalance: 250 });

    await waitFor(() => {
      expect(screen.getByTestId('good-balance')).toHaveTextContent('250');
    });
  });

  it('subscribes to the `balanceUpdate` socket event on mount', async () => {
    await renderWithAuth(<GoodConsumer />, { initialBalance: 50 });

    // The provider's useEffect must have registered exactly one handler for
    // `balanceUpdate` — that handler is the bridge from server pushes to
    // every context consumer. If this subscription is removed, balance
    // updates from BalanceService stop reaching the UI.
    await waitFor(() => {
      expect(capturedBalanceHandler).toBeTypeOf('function');
    });
  });

  it('re-renders context consumers when the balanceUpdate socket event fires', async () => {
    await renderWithAuth(<GoodConsumer />, { initialBalance: 100 });

    // Wait for the socket subscription to be registered (happens in a
    // useEffect that depends on user.id, which is set after api.get resolves).
    await waitFor(() => {
      expect(capturedBalanceHandler).toBeTypeOf('function');
    });

    // Simulate a server push: BalanceService awards a win and the main
    // namespace emits the canonical balance.
    act(() => {
      capturedBalanceHandler({ balance: 175.5 });
    });

    await waitFor(() => {
      expect(screen.getByTestId('good-balance')).toHaveTextContent('175.5');
    });
  });

  it('accepts a bare number payload for `balanceUpdate` (server contract tolerance)', async () => {
    await renderWithAuth(<GoodConsumer />, { initialBalance: 100 });

    await waitFor(() => {
      expect(capturedBalanceHandler).toBeTypeOf('function');
    });

    act(() => {
      capturedBalanceHandler(42);
    });

    await waitFor(() => {
      expect(screen.getByTestId('good-balance')).toHaveTextContent('42');
    });
  });

  it('ignores malformed `balanceUpdate` payloads instead of crashing', async () => {
    await renderWithAuth(<GoodConsumer />, { initialBalance: 100 });

    await waitFor(() => {
      expect(capturedBalanceHandler).toBeTypeOf('function');
    });

    // None of these should change the balance.
    act(() => {
      capturedBalanceHandler(null);
      capturedBalanceHandler(undefined);
      capturedBalanceHandler({});
      capturedBalanceHandler({ balance: 'not-a-number' });
      capturedBalanceHandler('string-payload');
      capturedBalanceHandler(Number.NaN);
    });

    expect(screen.getByTestId('good-balance')).toHaveTextContent('100');
  });

  it('drives bet-disable logic in a context-reading consumer', async () => {
    // Start broke: balance below the minimum bet → CTA disabled,
    // insufficient-balance message visible.
    await renderWithAuth(<GoodConsumer minBet={10} />, { initialBalance: 0 });

    await waitFor(() => {
      expect(screen.getByTestId('good-balance')).toHaveTextContent('0');
    });
    expect(screen.getByTestId('good-place-bet')).toBeDisabled();
    expect(screen.getByTestId('good-insufficient')).toBeInTheDocument();

    // Server pushes a deposit. The CTA must re-enable and the warning must
    // disappear — this is exactly the user-visible regression the broken
    // consumer pattern would cause.
    await waitFor(() => {
      expect(capturedBalanceHandler).toBeTypeOf('function');
    });
    act(() => {
      capturedBalanceHandler({ balance: 500 });
    });

    await waitFor(() => {
      expect(screen.getByTestId('good-balance')).toHaveTextContent('500');
    });
    expect(screen.getByTestId('good-place-bet')).not.toBeDisabled();
    expect(screen.queryByTestId('good-insufficient')).not.toBeInTheDocument();
  });

  it(
    'negative control: a consumer that snapshots balance into local state does NOT update',
    async () => {
      // This documents the antipattern we are defending against. If a future
      // change introduces a local-state mirror of balance in any game (e.g.
      // RouletteGame currently does on line 44:
      //   `useState(Number(user?.balance) || 0)`), the user-visible bet-disable
      // logic will get out of sync with the canonical balance.
      //
      // We assert this stale behavior on a hand-rolled broken consumer so
      // that the *positive* assertions above can't be silently weakened by a
      // future refactor of the mock harness — if both behaviors stopped
      // working, this test would fail too.
      await renderWithAuth(<BrokenConsumer minBet={10} />, { initialBalance: 0 });

      await waitFor(() => {
        expect(screen.getByTestId('broken-balance')).toHaveTextContent('0');
      });

      await waitFor(() => {
        expect(capturedBalanceHandler).toBeTypeOf('function');
      });
      act(() => {
        capturedBalanceHandler({ balance: 500 });
      });

      // The broken consumer's local state is frozen at the initial value, so
      // the button stays disabled even though the canonical balance is now
      // 500. This is the regression class the production tests above guard
      // against.
      expect(screen.getByTestId('broken-balance')).toHaveTextContent('0');
      expect(screen.getByTestId('broken-place-bet')).toBeDisabled();
    },
  );

  it('exposes `updateBalance` so consumers can apply optimistic updates', async () => {
    let captured;
    function Capture() {
      captured = useAuth();
      return <GoodConsumer />;
    }
    await renderWithAuth(<Capture />, { initialBalance: 100 });

    await waitFor(() => {
      expect(screen.getByTestId('good-balance')).toHaveTextContent('100');
    });

    expect(typeof captured.updateBalance).toBe('function');

    act(() => {
      captured.updateBalance(321);
    });

    await waitFor(() => {
      expect(screen.getByTestId('good-balance')).toHaveTextContent('321');
    });
  });
});
