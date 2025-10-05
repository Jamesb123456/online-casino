# Platinum Casino

A web-based online casino featuring multiple games with admin controls, user authentication, and comprehensive logging.

## Features

- Multiple casino games (Crash, Plinko, Wheel, Roulette, Blackjack)
- User authentication system
- Admin dashboard for balance management and statistics
- Comprehensive game logging
- Real-time game updates via Socket.IO
- Global chat for authenticated users

## Technology Stack

- **Frontend:** React with Tailwind CSS
- **Backend:** Node.js with Express
- **Database:** MySQL with Drizzle ORM
- **Real-time:** Socket.IO

## Project Structure

The project is divided into two main parts:

- `client/`: React frontend with Tailwind CSS
- `server/`: Node.js/Express backend with MySQL and Drizzle

## Setup Instructions
### Environment Setup

1. Create a `.env` file in the `server` directory with the following variables:
```
PORT=5000
JWT_SECRET=your_secure_jwt_secret
CLIENT_URL=http://localhost:5173
DATABASE_URL=mysql://username:password@localhost:3306/casino
```
You can use the provided example env files:
- Copy `server/.env.example` to `server/.env` and adjust values.
- Copy `client/.env.example` to `client/.env` (set `VITE_API_URL` to your server URL).

Environment files are ignored by git; do not commit real secrets.

### Installation

#### Backend Setup

2. Configure IIS to serve the static files from the `client/dist` directory
3. Set up the Node.js server as a Windows service using a tool like pm2

## Documentation

See `project.md` for detailed project planning and architecture information.

## License

MIT - see `LICENSE`