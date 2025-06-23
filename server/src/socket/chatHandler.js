/**
 * Chat Socket Handler
 * Manages real-time communication for the global chat feature
 */

// Import models and dependencies
import Message from '../models/Message.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

/**
 * Initialize chat handlers
 * @param {Object} io - Socket.io instance
 */
const initChatHandlers = (io) => {
  // Create a namespace for chat
  const chatNamespace = io.of('/chat');
  
  // Middleware to authenticate connections
  chatNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        console.log('No token provided for chat connection');
        return next(new Error('Authentication token required'));
      }
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret');
      
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
      const user = await User.findById(userId).select('username _id avatar');
      
      if (!user) {
        console.log('User not found for chat');
        socket.emit('error', { message: 'User not found' });
        return;
      }
      
      // Add user info to socket
      socket.user = {
        id: user._id,
        username: user.username,
        avatar: user.avatar || '/default-avatar.png'
      };
      
      // Join the global chat room
      socket.join('global');
      
      // Emit connected event with user info
      chatNamespace.to('global').emit('userJoined', {
        user: socket.user,
        timestamp: new Date(),
        message: `${socket.user.username} has joined the chat`
      });
      
      // Load previous messages (most recent 50)
      const previousMessages = await Message.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('user', 'username avatar')
        .lean();
        
      socket.emit('previousMessages', previousMessages.reverse());
      
      // Listen for new messages
      socket.on('sendMessage', async (data) => {
        try {
          // Create and save message to database
          const newMessage = new Message({
            content: data.content,
            user: socket.user.id,
            createdAt: new Date()
          });
          
          await newMessage.save();
          
          // Populate user info for the response
          const populatedMessage = await Message.findById(newMessage._id)
            .populate('user', 'username avatar')
            .lean();
          
          // Broadcast the message to all connected clients in the global room
          chatNamespace.to('global').emit('newMessage', populatedMessage);
          
        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });
      
      // Handle typing indicator
      socket.on('typing', () => {
        socket.to('global').emit('userTyping', {
          username: socket.user.username
        });
      });
      
      socket.on('stopTyping', () => {
        socket.to('global').emit('userStoppedTyping', {
          username: socket.user.username
        });
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected from chat namespace:', socket.id);
        chatNamespace.to('global').emit('userLeft', {
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
