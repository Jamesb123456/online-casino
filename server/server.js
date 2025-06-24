import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import initChatHandlers from './src/socket/chatHandler.js';
import initLiveGamesHandlers from './src/socket/liveGamesHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import gameRoutes from './routes/games.js';
import adminRoutes from './routes/admin.js';

// Config
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(helmet());
app.use(morgan('dev'));

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/casino');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/admin', adminRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Platinum Casino API is running');
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Game rooms
  socket.on('joinGame', (gameType) => {
    socket.join(gameType);
    console.log(`User ${socket.id} joined ${gameType}`);
  });
  
  // Crash game namespace
  const crashNamespace = io.of('/crash');
  
  crashNamespace.on('connection', (socket) => {
    console.log('Client connected to crash namespace:', socket.id);
    
    // Get user from socket (simplified - in real app would use authentication)
    const user = { _id: socket.id, balance: 1000 };
    
    // Initialize crash handlers
    require('./src/socket/crashHandler')(crashNamespace);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected from crash namespace:', socket.id);
    });
  });
  
  // Roulette game namespace
  const rouletteNamespace = io.of('/roulette');
  
  rouletteNamespace.on('connection', (socket) => {
    console.log('Client connected to roulette namespace:', socket.id);
    
    // Get user from socket (simplified - in real app would use authentication)
    const user = { _id: socket.id, balance: 1000 };
    
    // Initialize roulette handlers
    require('./src/socket/rouletteHandler').initRouletteHandlers(io, socket, user);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected from roulette namespace:', socket.id);
    });
  });
  
  // Blackjack game namespace
  const blackjackNamespace = io.of('/blackjack');
  
  blackjackNamespace.on('connection', (socket) => {
    console.log('Client connected to blackjack namespace:', socket.id);
    
    // Get user from socket (simplified - in real app would use authentication)
    const user = { _id: socket.id, balance: 1000 };
    
    // Initialize blackjack handlers
    require('./src/socket/blackjackHandler')(blackjackNamespace, socket);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected from blackjack namespace:', socket.id);
    });
  });
  
  // Handle disconnection from main namespace
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize chat handlers
initChatHandlers(io);

// Initialize live games handlers
initLiveGamesHandlers(io);

// Start server
const PORT = process.env.PORT || 5001; // Changed default port to 5001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectDB();
});

export { io };