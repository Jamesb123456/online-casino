import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DisconnectOverlay from '@/games/_shared/DisconnectOverlay';

describe('DisconnectOverlay', () => {
  it('returns null when status is "connected"', () => {
    const { container } = render(<DisconnectOverlay status="connected" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders "Connecting…" copy for status="connecting"', () => {
    render(<DisconnectOverlay status="connecting" />);
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
    expect(screen.getByText(/Establishing a secure session/i)).toBeInTheDocument();
  });

  it('renders "Disconnected" copy for status="disconnected"', () => {
    render(<DisconnectOverlay status="disconnected" />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('renders error title and the lastError.message for status="error"', () => {
    render(
      <DisconnectOverlay
        status="error"
        lastError={{ message: 'socket-timeout', source: 'connect' }}
      />
    );
    expect(screen.getByText('Connection error')).toBeInTheDocument();
    expect(screen.getByText('socket-timeout')).toBeInTheDocument();
  });

  it('falls back to "Offline" for unknown status values', () => {
    render(<DisconnectOverlay status="totally-unknown" />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  describe('Retry button', () => {
    let reloadSpy;
    let originalLocation;

    beforeEach(() => {
      originalLocation = window.location;
      // Replace window.location with a writable mock so we can spy on reload.
      delete window.location;
      reloadSpy = vi.fn();
      window.location = { ...originalLocation, reload: reloadSpy };
    });

    afterEach(() => {
      window.location = originalLocation;
    });

    it('clicking Retry calls window.location.reload', async () => {
      const user = userEvent.setup();
      render(<DisconnectOverlay status="error" lastError={{ message: 'x' }} />);
      await user.click(screen.getByRole('button', { name: 'Retry' }));
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });
  });
});
