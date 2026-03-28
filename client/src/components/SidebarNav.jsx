import React from 'react';
import { NavLink } from 'react-router-dom';

// Game data with colors matching the design system game tokens
const casinoGames = [
  { path: '/games/crash', label: 'Crash', color: 'bg-game-crash' },
  { path: '/games/roulette', label: 'Roulette', color: 'bg-game-roulette' },
  { path: '/games/blackjack', label: 'Blackjack', color: 'bg-game-blackjack' },
  { path: '/games/plinko', label: 'Plinko', color: 'bg-game-plinko' },
  { path: '/games/wheel', label: 'Wheel', color: 'bg-game-wheel' },
  { path: '/games/landmines', label: 'Landmines', color: 'bg-game-landmines' },
];

const accountLinks = [
  { path: '/profile', label: 'Profile', icon: ProfileIcon },
  { path: '/rewards', label: 'Rewards', icon: RewardsIcon },
  { path: '/leaderboard', label: 'Leaderboard', icon: LeaderboardIcon },
];

const supportLinks = [
  { path: '/responsible-gaming', label: 'Responsible Gaming', icon: ShieldIcon },
];

// NavLink style helper
const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-2 text-sm rounded-r-lg transition-colors duration-200 ${
    isActive
      ? 'bg-accent-gold/10 text-accent-gold border-l-2 border-accent-gold'
      : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated border-l-2 border-transparent'
  }`;

const SidebarNav = () => {
  return (
    <aside
      className="fixed left-0 top-16 bottom-0 w-64 bg-bg-card/80 backdrop-blur-xl border-r border-border overflow-y-auto hidden lg:block"
      data-testid="sidebar-nav"
      aria-label="Sidebar navigation"
    >
      <div className="py-6 space-y-8">
        {/* Casino Games section */}
        <div>
          <h2 className="px-4 mb-3 text-xs font-heading uppercase tracking-wider text-text-muted">
            Casino Games
          </h2>
          <nav className="space-y-0.5" aria-label="Casino games">
            {casinoGames.map((game) => (
              <NavLink key={game.path} to={game.path} className={linkClass}>
                <span
                  className={`w-2 h-2 rounded-full ${game.color} shrink-0`}
                  aria-hidden="true"
                />
                <span>{game.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Account section */}
        <div>
          <h2 className="px-4 mb-3 text-xs font-heading uppercase tracking-wider text-text-muted">
            Account
          </h2>
          <nav className="space-y-0.5" aria-label="Account">
            {accountLinks.map((link) => (
              <NavLink key={link.path} to={link.path} className={linkClass}>
                <link.icon />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Support section */}
        <div>
          <h2 className="px-4 mb-3 text-xs font-heading uppercase tracking-wider text-text-muted">
            Support
          </h2>
          <nav className="space-y-0.5" aria-label="Support">
            {supportLinks.map((link) => (
              <NavLink key={link.path} to={link.path} className={linkClass}>
                <link.icon />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
};

/* ── Inline SVG Icon Components ── */

function ProfileIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function RewardsIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function LeaderboardIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 010-5h1A2.5 2.5 0 018 6.5V9" />
      <path d="M18 9h1.5a2.5 2.5 0 000-5h-1A2.5 2.5 0 0016 6.5V9" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 0012 0V2z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export default SidebarNav;
