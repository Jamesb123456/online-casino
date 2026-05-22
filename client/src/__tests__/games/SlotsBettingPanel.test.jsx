import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Pixi-backed board is replaced with a sentinel; this file only exercises the
// betting UI surface contributed by SlotsGame (lines selector + BetPanel
// integration + socket payload shape).
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

describe('SlotsGame betting controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ackHandlers.clear();
    ackHandlers.set('slots:join', (_p, ack) => ack({ success: true, balance: 1000 }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSocket._listeners = {};
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the bet amount input, lines selector, and spin button', async () => {
    renderGame();
    await flushConnect();
    expect(screen.getByLabelText(/Bet amount/i)).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /Active lines/i })).toBeInTheDocument();
    expect(screen.getByTestId('slots-spin-button')).toBeInTheDocument();
  });

  it('updates the bet amount via the BetPanel input', async () => {
    renderGame();
    await flushConnect();
    const input = screen.getByLabelText(/Bet amount/i);
    fireEvent.change(input, { target: { value: '5' } });
    expect(Number(input.value)).toBe(5);
  });

  it('emits the correct socket payload on spin click', async () => {
    setSpinAck({
      ok: true,
      gameId: 'g',
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
      newBalance: 994,
    });
    renderGame();
    await flushConnect();
    fireEvent.change(screen.getByLabelText(/Bet amount/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('radio', { name: /^3 lines$/i }));
    fireEvent.click(screen.getByTestId('slots-spin-button'));

    const spinCalls = getSpinCalls();
    expect(spinCalls.length).toBe(1);
    expect(spinCalls[0][1]).toEqual({ betPerLine: 2, lines: 3 });
    expect(typeof spinCalls[0][2]).toBe('function');
  });

  it('shows the total bet derived from bet × active lines', async () => {
    renderGame();
    await flushConnect();
    fireEvent.change(screen.getByLabelText(/Bet amount/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('radio', { name: /^4 lines$/i }));
    expect(screen.getByTestId('slots-total-bet').textContent).toMatch(/12/);
  });

  it('disables the spin button while a spin is in progress', async () => {
    ackHandlers.set('slots:spin', () => {
      /* never ack */
    });
    renderGame();
    await flushConnect();
    const btn = screen.getByTestId('slots-spin-button');
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });
});
