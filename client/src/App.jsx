import React, { Suspense } from 'react'
import { 
  Route, 
  Navigate, 
  createRoutesFromElements,
  createBrowserRouter,
  RouterProvider
} from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Loading from './components/ui/Loading'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './contexts/AuthContext'

// Page Components
import HomePage from './pages/HomePage'
import GamesPage from './pages/GamesPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import CrashPage from './pages/games/CrashPage'
import PlinkoPage from './pages/games/PlinkoPage'
import WheelPage from './pages/games/WheelPage'
import RoulettePage from './pages/games/RoulettePage'
import BlackjackPage from './pages/games/BlackjackPage'
import LandminesPage from './pages/games/LandminesPage'
import RewardsPage from './pages/RewardsPage'

// Admin Components
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import PlayerManagementPage from './pages/admin/PlayerManagementPage'
import GameStatisticsPage from './pages/admin/GameStatisticsPage'
import TransactionsPage from './pages/admin/TransactionsPage'

// Guards
import AdminGuard from './components/guards/AdminGuard'
import AuthGuard from './components/guards/AuthGuard'

// Create router with future flags enabled
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/games" element={<GamesPage />} />
      <Route path="/games/crash" element={<CrashPage />} />
      <Route path="/games/plinko" element={<PlinkoPage />} />
      <Route path="/games/wheel" element={<WheelPage />} />
      <Route path="/games/roulette" element={<RoulettePage />} />
      <Route path="/games/blackjack" element={<BlackjackPage />} />
      <Route path="/games/landmines" element={<LandminesPage />} />
      <Route path="/rewards" element={<RewardsPage />} />
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
      <Route path="*" element={<Navigate to="/" />} />
    </Route>
  ),
  {
    future: {
      v7_relativeSplatPath: true
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