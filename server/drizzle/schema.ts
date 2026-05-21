import { mysqlTable, varchar, text, int, boolean, timestamp, json, decimal, index, mysqlEnum } from 'drizzle-orm/mysql-core';
import { relations, InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Enums (MySQL uses ENUM differently than PostgreSQL)
export const transactionTypeEnum = mysqlEnum('transaction_type', ['deposit', 'withdrawal', 'game_win', 'game_loss', 'admin_adjustment', 'bonus', 'login_reward']);
export const transactionStatusEnum = mysqlEnum('transaction_status', ['pending', 'completed', 'failed', 'voided', 'processing']);
export const gameTypeEnum = mysqlEnum('game_type', ['crash', 'plinko', 'wheel', 'roulette', 'blackjack', 'landmines', 'dice', 'slots', 'tournament_prize']);
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
  // Chat moderation (added in migration 0007)
  deletedAt: timestamp('deleted_at'),
  deletedBy: int('deleted_by').references(() => users.id),
  deletedReason: text('deleted_reason'),
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

// ---------------------------------------------------------------------------
// House Treasury (migration 0003)
// ---------------------------------------------------------------------------
export const houseAccount = mysqlTable('house_account', {
  id: int('id').primaryKey().autoincrement(),
  balance: decimal('balance', { precision: 15, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const houseTransactions = mysqlTable('house_transactions', {
  id: int('id').primaryKey().autoincrement(),
  type: varchar('type', { length: 50 }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  balanceBefore: decimal('balance_before', { precision: 15, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 15, scale: 2 }).notNull(),
  userId: int('user_id').references(() => users.id),
  gameType: varchar('game_type', { length: 50 }),
  gameSessionId: int('game_session_id'),
  transactionId: int('transaction_id').references(() => transactions.id),
  adminId: int('admin_id').references(() => users.id),
  reason: text('reason'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('house_transactions_type_idx').on(table.type),
  userIdIdx: index('house_transactions_user_id_idx').on(table.userId),
  gameTypeIdx: index('house_transactions_game_type_idx').on(table.gameType),
  createdAtIdx: index('house_transactions_created_at_idx').on(table.createdAt),
}));

export const settings = mysqlTable('settings', {
  id: int('id').primaryKey().autoincrement(),
  key: varchar('key', { length: 100 }).unique().notNull(),
  value: json('value').notNull(),
  updatedBy: int('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  keyIdx: index('settings_key_idx').on(table.key),
}));

// ---------------------------------------------------------------------------
// Game Config (migration 0004)
// ---------------------------------------------------------------------------
export const gameConfig = mysqlTable('game_config', {
  id: int('id').primaryKey().autoincrement(),
  gameType: varchar('game_type', { length: 50 }).unique().notNull(),
  houseEdge: decimal('house_edge', { precision: 5, scale: 4 }).notNull(),
  payoutTable: json('payout_table').notNull(),
  maxBet: decimal('max_bet', { precision: 15, scale: 2 }).default('0').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  updatedBy: int('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  gameTypeIdx: index('game_config_game_type_idx').on(table.gameType),
}));

// ---------------------------------------------------------------------------
// Daily Snapshots (migration 0006)
// ---------------------------------------------------------------------------
export const dailySnapshots = mysqlTable('daily_snapshots', {
  id: int('id').primaryKey().autoincrement(),
  snapshotDate: varchar('snapshot_date', { length: 10 }).unique().notNull(),
  houseBalanceClose: decimal('house_balance_close', { precision: 15, scale: 2 }).notNull(),
  totalBets: decimal('total_bets', { precision: 20, scale: 2 }).notNull(),
  totalWins: decimal('total_wins', { precision: 20, scale: 2 }).notNull(),
  ggr: decimal('ggr', { precision: 20, scale: 2 }).notNull(),
  bonusesPaid: decimal('bonuses_paid', { precision: 20, scale: 2 }).default('0').notNull(),
  ngr: decimal('ngr', { precision: 20, scale: 2 }).notNull(),
  activePlayerCount: int('active_player_count').default(0).notNull(),
  newPlayerCount: int('new_player_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  snapshotDateIdx: index('daily_snapshots_snapshot_date_idx').on(table.snapshotDate),
}));

// ---------------------------------------------------------------------------
// Chat Moderation: user mutes (migration 0007)
// ---------------------------------------------------------------------------
export const userMutes = mysqlTable('user_mutes', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().references(() => users.id),
  mutedUntil: timestamp('muted_until').notNull(),
  mutedBy: int('muted_by').references(() => users.id),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_mutes_user_id_idx').on(table.userId),
  userMutedUntilIdx: index('user_mutes_user_muted_until_idx').on(table.userId, table.mutedUntil),
}));

// ---------------------------------------------------------------------------
// Alerts (migration 0008)
// ---------------------------------------------------------------------------
export const alerts = mysqlTable('alerts', {
  id: int('id').primaryKey().autoincrement(),
  type: varchar('type', { length: 60 }).notNull(),
  severity: varchar('severity', { length: 20 }).default('warning').notNull(),
  userId: int('user_id').references(() => users.id),
  gameType: varchar('game_type', { length: 50 }),
  details: json('details').notNull(),
  acknowledged: boolean('acknowledged').default(false).notNull(),
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgedBy: int('acknowledged_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  acknowledgedIdx: index('alerts_acknowledged_idx').on(table.acknowledged),
  acknowledgedCreatedIdx: index('alerts_acknowledged_created_idx').on(table.acknowledged, table.createdAt),
  typeIdx: index('alerts_type_idx').on(table.type),
  createdAtIdx: index('alerts_created_at_idx').on(table.createdAt),
}));

// ---------------------------------------------------------------------------
// User Limits (migrations 0009 + 0010)
// ---------------------------------------------------------------------------
export const userLimits = mysqlTable('user_limits', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').unique().notNull().references(() => users.id),
  maxBetPerRound: decimal('max_bet_per_round', { precision: 15, scale: 2 }),
  maxLossPerDay: decimal('max_loss_per_day', { precision: 15, scale: 2 }),
  lockedUntil: timestamp('locked_until'),
  sessionLimitMinutes: decimal('session_limit_minutes', { precision: 10, scale: 2 }),
  updatedBy: int('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_limits_user_id_idx').on(table.userId),
  lockedUntilIdx: index('user_limits_locked_until_idx').on(table.lockedUntil),
}));

// ---------------------------------------------------------------------------
// Tournaments (migration 0011)
// ---------------------------------------------------------------------------
export const tournaments = mysqlTable('tournaments', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 120 }).notNull(),
  gameType: varchar('game_type', { length: 50 }).notNull(),
  scoring: varchar('scoring', { length: 40 }).notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  prizePool: decimal('prize_pool', { precision: 15, scale: 2 }).notNull(),
  prizeDistribution: json('prize_distribution').notNull(),
  status: varchar('status', { length: 20 }).default('scheduled').notNull(),
  createdBy: int('created_by').references(() => users.id),
  finalizedAt: timestamp('finalized_at'),
  finalizedBy: int('finalized_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index('tournaments_status_idx').on(table.status),
  gameTypeIdx: index('tournaments_game_type_idx').on(table.gameType),
  activeLookupIdx: index('tournaments_active_lookup_idx').on(table.status, table.startTime, table.endTime),
}));

export const tournamentEntries = mysqlTable('tournament_entries', {
  id: int('id').primaryKey().autoincrement(),
  tournamentId: int('tournament_id').notNull().references(() => tournaments.id),
  userId: int('user_id').notNull().references(() => users.id),
  score: decimal('score', { precision: 15, scale: 4 }).default('0').notNull(),
  totalWagered: decimal('total_wagered', { precision: 15, scale: 2 }).default('0').notNull(),
  totalWon: decimal('total_won', { precision: 15, scale: 2 }).default('0').notNull(),
  biggestWin: decimal('biggest_win', { precision: 15, scale: 2 }).default('0').notNull(),
  rank: int('rank'),
  prizeAmount: decimal('prize_amount', { precision: 15, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  leaderboardIdx: index('tournament_entries_leaderboard_idx').on(table.tournamentId, table.score),
}));

// ---------------------------------------------------------------------------
// Type exports for new tables
// ---------------------------------------------------------------------------
export type HouseAccount = InferSelectModel<typeof houseAccount>;
export type NewHouseAccount = InferInsertModel<typeof houseAccount>;
export type HouseTransaction = InferSelectModel<typeof houseTransactions>;
export type NewHouseTransaction = InferInsertModel<typeof houseTransactions>;
export type Setting = InferSelectModel<typeof settings>;
export type NewSetting = InferInsertModel<typeof settings>;
export type GameConfig = InferSelectModel<typeof gameConfig>;
export type NewGameConfig = InferInsertModel<typeof gameConfig>;
export type DailySnapshot = InferSelectModel<typeof dailySnapshots>;
export type NewDailySnapshot = InferInsertModel<typeof dailySnapshots>;
export type UserMute = InferSelectModel<typeof userMutes>;
export type NewUserMute = InferInsertModel<typeof userMutes>;
export type Alert = InferSelectModel<typeof alerts>;
export type NewAlert = InferInsertModel<typeof alerts>;
export type UserLimit = InferSelectModel<typeof userLimits>;
export type NewUserLimit = InferInsertModel<typeof userLimits>;
export type Tournament = InferSelectModel<typeof tournaments>;
export type NewTournament = InferInsertModel<typeof tournaments>;
export type TournamentEntry = InferSelectModel<typeof tournamentEntries>;
export type NewTournamentEntry = InferInsertModel<typeof tournamentEntries>;