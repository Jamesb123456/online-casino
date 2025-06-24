# Online Casino Server

A Node.js server application for an online casino platform built with Express, Socket.IO, and Drizzle ORM.

## Features

- **User Authentication & Authorization**: JWT-based authentication with role-based access control
- **Real-time Gaming**: Socket.IO powered real-time game experiences
- **Multiple Games**: Blackjack, Roulette, Crash, Landmines, Plinko, Wheel
- **Admin Dashboard**: Comprehensive admin panel for user and game management
- **Balance Management**: Secure transaction and balance tracking system
- **Chat System**: Real-time chat functionality
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: Socket.IO
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet, CORS, bcryptjs
- **Environment**: dotenv

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd online-casino-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/casino_db
   
   # JWT
   JWT_SECRET=your-super-secret-jwt-key-here
   
   # Server
   PORT=5000
   CLIENT_URL=http://localhost:5173
   
   # Environment
   NODE_ENV=development
   ```

4. **Database Setup**
   ```bash
   # Generate migrations (if needed)
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   
   # Seed the database
   npm run db:seed
   ```

5. **Create Admin User**
   ```bash
   npm run create-admin
   ```

## Scripts

- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon
- `npm run db:generate` - Generate new database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed the database with initial data
- `npm run create-admin` - Create an admin user
- `npm run init-stats` - Initialize game statistics

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/balance` - Get user balance
- `GET /api/users/balance/history` - Get balance history
- `GET /api/users/transactions` - Get user transactions

### Admin (Requires Admin Role)
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create new user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Deactivate user
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/games` - Get game statistics
- `GET /api/admin/transactions` - Get all transactions
- `POST /api/admin/transactions` - Create manual transaction
- `PUT /api/admin/transactions/:id/void` - Void transaction

## Socket.IO Namespaces

### Chat (`/chat`)
- `join_chat` - Join global chat
- `send_message` - Send chat message
- `leave_chat` - Leave chat

### Blackjack (`/blackjack`)
- `blackjack_start` - Start new game
- `blackjack_hit` - Hit (draw card)
- `blackjack_stand` - Stand (end turn)
- `blackjack_double` - Double down

### Other Games
- `/crash` - Crash game
- `/roulette` - Roulette game
- `/landmines` - Landmines game
- `/plinko` - Plinko game
- `/wheel` - Wheel game

## Database Schema

The application uses the following main entities:

- **Users**: User accounts with authentication and role management
- **Balances**: User balance tracking with history
- **Transactions**: Financial transaction records
- **GameSessions**: Individual game session tracking
- **GameLogs**: Detailed game action logging
- **GameStats**: Aggregated game statistics
- **Messages**: Chat message storage

## Development

### Adding New Games

1. Create a new socket handler in `src/socket/`
2. Add the game namespace in `server.js`
3. Update game statistics in `GameStat` model
4. Add any game-specific database tables

### Database Changes

1. Modify schema in `drizzle/schema.js`
2. Generate migration: `npm run db:generate`
3. Run migration: `npm run db:migrate`

## Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- CORS protection
- Helmet security headers
- Rate limiting on auth endpoints
- Input validation and sanitization

## Logging

The application includes comprehensive logging for:
- Game actions and outcomes
- User authentication events
- Admin actions
- System events
- Transaction records

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a secure `JWT_SECRET`
3. Configure proper PostgreSQL connection
4. Set up SSL/TLS
5. Configure reverse proxy (nginx)
6. Set up monitoring and logging

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team. 