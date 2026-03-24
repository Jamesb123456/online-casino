// @ts-nocheck
/**
 * Chat Socket Handler
 * Manages real-time communication for the global chat feature
 */

// Import Drizzle models
import Message from '../../drizzle/models/Message.js';
import UserModel from '../../drizzle/models/User.js';
import jwt from 'jsonwebtoken';

/**
 * Initialize chat handlers
 * @param {Object} io - Socket.io instance
 */
const initChatHandlers = (io) => {
  // Create a namespace for chat
  const chatNamespace = io.of('/chat');
  
  // Middleware to authenticate connections using cookies
  chatNamespace.use(async (socket, next) => {
    try {
      // Get cookies from the socket handshake
      const cookies = socket.handshake.headers.cookie;
      
      if (!cookies) {
        console.log('No cookies provided for chat connection');
        return next(new Error('Authentication token required'));
      }
      
      // Parse the authToken cookie
      const cookieArray = cookies.split(';');
      let authToken = null;
      
      for (const cookie of cookieArray) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'authToken') {
          authToken = value;
          break;
        }
      }
      
      if (!authToken) {
        console.log('No authToken cookie found for chat connection');
        return next(new Error('Authentication token required'));
      }
      
      // Verify token
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'default_jwt_secret');
      
      if (!decoded || !decoded.userId) {
        console.log('Invalid token for chat connection');
        return next(new Error('Invalid authentication token'));
      }
      
      // Store user ID in socket for later use
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      console.error('Authentication error in chat socket:', error.message);
      next(new Error('Authentication failed'));
    }
  });
  
  chatNamespace.on('connection', async (socket) => {
    console.log('Client connected to chat namespace:', socket.id);
    
    try {
      // Get user ID from the socket (set by auth middleware)
      const userId = socket.userId;
      
      if (!userId) {
        console.log('Unauthenticated connection attempt to chat');
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect();
        return;
      }
      
      // Find the user in the database
      const user = await UserModel.findById(userId);
      
      if (!user) {
        console.log('User not found for chat');
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
        isSystem: msg.isSystem || false,
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

          console.log(`Message from ${user.username}: ${content}`);
        } catch (error) {
          console.error('Error sending message:', error);
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
        console.log('Client disconnected from chat namespace:', socket.id);
        chatNamespace.to('global_chat').emit('userLeft', {
          user: socket.user,
          timestamp: new Date(),
          message: `${socket.user?.username || 'A user'} has left the chat`
        });
      });
      
    } catch (error) {
      console.error('Error in chat handler:', error);
    }
  });
  
  return chatNamespace;
};

export default initChatHandlers;
