import express from 'express';
import { authenticate } from '../middleware/auth.js';

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
router.post('/:gameId/bet', authenticate, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { betAmount } = req.body;
    const userId = req.user._id;
    
    // Basic validation
    if (!betAmount || isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ message: 'Invalid bet amount' });
    }
    
    // Check if game exists
    const validGames = ['crash', 'plinko', 'wheel', 'roulette', 'blackjack'];
    if (!validGames.includes(gameId)) {
      return res.status(404).json({ message: 'Game not found' });
    }
    
    // Later we will implement the actual game logic and session tracking
    // For now, return a placeholder response
    
    res.status(200).json({
      message: 'Bet placed successfully',
      gameId,
      betAmount,
      sessionId: `${gameId}-${Date.now()}`
    });
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ message: 'Server error while placing bet' });
  }
});

export default router;