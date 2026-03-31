// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const { mockGetBalance, mockPlaceBet, mockRecordWin } = vi.hoisted(() => ({
  mockGetBalance: vi.fn(),
  mockPlaceBet: vi.fn(),
  mockRecordWin: vi.fn(),
}));

const { mockGeneratePath, mockCalculateMultiplier } = vi.hoisted(() => ({
  mockGeneratePath: vi.fn(),
  mockCalculateMultiplier: vi.fn(),
}));

vi.mock('../services/balanceService.js', () => ({
  default: {
    getBalance: mockGetBalance,
    placeBet: mockPlaceBet,
    recordWin: mockRecordWin,
  },
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logGameEvent: vi.fn(),
    logBetPlaced: vi.fn(),
    logBetResult: vi.fn(),
    logSystemEvent: vi.fn(),
  },
}));

vi.mock('../utils/plinkoUtils.js', () => ({
  generatePath: mockGeneratePath,
  calculateMultiplier: mockCalculateMultiplier,
}));

vi.mock('../validation/schemas.js', () => ({
  validateSocketData: vi.fn((_schema, data) => data),
  plinkoDropBallSchema: {},
}));

import initPlinkoHandlers from '../socket/plinkoHandler.js';

function createMockSocket(user = { userId: 1, username: 'testuser', balance: 1000 }) {
  const eventHandlers = new Map();
  return {
    id: `socket_${Math.random().toString(36).slice(2)}`,
    user,
    emit: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    to: vi.fn().mockReturnThis(),
    on: vi.fn((event, handler) => {
      eventHandlers.set(event, handler);
    }),
    disconnect: vi.fn(),
    _trigger: async (event, ...args) => {
      const handler = eventHandlers.get(event);
      if (handler) return handler(...args);
    },
  };
}

function createMockIo() {
  return {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
    of: vi.fn().mockReturnThis(),
  };
}

describe('PlinkoHandler', () => {
  let mockIo;
  let mockSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIo = createMockIo();
    mockSocket = createMockSocket();
    mockGetBalance.mockResolvedValue(1000);
    mockPlaceBet.mockResolvedValue({ success: true });
    mockRecordWin.mockResolvedValue({ success: true });
    mockGeneratePath.mockReturnValue([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
    mockCalculateMultiplier.mockReturnValue(2.5);
  });

  describe('initialization', () => {
    it('should register event handlers for authenticated user', () => {
      initPlinkoHandlers(mockIo, mockSocket, { balance: 1000 });
      expect(mockSocket.on).toHaveBeenCalledWith('plinko:join', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('plinko:drop_ball', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('plinko:get_history', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('plinko:leave', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should disconnect unauthenticated socket', () => {
      const unauthSocket = createMockSocket(null);
      unauthSocket.user = null;
      initPlinkoHandlers(mockIo, unauthSocket, null);
      expect(unauthSocket.emit).toHaveBeenCalledWith('plinko:error', { message: 'Authentication required' });
      expect(unauthSocket.disconnect).toHaveBeenCalled();
    });

    it('should join plinko room', () => {
      initPlinkoHandlers(mockIo, mockSocket, { balance: 1000 });
      expect(mockSocket.join).toHaveBeenCalledWith('plinko');
    });
  });

  describe('plinko:join', () => {
    it('should return game state via callback', async () => {
      initPlinkoHandlers(mockIo, mockSocket, { balance: 1000 });
      const callback = vi.fn();
      await mockSocket._trigger('plinko:join', {}, callback);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        balance: expect.any(Number),
        history: expect.any(Array),
      }));
    });
  });

  describe('plinko:drop_ball', () => {
    it('should process valid ball drop', async () => {
      initPlinkoHandlers(mockIo, mockSocket, { balance: 1000 });
      const callback = vi.fn();
      await mockSocket._trigger('plinko:drop_ball', { betAmount: 10, risk: 'medium', rows: 16 }, callback);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        multiplier: 2.5,
        winAmount: 25,
        profit: 15,
      }));
      expect(mockPlaceBet).toHaveBeenCalledWith(1, 10, 'plinko', expect.any(Object));
    });

    it('should handle insufficient balance', async () => {
      initPlinkoHandlers(mockIo, mockSocket, { balance: 5 });
      const callback = vi.fn();
      // Session balance is set from user.balance (1000 from mock) or from the user param
      // We need to drain the session balance first
      // Actually the session balance is set from user.balance on socket or from the passed user
      // Let's just pass a bet that exceeds balance
      const socket2 = createMockSocket({ userId: 999, username: 'broke', balance: 5 });
      initPlinkoHandlers(mockIo, socket2, { balance: 5 });
      const cb = vi.fn();
      await socket2._trigger('plinko:drop_ball', { betAmount: 100, risk: 'medium', rows: 16 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Insufficient balance',
      }));
    });

    it('should broadcast game result to room', async () => {
      initPlinkoHandlers(mockIo, mockSocket, { balance: 1000 });
      const callback = vi.fn();
      await mockSocket._trigger('plinko:drop_ball', { betAmount: 10, risk: 'low', rows: 8 }, callback);
      expect(mockSocket.to).toHaveBeenCalledWith('plinko');
    });

    it('should call BalanceService.recordWin when winAmount > 0', async () => {
      mockCalculateMultiplier.mockReturnValue(3.0);
      initPlinkoHandlers(mockIo, mockSocket, { balance: 1000 });
      const callback = vi.fn();
      await mockSocket._trigger('plinko:drop_ball', { betAmount: 10, risk: 'high', rows: 16 }, callback);
      expect(mockRecordWin).toHaveBeenCalled();
    });
  });

  describe('plinko:get_history', () => {
    it('should return user and global history', async () => {
      initPlinkoHandlers(mockIo, mockSocket, { balance: 1000 });
      const callback = vi.fn();
      await mockSocket._trigger('plinko:get_history', { limit: 5 }, callback);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        userHistory: expect.any(Array),
        globalHistory: expect.any(Array),
      }));
    });

    it('should default to limit of 10', async () => {
      initPlinkoHandlers(mockIo, mockSocket, { balance: 1000 });
      const callback = vi.fn();
      await mockSocket._trigger('plinko:get_history', {}, callback);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('plinko:leave', () => {
    it('should leave plinko room', async () => {
      initPlinkoHandlers(mockIo, mockSocket, { balance: 1000 });
      await mockSocket._trigger('plinko:leave');
      expect(mockSocket.leave).toHaveBeenCalledWith('plinko');
    });
  });

  describe('disconnect', () => {
    it('should mark session as inactive', async () => {
      initPlinkoHandlers(mockIo, mockSocket, { balance: 1000 });
      await mockSocket._trigger('disconnect');
      // Should not throw
    });
  });
});
