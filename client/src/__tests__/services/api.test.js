import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest, api } from '@/services/api';

// ---- Mock global fetch ----

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Helper to create a mock Response
function mockResponse(body, { status = 200, statusText = 'OK', ok = true } = {}) {
  return {
    ok,
    status,
    statusText,
    json: () => Promise.resolve(body),
  };
}

describe('apiRequest', () => {
  it('makes fetch call with correct URL', async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: true }));

    await apiRequest('/users');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    // The URL includes the base URL from env or defaults
    expect(url).toMatch(/\/api\/users$/);
  });

  it('includes credentials: "include" in all requests', async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: true }));

    await apiRequest('/test');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.credentials).toBe('include');
  });

  it('sets Content-Type to application/json by default', async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: true }));

    await apiRequest('/test');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('merges custom headers', async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: true }));

    await apiRequest('/test', {
      headers: { 'X-Custom': 'value' },
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['X-Custom']).toBe('value');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('handles params option by building query string', async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: true }));

    await apiRequest('/search', {
      params: { q: 'hello', page: 1 },
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('?');
    expect(url).toContain('q=hello');
    expect(url).toContain('page=1');
  });

  it('skips null and undefined params', async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: true }));

    await apiRequest('/search', {
      params: { q: 'test', empty: null, undef: undefined },
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('q=test');
    expect(url).not.toContain('empty');
    expect(url).not.toContain('undef');
  });

  it('returns parsed JSON response', async () => {
    const body = { id: 1, name: 'Alice' };
    mockFetch.mockResolvedValue(mockResponse(body));

    const result = await apiRequest('/users/1');

    expect(result).toEqual(body);
  });

  it('returns empty object for 204 No Content responses', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: () => Promise.reject(new Error('Should not be called')),
    });

    const result = await apiRequest('/resource');

    expect(result).toEqual({});
  });

  it('throws error with message from API response on failure', async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ message: 'User not found' }, { status: 404, statusText: 'Not Found', ok: false })
    );

    // Suppress console.error from the catch block in apiRequest
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(apiRequest('/users/999')).rejects.toThrow('User not found');

    spy.mockRestore();
  });

  it('throws error with HTTP status when no message in API response', async () => {
    mockFetch.mockResolvedValue(
      mockResponse({}, { status: 500, statusText: 'Internal Server Error', ok: false })
    );

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(apiRequest('/broken')).rejects.toThrow('HTTP 500: Internal Server Error');

    spy.mockRestore();
  });

  it('handles network errors', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(apiRequest('/unreachable')).rejects.toThrow('Failed to fetch');

    spy.mockRestore();
  });
});

describe('api convenience methods', () => {
  it('api.get() sends GET request', async () => {
    mockFetch.mockResolvedValue(mockResponse({ items: [] }));

    const result = await api.get('/items');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('GET');
    expect(result).toEqual({ items: [] });
  });

  it('api.get() passes through options', async () => {
    mockFetch.mockResolvedValue(mockResponse({ items: [] }));

    await api.get('/items', { params: { limit: 10 } });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('limit=10');
  });

  it('api.post() sends POST request with JSON body', async () => {
    mockFetch.mockResolvedValue(mockResponse({ id: 1 }));

    const data = { name: 'New Item' };
    const result = await api.post('/items', data);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify(data));
    expect(result).toEqual({ id: 1 });
  });

  it('api.put() sends PUT request with JSON body', async () => {
    mockFetch.mockResolvedValue(mockResponse({ id: 1, name: 'Updated' }));

    const data = { name: 'Updated' };
    const result = await api.put('/items/1', data);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('PUT');
    expect(options.body).toBe(JSON.stringify(data));
    expect(result).toEqual({ id: 1, name: 'Updated' });
  });

  it('api.delete() sends DELETE request', async () => {
    mockFetch.mockResolvedValue(mockResponse({ success: true }));

    const result = await api.delete('/items/1');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('DELETE');
    expect(result).toEqual({ success: true });
  });

  it('api.post() merges additional options', async () => {
    mockFetch.mockResolvedValue(mockResponse({ id: 1 }));

    await api.post('/items', { name: 'test' }, {
      headers: { 'X-Request-Id': '123' },
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['X-Request-Id']).toBe('123');
    expect(options.headers['Content-Type']).toBe('application/json');
  });
});
