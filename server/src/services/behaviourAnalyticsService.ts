import { db } from '../../drizzle/db.js';
import { sql } from 'drizzle-orm';
import LoggingService from './loggingService.js';

const WINDOW_DAYS = 30;
const CHASE_RATIO = 1.5;
const CHASE_SCORE_THRESHOLD = 0.2;
const LATE_NIGHT_PCT_THRESHOLD = 0.4;
const LATE_NIGHT_MIN_BETS = 20;
const CADENCE_CV_THRESHOLD = 0.15;
const CADENCE_MIN_SAMPLES = 50;
const CADENCE_MIN_SESSION_BETS = 5;

export type BehaviourPatterns = {
  chasingLosses: {
    detected: boolean;
    score: number;
    details: {
      chaseEvents: number;
      totalBets: number;
      longestChaseStreak: number;
    };
  };
  lateNightActivity: {
    detected: boolean;
    pctOfBetsAfterMidnight: number;
    totalBets: number;
    lateNightBets: number;
  };
  botLikeCadence: {
    detected: boolean;
    interArrivalCv: number | null;
    sampleSize: number;
  };
};

const EMPTY_RESULT: BehaviourPatterns = {
  chasingLosses: {
    detected: false,
    score: 0,
    details: { chaseEvents: 0, totalBets: 0, longestChaseStreak: 0 },
  },
  lateNightActivity: {
    detected: false,
    pctOfBetsAfterMidnight: 0,
    totalBets: 0,
    lateNightBets: 0,
  },
  botLikeCadence: {
    detected: false,
    interArrivalCv: null,
    sampleSize: 0,
  },
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

class BehaviourAnalyticsService {
  /**
   * Detect behaviour patterns for a single user over the last WINDOW_DAYS days.
   * Returns sensible empty results for users with insufficient data — never throws.
   */
  async detectPatterns(userId: number): Promise<BehaviourPatterns> {
    if (!Number.isFinite(userId) || userId <= 0) {
      return JSON.parse(JSON.stringify(EMPTY_RESULT));
    }

    try {
      const [chasing, lateNight, cadence] = await Promise.all([
        this._detectChasingLosses(userId),
        this._detectLateNightActivity(userId),
        this._detectBotLikeCadence(userId),
      ]);

      return {
        chasingLosses: chasing,
        lateNightActivity: lateNight,
        botLikeCadence: cadence,
      };
    } catch (error) {
      LoggingService.logSystemEvent(
        'behaviour_analytics_error',
        { userId, error: (error as Error)?.message },
        'error'
      );
      return JSON.parse(JSON.stringify(EMPTY_RESULT));
    }
  }

  /**
   * Chase event = bet amount >= 1.5x previous bet AND previous bet was a loss.
   * Pulls game_loss + game_win transactions in created_at order.
   */
  async _detectChasingLosses(userId: number) {
    const result = await db.execute(sql`
      SELECT t.amount, t.transaction_type, t.created_at
      FROM transactions t
      WHERE t.user_id = ${userId}
        AND t.transaction_type IN ('game_win', 'game_loss')
        AND t.transaction_status = 'completed'
        AND t.created_at >= DATE_SUB(NOW(), INTERVAL ${WINDOW_DAYS} DAY)
      ORDER BY t.created_at ASC
    `);

    const rows = ((result as any)[0] || []) as Array<{
      amount: string;
      transaction_type: string;
    }>;

    const totalBets = rows.length;
    if (totalBets === 0) {
      return {
        detected: false,
        score: 0,
        details: { chaseEvents: 0, totalBets: 0, longestChaseStreak: 0 },
      };
    }

    let chaseEvents = 0;
    let longestChaseStreak = 0;
    let currentStreak = 0;
    let prevAmount: number | null = null;
    let prevWasLoss = false;

    for (const row of rows) {
      const amount = Number(row.amount);
      const isLoss = row.transaction_type === 'game_loss';

      if (prevAmount !== null && prevWasLoss && amount >= prevAmount * CHASE_RATIO) {
        chaseEvents++;
        currentStreak++;
        if (currentStreak > longestChaseStreak) longestChaseStreak = currentStreak;
      } else {
        currentStreak = 0;
      }

      prevAmount = amount;
      prevWasLoss = isLoss;
    }

    const score = round4(chaseEvents / totalBets);
    return {
      detected: score >= CHASE_SCORE_THRESHOLD,
      score,
      details: { chaseEvents, totalBets, longestChaseStreak },
    };
  }

  /**
   * Pct of bets placed between 00:00 and 04:59 (UTC, created_at).
   */
  async _detectLateNightActivity(userId: number) {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) AS totalBets,
        SUM(CASE WHEN HOUR(t.created_at) BETWEEN 0 AND 4 THEN 1 ELSE 0 END) AS lateNightBets
      FROM transactions t
      WHERE t.user_id = ${userId}
        AND t.transaction_type = 'game_loss'
        AND t.transaction_status = 'completed'
        AND t.created_at >= DATE_SUB(NOW(), INTERVAL ${WINDOW_DAYS} DAY)
    `);

    const row = ((result as any)[0] || [])[0] || {};
    const totalBets = Number(row.totalBets || 0);
    const lateNightBets = Number(row.lateNightBets || 0);

    if (totalBets === 0) {
      return {
        detected: false,
        pctOfBetsAfterMidnight: 0,
        totalBets: 0,
        lateNightBets: 0,
      };
    }

    const pct = round4(lateNightBets / totalBets);
    return {
      detected: pct > LATE_NIGHT_PCT_THRESHOLD && totalBets > LATE_NIGHT_MIN_BETS,
      pctOfBetsAfterMidnight: pct,
      totalBets,
      lateNightBets,
    };
  }

  /**
   * Inter-arrival CV across all sessions with >= 5 bets. Pulls bets ordered by
   * (game_session_id, created_at) and computes deltas within each session.
   */
  async _detectBotLikeCadence(userId: number) {
    const result = await db.execute(sql`
      SELECT t.game_session_id AS sessionId, UNIX_TIMESTAMP(t.created_at) AS ts
      FROM transactions t
      WHERE t.user_id = ${userId}
        AND t.transaction_type IN ('game_win', 'game_loss')
        AND t.transaction_status = 'completed'
        AND t.game_session_id IS NOT NULL
        AND t.created_at >= DATE_SUB(NOW(), INTERVAL ${WINDOW_DAYS} DAY)
      ORDER BY t.game_session_id ASC, t.created_at ASC
    `);

    const rows = ((result as any)[0] || []) as Array<{ sessionId: number; ts: number }>;

    const bySession = new Map<number, number[]>();
    for (const row of rows) {
      const sid = Number(row.sessionId);
      const ts = Number(row.ts);
      if (!bySession.has(sid)) bySession.set(sid, []);
      bySession.get(sid)!.push(ts);
    }

    const intervals: number[] = [];
    for (const ts of bySession.values()) {
      if (ts.length < CADENCE_MIN_SESSION_BETS) continue;
      for (let i = 1; i < ts.length; i++) {
        const delta = ts[i] - ts[i - 1];
        if (delta > 0) intervals.push(delta);
      }
    }

    const sampleSize = intervals.length;
    if (sampleSize < CADENCE_MIN_SAMPLES) {
      return { detected: false, interArrivalCv: null, sampleSize };
    }

    const mean = intervals.reduce((s, n) => s + n, 0) / sampleSize;
    if (mean === 0) {
      return { detected: false, interArrivalCv: null, sampleSize };
    }
    const variance =
      intervals.reduce((s, n) => s + (n - mean) * (n - mean), 0) / sampleSize;
    const stddev = Math.sqrt(variance);
    const cv = round4(stddev / mean);

    return {
      detected: cv < CADENCE_CV_THRESHOLD,
      interArrivalCv: cv,
      sampleSize,
    };
  }
}

const behaviourAnalyticsService = new BehaviourAnalyticsService();
export default behaviourAnalyticsService;
export { BehaviourAnalyticsService };
