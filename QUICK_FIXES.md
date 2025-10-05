# Quick Fixes Checklist

**Purpose:** Immediate fixes to make the casino functional  
**Time Required:** ~4-6 hours  
**Priority:** CRITICAL

---

## ✅ Pre-Flight Checklist

Before starting, ensure you have:
- [ ] Git repository is clean (commit or stash changes)
- [ ] Node.js v16+ installed
- [ ] MySQL database accessible
- [ ] Backup of current `.env` files

---

## 🔥 Critical Fix #1: Enable Socket Game Handlers

**Status:** ❌ BLOCKING - Games cannot function  
**Time:** ~2 hours

### Step 1: Fix Crash Handler Export

**File:** `server/src/socket/crashHandler.ts`

Find line 37:
```typescript
module.exports = function(namespace) {
```

Replace with:
```typescript
export default function initCrashHandlers(namespace) {
```

### Step 2: Fix Roulette Handler Export

**File:** `server/src/socket/rouletteHandler.ts`

Add at the end of file:
```typescript
export default initRouletteHandlers;
```

### Step 3: Fix Other Game Handlers

Apply similar export fixes to:
- `server/src/socket/landminesHandler.ts`
- `server/src/socket/blackjackHandler.ts`
- `server/src/socket/plinkoHandler.ts`
- `server/src/socket/wheelHandler.ts`

### Step 4: Update Server.ts

**File:** `server/server.ts`

Add imports at top (after line 14):
```typescript
import initCrashHandlers from './src/socket/crashHandler.js';
import initRouletteHandlers from './src/socket/rouletteHandler.js';
import initLandminesHandlers from './src/socket/landminesHandler.js';
import initBlackjackHandlers from './src/socket/blackjackHandler.js';
import initPlinkoHandlers from './src/socket/plinkoHandler.js';
import initWheelHandlers from './src/socket/wheelHandler.js';
import initChatHandlers from './src/socket/chatHandler.js';
import initLiveGamesHandlers from './src/socket/liveGamesHandler.js';
```

Replace line 84:
```typescript
// require('./src/socket/crashHandler')(crashNamespace);
```

With:
```typescript
initCrashHandlers(crashNamespace);
```

Do the same for other handlers.

### Step 5: Add Missing Namespaces

Add Plinko namespace (after blackjack namespace):
```typescript
// Plinko game namespace
const plinkoNamespace = io.of('/plinko');
plinkoNamespace.use(socketAuth);

plinkoNamespace.on('connection', (socket) => {
  console.log('Client connected to plinko namespace:', socket.id);
  const user = getAuthenticatedUser(socket);
  if (!user) {
    socket.disconnect();
    return;
  }
  
  initPlinkoHandlers(plinkoNamespace);
  
  socket.on('disconnect', () => {
    console.log(`User ${user.username} disconnected from plinko namespace`);
  });
});
```

Add Wheel namespace:
```typescript
// Wheel game namespace
const wheelNamespace = io.of('/wheel');
wheelNamespace.use(socketAuth);

wheelNamespace.on('connection', (socket) => {
  console.log('Client connected to wheel namespace:', socket.id);
  const user = getAuthenticatedUser(socket);
  if (!user) {
    socket.disconnect();
    return;
  }
  
  initWheelHandlers(wheelNamespace);
  
  socket.on('disconnect', () => {
    console.log(`User ${user.username} disconnected from wheel namespace`);
  });
});
```

### Step 6: Rebuild Server

```bash
cd server
npm run build
```

### ✅ Verification

Test each game:
```bash
# Start server
npm run dev

# In browser, try each game:
# - http://localhost:5173/games/crash
# - http://localhost:5173/games/roulette
# - http://localhost:5173/games/blackjack
# - http://localhost:5173/games/landmines
# - http://localhost:5173/games/plinko
# - http://localhost:5173/games/wheel
```

**Expected:** All games should connect and allow betting

---

## 🔒 Critical Fix #2: Security

**Status:** ❌ BLOCKING - Security risk  
**Time:** ~30 minutes

### Step 1: Generate Strong JWT Secret

**PowerShell (Windows):**
```powershell
# Generate random base64 string
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

Copy the output.

### Step 2: Update .env

**File:** `server/.env`

Replace:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/casino
JWT_SECRET=casino-super-secret-jwt-key-change-in-production
CLIENT_URL=http://localhost:5173
DATABASE_URL="mysql://root:[32g95P<OTN+Df6p@154.61.60.132:3306/casino"
```

With:
```env
PORT=5000
JWT_SECRET=<PASTE_GENERATED_SECRET_HERE>
CLIENT_URL=http://localhost:5173
DATABASE_URL="mysql://root:[32g95P<OTN+Df6p@154.61.60.132:3306/casino"
```

**Note:** Removed MONGO_URI (not used)

### Step 3: Create .env.example

**File:** `server/.env.example` (NEW FILE)

```env
PORT=5000
JWT_SECRET=your_generated_jwt_secret_here
CLIENT_URL=http://localhost:5173
DATABASE_URL=mysql://username:password@host:port/database_name
```

**File:** `client/.env.example` (NEW FILE)

```env
VITE_API_URL=http://localhost:5000/api
```

### ✅ Verification

- [ ] `.env` has strong JWT secret
- [ ] `.env.example` files created
- [ ] No real credentials in `.env.example`

---

## 📁 Critical Fix #3: .gitignore

**Status:** ❌ BLOCKING - May leak credentials  
**Time:** ~5 minutes

### Step 1: Update Client .gitignore

**File:** `client/.gitignore`

Replace entire file:
```gitignore
# Dependencies
node_modules/

# Build
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/
```

### Step 2: Update Server .gitignore

**File:** `server/.gitignore`

Replace entire file:
```gitignore
# Dependencies
node_modules/

# Build
dist/
build/

# Environment
.env
.env.*
!.env.example

# Database
*.db

# IDE
.vscode/
.idea/

# OS
.DS_Store

# Logs
*.log
logs/
```

### Step 3: Check Git Status

```bash
git status
```

**If .env files are staged:** Remove them!
```bash
git rm --cached server/.env
git rm --cached client/.env
```

### ✅ Verification

- [ ] `.env` files in both .gitignore
- [ ] `.env` not tracked by git
- [ ] `.env.example` IS tracked

---

## 📝 Critical Fix #4: Documentation

**Status:** ⚠️ IMPORTANT - Prevents confusion  
**Time:** ~15 minutes

### Update README.md

**File:** `README.md`

Line 18, change:
```markdown
- **Database:** MongoDB
```

To:
```markdown
- **Database:** MySQL with Drizzle ORM
```

Lines 40-44, remove:
```markdown
MONGO_URI=mongodb://localhost:27017/casino
```

### Update server/README.md

**File:** `server/README.md`

Line 13, change:
```markdown
- **Database**: PostgreSQL with Drizzle ORM
```

To:
```markdown
- **Database**: MySQL with Drizzle ORM
```

Line 18, change:
```markdown
- PostgreSQL database
```

To:
```markdown
- MySQL database
```

Line 47, change:
```markdown
DATABASE_URL=postgresql://username:password@localhost:5432/casino_db
```

To:
```markdown
DATABASE_URL=mysql://username:password@localhost:3306/casino
```

### ✅ Verification

- [ ] No MongoDB references
- [ ] No PostgreSQL references
- [ ] MySQL properly documented

---

## 🎯 Quick Win: Complete TODOs

**Status:** ⚠️ IMPORTANT - Better UX  
**Time:** ~30 minutes

### Fix Crash Game Errors

**File:** `client/src/games/crash/CrashGame.jsx`

Line 491, replace:
```javascript
// TODO: Show error toast/notification
```

With:
```javascript
addToast('Failed to place bet. Please try again.', 'error');
```

Line 532, replace:
```javascript
// TODO: Show error toast/notification
```

With:
```javascript
addToast('Failed to cash out. Please try again.', 'error');
```

Make sure `useToast` is imported at the top:
```javascript
import { useToast } from '../../context/ToastContext';
```

And used in component:
```javascript
const { addToast } = useToast();
```

### Fix Plinko Game Errors

**File:** `client/src/games/plinko/PlinkoGame.jsx`

Line 111, replace:
```javascript
// TODO: Show error notification
```

With:
```javascript
addToast('Failed to drop ball. Please try again.', 'error');
```

Add import and hook as above.

### ✅ Verification

- [ ] Error messages shown in UI
- [ ] No TODO comments remaining in game files

---

## 🔄 Final Steps

### Rebuild Everything

```bash
# Server
cd server
npm run build

# Test
npm run dev
```

In another terminal:
```bash
# Client
cd client
npm run dev
```

### Test Checklist

Visit http://localhost:5173 and test:

- [ ] Register new account
- [ ] Login works
- [ ] Can see balance
- [ ] Crash game loads and accepts bets
- [ ] Roulette game loads and accepts bets
- [ ] Blackjack game loads and accepts bets
- [ ] Landmines game loads and accepts bets
- [ ] Plinko game loads and accepts bets
- [ ] Wheel game loads and accepts bets
- [ ] Admin login works (admin/admin123)
- [ ] Admin dashboard shows stats
- [ ] Can manage players as admin

---

## 🎉 Success Criteria

After completing all quick fixes:

✅ **All 6 games functional**  
✅ **No security warnings**  
✅ **Documentation accurate**  
✅ **No credentials in git**  
✅ **Error messages display properly**

**Estimated Total Time:** 4-6 hours

---

## 🆘 Troubleshooting

### Games Still Not Working

1. Check browser console for errors
2. Check server logs for connection issues
3. Verify socket namespaces match between client and server
4. Ensure authentication middleware is working

### Database Connection Errors

1. Verify MySQL is running
2. Check DATABASE_URL credentials
3. Run migrations: `npm run db:migrate`
4. Seed database: `npm run seed`

### Build Errors

1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
2. Clear TypeScript cache:
   ```bash
   rm -rf dist/
   npm run build
   ```

---

**Document Version:** 1.0  
**Created:** October 5, 2025  
**For:** Immediate deployment preparation
