import { mysqlTable, varchar, text, int, boolean, timestamp, json, decimal, index, mysqlEnum } from 'drizzle-orm/mysql-core';
import { relations, InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Enums (MySQL uses ENUM differently than PostgreSQL)
export const userRoleEnum = mysqlEnum('user_role', ['user', 'admin']);
export const transactionTypeEnum = mysqlEnum('transaction_type', ['deposit', 'withdrawal', 'game_win', 'game_loss', 'admin_adjustment', 'bonus']);
export const transactionStatusEnum = mysqlEnum('transaction_status', ['pending', 'completed', 'failed', 'voided', 'processing']);
export const gameTypeEnum = mysqlEnum('game_type', ['crash', 'plinko', 'wheel', 'roulette', 'blackjack']);
export const balanceTypeEnum = mysqlEnum('balance_type', ['deposit', 'withdrawal', 'win', 'loss', 'admin_adjustment']);
export const eventTypeEnum = mysqlEnum('event_type', ['session_start', 'bet_placed', 'bet_updated', 'game_result', 'win', 'loss', 'cashout', 'error', 'game_state_change']);

// Users table
export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  username: varchar('username', { length: 30 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum.default('user').notNull(),
  balance: decimal('balance', { precision: 15, scale: 2 }).default('0').notNull(),
  avatar: text('avatar').default(''),
  isActive: boolean('is_active').default(true).notNull(),
  lastLogin: timestamp('last_login').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  usernameIdx: index('users_username_idx').on(table.username),
  roleIdx: index('users_role_idx').on(table.role),
}));

// Transactions table
export const transactions = mysqlTable('transactions', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().references(() => users.id),
  type: transactionTypeEnum.notNull(),
  gameType: gameTypeEnum,
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  balanceBefore: decimal('balance_before', { precision: 15, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 15, scale: 2 }).notNull(),
  status: transactionStatusEnum.default('completed').notNull(),
  createdBy: int('created_by').references(() => users.id),
  reference: varchar('reference', { length: 255 }),
  description: text('description'),
  gameSessionId: int('game_session_id'),
  metadata: json('metadata'),
  notes: json('notes'),
  voidedBy: int('voided_by').references(() => users.id),
  voidedReason: text('voided_reason'),
  voidedAt: timestamp('voided_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index('transactions_user_id_idx').on(table.userId),
  typeIdx: index('transactions_type_idx').on(table.type),
  gameTypeIdx: index('transactions_game_type_idx').on(table.gameType),
  statusIdx: index('transactions_status_idx').on(table.status),
  amountIdx: index('transactions_amount_idx').on(table.amount),
  createdByIdx: index('transactions_created_by_idx').on(table.createdBy),
  gameSessionIdIdx: index('transactions_game_session_id_idx').on(table.gameSessionId),
  createdAtIdx: index('transactions_created_at_idx').on(table.createdAt),
}));

// Game Sessions table
export const gameSessions = mysqlTable('game_sessions', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().references(() => users.id),
  gameType: gameTypeEnum.notNull(),
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time'),
  initialBet: decimal('initial_bet', { precision: 15, scale: 2 }).notNull(),
  totalBet: decimal('total_bet', { precision: 15, scale: 2 }).notNull(),
  outcome: decimal('outcome', { precision: 15, scale: 2 }).default('0').notNull(),
  finalMultiplier: decimal('final_multiplier', { precision: 10, scale: 6 }),
  gameState: json('game_state'),
  isCompleted: boolean('is_completed').default(false).notNull(),
  resultDetails: json('result_details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index('game_sessions_user_id_idx').on(table.userId),
  gameTypeIdx: index('game_sessions_game_type_idx').on(table.gameType),
  startTimeIdx: index('game_sessions_start_time_idx').on(table.startTime),
  isCompletedIdx: index('game_sessions_is_completed_idx').on(table.isCompleted),
}));

// Game Logs table
export const gameLogs = mysqlTable('game_logs', {
  id: int('id').primaryKey().autoincrement(),
  sessionId: int('session_id').references(() => gameSessions.id),
  userId: int('user_id').references(() => users.id),
  gameType: gameTypeEnum.notNull(),
  eventType: eventTypeEnum.notNull(),
  eventDetails: json('event_details').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sessionIdIdx: index('game_logs_session_id_idx').on(table.sessionId),
  userIdIdx: index('game_logs_user_id_idx').on(table.userId),
  gameTypeIdx: index('game_logs_game_type_idx').on(table.gameType),
  eventTypeIdx: index('game_logs_event_type_idx').on(table.eventType),
  timestampIdx: index('game_logs_timestamp_idx').on(table.timestamp),
}));

// Balance History table
export const balances = mysqlTable('balances', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().references(() => users.id),
  amount: decimal('amount', { precision: 15, scale: 2 }).default('0').notNull(),
  previousBalance: decimal('previous_balance', { precision: 15, scale: 2 }).notNull(),
  changeAmount: decimal('change_amount', { precision: 15, scale: 2 }).notNull(),
  type: balanceTypeEnum.notNull(),
  gameType: gameTypeEnum,
  relatedSessionId: int('related_session_id').references(() => gameSessions.id),
  transactionId: int('transaction_id').references(() => transactions.id),
  note: text('note'),
  adminId: int('admin_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index('balances_user_id_idx').on(table.userId),
  typeIdx: index('balances_type_idx').on(table.type),
  gameTypeIdx: index('balances_game_type_idx').on(table.gameType),
  relatedSessionIdIdx: index('balances_related_session_id_idx').on(table.relatedSessionId),
  transactionIdIdx: index('balances_transaction_id_idx').on(table.transactionId),
}));

// Game Stats table
export const gameStats = mysqlTable('game_stats', {
  id: int('id').primaryKey().autoincrement(),
  gameType: varchar('game_type', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  totalGamesPlayed: int('total_games_played').default(0).notNull(),
  totalBetsAmount: decimal('total_bets_amount', { precision: 20, scale: 2 }).default('0').notNull(),
  totalWinningsAmount: decimal('total_winnings_amount', { precision: 20, scale: 2 }).default('0').notNull(),
  houseProfit: decimal('house_profit', { precision: 20, scale: 2 }).default('0').notNull(),
  dailyStats: json('daily_stats'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  gameTypeIdx: index('game_stats_game_type_idx').on(table.gameType),
}));

// Messages table (for chat)
export const messages = mysqlTable('messages', {
  id: int('id').primaryKey().autoincrement(),
  content: text('content').notNull(),
  userId: int('user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('messages_user_id_idx').on(table.userId),
  createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  gameSessions: many(gameSessions),
  gameLogs: many(gameLogs),
  balances: many(balances),
  messages: many(messages),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [transactions.createdBy],
    references: [users.id],
  }),
  voidedByUser: one(users, {
    fields: [transactions.voidedBy],
    references: [users.id],
  }),
  gameSession: one(gameSessions, {
    fields: [transactions.gameSessionId],
    references: [gameSessions.id],
  }),
}));

export const gameSessionsRelations = relations(gameSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [gameSessions.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
  gameLogs: many(gameLogs),
  balances: many(balances),
}));

export const gameLogsRelations = relations(gameLogs, ({ one }) => ({
  user: one(users, {
    fields: [gameLogs.userId],
    references: [users.id],
  }),
  gameSession: one(gameSessions, {
    fields: [gameLogs.sessionId],
    references: [gameSessions.id],
  }),
}));

export const balancesRelations = relations(balances, ({ one }) => ({
  user: one(users, {
    fields: [balances.userId],
    references: [users.id],
  }),
  admin: one(users, {
    fields: [balances.adminId],
    references: [users.id],
  }),
  gameSession: one(gameSessions, {
    fields: [balances.relatedSessionId],
    references: [gameSessions.id],
  }),
  transaction: one(transactions, {
    fields: [balances.transactionId],
    references: [transactions.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));

// Export TypeScript types
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Transaction = InferSelectModel<typeof transactions>;
export type NewTransaction = InferInsertModel<typeof transactions>;
export type GameSession = InferSelectModel<typeof gameSessions>;
export type NewGameSession = InferInsertModel<typeof gameSessions>;
export type GameLog = InferSelectModel<typeof gameLogs>;
export type NewGameLog = InferInsertModel<typeof gameLogs>;
export type Balance = InferSelectModel<typeof balances>;
export type NewBalance = InferInsertModel<typeof balances>;
export type GameStat = InferSelectModel<typeof gameStats>;
export type NewGameStat = InferInsertModel<typeof gameStats>;
export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>; 