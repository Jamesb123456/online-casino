import type { Socket } from 'socket.io-client';

/**
 * Wait for a specific socket event, returning the data as a Promise.
 */
export function waitForEvent<T = any>(socket: Socket, event: string, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for event "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);

    function handler(data: T) {
      clearTimeout(timer);
      resolve(data);
    }

    socket.once(event, handler);
  });
}

/**
 * Emit a socket event and wait for the callback response.
 */
export function emitWithAck<T = any>(
  socket: Socket,
  event: string,
  data: any,
  timeoutMs = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ack on "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.emit(event, data, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

/**
 * Wait a fixed number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for one of several events, returning which event fired and its data.
 */
export function waitForAnyEvent<T = any>(
  socket: Socket,
  events: string[],
  timeoutMs = 15000
): Promise<{ event: string; data: T }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      events.forEach(e => socket.off(e, handlers[e]));
      reject(new Error(`Timeout waiting for any of [${events.join(', ')}] after ${timeoutMs}ms`));
    }, timeoutMs);

    const handlers: Record<string, (data: T) => void> = {};

    for (const event of events) {
      handlers[event] = (data: T) => {
        clearTimeout(timer);
        // Remove all listeners
        events.forEach(e => socket.off(e, handlers[e]));
        resolve({ event, data });
      };
      socket.once(event, handlers[event]);
    }
  });
}
