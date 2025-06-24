/**
 * Socket service for real-time communication with server
 */
import { io } from 'socket.io-client';

// Socket.IO instance 
let socket = null;

// Socket events handlers
const eventHandlers = new Map();

/**
 * Initialize Socket.IO connection
 */
export const initializeSocket = () => {
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

  // Close any existing socket
  if (socket) {
    socket.close();
  }
  
  // Create new socket instance with cookie-based auth
  socket = io(SOCKET_URL, {
    withCredentials: true, // Send cookies with socket requests
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  });
  
  // Setup default event listeners
  setupDefaultEventHandlers();
  
  return socket;
};

/**
 * Get the current socket instance or create a new one
 */
export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

/**
 * Setup default event handlers
 */
const setupDefaultEventHandlers = () => {
  if (!socket) return;
  
  // Connection events
  socket.on('connect', () => {
    console.log('Socket connected');
    // Execute all connect handlers
    triggerHandlers('connect');
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${reason}`);
    triggerHandlers('disconnect', reason);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    triggerHandlers('connect_error', error);
  });
};

/**
 * Subscribe to a socket event
 * @param {String} event - Event name
 * @param {Function} callback - Event handler
 * @returns {Function} - Unsubscribe function
 */
export const onSocketEvent = (event, callback) => {
  if (!socket) {
    initializeSocket();
  }
  
  // Add event handler to our map
  if (!eventHandlers.has(event)) {
    eventHandlers.set(event, new Set());
    
    // Register the event with socket.io if it's not a default one
    if (!['connect', 'disconnect', 'connect_error'].includes(event)) {
      socket.on(event, (...args) => {
        triggerHandlers(event, ...args);
      });
    }
  }
  
  // Add this specific handler
  eventHandlers.get(event).add(callback);
  
  // Return unsubscribe function
  return () => {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.delete(callback);
    }
  };
};

/**
 * Emit a socket event to server
 * @param {String} event - Event name 
 * @param {*} data - Event data
 * @param {Function} ack - Optional acknowledgement callback
 */
export const emitSocketEvent = (event, data, ack = null) => {
  if (!socket) {
    socket = initializeSocket();
  }
  
  if (ack) {
    socket.emit(event, data, ack);
  } else {
    socket.emit(event, data);
  }
};

/**
 * Trigger all registered handlers for an event
 * @param {String} event - Event name
 * @param  {...any} args - Event arguments
 */
const triggerHandlers = (event, ...args) => {
  const handlers = eventHandlers.get(event);
  if (handlers) {
    handlers.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    });
  }
};

/**
 * Clean up socket connection
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    eventHandlers.clear();
  }
};

export default {
  initializeSocket,
  getSocket,
  onSocketEvent,
  emitSocketEvent,
  disconnectSocket
};