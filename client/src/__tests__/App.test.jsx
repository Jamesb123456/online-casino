import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock the entire react-router-dom surface used in App.jsx with a simple
// pass-through router that renders all <Route> children inline. This exercises
// every JSX expression in App.jsx without booting the actual router.
vi.mock('react-router-dom', () => {
  const _passthrough = ({ children, element }) => element || children || null;
  return {
    Route: ({ element, children }) => (
      <div>
        {element || null}
        {children || null}
      </div>
    ),
    Navigate: () => <div data-testid="navigate" />,
    createRoutesFromElements: (elements) => elements,
    createBrowserRouter: (routes) => ({ routes }),
    RouterProvider: ({ router, fallbackElement }) => (
      <div data-testid="router-provider">
        {fallbackElement || null}
        {router?.routes || null}
      </div>
    ),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
    useParams: () => ({}),
    Link: ({ children, ...props }) => <a {...props}>{children}</a>,
    NavLink: ({ children, ...props }) => <a {...props}>{children}</a>,
  };
});

// Mock context providers to keep them lightweight.
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>,
  AuthContext: React.createContext({}),
  useAuth: () => ({ user: null }),
}));
vi.mock('@/contexts/ToastContext', () => ({
  ToastProvider: ({ children }) => <div data-testid="toast-provider">{children}</div>,
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock('@/contexts/AudioContext', () => ({
  AudioProvider: ({ children }) => <div data-testid="audio-provider">{children}</div>,
  useAudio: () => ({}),
}));
vi.mock('@/components/casino/SoundProvider', () => ({
  SoundProvider: ({ children }) => <div data-testid="audio-provider">{children}</div>,
  useSound: () => ({ play: vi.fn(), enabled: true, setEnabled: vi.fn() }),
}));
vi.mock('@/components/casino/MotionSafe', () => ({
  MotionSafe: ({ children }) => <div data-testid="motion-safe">{children}</div>,
}));

// Mock error boundaries to identity wrappers.
vi.mock('@/components/ErrorBoundary', () => ({
  default: ({ children }) => <div data-testid="error-boundary">{children}</div>,
}));
vi.mock('@/components/GameErrorBoundary', () => ({
  default: ({ children, gameName }) => (
    <div data-testid={`game-eb-${gameName || 'unknown'}`}>{children}</div>
  ),
}));

// Loading is rendered as a fallback for Suspense.
vi.mock('@/components/ui/Loading', () => ({
  default: ({ message }) => <div data-testid="loading">{message}</div>,
}));

// Guards just render children.
vi.mock('@/components/guards/AuthGuard', () => ({
  default: ({ children }) => <div data-testid="auth-guard">{children}</div>,
}));
vi.mock('@/components/guards/AdminGuard', () => ({
  default: ({ children }) => <div data-testid="admin-guard">{children}</div>,
}));

// Page components (eager) — keep them tiny.
vi.mock('@/pages/HomePage', () => ({ default: () => <div>HomePage</div> }));
vi.mock('@/pages/GamesPage', () => ({ default: () => <div>GamesPage</div> }));
vi.mock('@/pages/LoginPage', () => ({ default: () => <div>LoginPage</div> }));
vi.mock('@/pages/RegisterPage', () => ({ default: () => <div>RegisterPage</div> }));
vi.mock('@/pages/NotFoundPage', () => ({ default: () => <div>NotFoundPage</div> }));

// Lazy-loaded pages — the dynamic import path passes through `vi.mock` automatically.
vi.mock('@/pages/games/CrashPage', () => ({ default: () => <div>CrashPage</div> }));
vi.mock('@/pages/games/PlinkoPage', () => ({ default: () => <div>PlinkoPage</div> }));
vi.mock('@/pages/games/WheelPage', () => ({ default: () => <div>WheelPage</div> }));
vi.mock('@/pages/games/RoulettePage', () => ({ default: () => <div>RoulettePage</div> }));
vi.mock('@/pages/games/BlackjackPage', () => ({ default: () => <div>BlackjackPage</div> }));
vi.mock('@/pages/games/LandminesPage', () => ({ default: () => <div>LandminesPage</div> }));
vi.mock('@/pages/games/DicePage', () => ({ default: () => <div>DicePage</div> }));
vi.mock('@/pages/games/SlotsPage', () => ({ default: () => <div>SlotsPage</div> }));
vi.mock('@/pages/ProfilePage', () => ({ default: () => <div>ProfilePage</div> }));
vi.mock('@/pages/RewardsPage', () => ({ default: () => <div>RewardsPage</div> }));
vi.mock('@/pages/VerifyPage', () => ({ default: () => <div>VerifyPage</div> }));
vi.mock('@/pages/LeaderboardPage', () => ({ default: () => <div>LeaderboardPage</div> }));
vi.mock('@/pages/ResponsibleGamingPage', () => ({ default: () => <div>ResponsibleGamingPage</div> }));
vi.mock('@/pages/TournamentsPage', () => ({ default: () => <div>TournamentsPage</div> }));
vi.mock('@/pages/admin/AdminDashboardPage', () => ({ default: () => <div>AdminDashboard</div> }));
vi.mock('@/pages/admin/PlayerManagementPage', () => ({
  default: () => <div>PlayerManagement</div>,
}));
vi.mock('@/pages/admin/GameStatisticsPage', () => ({ default: () => <div>GameStatistics</div> }));
vi.mock('@/pages/admin/TransactionsPage', () => ({ default: () => <div>Transactions</div> }));
vi.mock('@/pages/admin/GameAnalyticsPage', () => ({ default: () => <div>GameAnalytics</div> }));
vi.mock('@/pages/admin/GameDetailPage', () => ({ default: () => <div>GameDetail</div> }));
vi.mock('@/pages/admin/PlayerProfilePage', () => ({ default: () => <div>PlayerProfile</div> }));
vi.mock('@/pages/admin/RevenueDashboardPage', () => ({ default: () => <div>Revenue</div> }));
vi.mock('@/pages/admin/HousePage', () => ({ default: () => <div>House</div> }));
vi.mock('@/pages/admin/HouseTrendsPage', () => ({ default: () => <div>HouseTrends</div> }));
vi.mock('@/pages/admin/GamesConfigPage', () => ({ default: () => <div>GamesConfig</div> }));
vi.mock('@/pages/admin/LoginRewardsConfigPage', () => ({
  default: () => <div>LoginRewardsConfig</div>,
}));
vi.mock('@/pages/admin/ChatModerationPage', () => ({ default: () => <div>ChatMod</div> }));
vi.mock('@/pages/admin/AlertsPage', () => ({ default: () => <div>Alerts</div> }));
vi.mock('@/pages/admin/SettingsPage', () => ({ default: () => <div>Settings</div> }));
vi.mock('@/pages/admin/TournamentsAdminPage', () => ({ default: () => <div>TournamentsAdmin</div> }));

import App from '@/App';

describe('App', () => {
  it('renders the application within all providers and error boundaries', () => {
    render(<App />);
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByTestId('toast-provider')).toBeInTheDocument();
    expect(screen.getByTestId('audio-provider')).toBeInTheDocument();
    expect(screen.getByTestId('router-provider')).toBeInTheDocument();
  });

  it('passes a fallbackElement to the RouterProvider', () => {
    render(<App />);
    // The fallback contains a Loading component with the application-loading message.
    expect(screen.getByText(/Loading application/i)).toBeInTheDocument();
  });
});
