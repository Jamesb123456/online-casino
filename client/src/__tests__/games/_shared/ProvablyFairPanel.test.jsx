import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the provablyFair lib used by the panel.
vi.mock('@/lib/provablyFair', () => ({
  verifyResult: vi.fn(),
}));

import ProvablyFairPanel from '@/games/_shared/ProvablyFairPanel';
import { verifyResult } from '@/lib/provablyFair';

beforeEach(() => {
  verifyResult.mockReset();
});

const baseHistory = [
  {
    id: 'r1',
    gameType: 'dice',
    serverSeedHash: 'hash-1',
    serverSeed: 'seed-1',
    clientSeed: 'client-1',
    nonce: 1,
    multiplier: 2,
  },
  {
    id: 'r2',
    gameType: 'dice',
    serverSeedHash: 'hash-2',
    serverSeed: 'seed-2',
    clientSeed: 'client-2',
    nonce: 2,
    multiplier: 1,
  },
];

describe('ProvablyFairPanel', () => {
  it('renders the current server seed hash', () => {
    render(
      <ProvablyFairPanel
        currentHash="my-current-hash"
        clientSeed="cs"
        onClientSeedChange={() => {}}
        history={[]}
      />
    );
    const hashInput = screen.getByLabelText(/server seed hash \(next round\)/i);
    expect(hashInput).toHaveValue('my-current-hash');
  });

  it('shows empty state when history is empty', async () => {
    const user = userEvent.setup();
    render(
      <ProvablyFairPanel
        currentHash="h"
        clientSeed="cs"
        onClientSeedChange={() => {}}
        history={[]}
      />
    );
    // Expand the collapsed section
    await user.click(screen.getByRole('button', { name: /recent rounds/i }));
    expect(screen.getByText(/no rounds played yet/i)).toBeInTheDocument();
  });

  it('clicking Verify on a row calls verifyResult with that row’s seeds and shows ✓ when valid', async () => {
    // The component stores the returned value directly in state, so we return
    // a plain object (not a Promise) to drive the synchronous render path.
    verifyResult.mockReturnValue({
      valid: true,
      result: 0.5,
      serverSeedHashMatch: true,
    });

    const user = userEvent.setup();
    render(
      <ProvablyFairPanel
        currentHash="h"
        clientSeed="cs"
        onClientSeedChange={() => {}}
        history={baseHistory}
      />
    );

    await user.click(screen.getByRole('button', { name: /recent rounds/i }));
    const verifyButtons = screen.getAllByRole('button', { name: 'Verify' });
    await user.click(verifyButtons[0]);

    expect(verifyResult).toHaveBeenCalledWith({
      serverSeed: 'seed-1',
      serverSeedHash: 'hash-1',
      clientSeed: 'client-1',
      nonce: 1,
    });

    const ok = await screen.findByLabelText('Verified');
    expect(ok).toHaveTextContent('✓');
  });

  it('shows ✗ when verifyResult returns valid:false', async () => {
    verifyResult.mockReturnValue({
      valid: false,
      result: 0.5,
      serverSeedHashMatch: false,
    });

    const user = userEvent.setup();
    render(
      <ProvablyFairPanel
        currentHash="h"
        clientSeed="cs"
        onClientSeedChange={() => {}}
        history={baseHistory}
      />
    );

    await user.click(screen.getByRole('button', { name: /recent rounds/i }));
    const verifyButtons = screen.getAllByRole('button', { name: 'Verify' });
    await user.click(verifyButtons[0]);

    const fail = await screen.findByLabelText('Verification failed');
    expect(fail).toHaveTextContent('✗');
  });

  it('Rotate button calls onClientSeedChange with the input text', async () => {
    const onClientSeedChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ProvablyFairPanel
        currentHash="h"
        clientSeed="old-seed"
        onClientSeedChange={onClientSeedChange}
        history={[]}
      />
    );

    const seedInput = screen.getByLabelText(/your client seed/i);
    await user.clear(seedInput);
    await user.type(seedInput, 'new-seed-value');

    await user.click(screen.getByRole('button', { name: /rotate client seed/i }));

    expect(onClientSeedChange).toHaveBeenCalledWith('new-seed-value');
  });
});
