import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from './api';
import {
  getGames,
  getGameDetails,
  placeBet,
  getGameHistory,
  getLeaderboard,
} from './gameService';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

describe('getGames()', () => {
  it('calls api.get with /games and returns the response', async () => {
    api.get.mockResolvedValue([{ id: 1, name: 'Crash' }]);

    const result = await getGames();

    expect(api.get).toHaveBeenCalledWith('/games');
    expect(result).toEqual([{ id: 1, name: 'Crash' }]);
  });

  it('logs and rethrows errors', async () => {
    const err = new Error('network down');
    api.get.mockRejectedValue(err);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getGames()).rejects.toThrow('network down');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

describe('getGameDetails()', () => {
  it('calls api.get with /games/<id>', async () => {
    api.get.mockResolvedValue({ id: 'crash', name: 'Crash' });

    const result = await getGameDetails('crash');

    expect(api.get).toHaveBeenCalledWith('/games/crash');
    expect(result).toEqual({ id: 'crash', name: 'Crash' });
  });

  it('propagates error and logs with game id', async () => {
    const err = new Error('not found');
    api.get.mockRejectedValue(err);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getGameDetails('xyz')).rejects.toThrow('not found');
    spy.mockRestore();
  });
});

describe('placeBet()', () => {
  it('calls api.post with /games/bet and bet data', async () => {
    const bet = { game: 'crash', amount: 100 };
    api.post.mockResolvedValue({ success: true });

    const result = await placeBet(bet);

    expect(api.post).toHaveBeenCalledWith('/games/bet', bet);
    expect(result).toEqual({ success: true });
  });

  it('propagates errors from api.post', async () => {
    api.post.mockRejectedValue(new Error('insufficient balance'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(placeBet({ amount: 5 })).rejects.toThrow('insufficient balance');
    spy.mockRestore();
  });
});

describe('getGameHistory()', () => {
  it('calls api.get with /games/history when no filters', async () => {
    api.get.mockResolvedValue([]);

    await getGameHistory();

    expect(api.get).toHaveBeenCalledWith('/games/history');
  });

  it('appends query string when filters provided', async () => {
    api.get.mockResolvedValue([]);

    await getGameHistory({ game: 'crash', limit: 10 });

    const [url] = api.get.mock.calls[0];
    expect(url.startsWith('/games/history?')).toBe(true);
    expect(url).toContain('game=crash');
    expect(url).toContain('limit=10');
  });

  it('propagates errors', async () => {
    api.get.mockRejectedValue(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getGameHistory()).rejects.toThrow('boom');
    spy.mockRestore();
  });
});

describe('getLeaderboard()', () => {
  it('calls api.get with /games/leaderboard when no options', async () => {
    api.get.mockResolvedValue([]);

    await getLeaderboard();

    expect(api.get).toHaveBeenCalledWith('/games/leaderboard');
  });

  it('appends query string for options', async () => {
    api.get.mockResolvedValue([]);

    await getLeaderboard({ timeframe: 'week', limit: 5 });

    const [url] = api.get.mock.calls[0];
    expect(url).toContain('timeframe=week');
    expect(url).toContain('limit=5');
  });

  it('propagates errors', async () => {
    api.get.mockRejectedValue(new Error('nope'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getLeaderboard()).rejects.toThrow('nope');
    spy.mockRestore();
  });
});
