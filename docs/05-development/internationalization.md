# Internationalization (i18n)

Guide for adding multi-language support to Platinum Casino using react-i18next.

---

## Current State

The application is English-only. All user-facing strings are hardcoded in JSX components and server response messages:

- **Client:** String literals in `.jsx` files (button labels, headings, table headers, error messages, game status text like `"CRASHED"`, `"CONNECTING"`, `"No games played yet"`).
- **Server:** Response message strings in route handlers (e.g., `"User registered successfully"`, `"Invalid credentials"`, `"Insufficient balance"`).
- **Formatting:** Numbers and currency use `Intl.NumberFormat('en-US')` in some components (e.g., `WheelGame.jsx`) and `.toFixed(2)` in others.

No i18n library is installed. No translation files exist.

---

## Recommended Library: react-i18next

[react-i18next](https://react.i18next.com/) is the standard React binding for the i18next ecosystem. It is recommended for Platinum Casino because:

- It has a large ecosystem with plugins for detection, loading, and formatting.
- It supports React Suspense for lazy-loading translations.
- It works with both functional components (via `useTranslation` hook) and class components.
- It supports interpolation, pluralization, and context-based translations out of the box.
- It integrates with tools like Crowdin and Lokalise for professional translation workflows.

---

## Setup Instructions

### 1. Install Dependencies

```bash
cd client
npm install react-i18next i18next i18next-browser-languagedetector i18next-http-backend
```

| Package | Purpose |
|---|---|
| `i18next` | Core internationalization framework |
| `react-i18next` | React bindings (hooks, components, HOCs) |
| `i18next-browser-languagedetector` | Auto-detects user language from browser, URL, cookie, or localStorage |
| `i18next-http-backend` | Loads translation JSON files on demand |

### 2. Create the i18n Configuration

```javascript
// client/src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: import.meta.env.DEV,

    interpolation: {
      escapeValue: false, // React already escapes output
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    ns: ['common', 'games', 'auth', 'admin'],
    defaultNS: 'common',
  });

export default i18n;
```

### 3. Import in the Application Entry Point

```javascript
// client/src/main.jsx
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n'; // Initialize i18n before rendering

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <App />
    </Suspense>
  </React.StrictMode>
);
```

The `Suspense` wrapper is needed because `i18next-http-backend` loads translations asynchronously.

---

## Translation File Structure

```
client/
  public/
    locales/
      en/
        common.json       # Shared UI: navigation, buttons, labels, footer
        games.json         # Game-specific strings: crash, plinko, wheel, etc.
        auth.json          # Login, register, password change
        admin.json         # Admin panel: dashboard, player management
      es/
        common.json
        games.json
        auth.json
        admin.json
      pt/
        common.json
        games.json
        auth.json
        admin.json
```

### Example: `en/common.json`

```json
{
  "nav": {
    "casinoGames": "Casino Games",
    "allGames": "All Games",
    "leaderboard": "Leaderboard",
    "promotions": "Promotions",
    "supportAdmin": "Support & Admin",
    "support": "Support",
    "adminDashboard": "Admin Dashboard",
    "playerManagement": "Player Management",
    "gameStatistics": "Game Statistics",
    "transactions": "Transactions"
  },
  "balance": "Balance",
  "login": "Log In",
  "logout": "Log Out",
  "register": "Register",
  "loading": "Loading...",
  "noData": "No data available",
  "currency": "{{amount, currency}}"
}
```

### Example: `en/games.json`

```json
{
  "crash": {
    "title": "Crash",
    "status": {
      "connecting": "CONNECTING",
      "starting": "STARTING",
      "live": "LIVE",
      "crashed": "CRASHED"
    },
    "nextRound": "Next round in {{seconds}}s",
    "connectingMessage": "Connecting to game server...",
    "placeBet": "Place Bet",
    "cashOut": "Cash Out",
    "autoCashout": "Auto Cashout",
    "betAmount": "Bet Amount"
  },
  "plinko": {
    "title": "Plinko",
    "dropBall": "Drop Ball",
    "risk": "Risk",
    "riskLow": "Low",
    "riskMedium": "Medium",
    "riskHigh": "High"
  },
  "shared": {
    "gameHistory": "Game History",
    "gameStats": "Game Stats",
    "gamesPlayed": "Games Played",
    "totalWagered": "Total Wagered",
    "totalProfit": "Total Profit",
    "bestWin": "Best Win",
    "noGamesYet": "No games played yet",
    "time": "Time",
    "bet": "Bet",
    "multiplier": "Multiplier",
    "profit": "Profit"
  }
}
```

### Example: `es/games.json`

```json
{
  "crash": {
    "title": "Crash",
    "status": {
      "connecting": "CONECTANDO",
      "starting": "INICIANDO",
      "live": "EN VIVO",
      "crashed": "CRASH"
    },
    "nextRound": "Siguiente ronda en {{seconds}}s",
    "connectingMessage": "Conectando al servidor de juego...",
    "placeBet": "Apostar",
    "cashOut": "Cobrar",
    "autoCashout": "Cobro Automatico",
    "betAmount": "Monto de Apuesta"
  },
  "shared": {
    "gameHistory": "Historial de Juego",
    "gameStats": "Estadisticas",
    "gamesPlayed": "Juegos Jugados",
    "totalWagered": "Total Apostado",
    "totalProfit": "Ganancia Total",
    "bestWin": "Mejor Ganancia",
    "noGamesYet": "No se han jugado juegos aun"
  }
}
```

---

## Wrapping Components with useTranslation

### Before (Hardcoded English)

```jsx
// From CrashGame.jsx
<span className="text-xs font-bold text-white">
  {gameState.status === 'connecting' ? 'CONNECTING' :
   gameState.status === 'waiting' ? 'STARTING' :
   gameState.status === 'running' ? 'LIVE' :
   'CRASHED'}
</span>
```

### After (Translated)

```jsx
import { useTranslation } from 'react-i18next';

const CrashGame = () => {
  const { t } = useTranslation('games');

  // ...

  return (
    <span className="text-xs font-bold text-white">
      {t(`crash.status.${gameState.status === 'running' ? 'live' : gameState.status}`)}
    </span>
  );
};
```

### Before (SidebarNav)

```jsx
<NavCategory title="Casino Games" items={[
  { path: '/games/crash', label: 'Crash' },
  { path: '/games/roulette', label: 'Roulette' },
]} />
```

### After (SidebarNav)

```jsx
import { useTranslation } from 'react-i18next';

const SidebarNav = () => {
  const { t } = useTranslation('common');

  return (
    <NavCategory title={t('nav.casinoGames')} items={[
      { path: '/games/crash', label: t('nav.crash', 'Crash') },
      { path: '/games/roulette', label: t('nav.roulette', 'Roulette') },
    ]} />
  );
};
```

### With Interpolation

```jsx
// Countdown text in CrashGame
ctx.fillText(t('crash.nextRound', { seconds: gameState.countdown }), width / 2, height / 2);
```

### Language Switcher Component

```jsx
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Espanol' },
    { code: 'pt', label: 'Portugues' },
  ];

  return (
    <select
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="bg-gray-800 text-white rounded px-2 py-1 text-sm"
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  );
};
```

---

## Server-Side Considerations

### Error Messages

Server responses currently return English strings like `"Invalid credentials"` and `"User registered successfully"`. Two approaches:

**Option A: Return error codes, translate on client (Recommended)**

```typescript
// Server returns a code
res.status(401).json({ message: 'INVALID_CREDENTIALS' });
```

```jsx
// Client maps code to translated string
const errorMessage = t(`errors.${response.message}`, 'An error occurred');
```

This keeps the server language-agnostic. The client already has the translation context and can map codes to localized strings.

**Option B: Server reads Accept-Language header**

```typescript
import i18next from 'i18next';

// Parse Accept-Language header
const lng = req.headers['accept-language']?.split(',')[0] || 'en';
const message = i18next.t('auth.invalidCredentials', { lng });
res.status(401).json({ message });
```

This is more complex and requires maintaining translation files on the server. Only recommended if the API is consumed by non-browser clients that cannot translate on their own.

### Validation Messages

Zod validation errors are currently returned in English via `parsed.error.flatten()`. For localized validation:

1. Map Zod error codes to translation keys on the client.
2. Or use [zod-i18n-map](https://github.com/aiji42/zod-i18n-map) for server-side Zod message localization.

---

## RTL Language Support

If right-to-left languages (Arabic, Hebrew) are added in the future:

### 1. Set the HTML `dir` Attribute

```javascript
// In the i18n config, listen for language change
i18n.on('languageChanged', (lng) => {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
  const dir = rtlLanguages.includes(lng) ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
});
```

### 2. Use Tailwind CSS Logical Properties

Tailwind v4 supports `start` and `end` variants for RTL:

```jsx
// Instead of:
<div className="ml-4 text-left">

// Use:
<div className="ms-4 text-start">
```

The `ms-` (margin-inline-start) and `me-` (margin-inline-end) utilities automatically flip for RTL layouts.

### 3. Review Sidebar Layout

The `SidebarNav` component uses `border-l-2 border-[#ffc107]` for the active indicator. For RTL, this should be `border-s-2` (border-inline-start) so it appears on the correct side.

---

## Date, Number, and Currency Formatting

### Numbers and Currency

Replace hardcoded `toFixed(2)` with `Intl.NumberFormat` using the current locale:

```javascript
import { useTranslation } from 'react-i18next';

const useFormatting = () => {
  const { i18n } = useTranslation();
  const locale = i18n.language;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD', // Or make currency configurable
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat(locale).format(number);
  };

  return { formatCurrency, formatNumber };
};
```

Some components like `WheelGame.jsx` already use `Intl.NumberFormat('en-US')` -- these should be updated to use the dynamic locale instead.

### Dates

```javascript
const formatDate = (date) => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
};

const formatTime = (date) => {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};
```

Several game components (`PlinkoGame.jsx`, `WheelGame.jsx`) already have `formatTime` helper functions that use `toLocaleTimeString`. These should use the i18n locale rather than relying on the browser default.

---

## Priority Languages

Recommended order based on typical online casino demographics:

| Priority | Language | Code | Notes |
|---|---|---|---|
| 1 | English | `en` | Current default, already complete |
| 2 | Spanish | `es` | Large global gaming market |
| 3 | Portuguese | `pt` | Brazil is a major market |
| 4 | French | `fr` | Canada and West Africa |
| 5 | German | `de` | Strong European market |
| 6 | Japanese | `ja` | Significant gaming culture |
| 7 | Korean | `ko` | Growing online gaming market |
| 8 | Arabic | `ar` | RTL support required -- add after the LTR languages are stable |

Start with English, Spanish, and Portuguese. Add others incrementally based on user analytics.

---

## Implementation Checklist

1. Install `react-i18next`, `i18next`, `i18next-browser-languagedetector`, `i18next-http-backend`.
2. Create `client/src/i18n.js` with the configuration above.
3. Import `i18n.js` in `main.jsx` and wrap `App` in `Suspense`.
4. Extract all English strings from components into `public/locales/en/*.json`.
5. Wrap all components with `useTranslation` and replace hardcoded strings with `t()` calls.
6. Replace hardcoded `Intl.NumberFormat('en-US')` calls with locale-aware formatting.
7. Add a `LanguageSwitcher` component to the header or sidebar.
8. Create translation files for Spanish (`es`) and Portuguese (`pt`).
9. Decide on server error message strategy (error codes vs server-side translation).
10. Test with RTL languages if Arabic or Hebrew support is planned.

---

## Related Documents

- [Coding Standards](./coding-standards.md) -- file naming and component patterns to follow when adding i18n
- [Project Structure](./project-structure.md) -- where translation files and the i18n config should live
- [REST API Reference](../04-api/rest-api.md) -- server response messages that may need localization
- [Error Codes Reference](../04-api/error-codes.md) -- error codes that could serve as translation keys
- [Mobile Responsiveness](./mobile-responsiveness.md) -- RTL considerations overlap with responsive layout
- [Technology Stack](../01-overview/technology-stack.md) -- libraries used in the project
- [Roadmap](../11-roadmap/roadmap.md) -- planned feature timeline
