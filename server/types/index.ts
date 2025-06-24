import type { Request } from 'express';
import type { Socket } from 'socket.io';

// User types
export interface User {
  id: number;
  username: string;
  passwordHash: string;
  role: 'user' | 'admin';
  balance: string;
  avatar?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    username: string;
    role: 'user' | 'admin';
  };
}

// Transaction types
export interface Transaction {
  id: number;
  userId: number;
  type: 'deposit' | 'withdrawal' | 'game_win' | 'game_loss' | 'admin_adjustment' | 'bonus';
  gameType?: 'crash' | 'plinko' | 'wheel' | 'roulette' | 'blackjack';
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  status: 'pending' | 'completed' | 'failed' | 'voided' | 'processing';
  createdBy?: number;
  reference?: string;
  description?: string;
  gameSessionId?: number;
  metadata?: any;
  notes?: any;
  voidedBy?: number;
  voidedReason?: string;
  voidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Game Session types
export interface GameSession {
  id: number;
  userId: number;
  gameType: 'crash' | 'plinko' | 'wheel' | 'roulette' | 'blackjack';
  startTime: Date;
  endTime?: Date;
  initialBet: string;
  totalBet: string;
  outcome: string;
  finalMultiplier?: string;
  gameState?: any;
  isCompleted: boolean;
  resultDetails?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Balance types
export interface Balance {
  id: number;
  userId: number;
  amount: string;
  previousBalance: string;
  changeAmount: string;
  type: 'deposit' | 'withdrawal' | 'win' | 'loss' | 'admin_adjustment';
  gameType?: 'crash' | 'plinko' | 'wheel' | 'roulette' | 'blackjack';
  relatedSessionId?: number;
  transactionId?: number;
  note?: string;
  adminId?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Game Log types
export interface GameLog {
  id: number;
  sessionId?: number;
  userId?: number;
  gameType: 'crash' | 'plinko' | 'wheel' | 'roulette' | 'blackjack';
  eventType: 'session_start' | 'bet_placed' | 'bet_updated' | 'game_result' | 'win' | 'loss' | 'cashout' | 'error' | 'game_state_change';
  eventDetails: any;
  amount?: string;
  timestamp: Date;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Game Stats types
export interface GameStat {
  id: number;
  gameType: string;
  name: string;
  totalGamesPlayed: number;
  totalBetsAmount: string;
  totalWinningsAmount: string;
  houseProfit: string;
  dailyStats?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Message types
export interface Message {
  id: number;
  content: string;
  userId: number;
  createdAt: Date;
}

// Blackjack specific types
export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  value: number;
}

export interface BlackjackGame {
  userId: number;
  betAmount: number;
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  status: 'active' | 'completed';
  result?: 'win' | 'loss' | 'push' | 'blackjack' | 'player_bust' | 'dealer_bust';
  winAmount?: number;
  createdAt: Date;
}

// Socket types
export interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
  role?: 'user' | 'admin';
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Service types
export interface BalanceUpdateResult {
  success: boolean;
  newBalance: number;
  transaction?: Transaction;
}

export interface GameResult {
  won: boolean;
  amount: number;
  multiplier?: number;
  details?: any;
}

// Pagination types
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  sort?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
} 