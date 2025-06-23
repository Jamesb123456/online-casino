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
- **Database:** MongoDB
- **Real-time:** Socket.IO

## Project Structure

The project is divided into two main parts:

- `client/`: React frontend with Tailwind CSS
- `server/`: Node.js/Express backend with MongoDB

## Setup Instructions

### Prerequisites

- Node.js (v16 or newer)
- MongoDB (local or Atlas)

### Environment Setup

1. Create a `.env` file in the `server` directory with the following variables:

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/casino
JWT_SECRET=your_secure_jwt_secret
CLIENT_URL=http://localhost:5173
```

### Installation

#### Backend Setup

```bash
cd server
npm install
npm run dev
```

#### Frontend Setup

```bash
cd client
npm install
npm run dev
```

## Development Guidelines

- Follow the component structure defined in the project
- Use Tailwind CSS for styling
- Create reusable components when possible
- Follow the API routes documentation for backend integration

## Deployment

This application is configured to run on a Windows Server environment:

1. Build the frontend: `cd client && npm run build`
2. Configure IIS to serve the static files from the `client/dist` directory
3. Set up the Node.js server as a Windows service using a tool like pm2

## Documentation

See `project.md` for detailed project planning and architecture information.

## License

Private - Not for distribution