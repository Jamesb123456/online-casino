// @ts-nocheck -- TODO: fix Drizzle/Express type errors and remove this directive
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import LoggingService from '../src/services/loggingService.js';

const router = express.Router();

// Get list of all available games
router.get('/', authenticate, (req, res) => {
  const games = [
    {
      id: 'crash',
      name: 'Crash',
      description: 'Watch the multiplier increase until it crashes. Cash out before it\'s too late!',
      minBet: 10,
      maxBet: 10000,
      thumbnail: '/images/games/crash.jpg'
    },
    {
      id: 'plinko',
      name: 'Plinko',
      description: 'Drop the ball and watch it bounce through pins to determine your payout.',
      minBet: 10,
      maxBet: 5000,
      thumbnail: '/images/games/plinko.jpg'
    },
    {
      id: 'wheel',
      name: 'Wheel',
      description: 'Spin the wheel and win based on where it stops!',
      minBet: 10,
      maxBet: 5000,
      thumbnail: '/images/games/wheel.jpg'
    },
    {
      id: 'roulette',
      name: 'Roulette',
      description: 'Classic casino roulette with multiple betting options.',
      minBet: 10,
      maxBet: 5000,
      thumbnail: '/images/games/roulette.jpg'
    },

    {
      id: 'blackjack',
      name: 'Blackjack',
      description: 'Beat the dealer by getting closer to 21 without going over.',
      minBet: 10,
      maxBet: 5000,
      thumbnail: '/images/games/blackjack.jpg'
    }
  ];
  
  res.status(200).json(games);
});

// Place a bet for a game
// Limit bet placement to mitigate abuse
const betLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

const betSchema = z.object({
  betAmount: z.number().positive()
});

const gameParamSchema = z.object({
  gameId: z.enum(['crash', 'plinko', 'wheel', 'roulette', 'blackjack'])
});

router.post('/:gameId/bet', authenticate, betLimiter, async (req, res) => {
  try {
    const paramsParse = gameParamSchema.safeParse(req.params);
    if (!paramsParse.success) {
      return res.status(400).json({ message: 'Invalid gameId' });
    }
    const { gameId } = paramsParse.data;

    const bodyParse = betSchema.safeParse({
      betAmount: Number(req.body?.betAmount)
    });
    if (!bodyParse.success) {
      return res.status(400).json({ message: 'Invalid bet amount' });
    }
    const { betAmount } = bodyParse.data;
    const userId = req.user.userId;
    
    // Later we will implement the actual game logic and session tracking
    // For now, return a placeholder response
    
    res.status(200).json({
      message: 'Bet placed successfully',
      gameId,
      betAmount,
      sessionId: `${gameId}-${Date.now()}`
    });
  } catch (error) {
    LoggingService.logSystemEvent('place_bet_error', { error: (error as any)?.message }, 'error');
    res.status(500).json({ message: 'Server error while placing bet' });
  }
});

export default router;