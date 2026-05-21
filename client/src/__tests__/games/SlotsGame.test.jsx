import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Shared mock socket — every test gets a fresh one via the factory below.
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
        const fn = handlers.get(event);
        fn(payload, ack);
      }
    }),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
  };
  return { mockSocket: socket, ackHandlers: handlers };
});

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    // simulate connect on next tick
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
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import SlotsGame from '@/games/slots/SlotsGame';

const renderGame = () => render(
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

describe('SlotsGame component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ackHandlers.clear();
    // Default join ack
    ackHandlers.set('slots:join', (_payload, ack) => ack({ success: true, balance: 1000 }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSocket._listeners = {};
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the spin button and 5 reels', async () => {
    renderGame();
    await flushConnect();
    expect(screen.getByTestId('slots-spin-button')).toBeInTheDocument();
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`slots-reel-${i}`)).toBeInTheDocument();
    }
  });

  it('shows total bet = lines × betPerLine', async () => {
    renderGame();
    await flushConnect();
    expect(screen.getByTestId('slots-total-bet').textContent).toMatch(/5/);
  });

  it('updates total bet when lines change', async () => {
    renderGame();
    await flushConnect();
    fireEvent.click(screen.getByRole('radio', { name: /3 lines/i }));
    expect(screen.getByTestId('slots-total-bet').textContent).toMatch(/3/);
  });

  it('emits slots:spin with the correct payload on button click', async () => {
    setSpinAck({
      ok: true,
      gameId: 'g1',
      reels: [['A','A','A'],['A','A','A'],['A','A','A'],['A','A','A'],['A','A','A']],
      hits: [],
      totalPayout: 0,
      multiplier: 0,
      newBalance: 995,
    });
    renderGame();
    await flushConnect();
    fireEvent.click(screen.getByTestId('slots-spin-button'));
    const spinCalls = mockSocket.emit.mock.calls.filter((c) => c[0] === 'slots:spin');
    expect(spinCalls.length).toBe(1);
    expect(spinCalls[0][1]).toEqual({ betPerLine: 1, lines: 5 });
  });

  it('renders the resolved reels and win banner after a winning spin', async () => {
    setSpinAck({
      ok: true,
      gameId: 'abc',
      reels: [
        ['A', 'A', 'A'],
        ['A', 'A', 'A'],
        ['A', 'A', 'A'],
        ['A', 'A', 'A'],
        ['A', 'A', 'A'],
      ],
      hits: [{ lineIdx: 0, symbol: 'A', count: 5, payout: 100 }],
      totalPayout: 100,
      multiplier: 20,
      newBalance: 1100,
    });
    renderGame();
    await flushConnect();
    fireEvent.click(screen.getByTestId('slots-spin-button'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    await waitFor(() => {
      expect(screen.getByTestId('slots-win-banner').textContent).toMatch(/Won/i);
    });
  });

  it('does not call spin again while a spin is in progress', async () => {
    // No ack — leaves spin pending
    ackHandlers.set('slots:spin', () => { /* swallow */ });
    renderGame();
    await flushConnect();
    fireEvent.click(screen.getByTestId('slots-spin-button'));
    fireEvent.click(screen.getByTestId('slots-spin-button'));
    const spinCalls = mockSocket.emit.mock.calls.filter((c) => c[0] === 'slots:spin');
    expect(spinCalls.length).toBe(1);
  });

  it('stops spinning when the server response is not ok', async () => {
    setSpinAck({ ok: false, error: 'broke' });
    renderGame();
    await flushConnect();
    fireEvent.click(screen.getByTestId('slots-spin-button'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    // Spin button re-enables (no longer disabled by isSpinning)
    expect(screen.getByTestId('slots-spin-button')).not.toBeDisabled();
  });

  it('renders a losing-spin banner when totalPayout is zero', async () => {
    setSpinAck({
      ok: true,
      reels: [['A','B','C'],['A','B','C'],['A','B','C'],['A','B','C'],['A','B','C']],
      hits: [],
      totalPayout: 0,
      multiplier: 0,
      newBalance: 995,
    });
    renderGame();
    await flushConnect();
    fireEvent.click(screen.getByTestId('slots-spin-button'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    await waitFor(() => {
      expect(screen.getByTestId('slots-result').textContent).toMatch(/No win/i);
    });
  });
});
