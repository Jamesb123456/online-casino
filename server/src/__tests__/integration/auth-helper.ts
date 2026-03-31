/**
 * Authentication helpers for integration tests.
 * Creates test users and returns session cookies for socket authentication.
 */
import { io as ioClient, Socket } from 'socket.io-client';

let userCounter = 0;

/**
 * Create a test user via the Better Auth sign-up endpoint.
 * Returns the session cookie string for authenticating sockets.
 */
export async function createTestUser(
  baseUrl: string,
  username?: string,
  password = 'TestPass123!'
): Promise<{ cookie: string; username: string; userId?: number }> {
  const name = username || `testuser_${Date.now()}_${++userCounter}`;
  const email = `${name}@test.local`;

  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      name,
      username: name,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create test user "${name}": ${res.status} ${body}`);
  }

  // Extract Set-Cookie header(s)
  const setCookies = res.headers.getSetCookie?.() || [];
  const cookie = setCookies.map(c => c.split(';')[0]).join('; ');

  if (!cookie) {
    throw new Error('No session cookie returned from sign-up');
  }

  // Try to parse user ID from response
  let userId: number | undefined;
  try {
    const data = await res.json();
    userId = data?.user?.id ? Number(data.user.id) : undefined;
  } catch {
    // Response may have already been consumed
  }

  return { cookie, username: name, userId };
}

/**
 * Login an existing test user and return the session cookie.
 */
export async function loginTestUser(
  baseUrl: string,
  username: string,
  password = 'TestPass123!'
): Promise<string> {
  const email = `${username}@test.local`;

  const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to login "${username}": ${res.status} ${body}`);
  }

  const setCookies = res.headers.getSetCookie?.() || [];
  const cookie = setCookies.map(c => c.split(';')[0]).join('; ');

  if (!cookie) {
    throw new Error('No session cookie returned from sign-in');
  }

  return cookie;
}

/**
 * Create an authenticated Socket.IO client for a game namespace.
 */
export function createAuthSocket(
  baseUrl: string,
  namespace: string,
  cookie: string
): Socket {
  const url = `${baseUrl}${namespace.startsWith('/') ? namespace : '/' + namespace}`;
  return ioClient(url, {
    extraHeaders: { cookie },
    transports: ['websocket'],
    reconnection: false,
    timeout: 10000,
  });
}

/**
 * Connect socket and wait for the 'connect' event.
 */
export function connectSocket(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connect timeout')), 10000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Socket connect error: ${err.message}`));
    });

    socket.connect();
  });
}
