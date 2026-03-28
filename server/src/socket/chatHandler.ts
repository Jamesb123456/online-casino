/**
 * Chat Socket Handler
 * Manages real-time communication for the global chat feature
 */

// Import Drizzle models
import Message from '../../drizzle/models/Message.js';
import UserModel from '../../drizzle/models/User.js';
import { auth } from '../../lib/auth.js';
import LoggingService from '../services/loggingService.js';

/**
 * Initialize chat handlers
 * @param {Object} io - Socket.io instance
 */
const initChatHandlers = (io) => {
  // Create a namespace for chat
  const chatNamespace = io.of('/chat');
  
  // Middleware to authenticate connections using Better Auth sessions
  chatNamespace.use(async (socket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie;
      if (!cookies) {
        return next(new Error('Authentication token required'));
      }

      const headers = new Headers();
      headers.set('cookie', cookies);
      const session = await auth.api.getSession({ headers });

      if (!session?.user) {
        return next(new Error('Invalid authentication session'));
      }

      socket.userId = Number(session.user.id);
      next();
    } catch (error) {
      LoggingService.logSystemEvent('chat_auth_error', { error: error.message }, 'error');
      next(new Error('Authentication failed'));
    }
  });
  
  chatNamespace.on('connection', async (socket) => {
    LoggingService.logGameEvent('chat', 'client_connected', { socketId: socket.id });
    
    try {
      // Get user ID from the socket (set by auth middleware)
      const userId = socket.userId;
      
      if (!userId) {
        LoggingService.logSystemEvent('chat_unauthenticated', { socketId: socket.id }, 'warning');
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect();
        return;
      }
      
      // Find the user in the database
      const user = await UserModel.findById(userId);
      
      if (!user) {
        LoggingService.logSystemEvent('chat_user_not_found', { userId }, 'warning');
        socket.emit('error', { message: 'User not found' });
        return;
      }
      
      // Add user info to socket
      socket.user = {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      };
      
      // Join the global chat room
      socket.join('global_chat');
      
      // Emit connected event with user info
      chatNamespace.to('global_chat').emit('user_joined', {
        user: socket.user,
        timestamp: new Date(),
        message: `${socket.user.username} has joined the chat`
      });
      
      // Load previous messages (most recent 50)
      const previousMessages = await Message.getRecentMessages(50);
      
      // Transform messages to have consistent structure
      const transformedMessages = previousMessages.map(msg => ({
        id: msg.id,
        _id: msg.id, // Add _id for React compatibility
        content: msg.content,
        createdAt: msg.createdAt,
        userId: msg.userId,
        isSystem: (msg as any).isSystem || false,
        username: msg.username,
        avatar: msg.avatar
      }));
        
      socket.emit('message_history', transformedMessages);
      
      // Listen for new messages
      socket.on('send_message', async (data) => {
        try {
          const { content } = data;
          
          if (!content || content.trim().length === 0) {
            socket.emit('chat_error', { message: 'Message cannot be empty' });
            return;
          }

          if (content.length > 500) {
            socket.emit('chat_error', { message: 'Message too long (max 500 characters)' });
            return;
          }

          // Create message
          const messageData = {
            content: content.trim(),
            userId: userId,
            isSystem: false,
            createdAt: new Date()
          };

          // Save to database
          const newMessage = await Message.create(messageData);

          // Format message for broadcast (simulate populate)
          const formattedMessage = {
            id: newMessage.id,
            _id: newMessage.id,
            content: newMessage.content,
            createdAt: newMessage.createdAt,
            userId: newMessage.userId,
            isSystem: newMessage.isSystem,
            username: user.username,
            avatar: user.avatar
          };

          // Broadcast message to all users in chat
          chatNamespace.to('global_chat').emit('new_message', formattedMessage);

          LoggingService.logGameEvent('chat', 'message_sent', { userId, username: user.username });
        } catch (error) {
          LoggingService.logGameEvent('chat', 'error_sending_message', { error: String(error), userId });
          socket.emit('chat_error', { message: 'Failed to send message' });
        }
      });
      
      // Handle typing indicator
      socket.on('typing', () => {
        socket.to('global_chat').emit('userTyping', {
          username: socket.user.username
        });
      });
      
      socket.on('stopTyping', () => {
        socket.to('global_chat').emit('userStoppedTyping', {
          username: socket.user.username
        });
      });
      
      // Handle disconnection
      socket.on('leave_chat', () => {
        LoggingService.logGameEvent('chat', 'client_disconnected', { socketId: socket.id, userId });
        chatNamespace.to('global_chat').emit('userLeft', {
          user: socket.user,
          timestamp: new Date(),
          message: `${socket.user?.username || 'A user'} has left the chat`
        });
      });
      
    } catch (error) {
      LoggingService.logSystemEvent('chat_handler_error', { error: String(error), socketId: socket.id }, 'error');
    }
  });
  
  return chatNamespace;
};

export default initChatHandlers;
