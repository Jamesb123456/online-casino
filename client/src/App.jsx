import React, { Suspense, lazy } from 'react'
import {
  Route,
  Navigate,
  createRoutesFromElements,
  createBrowserRouter,
  RouterProvider
} from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import GameErrorBoundary from './components/GameErrorBoundary'
import Loading from './components/ui/Loading'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'

// Eagerly loaded pages (critical path)
import HomePage from './pages/HomePage'
import GamesPage from './pages/GamesPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import NotFoundPage from './pages/NotFoundPage'

// Lazy loaded game pages
const CrashPage = lazy(() => import('./pages/games/CrashPage'))
const PlinkoPage = lazy(() => import('./pages/games/PlinkoPage'))
const WheelPage = lazy(() => import('./pages/games/WheelPage'))
const RoulettePage = lazy(() => import('./pages/games/RoulettePage'))
const BlackjackPage = lazy(() => import('./pages/games/BlackjackPage'))
const LandminesPage = lazy(() => import('./pages/games/LandminesPage'))

// Lazy loaded feature pages
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const RewardsPage = lazy(() => import('./pages/RewardsPage'))
const VerifyPage = lazy(() => import('./pages/VerifyPage'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))
const ResponsibleGamingPage = lazy(() => import('./pages/ResponsibleGamingPage'))

// Lazy loaded admin pages
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const PlayerManagementPage = lazy(() => import('./pages/admin/PlayerManagementPage'))
const GameStatisticsPage = lazy(() => import('./pages/admin/GameStatisticsPage'))
const TransactionsPage = lazy(() => import('./pages/admin/TransactionsPage'))

// Guards
import AdminGuard from './components/guards/AdminGuard'
import AuthGuard from './components/guards/AuthGuard'

// Game route helper with error boundary and suspense
function GameRoute({ name, children }) {
  return (
    <GameErrorBoundary gameName={name}>
      <Suspense fallback={<Loading size="lg" message={`Loading ${name}...`} />}>
        {children}
      </Suspense>
    </GameErrorBoundary>
  )
}

// Create router with future flags enabled
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/games" element={<GamesPage />} />
      <Route path="/games/crash" element={<AuthGuard><GameRoute name="Crash"><CrashPage /></GameRoute></AuthGuard>} />
      <Route path="/games/plinko" element={<AuthGuard><GameRoute name="Plinko"><PlinkoPage /></GameRoute></AuthGuard>} />
      <Route path="/games/wheel" element={<AuthGuard><GameRoute name="Wheel"><WheelPage /></GameRoute></AuthGuard>} />
      <Route path="/games/roulette" element={<AuthGuard><GameRoute name="Roulette"><RoulettePage /></GameRoute></AuthGuard>} />
      <Route path="/games/blackjack" element={<AuthGuard><GameRoute name="Blackjack"><BlackjackPage /></GameRoute></AuthGuard>} />
      <Route path="/games/landmines" element={<AuthGuard><GameRoute name="Landmines"><LandminesPage /></GameRoute></AuthGuard>} />
      <Route path="/rewards" element={
        <Suspense fallback={<Loading size="lg" message="Loading rewards..." />}>
          <RewardsPage />
        </Suspense>
      } />
      <Route path="/verify" element={
        <Suspense fallback={<Loading size="lg" message="Loading verification..." />}>
          <VerifyPage />
        </Suspense>
      } />
      <Route path="/leaderboard" element={
        <Suspense fallback={<Loading size="lg" message="Loading leaderboard..." />}>
          <LeaderboardPage />
        </Suspense>
      } />
      <Route path="/responsible-gaming" element={
        <Suspense fallback={<Loading size="lg" message="Loading..." />}>
          <ResponsibleGamingPage />
        </Suspense>
      } />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Player protected routes */}
      <Route
        path="/profile"
        element={
          <AuthGuard>
            <Suspense fallback={<Loading size="lg" message="Loading profile..." />}>
              <ProfilePage />
            </Suspense>
          </AuthGuard>
        }
      />

      {/* Admin protected routes */}
      <Route
        path="/admin/dashboard"
        element={
          <AdminGuard>
            <Suspense fallback={<Loading size="lg" message="Loading dashboard..." />}>
              <AdminDashboardPage />
            </Suspense>
          </AdminGuard>
        }
      />
      <Route
        path="/admin/players"
        element={
          <AdminGuard>
            <Suspense fallback={<Loading size="lg" message="Loading player management..." />}>
              <PlayerManagementPage />
            </Suspense>
          </AdminGuard>
        }
      />
      <Route
        path="/admin/game-stats"
        element={
          <AdminGuard>
            <Suspense fallback={<Loading size="lg" message="Loading game statistics..." />}>
              <GameStatisticsPage />
            </Suspense>
          </AdminGuard>
        }
      />
      <Route
        path="/admin/transactions"
        element={
          <AdminGuard>
            <Suspense fallback={<Loading size="lg" message="Loading transactions..." />}>
              <TransactionsPage />
            </Suspense>
          </AdminGuard>
        }
      />

      {/* Admin redirect */}
      <Route
        path="/admin"
        element={<AdminGuard><Navigate to="/admin/dashboard" /></AdminGuard>}
      />

      {/* Fallback route for non-existent pages */}
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  ),
  {
    future: {
      v7_relativeSplatPath: true,
      v7_startTransition: true
    }
  }
);

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider
            router={router}
            fallbackElement={
              <div className="min-h-screen flex items-center justify-center">
                <Loading size="lg" message="Loading application..." />
              </div>
            }
          />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
