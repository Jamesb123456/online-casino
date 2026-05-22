import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock better-auth/react and its plugins so we can inspect what
// auth-client.js does with them.
const createAuthClientMock = vi.fn(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('better-auth/react', () => ({
  createAuthClient: createAuthClientMock,
}));

vi.mock('better-auth/client/plugins', () => ({
  usernameClient: vi.fn(() => ({ id: 'username-plugin' })),
  adminClient: vi.fn(() => ({ id: 'admin-plugin' })),
}));

describe('auth-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthClientMock.mockClear();
    vi.resetModules();
  });

  it('exports an authClient created via createAuthClient', async () => {
    const mod = await import('./auth-client');

    expect(mod.authClient).toBeDefined();
    expect(createAuthClientMock).toHaveBeenCalledTimes(1);
  });

  it('passes a baseURL string to createAuthClient', async () => {
    await import('./auth-client');

    const [config] = createAuthClientMock.mock.calls[0];
    expect(typeof config.baseURL).toBe('string');
    expect(config.baseURL.length).toBeGreaterThan(0);
  });

  it('strips trailing /api from VITE_API_URL when computing baseURL', async () => {
    // Stub the env to confirm the strip-/api behavior.
    const originalEnv = import.meta.env.VITE_API_URL;
    try {
      // Vitest exposes env via import.meta.env as a writable object in tests.
      import.meta.env.VITE_API_URL = 'http://example.com/api';
      vi.resetModules();
      await import('./auth-client');

      const [config] = createAuthClientMock.mock.calls.slice(-1)[0];
      expect(config.baseURL).toBe('http://example.com');
    } finally {
      import.meta.env.VITE_API_URL = originalEnv;
    }
  });

  it('falls back to localhost:5000 when VITE_API_URL is unset', async () => {
    const originalEnv = import.meta.env.VITE_API_URL;
    try {
      delete import.meta.env.VITE_API_URL;
      vi.resetModules();
      await import('./auth-client');

      const [config] = createAuthClientMock.mock.calls.slice(-1)[0];
      expect(config.baseURL).toBe('http://localhost:5000');
    } finally {
      if (originalEnv !== undefined) {
        import.meta.env.VITE_API_URL = originalEnv;
      }
    }
  });

  it('registers usernameClient and adminClient plugins', async () => {
    vi.resetModules();
    await import('./auth-client');

    const [config] = createAuthClientMock.mock.calls.slice(-1)[0];
    expect(Array.isArray(config.plugins)).toBe(true);
    expect(config.plugins).toHaveLength(2);
  });
});
