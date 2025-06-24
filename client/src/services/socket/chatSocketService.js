import { io } from 'socket.io-client';

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
   * @param {string} token - JWT auth token
   * @returns {Promise} - Promise that resolves when connection is established
   */
  connect(token) {
    return new Promise((resolve, reject) => {
      try {
        if (!token) {
          return reject(new Error('Authentication token is required for chat'));
        }
        
        // Close existing connection if any
        this.disconnect();
        
        // Create socket connection with auth token
        // Socket.IO namespace should be direct to the server without /api
        const socketUrl = 'http://localhost:5000'; // Use port 5000 to match server
        console.log('Connecting to chat server at:', socketUrl);
        
        this.socket = io(`${socketUrl}/chat`, {
          auth: { token },
          transports: ['polling'], // Use only polling since WebSocket is failing
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
              if (token) this.connect(token);
            }, 3000);
          }
        });
        
        // Handle socket errors
        this.socket.on('error', (error) => {
          console.error('Chat socket error:', error);
          this.handlers.error.forEach(handler => handler(error));
        });

        // Set up message handlers
        this.socket.on('newMessage', (message) => {
          this.handlers.newMessage.forEach(handler => handler(message));
        });

        this.socket.on('previousMessages', (messages) => {
          this.handlers.previousMessages.forEach(handler => handler(messages));
        });

        this.socket.on('userJoined', (data) => {
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

        this.socket.on('error', (error) => {
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
      this.socket.off('newMessage');
      this.socket.off('previousMessages');
      this.socket.off('userJoined');
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

    this.socket.emit('sendMessage', { content });
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
