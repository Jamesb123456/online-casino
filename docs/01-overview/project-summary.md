# Project Summary

## Platinum Casino

**Version:** 1.0.0
**Status:** In Development
**License:** MIT

Platinum Casino is a web-based online casino platform featuring six real-time multiplayer games, a comprehensive admin dashboard, user authentication, and detailed analytics. The platform is designed as an educational project demonstrating full-stack development with real-time WebSocket communication.

### Key Facts

| Attribute | Value |
|-----------|-------|
| **Project Name** | Platinum Casino |
| **Type** | Web Application (SPA + REST API) |
| **Frontend** | React 18 + Tailwind CSS 4 |
| **Backend** | Node.js + Express + TypeScript |
| **Database** | MySQL 8 + Drizzle ORM |
| **Real-time** | Socket.IO 4 |
| **Auth** | Better Auth (session-based, HTTP-only cookies) |
| **Build Tool** | Vite 5 (client), tsc (server) |
| **Runtime** | Node.js 20+ / Bun (dev) |

### Core Capabilities

- **6 Casino Games** - Crash, Plinko, Roulette, Blackjack, Wheel, Landmines
- **Real-time Multiplayer** - Socket.IO namespaces per game with live updates
- **Admin Dashboard** - Player management, balance adjustments, game statistics
- **Authentication** - Better Auth session-based with role-based access (user/admin)
- **Transaction System** - Full audit trail with balance history
- **Login Rewards** - Daily reward system for player engagement
- **Global Chat** - Authenticated user chat system
- **Rate Limiting** - API and auth endpoint protection
- **Structured Logging** - Winston-based logging service

### Target Audience

This project serves as:
1. An educational full-stack development reference
2. A demonstration of real-time WebSocket game architecture
3. A template for building multiplayer gaming platforms

> **Disclaimer:** This is educational software. Ensure compliance with local gambling laws before any production deployment.

## Related Documents

- [Technology Stack](./technology-stack.md)
- [System Architecture](../02-architecture/system-architecture.md)
- [Getting Started](../05-development/getting-started.md)
