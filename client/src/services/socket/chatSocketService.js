import { io } from 'socket.io-client';
import { getSocketBaseUrl } from './socketUtils';

/**
 * Chat Socket Service
 * Manages socket.io connection and events for the global chat feature
 */
class ChatSocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.handlers = {
      newMessage: [],
      previousMessages: [],
      userJoined: [],
      userLeft: [],
      userTyping: [],
      userStoppedTyping: [],
      error: [],
    };
  }

  /**
   * Connect to the chat socket namespace
   * @returns {Promise} - Promise that resolves when connection is established
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        // Close existing connection if any
        this.disconnect();
        
        const socketUrl = getSocketBaseUrl();

        this.socket = io(`${socketUrl}/chat`, {
          withCredentials: true,
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000, // Increase timeout for polling
        });

        // Set up event listeners
        this.socket.on('connect', () => {
          console.log('Connected to chat socket');
          this.connected = true;
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Chat socket connection error:', error);
          this.connected = false;
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Disconnected from chat socket:', reason);
          this.connected = false;
          
          // Attempt reconnection for certain disconnect reasons
          if (reason === 'io server disconnect') {
            // The server has forcefully disconnected the socket
            // We need to manually reconnect
            setTimeout(() => {
              this.connect();
            }, 3000);
          }
        });
        
        // Handle socket errors
        this.socket.on('error', (error) => {
          console.error('Chat socket error:', error);
          this.handlers.error.forEach(handler => handler(error));
        });

        // Set up message handlers
        this.socket.on('new_message', (message) => {
          this.handlers.newMessage.forEach(handler => handler(message));
        });

        this.socket.on('message_history', (messages) => {
          this.handlers.previousMessages.forEach(handler => handler(messages));
        });

        this.socket.on('user_joined', (data) => {
          this.handlers.userJoined.forEach(handler => handler(data));
        });

        this.socket.on('userLeft', (data) => {
          this.handlers.userLeft.forEach(handler => handler(data));
        });

        this.socket.on('userTyping', (data) => {
          this.handlers.userTyping.forEach(handler => handler(data));
        });

        this.socket.on('userStoppedTyping', (data) => {
          this.handlers.userStoppedTyping.forEach(handler => handler(data));
        });

        this.socket.on('chat_error', (error) => {
          console.error('Chat socket error:', error);
          this.handlers.error.forEach(handler => handler(error));
        });
      } catch (error) {
        console.error('Error initializing chat socket:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the chat socket
   */
  disconnect() {
    if (this.socket) {
      // Remove all listeners to prevent memory leaks
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('connect_error');
      this.socket.off('error');
      this.socket.off('new_message');
      this.socket.off('message_history');
      this.socket.off('user_joined');
      this.socket.off('userLeft');
      this.socket.off('userTyping');
      this.socket.off('userStoppedTyping');
      
      // Disconnect the socket
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Send a message to the chat
   * @param {string} content - Message content
   */
  sendMessage(content) {
    if (!this.connected || !this.socket) {
      console.error('Cannot send message: not connected to chat');
      return;
    }

    this.socket.emit('send_message', { content });
  }

  /**
   * Notify that the user is typing
   */
  sendTyping() {
    if (this.connected && this.socket) {
      this.socket.emit('typing');
    }
  }

  /**
   * Notify that the user stopped typing
   */
  sendStopTyping() {
    if (this.connected && this.socket) {
      this.socket.emit('stopTyping');
    }
  }

  /**
   * Register event handlers
   * @param {string} event - Event name
   * @param {function} handler - Event handler function
   */
  on(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event].push(handler);
    }
    return () => this.off(event, handler);
  }

  /**
   * Unregister event handlers
   * @param {string} event - Event name
   * @param {function} handler - Event handler function
   */
  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }
}

// Create a singleton instance
const chatSocketService = new ChatSocketService();

export default chatSocketService;
