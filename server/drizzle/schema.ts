import { mysqlTable, varchar, text, int, boolean, timestamp, json, decimal, index, mysqlEnum } from 'drizzle-orm/mysql-core';
import { relations, InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Enums (MySQL uses ENUM differently than PostgreSQL)
export const transactionTypeEnum = mysqlEnum('transaction_type', ['deposit', 'withdrawal', 'game_win', 'game_loss', 'admin_adjustment', 'bonus', 'login_reward']);
export const transactionStatusEnum = mysqlEnum('transaction_status', ['pending', 'completed', 'failed', 'voided', 'processing']);
export const gameTypeEnum = mysqlEnum('game_type', ['crash', 'plinko', 'wheel', 'roulette', 'blackjack', 'landmines']);
export const balanceTypeEnum = mysqlEnum('balance_type', ['deposit', 'withdrawal', 'win', 'loss', 'admin_adjustment', 'login_reward']);
export const eventTypeEnum = mysqlEnum('event_type', ['session_start', 'bet_placed', 'bet_updated', 'game_result', 'win', 'loss', 'cashout', 'error', 'game_state_change']);

// Users table (extended for Better Auth with username + admin plugins)
export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  // Better Auth core fields
  name: varchar('name', { length: 255 }).notNull().default(''),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  // Better Auth username plugin fields
  username: varchar('username', { length: 30 }).notNull().unique(),
  displayUsername: varchar('display_username', { length: 30 }),
  // Better Auth admin plugin fields
  role: varchar('role', { length: 20 }).default('user'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  // Casino custom fields
  passwordHash: text('password_hash'),
  balance: decimal('balance', { precision: 15, scale: 2 }).default('0').notNull(),
  avatar: text('avatar').default(''),
  isActive: boolean('is_active').default(true).notNull(),
  lastLogin: timestamp('last_login').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  usernameIdx: index('users_username_idx').on(table.username),
  emailIdx: index('users_email_idx').on(table.email),
  roleIdx: index('users_role_idx').on(table.role),
}));

// Better Auth session table
export const session = mysqlTable('session', {
  id: int('id').primaryKey().autoincrement(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  userId: int('user_id').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  impersonatedBy: varchar('impersonated_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tokenIdx: index('session_token_idx').on(table.token),
  userIdIdx: index('session_user_id_idx').on(table.userId),
}));

// Better Auth account table
export const account = mysqlTable('account', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().references(() => users.id),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index('account_user_id_idx').on(table.userId),
  accountIdIdx: index('account_account_id_idx').on(table.accountId),
}));

// Better Auth verification table
export const verification = mysqlTable('verification', {
  id: int('id').primaryKey().autoincrement(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

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
  // Compound indexes for common query patterns
  userTypeIdx: index('idx_transactions_user_type').on(table.userId, table.type),
  userCreatedIdx: index('idx_transactions_user_created').on(table.userId, table.createdAt),
  statusCreatedIdx: index('idx_transactions_status_created').on(table.status, table.createdAt),
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
  // Compound indexes for common query patterns
  userGameIdx: index('idx_sessions_user_game').on(table.userId, table.gameType),
  gameCompletedIdx: index('idx_sessions_game_completed').on(table.gameType, table.isCompleted),
}));

// Game Logs table
// gameType and eventType use varchar instead of enum because LoggingService
// writes system/admin events (not just game events) to this table
export const gameLogs = mysqlTable('game_logs', {
  id: int('id').primaryKey().autoincrement(),
  sessionId: int('session_id').references(() => gameSessions.id),
  userId: int('user_id').references(() => users.id),
  gameType: varchar('game_type', { length: 50 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
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
  // Compound indexes for common query patterns
  userEventIdx: index('idx_logs_user_event').on(table.userId, table.eventType),
  gameCreatedIdx: index('idx_logs_game_created').on(table.gameType, table.createdAt),
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
  // Compound index for user balance history queries
  userCreatedIdx: index('idx_balances_user_created').on(table.userId, table.createdAt),
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

// Login Rewards table
export const loginRewards = mysqlTable('login_rewards', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().references(() => users.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  transactionId: int('transaction_id').references(() => transactions.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('login_rewards_user_id_idx').on(table.userId),
  createdAtIdx: index('login_rewards_created_at_idx').on(table.createdAt),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  transactions: many(transactions),
  gameSessions: many(gameSessions),
  gameLogs: many(gameLogs),
  balances: many(balances),
  messages: many(messages),
  loginRewards: many(loginRewards),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(users, {
    fields: [session.userId],
    references: [users.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(users, {
    fields: [account.userId],
    references: [users.id],
  }),
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

export const loginRewardsRelations = relations(loginRewards, ({ one }) => ({
  user: one(users, {
    fields: [loginRewards.userId],
    references: [users.id],
  }),
  transaction: one(transactions, {
    fields: [loginRewards.transactionId],
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
export type LoginReward = InferSelectModel<typeof loginRewards>;
export type NewLoginReward = InferInsertModel<typeof loginRewards>;
export type Session = InferSelectModel<typeof session>;
export type NewSession = InferInsertModel<typeof session>;
export type Account = InferSelectModel<typeof account>;
export type NewAccount = InferInsertModel<typeof account>;
export type Verification = InferSelectModel<typeof verification>;
export type NewVerification = InferInsertModel<typeof verification>;