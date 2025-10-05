# Platinum Casino - Action Plan

**Last Updated:** October 5, 2025

This document provides a **step-by-step action plan** to fix critical issues and complete missing features based on the comprehensive project review.

---

## Phase 1: Critical Fixes (Week 1) 🔴

**Goal:** Make the application fully functional and secure

### Task 1.1: Initialize Socket Game Handlers
**Priority:** CRITICAL  
**Estimated Time:** 2-3 hours

**Steps:**
1. Create proper exports in socket handlers
2. Update `server/server.ts` to uncomment and initialize handlers
3. Test each game namespace connection
4. Verify game functionality

**Files to Modify:**
- `server/server.ts` (lines 84, 112, 140, 168, 216, 219)
- `server/src/socket/crashHandler.ts`
- `server/src/socket/rouletteHandler.ts`
- `server/src/socket/landminesHandler.ts`
- `server/src/socket/blackjackHandler.ts`
- `server/src/socket/plinkoHandler.ts`
- `server/src/socket/wheelHandler.ts`
- `server/src/socket/chatHandler.ts`
- `server/src/socket/liveGamesHandler.ts`

**Verification:**
```bash
# Test socket connections for each game
# All games should connect and allow betting
```

---

### Task 1.2: Fix Security Issues
**Priority:** CRITICAL  
**Estimated Time:** 1 hour

**Steps:**

1. **Generate Strong JWT Secret:**
   ```bash
   # On Windows PowerShell:
   [Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))
   ```

2. **Create .env.example Template:**
   ```env
   PORT=5000
   JWT_SECRET=your_jwt_secret_here_generate_using_openssl
   CLIENT_URL=http://localhost:5173
   DATABASE_URL=mysql://username:password@host:port/database
   ```

3. **Update .env with Secure Credentials:**
   - Generate new JWT_SECRET
   - Remove MONGO_URI
   - Document but don't commit actual credentials

**Files to Create/Modify:**
- `server/.env.example` (CREATE)
- `client/.env.example` (CREATE)
- `server/.env` (UPDATE - don't commit)

---

### Task 1.3: Update .gitignore Files
**Priority:** CRITICAL  
**Estimated Time:** 15 minutes

**Client .gitignore:**
```gitignore
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Production build
dist/
build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
```

**Server .gitignore:**
```gitignore
# Dependencies
node_modules/
npm-debug.log*

# Build
dist/
build/

# Environment variables
.env
.env.*
!.env.example

# Database
*.db
*.sqlite

# Logs
logs/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# TypeScript
*.tsbuildinfo
```

---

### Task 1.4: Update Documentation
**Priority:** HIGH  
**Estimated Time:** 1 hour

**Files to Update:**

1. **README.md:**
   - Change "MongoDB" to "MySQL"
   - Update database setup instructions
   - Remove MongoDB installation steps
   - Add MySQL/Drizzle setup

2. **server/README.md:**
   - Change "PostgreSQL" to "MySQL"
   - Update connection string format
   - Update all PostgreSQL references

3. **project.md:**
   - Add "Actual Implementation" section
   - Note database change from planned MongoDB to MySQL
   - Update tech stack section

---

### Task 1.5: Rebuild Server from TypeScript
**Priority:** HIGH  
**Estimated Time:** 10 minutes

**Steps:**
```bash
cd server
npm run build
```

**Verification:**
- Check `server/dist/server.js` includes login rewards route
- Verify all handlers are properly compiled

---

## Phase 2: Code Quality Improvements (Week 2) 🟠

### Task 2.1: Implement Proper Logging
**Priority:** HIGH  
**Estimated Time:** 3-4 hours

**Steps:**
1. Update `server.ts` to import and use LoggingService
2. Replace all `console.log()` with appropriate log levels
3. Configure Winston transports (file, console)
4. Add request logging middleware

**Log Levels to Use:**
- `error` - Errors and exceptions
- `warn` - Warning conditions
- `info` - Informational messages
- `debug` - Debug information

**Files to Modify:**
- `server/server.ts`
- `server/middleware/socket/socketAuth.ts`
- All socket handlers
- All route handlers
- All scripts

---

### Task 2.2: Complete TODO Items
**Priority:** HIGH  
**Estimated Time:** 2 hours

**TODOs to Complete:**

1. **Crash Game Error Notifications** (`client/src/games/crash/CrashGame.jsx`):
   - Lines 491, 532
   - Use ToastContext to show error messages

2. **Plinko Error Notifications** (`client/src/games/plinko/PlinkoGame.jsx`):
   - Line 111
   - Implement error toast

**Implementation:**
```javascript
import { useToast } from '../../context/ToastContext';

const { addToast } = useToast();

// On error:
addToast('Failed to place bet. Please try again.', 'error');
```

---

### Task 2.3: Add Rate Limiting
**Priority:** HIGH  
**Estimated Time:** 1 hour

**Implementation:**

Create `server/middleware/rateLimiter.ts`:
```typescript
import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, please try again later.'
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100 // 100 requests per window
});
```

Apply to routes:
```typescript
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', apiLimiter);
```

---

### Task 2.4: Standardize Module System
**Priority:** MEDIUM  
**Estimated Time:** 2-3 hours

**Steps:**
1. Convert all `module.exports` to `export default`
2. Convert all `require()` to `import`
3. Update socket handlers to use ES6 exports
4. Test all imports/exports

---

## Phase 3: Testing Infrastructure (Week 3) 🟡

### Task 3.1: Setup Testing Framework
**Priority:** MEDIUM  
**Estimated Time:** 4-6 hours

**Frontend Testing (Vitest + React Testing Library):**
```bash
cd client
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Backend Testing (Vitest):**
```bash
cd server
npm install -D vitest @vitest/coverage-v8
```

**Create Test Files:**
- `client/src/__tests__/` - Component tests
- `server/__tests__/` - API and unit tests

---

### Task 3.2: Write Initial Tests
**Priority:** MEDIUM  
**Estimated Time:** 6-8 hours

**Minimum Test Coverage:**

1. **Authentication Tests:**
   - User registration
   - User login
   - Token validation
   - Protected route access

2. **Balance Service Tests:**
   - Debit balance
   - Credit balance
   - Transaction creation
   - Balance history

3. **Game Logic Tests:**
   - Bet placement
   - Win calculation
   - House edge verification

4. **Component Tests:**
   - Header component
   - Login form
   - Game cards
   - Admin dashboard

**Target:** >50% code coverage

---

### Task 3.3: Setup CI/CD Pipeline
**Priority:** LOW  
**Estimated Time:** 3-4 hours

**Create `.github/workflows/test.yml`:**
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
```

---

## Phase 4: Missing Features (Week 4) 🟢

### Task 4.1: Add Health Check Endpoints
**Priority:** MEDIUM  
**Estimated Time:** 30 minutes

**Implementation:**
```typescript
// In server/server.ts
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/health/db', async (req, res) => {
  try {
    // Test database connection
    await db.execute('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});
```

---

### Task 4.2: Add Input Validation
**Priority:** MEDIUM  
**Estimated Time:** 4-6 hours

**Install Zod:**
```bash
cd server
npm install zod
```

**Create Validation Schemas:**
```typescript
// server/validators/auth.ts
import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(100)
});

export const loginSchema = z.object({
  username: z.string(),
  password: z.string()
});
```

**Apply to Routes:**
```typescript
import { registerSchema } from '../validators/auth';

router.post('/register', async (req, res) => {
  try {
    const validated = registerSchema.parse(req.body);
    // Process registration
  } catch (error) {
    return res.status(400).json({ errors: error.errors });
  }
});
```

---

### Task 4.3: Docker Configuration
**Priority:** LOW  
**Estimated Time:** 2-3 hours

**Create `Dockerfile` (server):**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

**Create `docker-compose.yml`:**
```yaml
version: '3.8'

services:
  server:
    build: ./server
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - db

  client:
    build: ./client
    ports:
      - "5173:5173"
    depends_on:
      - server

  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: casino
    volumes:
      - db_data:/var/lib/mysql

volumes:
  db_data:
```

---

### Task 4.4: PM2 Configuration
**Priority:** MEDIUM  
**Estimated Time:** 30 minutes

**Create `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'casino-server',
    script: './dist/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
```

**Install PM2:**
```bash
npm install -g pm2
```

**Start with PM2:**
```bash
cd server
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Phase 5: Performance & Optimization (Future)

### Task 5.1: Redis Caching
**Priority:** LOW  
**Estimated Time:** 6-8 hours

**Use Cases:**
- User session storage
- Game state caching
- Leaderboard caching
- Statistics aggregation

---

### Task 5.2: Socket.IO Redis Adapter
**Priority:** LOW  
**Estimated Time:** 2-3 hours

**Implementation:**
```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

---

### Task 5.3: Database Query Optimization
**Priority:** LOW  
**Estimated Time:** 4-6 hours

**Actions:**
- Analyze slow queries
- Add compound indexes
- Implement query result caching
- Optimize N+1 queries

---

## Task Tracking

### Critical Tasks (Complete First)
- [ ] 1.1 Initialize Socket Game Handlers
- [ ] 1.2 Fix Security Issues
- [ ] 1.3 Update .gitignore Files
- [ ] 1.4 Update Documentation
- [ ] 1.5 Rebuild Server from TypeScript

### High Priority Tasks
- [ ] 2.1 Implement Proper Logging
- [ ] 2.2 Complete TODO Items
- [ ] 2.3 Add Rate Limiting
- [ ] 2.4 Standardize Module System

### Medium Priority Tasks
- [ ] 3.1 Setup Testing Framework
- [ ] 3.2 Write Initial Tests
- [ ] 4.1 Add Health Check Endpoints
- [ ] 4.2 Add Input Validation
- [ ] 4.4 PM2 Configuration

### Low Priority Tasks
- [ ] 3.3 Setup CI/CD Pipeline
- [ ] 4.3 Docker Configuration
- [ ] 5.1 Redis Caching
- [ ] 5.2 Socket.IO Redis Adapter
- [ ] 5.3 Database Query Optimization

---

## Progress Tracking

**Week 1:** ☐ Critical Fixes (0/5 complete)  
**Week 2:** ☐ Code Quality (0/4 complete)  
**Week 3:** ☐ Testing (0/3 complete)  
**Week 4:** ☐ Features (0/4 complete)

---

## Resources & References

- **Drizzle ORM Docs:** https://orm.drizzle.team/
- **Socket.IO Docs:** https://socket.io/docs/v4/
- **Winston Logging:** https://github.com/winstonjs/winston
- **Vitest:** https://vitest.dev/
- **Zod Validation:** https://zod.dev/

---

**Document Version:** 1.0  
**Last Updated:** October 5, 2025
