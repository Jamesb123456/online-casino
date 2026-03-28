// @ts-nocheck -- matches convention used by other route files in this project
import { Router, Request, Response } from 'express';
import ProvablyFairService from '../src/services/provablyFairService.js';

const router = Router();

/**
 * POST /api/verify
 * Verify a game result
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { serverSeed, serverSeedHash, clientSeed, nonce, gameType } = req.body;

    if (!serverSeed || !serverSeedHash || !clientSeed || nonce === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const verification = ProvablyFairService.verifyResult(
      serverSeed, serverSeedHash, clientSeed, Number(nonce)
    );

    let gameResult: any = { rawResult: verification.result };

    if (gameType === 'crash') {
      gameResult.crashPoint = ProvablyFairService.generateCrashPoint(serverSeed, clientSeed, Number(nonce));
    } else if (gameType === 'roulette') {
      gameResult.number = ProvablyFairService.generateRouletteNumber(serverSeed, clientSeed, Number(nonce));
    }

    res.json({
      valid: verification.valid,
      serverSeedHashMatch: verification.serverSeedHashMatch,
      ...gameResult,
    });
  } catch (error) {
    res.status(500).json({ message: 'Verification error' });
  }
});

/**
 * GET /api/verify/generate-client-seed
 * Generate a random client seed for the user
 */
router.get('/generate-client-seed', (req: Request, res: Response) => {
  const clientSeed = ProvablyFairService.generateServerSeed().substring(0, 16);
  res.json({ clientSeed });
});

export default router;
