import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Home', icon: HomeIcon, end: true },
  { path: '/games', label: 'Games', icon: GamesIcon, end: false },
  { path: '/rewards', label: 'Rewards', icon: RewardsIcon, end: false },
  { path: '/leaderboard', label: 'Leaderboard', icon: TrophyIcon, end: false },
  { path: '/profile', label: 'Profile', icon: UserIcon, end: false },
];

const MobileBottomNav = () => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-2 h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-1 px-3 min-w-[56px] transition-colors duration-200 ${
                isActive ? 'text-accent-gold' : 'text-text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Gold dot indicator above icon */}
                <span
                  className={`w-1 h-1 rounded-full transition-opacity duration-200 ${
                    isActive ? 'bg-accent-gold opacity-100' : 'opacity-0'
                  }`}
                  aria-hidden="true"
                />
                <item.icon />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

/* ── Inline SVG Icon Components ── */

function HomeIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function GamesIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M8 8v2" />
      <path d="M7 9h2" />
      <circle cx="15" cy="9" r="1" />
      <circle cx="17" cy="11" r="1" />
      <path d="M8 15h8" />
    </svg>
  );
}

function RewardsIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 010-5h1A2.5 2.5 0 018 6.5V9" />
      <path d="M18 9h1.5a2.5 2.5 0 000-5h-1A2.5 2.5 0 0016 6.5V9" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 0012 0V2z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default MobileBottomNav;
