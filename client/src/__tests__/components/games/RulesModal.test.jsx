import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('@/services/api', () => ({
  default: { get: mockGet },
  api: { get: mockGet },
}));

import RulesModal from '@/components/games/RulesModal';

describe('RulesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ houseEdge: 0.04, maxBet: 5000, enabled: true });
  });

  it('renders title and children when open', async () => {
    render(
      <RulesModal gameType="crash" gameName="Crash" open={true} onClose={vi.fn()}>
        <p>How to play crash</p>
      </RulesModal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Crash — How it works/)).toBeInTheDocument();
    expect(screen.getByText('How to play crash')).toBeInTheDocument();
  });

  it('fetches config on open and displays formatted house edge and max bet', async () => {
    render(
      <RulesModal gameType="crash" gameName="Crash" open={true} onClose={vi.fn()}>
        <p>rules</p>
      </RulesModal>
    );
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/games/config/crash');
    });
    await waitFor(() => {
      expect(screen.getByTestId('rules-house-edge')).toHaveTextContent('4.00%');
    });
    expect(screen.getByTestId('rules-max-bet')).toHaveTextContent('5,000');
  });

  it('shows "No max" when maxBet is 0', async () => {
    mockGet.mockResolvedValue({ houseEdge: 0.027, maxBet: 0, enabled: true });
    render(
      <RulesModal gameType="roulette" gameName="Roulette" open={true} onClose={vi.fn()}>
        <p>rules</p>
      </RulesModal>
    );
    await waitFor(() => {
      expect(screen.getByTestId('rules-max-bet')).toHaveTextContent('No max');
    });
  });

  it('does not fetch when not open', () => {
    render(
      <RulesModal gameType="crash" gameName="Crash" open={false} onClose={vi.fn()}>
        <p>rules</p>
      </RulesModal>
    );
    expect(mockGet).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(
      <RulesModal gameType="crash" gameName="Crash" open={true} onClose={onClose}>
        <p>rules</p>
      </RulesModal>
    );
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 1000 });
  });

  it('shows error message when config fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('Network down'));
    render(
      <RulesModal gameType="crash" gameName="Crash" open={true} onClose={vi.fn()}>
        <p>rules</p>
      </RulesModal>
    );
    await waitFor(() => {
      expect(screen.getByTestId('rules-config-error')).toHaveTextContent('Network down');
    });
  });
});
