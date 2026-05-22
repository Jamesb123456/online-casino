import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Pixi requires WebGL which jsdom doesn't have. Stub the board so this test
// stays focused on the GameShell + BetPanel composition + socket payload.
vi.mock('@/games/slots/SlotsBoard', () => ({
  default: () => <div data-testid="slots-board">Slots Board</div>,
}));

const { mockSocket, ackHandlers } = vi.hoisted(() => {
  const handlers = new Map();
  const socket = {
    _listeners: {},
    on: vi.fn(function (event, cb) {
      socket._listeners[event] = cb;
      return socket;
    }),
    emit: vi.fn(function (event, payload, ack) {
      if (ack && handlers.has(event)) {
        handlers.get(event)(payload, ack);
      }
    }),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
  };
  return { mockSocket: socket, ackHandlers: handlers };
});

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    setTimeout(() => {
      mockSocket._listeners.connect?.();
    }, 0);
    return mockSocket;
  }),
}));

vi.mock('@/services/socket/socketUtils', () => ({
  getSocketBaseUrl: () => 'http://localhost:5000',
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: React.createContext({
    user: { id: 1, username: 'tester', balance: 1000 },
    updateBalance: vi.fn(),
  }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

import SlotsGame from '@/games/slots/SlotsGame';

const renderGame = () =>
  render(
    <MemoryRouter>
      <SlotsGame />
    </MemoryRouter>,
  );

const flushConnect = async () => {
  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(5);
  });
};

const setSpinAck = (resp) => {
  ackHandlers.set('slots:spin', (_payload, ack) => ack(resp));
};

const getSpinCalls = () =>
  mockSocket.emit.mock.calls.filter((c) => c[0] === 'slots:spin');

describe('SlotsGame component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ackHandlers.clear();
    ackHandlers.set('slots:join', (_payload, ack) => ack({ success: true, balance: 1000 }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSocket._listeners = {};
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the Slots title, board sentinel and a primary spin CTA', async () => {
    renderGame();
    await flushConnect();
    expect(screen.getByRole('heading', { name: /slots/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('slots-board')).toBeInTheDocument();
    expect(screen.getByTestId('slots-spin-button')).toBeInTheDocument();
    // BetPanel renders a visible primary CTA labelled "Spin".
    expect(screen.getByRole('button', { name: /^Spin$/i })).toBeInTheDocument();
  });

  it('shows total bet = lines × bet amount (5 × 1)', async () => {
    renderGame();
    await flushConnect();
    expect(screen.getByTestId('slots-total-bet').textContent).toMatch(/5/);
  });

  it('updates total bet when the active-lines selector changes', async () => {
    renderGame();
    await flushConnect();
    fireEvent.click(screen.getByRole('radio', { name: /^3 lines$/i }));
    expect(screen.getByTestId('slots-total-bet').textContent).toMatch(/3/);
  });

  it('emits slots:spin with the correct payload on spin click', async () => {
    setSpinAck({
      ok: true,
      gameId: 'g1',
      reels: [
        ['A', 'A', 'A'],
        ['A', 'A', 'A'],
        ['A', 'A', 'A'],
        ['A', 'A', 'A'],
        ['A', 'A', 'A'],
      ],
      hits: [],
      totalPayout: 0,
      multiplier: 0,
      newBalance: 995,
    });
    renderGame();
    await flushConnect();
    fireEvent.click(screen.getByTestId('slots-spin-button'));
    const spinCalls = getSpinCalls();
    expect(spinCalls.length).toBe(1);
    expect(spinCalls[0][1]).toEqual({ betPerLine: 1, lines: 5 });
    expect(typeof spinCalls[0][2]).toBe('function');
  });

  it('does not call spin again while a spin is in progress', async () => {
    ackHandlers.set('slots:spin', () => {
      /* swallow — keep the spin pending */
    });
    renderGame();
    await flushConnect();
    fireEvent.click(screen.getByTestId('slots-spin-button'));
    fireEvent.click(screen.getByTestId('slots-spin-button'));
    const spinCalls = getSpinCalls();
    expect(spinCalls.length).toBe(1);
  });

  it('renders a losing-spin summary when totalPayout is zero', async () => {
    setSpinAck({
      ok: true,
      gameId: 'lose-1',
      reels: [
        ['A', 'B', 'C'],
        ['A', 'B', 'C'],
        ['A', 'B', 'C'],
        ['A', 'B', 'C'],
        ['A', 'B', 'C'],
      ],
      hits: [],
      totalPayout: 0,
      multiplier: 0,
      newBalance: 995,
    });
    renderGame();
    await flushConnect();
    fireEvent.click(screen.getByTestId('slots-spin-button'));
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId('slots-result').textContent).toMatch(/No win/i);
  });

  it('renders a winning-spin summary with the payout amount', async () => {
    setSpinAck({
      ok: true,
      gameId: 'win-1',
      reels: [
        ['SEVEN', 'A', 'B'],
        ['SEVEN', 'A', 'B'],
        ['SEVEN', 'A', 'B'],
        ['SEVEN', 'A', 'B'],
        ['SEVEN', 'A', 'B'],
      ],
      hits: [{ lineIdx: 0, symbol: 'SEVEN', count: 5, payout: 100 }],
      totalPayout: 100,
      multiplier: 20,
      newBalance: 1100,
    });
    renderGame();
    await flushConnect();
    fireEvent.click(screen.getByTestId('slots-spin-button'));
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId('slots-result').textContent).toMatch(/\+100/);
  });

  it('stops spinning when the server response is not ok', async () => {
    setSpinAck({ ok: false, error: 'broke' });
    renderGame();
    await flushConnect();
    fireEvent.click(screen.getByTestId('slots-spin-button'));
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId('slots-spin-button')).not.toBeDisabled();
  });
});
