import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'

// Page Components
import HomePage from './pages/HomePage'
import GamesPage from './pages/GamesPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CrashPage from './pages/games/CrashPage'
import PlinkoPage from './pages/games/PlinkoPage'
import WheelPage from './pages/games/WheelPage'
import RoulettePage from './pages/games/RoulettePage'
import ChickenPage from './pages/ChickenPage'
import BlackjackPage from './pages/games/BlackjackPage'

// Admin Components
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import PlayerManagementPage from './pages/admin/PlayerManagementPage'
import GameStatisticsPage from './pages/admin/GameStatisticsPage'
import TransactionsPage from './pages/admin/TransactionsPage'

// Guards
import AdminGuard from './components/guards/AdminGuard'

// Demo authentication state (will be replaced with actual auth context)
const isAuthenticated = false;

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/games/crash" element={<CrashPage />} />
        <Route path="/games/plinko" element={<PlinkoPage />} />
        <Route path="/games/wheel" element={<WheelPage />} />
        <Route path="/games/roulette" element={<RoulettePage />} />
        <Route path="/games/chicken" element={<ChickenPage />} />
        <Route path="/games/blackjack" element={<BlackjackPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Player protected routes */}
        <Route 
          path="/profile" 
          element={isAuthenticated ? <div>Profile Page</div> : <Navigate to="/login" />} 
        />
        
        {/* Admin protected routes */}
        <Route 
          path="/admin/dashboard" 
          element={<AdminGuard><AdminDashboardPage /></AdminGuard>} 
        />
        <Route 
          path="/admin/players" 
          element={<AdminGuard><PlayerManagementPage /></AdminGuard>} 
        />
        <Route 
          path="/admin/game-stats" 
          element={<AdminGuard><GameStatisticsPage /></AdminGuard>} 
        />
        <Route 
          path="/admin/transactions" 
          element={<AdminGuard><TransactionsPage /></AdminGuard>} 
        />
        
        {/* Admin redirect */}
        <Route
          path="/admin"
          element={<AdminGuard><Navigate to="/admin/dashboard" /></AdminGuard>}
        />
        
        {/* Fallback route for non-existent pages */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

export default App