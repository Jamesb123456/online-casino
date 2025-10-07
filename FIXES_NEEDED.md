# Fixes Needed for Server to Start

## Summary

The server won't start because several game handler files use CommonJS (`require`/`module.exports`) but the project is configured as ESM (`type: "module"` in package.json).

## Files That Need Converting to ESM:

### ✅ Already Fixed:
- `server/src/socket/crashHandler.ts` - ✅ Converted
- `server/src/socket/rouletteHandler.ts` - ✅ Converted  
- `server/drizzle/db.ts` - ✅ Fixed database URL encoding
- `server/middleware/socket/socketAuth.ts` - ✅ Fixed syntax errors

### ❌ Still Need Fixing:

1. **server/src/socket/landminesHandler.ts**
   - Lines to fix:
     - Line 5: `const balanceService = require('../services/balanceService');`
     - Line 6: `const loggingService = require('../services/loggingService');`
     - Line 9: `const GameStat = require('../../models/GameStat.js').default;`
     - Line 62: `const seedrandom = require('seedrandom');`
     - Line 541-543: `module.exports = { initLandminesHandlers };`
   
   - Convert to:
     ```typescript
     import BalanceService from '../services/balanceService.js';
     import LoggingService from '../services/loggingService.js';
     import GameStat from '../../models/GameStat.js';
     import seedrandom from 'seedrandom';
     
     // At end of file:
     export default initLandminesHandlers;
     export { initLandminesHandlers };
     ```

2. **server/src/socket/plinkoHandler.ts**
   - Similar pattern - replace all `require()` with `import`
   - Replace `module.exports` with `export default`

3. **server/src/socket/wheelHandler.ts**
   - Similar pattern - replace all `require()` with `import`
   - Replace `module.exports` with `export default`

## Quick Fix to Get Server Running Now

### Option 1: Comment out problem handlers temporarily

Edit `server/server.ts` and comment out the handlers that aren't fixed yet:

```typescript
// Comment these sections until handlers are fixed:
// Lines 137-147 (roulette) - Actually this is fixed, uncomment if needed
// Lines 171-181 (landmines)
// Lines 225-235 (plinko)
// Lines 249-259 (wheel)
```

### Option 2: Fix remaining handlers

Run this script to convert remaining handlers:

```bash
cd server
# Backup first
cp src/socket/landminesHandler.ts src/socket/landminesHandler.ts.backup
cp src/socket/plinkoHandler.ts src/socket/plinkoHandler.ts.backup
cp src/socket/wheelHandler.ts src/socket/wheelHandler.ts.backup

# Then manually convert require() to import and module.exports to export default
```

## Current Status

- ✅ Security: .env properly gitignored, credentials removed from examples
- ✅ Database: URL encoding fixed for special characters in passwords
- ✅ Documentation: README, SECURITY.md created
- ✅ Crash game: Handler converted to ESM
- ✅ Roulette game: Handler converted to ESM
- ❌ Other games: Need ESM conversion (landmines, plinko, wheel)
- ❌ Server: Won't start until all handlers are ESM or commented out

## Next Steps

1. Either comment out unfinished handlers in server.ts
2. Or complete ESM conversion for remaining 3 handlers
3. Test server starts: `npm run start:ts`
4. Test client connects: `npm run dev` in client folder
5. Test login works

## Database Setup

Don't forget to encode your DATABASE_URL if it has special characters:
```bash
cd server
node encode-db-password.js
```

Then update your `.env` file with the encoded URL.
