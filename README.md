# 🎰 Platinum Casino

A web-based online casino featuring multiple games with admin controls, user authentication, and comprehensive logging.

## ✨ Features

- 🎮 Multiple casino games (Crash, Plinko, Wheel, Roulette, Blackjack)
- 🔐 Secure user authentication system
- 👨‍💼 Admin dashboard for balance management and statistics
- 📊 Comprehensive game logging
- ⚡ Real-time game updates via Socket.IO
- 💬 Global chat for authenticated users

## 🛠️ Technology Stack

- **Frontend:** React with Tailwind CSS
- **Backend:** Node.js with Express & TypeScript
- **Database:** MySQL with Drizzle ORM
- **Real-time:** Socket.IO

## 📁 Project Structure

```
online-casino/
├── client/          # React frontend
│   ├── src/
│   └── package.json
├── server/          # Express backend
│   ├── drizzle/     # Database schema & migrations
│   ├── routes/      # API routes
│   ├── middleware/  # Auth & socket middleware
│   └── package.json
└── start.ps1        # Windows startup script
```

## 🚀 Quick Start (Windows)

### Prerequisites

- Node.js v18+ and npm
- MySQL database

### Easy Setup

1. **Clone the repository**
   ```powershell
   git clone <your-repo-url>
   cd online-casino
   ```

2. **Configure environment**
   ```powershell
   # Create server/.env file
   cp server/.env.example server/.env
   
   # If your MySQL password has special characters, encode it:
   cd server
   node encode-db-password.js
   ```

3. **Edit `server/.env`** with your values:
   ```env
   PORT=5000
   CLIENT_URL=http://localhost:5173
   JWT_SECRET=<generate-strong-secret>
   DATABASE_URL=mysql://username:password@host:3306/casino
   ```

4. **Run the startup script**
   ```powershell
   .\start.ps1
   ```

   This will:
   - Install dependencies
   - Run database migrations
   - Seed initial data
   - Start both server and client

5. **Access the application**
   - Client: http://localhost:5173
   - Server API: http://localhost:5000

### Default Login Credentials

- **Admin:** username=`admin`, password=`admin123`
- **Player:** username=`player1`, password=`password123`

⚠️ **Change these credentials in production!**

## 🔧 Manual Setup

### Server Setup

```powershell
cd server
npm install
npm run db:migrate
npm run seed
npm run start:ts
```

### Client Setup

```powershell
cd client
npm install
npm run dev
```

## 🔒 Security Notes

### For Development

- Never commit `.env` files
- Use strong, unique passwords
- Change default admin credentials

### For Production

1. Generate a strong JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. Use environment variables or a secrets manager
3. Enable HTTPS
4. Configure proper CORS settings
5. Set up rate limiting
6. Use a production database with proper access controls

## 📚 Documentation

- [Project Architecture](project.md)
- [Quick Fixes Guide](QUICK_FIXES.md)
- [Action Plan](ACTION_PLAN.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT - see [LICENSE](LICENSE) file

## ⚠️ Disclaimer

This is educational software. Ensure compliance with local gambling laws before deployment.