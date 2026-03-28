import React, { useState } from 'react';
import MainLayout from '../layouts/MainLayout';
import { api } from '../services/api';

const VerifyPage = () => {
  const [serverSeed, setServerSeed] = useState('');
  const [serverSeedHash, setServerSeedHash] = useState('');
  const [clientSeed, setClientSeed] = useState('');
  const [nonce, setNonce] = useState('');
  const [gameType, setGameType] = useState('crash');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!serverSeed || !serverSeedHash || !clientSeed || nonce === '') {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setIsLoading(true);
      const data = await api.post('/verify', {
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce: Number(nonce),
        gameType,
      });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Verification failed. Please check your inputs and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateClientSeed = async () => {
    try {
      const data = await api.get('/verify/generate-client-seed');
      setClientSeed(data.clientSeed);
    } catch (err) {
      setError('Failed to generate client seed.');
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-text-primary mb-3">
            Provably Fair <span className="text-gold-gradient">Verification</span>
          </h1>
          <p className="text-text-secondary max-w-2xl mx-auto">
            Verify the fairness of any game result using the server seed, client seed, and nonce.
            Our provably fair system uses HMAC-SHA256 to ensure every outcome is transparent and tamper-proof.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Verification Form */}
          <div className="lg:col-span-2 bg-bg-card rounded-xl border border-border shadow-card">
            <div className="p-6">
              <h2 className="text-xl font-heading font-bold text-text-primary mb-4">Verify a Game Result</h2>
              <form onSubmit={handleVerify} className="space-y-4">
                {/* Server Seed */}
                <div>
                  <label htmlFor="serverSeed" className="block text-sm font-medium text-text-secondary mb-1">
                    Server Seed
                  </label>
                  <input
                    id="serverSeed"
                    type="text"
                    value={serverSeed}
                    onChange={(e) => setServerSeed(e.target.value)}
                    placeholder="Enter the revealed server seed"
                    className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold transition-colors text-sm font-mono"
                  />
                </div>

                {/* Server Seed Hash */}
                <div>
                  <label htmlFor="serverSeedHash" className="block text-sm font-medium text-text-secondary mb-1">
                    Server Seed Hash
                  </label>
                  <input
                    id="serverSeedHash"
                    type="text"
                    value={serverSeedHash}
                    onChange={(e) => setServerSeedHash(e.target.value)}
                    placeholder="Enter the SHA-256 hash shown before the game"
                    className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold transition-colors text-sm font-mono"
                  />
                </div>

                {/* Client Seed */}
                <div>
                  <label htmlFor="clientSeed" className="block text-sm font-medium text-text-secondary mb-1">
                    Client Seed
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="clientSeed"
                      type="text"
                      value={clientSeed}
                      onChange={(e) => setClientSeed(e.target.value)}
                      placeholder="Enter your client seed"
                      className="flex-1 bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold transition-colors text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateClientSeed}
                      className="px-4 py-2.5 bg-bg-surface hover:bg-bg-elevated text-text-primary text-sm rounded-lg transition-colors whitespace-nowrap border border-border"
                    >
                      Generate
                    </button>
                  </div>
                </div>

                {/* Nonce and Game Type row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="nonce" className="block text-sm font-medium text-text-secondary mb-1">
                      Nonce
                    </label>
                    <input
                      id="nonce"
                      type="number"
                      min="0"
                      value={nonce}
                      onChange={(e) => setNonce(e.target.value)}
                      placeholder="Game round number"
                      className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="gameType" className="block text-sm font-medium text-text-secondary mb-1">
                      Game Type
                    </label>
                    <select
                      id="gameType"
                      value={gameType}
                      onChange={(e) => setGameType(e.target.value)}
                      className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold transition-colors text-sm"
                    >
                      <option value="crash">Crash</option>
                      <option value="roulette">Roulette</option>
                      <option value="generic">Generic (Raw Result)</option>
                    </select>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="p-3 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error text-sm">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-accent-gold to-accent-gold-light disabled:from-bg-elevated disabled:to-bg-elevated disabled:text-text-muted disabled:cursor-not-allowed text-bg-base font-bold py-3 px-6 rounded-lg transition-all text-sm hover:shadow-glow-gold"
                >
                  {isLoading ? 'Verifying...' : 'Verify Result'}
                </button>
              </form>
            </div>
          </div>

          {/* How It Works Panel */}
          <div className="bg-bg-card rounded-xl border border-border shadow-card">
            <div className="p-6">
              <h2 className="text-xl font-heading font-bold text-text-primary mb-4">How It Works</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-gold/15 text-accent-gold flex items-center justify-center text-xs font-bold">
                    1
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">
                      <span className="text-text-primary font-medium">Before the game:</span> The server generates a secret seed and shows you its SHA-256 hash.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-gold/15 text-accent-gold flex items-center justify-center text-xs font-bold">
                    2
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">
                      <span className="text-text-primary font-medium">You provide:</span> A client seed of your choice and a nonce (round number) that increments each game.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-gold/15 text-accent-gold flex items-center justify-center text-xs font-bold">
                    3
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">
                      <span className="text-text-primary font-medium">Game result:</span> Calculated using HMAC-SHA256 with the server seed as the key and "clientSeed:nonce" as the message.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-gold/15 text-accent-gold flex items-center justify-center text-xs font-bold">
                    4
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">
                      <span className="text-text-primary font-medium">After the game:</span> The server seed is revealed. You can verify the hash matches what was shown before the game.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-3 bg-status-info/10 border border-status-info/20 rounded-lg">
                <p className="text-xs text-text-secondary leading-relaxed">
                  This system ensures neither the house nor the player can manipulate the outcome.
                  The server seed is committed (hashed) before the game begins, and the client seed
                  is chosen by the player, making the result jointly determined and independently verifiable.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="mt-6 bg-bg-card rounded-xl border border-border shadow-card">
            <div className="p-6">
              <h2 className="text-xl font-heading font-bold text-text-primary mb-4">Verification Result</h2>

              {/* Hash Match Status */}
              <div className={`p-4 rounded-xl mb-4 border ${
                result.serverSeedHashMatch
                  ? 'bg-status-success/10 border-status-success/20'
                  : 'bg-status-error/10 border-status-error/20'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    result.serverSeedHashMatch ? 'bg-status-success/20 text-status-success' : 'bg-status-error/20 text-status-error'
                  }`}>
                    {result.serverSeedHashMatch ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`font-bold ${result.serverSeedHashMatch ? 'text-status-success' : 'text-status-error'}`}>
                      {result.serverSeedHashMatch ? 'Hash Verified - Game is Fair' : 'Hash Mismatch - Verification Failed'}
                    </p>
                    <p className="text-sm text-text-muted">
                      {result.serverSeedHashMatch
                        ? 'The server seed hash matches the committed hash. The result was not tampered with.'
                        : 'The server seed does not match the provided hash. The seeds may be incorrect.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Result Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-bg-elevated rounded-xl p-4 border border-border">
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Raw Result</p>
                  <p className="text-lg font-mono text-text-primary">{result.rawResult?.toFixed(10)}</p>
                </div>

                {result.crashPoint !== undefined && (
                  <div className="bg-bg-elevated rounded-xl p-4 border border-border">
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Crash Point</p>
                    <p className="text-lg font-mono text-accent-gold font-bold">{result.crashPoint.toFixed(2)}x</p>
                  </div>
                )}

                {result.number !== undefined && (
                  <div className="bg-bg-elevated rounded-xl p-4 border border-border">
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Roulette Number</p>
                    <p className="text-lg font-mono text-accent-gold font-bold">{result.number}</p>
                  </div>
                )}

                <div className="bg-bg-elevated rounded-xl p-4 border border-border">
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Overall</p>
                  <p className={`text-lg font-bold ${result.valid ? 'text-status-success' : 'text-status-error'}`}>
                    {result.valid ? 'VALID' : 'INVALID'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default VerifyPage;
