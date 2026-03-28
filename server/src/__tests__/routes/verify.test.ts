// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockVerifyResult, mockGenerateCrashPoint, mockGenerateRouletteNumber, mockGenerateServerSeed } = vi.hoisted(() => ({
  mockVerifyResult: vi.fn(),
  mockGenerateCrashPoint: vi.fn(),
  mockGenerateRouletteNumber: vi.fn(),
  mockGenerateServerSeed: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/services/provablyFairService.js', () => ({
  default: {
    verifyResult: mockVerifyResult,
    generateCrashPoint: mockGenerateCrashPoint,
    generateRouletteNumber: mockGenerateRouletteNumber,
    generateServerSeed: mockGenerateServerSeed,
  },
}));

// ---------------------------------------------------------------------------
// Import router under test
// ---------------------------------------------------------------------------

import router from '../../../routes/verify.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/verify', router);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Verify routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // POST /api/verify
  // =========================================================================
  describe('POST /', () => {
    const validPayload = {
      serverSeed: 'abc123',
      serverSeedHash: 'hash123',
      clientSeed: 'client456',
      nonce: 1,
    };

    it('should verify a result with valid inputs', async () => {
      mockVerifyResult.mockReturnValue({
        valid: true,
        result: 0.5,
        serverSeedHashMatch: true,
      });

      const res = await request(createApp())
        .post('/api/verify')
        .send(validPayload);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        valid: true,
        serverSeedHashMatch: true,
        rawResult: 0.5,
      });
      expect(mockVerifyResult).toHaveBeenCalledWith('abc123', 'hash123', 'client456', 1);
    });

    it('should include crash point when gameType is crash', async () => {
      mockVerifyResult.mockReturnValue({
        valid: true,
        result: 0.7,
        serverSeedHashMatch: true,
      });
      mockGenerateCrashPoint.mockReturnValue(3.5);

      const res = await request(createApp())
        .post('/api/verify')
        .send({ ...validPayload, gameType: 'crash' });

      expect(res.status).toBe(200);
      expect(res.body.crashPoint).toBe(3.5);
      expect(mockGenerateCrashPoint).toHaveBeenCalledWith('abc123', 'client456', 1);
    });

    it('should include roulette number when gameType is roulette', async () => {
      mockVerifyResult.mockReturnValue({
        valid: true,
        result: 0.3,
        serverSeedHashMatch: true,
      });
      mockGenerateRouletteNumber.mockReturnValue(17);

      const res = await request(createApp())
        .post('/api/verify')
        .send({ ...validPayload, gameType: 'roulette' });

      expect(res.status).toBe(200);
      expect(res.body.number).toBe(17);
      expect(mockGenerateRouletteNumber).toHaveBeenCalledWith('abc123', 'client456', 1);
    });

    it('should report invalid when hash does not match', async () => {
      mockVerifyResult.mockReturnValue({
        valid: false,
        result: 0.5,
        serverSeedHashMatch: false,
      });

      const res = await request(createApp())
        .post('/api/verify')
        .send(validPayload);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.serverSeedHashMatch).toBe(false);
    });

    it('should return 400 when serverSeed is missing', async () => {
      const res = await request(createApp())
        .post('/api/verify')
        .send({ serverSeedHash: 'hash', clientSeed: 'client', nonce: 1 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Missing required fields' });
    });

    it('should return 400 when serverSeedHash is missing', async () => {
      const res = await request(createApp())
        .post('/api/verify')
        .send({ serverSeed: 'seed', clientSeed: 'client', nonce: 1 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Missing required fields' });
    });

    it('should return 400 when clientSeed is missing', async () => {
      const res = await request(createApp())
        .post('/api/verify')
        .send({ serverSeed: 'seed', serverSeedHash: 'hash', nonce: 1 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Missing required fields' });
    });

    it('should return 400 when nonce is missing (undefined)', async () => {
      const res = await request(createApp())
        .post('/api/verify')
        .send({ serverSeed: 'seed', serverSeedHash: 'hash', clientSeed: 'client' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Missing required fields' });
    });

    it('should accept nonce of 0', async () => {
      mockVerifyResult.mockReturnValue({
        valid: true,
        result: 0.1,
        serverSeedHashMatch: true,
      });

      const res = await request(createApp())
        .post('/api/verify')
        .send({ ...validPayload, nonce: 0 });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(mockVerifyResult).toHaveBeenCalledWith('abc123', 'hash123', 'client456', 0);
    });

    it('should coerce nonce to number', async () => {
      mockVerifyResult.mockReturnValue({
        valid: true,
        result: 0.5,
        serverSeedHashMatch: true,
      });

      const res = await request(createApp())
        .post('/api/verify')
        .send({ ...validPayload, nonce: '5' });

      expect(res.status).toBe(200);
      expect(mockVerifyResult).toHaveBeenCalledWith('abc123', 'hash123', 'client456', 5);
    });

    it('should return 500 when service throws', async () => {
      mockVerifyResult.mockImplementation(() => {
        throw new Error('Crypto error');
      });

      const res = await request(createApp())
        .post('/api/verify')
        .send(validPayload);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Verification error' });
    });

    it('should not include crashPoint/number for unknown gameType', async () => {
      mockVerifyResult.mockReturnValue({
        valid: true,
        result: 0.5,
        serverSeedHashMatch: true,
      });

      const res = await request(createApp())
        .post('/api/verify')
        .send({ ...validPayload, gameType: 'plinko' });

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('crashPoint');
      expect(res.body).not.toHaveProperty('number');
    });

    it('should not require authentication', async () => {
      // The verify route does not use authenticate middleware
      mockVerifyResult.mockReturnValue({
        valid: true,
        result: 0.5,
        serverSeedHashMatch: true,
      });

      const res = await request(createApp())
        .post('/api/verify')
        .send(validPayload);

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // GET /api/verify/generate-client-seed
  // =========================================================================
  describe('GET /generate-client-seed', () => {
    it('should return a client seed', async () => {
      mockGenerateServerSeed.mockReturnValue('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');

      const res = await request(createApp()).get('/api/verify/generate-client-seed');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('clientSeed');
      expect(typeof res.body.clientSeed).toBe('string');
      expect(res.body.clientSeed.length).toBe(16);
    });

    it('should truncate the seed to 16 characters', async () => {
      mockGenerateServerSeed.mockReturnValue('1234567890abcdef1234567890abcdef');

      const res = await request(createApp()).get('/api/verify/generate-client-seed');

      expect(res.status).toBe(200);
      expect(res.body.clientSeed).toBe('1234567890abcdef');
    });
  });
});
