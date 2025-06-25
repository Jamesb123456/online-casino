import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import type { Socket } from 'socket.io';
// import initChatHandlers from './src/socket/chatHandler.js';
// import initLiveGamesHandlers from './src/socket/liveGamesHandler.js';

// Socket Authentication Middleware
import { socketAuth, getAuthenticatedUser } from './middleware/socket/socketAuth.js';

// Drizzle Database Connection
import { connectDB, closeDB } from './drizzle/db.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import gameRoutes from './routes/games.js';
import adminRoutes from './routes/admin.js';
import loginRewardsRoutes from './routes/login-rewards.js';

// Config
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(helmet());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rewards', loginRewardsRoutes);

// Root route
app.get('/', (req: express.Request, res: express.Response) => {
  res.send('Platinum Casino API is running');
});

// Define all namespaces outside the main connection handler
// Apply authentication middleware to all game namespaces
// Crash game namespace
const crashNamespace = io.of('/crash');

// Apply authentication middleware to crash namespace
crashNamespace.use(socketAuth);

crashNamespace.on('connection', (socket) => {
  console.log('Client connected to crash namespace:', socket.id);
  
  // Get authenticated user from socket
  const user = getAuthenticatedUser(socket);
  if (!user) {
    console.error('Unauthenticated connection attempt to crash namespace');
    socket.disconnect();
    return;
  }
  
  console.log(`Authenticated user ${user.username} connected to crash namespace`);
  
  // Initialize crash handlers
  // require('./src/socket/crashHandler')(crashNamespace);
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User ${user.username} disconnected from crash namespace`);
  });
});

// Roulette game namespace
const rouletteNamespace = io.of('/roulette');

// Apply authentication middleware to roulette namespace
rouletteNamespace.use(socketAuth);

rouletteNamespace.on('connection', (socket) => {
  console.log('Client connected to roulette namespace:', socket.id);
  
  // Get authenticated user from socket
  const user = getAuthenticatedUser(socket);
  if (!user) {
    console.error('Unauthenticated connection attempt to roulette namespace');
    socket.disconnect();
    return;
  }
  
  console.log(`Authenticated user ${user.username} connected to roulette namespace`);
  
  // Initialize roulette handlers
  // require('./src/socket/rouletteHandler').initRouletteHandlers(io, socket, user);
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User ${user.username} disconnected from roulette namespace`);
  });
});

// Landmines game namespace
const landminesNamespace = io.of('/landmines');

// Apply authentication middleware to landmines namespace
landminesNamespace.use(socketAuth);

landminesNamespace.on('connection', (socket) => {
  console.log('Client connected to landmines namespace:', socket.id);
  
  // Get authenticated user from socket
  const user = getAuthenticatedUser(socket);
  if (!user) {
    console.error('Unauthenticated connection attempt to landmines namespace');
    socket.disconnect();
    return;
  }
  
  console.log(`Authenticated user ${user.username} connected to landmines namespace`);
  
  // Initialize landmines handlers
  // require('./src/socket/landminesHandler').initLandminesHandlers(io, socket, user);
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User ${user.username} disconnected from landmines namespace`);
  });
});

// Blackjack game namespace
const blackjackNamespace = io.of('/blackjack');

// Apply authentication middleware to blackjack namespace
blackjackNamespace.use(socketAuth);

blackjackNamespace.on('connection', (socket) => {
  console.log('Client connected to blackjack namespace:', socket.id);
  
  // Get authenticated user from socket
  const user = getAuthenticatedUser(socket);
  if (!user) {
    console.error('Unauthenticated connection attempt to blackjack namespace');
    socket.disconnect();
    return;
  }
  
  console.log(`Authenticated user ${user.username} connected to blackjack namespace`);
  
  // Initialize blackjack handlers
  // require('./src/socket/blackjackHandler')(blackjackNamespace, socket);
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User ${user.username} disconnected from blackjack namespace`);
  });
});

// Socket.io main namespace connection
io.on('connection', (socket: Socket) => {
  console.log('New client connected:', socket.id);
  
  // Check authentication before allowing game room joins
  socket.on('joinGame', (gameType, callback) => {
    // Only authenticated sockets can join game rooms
    if (!(socket as any).user) {
      console.log(`Unauthenticated user ${socket.id} attempted to join ${gameType}`);
      
      if (callback) {
        callback({ 
          success: false, 
          error: 'Authentication required to join games' 
        });
      }
      
      // Prevent join and disconnect the socket
      socket.disconnect();
      return;
    }
    
    // If authenticated, allow join
    socket.join(gameType);
    const username = (socket as any).user?.username || socket.id;
    console.log(`User ${username} joined ${gameType}`);
    
    if (callback) {
      callback({ success: true });
    }
  });
  
  // Handle disconnection from main namespace
  socket.on('disconnect', () => {
    const username = (socket as any).user?.username || socket.id;
    console.log(`Client disconnected: ${username}`);
  });
});

// Initialize chat handlers
// initChatHandlers(io);

// Initialize live games handlers
// initLiveGamesHandlers(io);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 5000; // Default port 5000
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectDB();
});

export { io };