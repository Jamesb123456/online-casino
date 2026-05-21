import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import CrashPlayersList from '@/games/crash/CrashPlayersList';

describe('CrashPlayersList', () => {
  it('renders empty state when there are no players', () => {
    render(<CrashPlayersList players={[]} />);
    expect(screen.getByText(/No active players/i)).toBeInTheDocument();
  });

  it('renders empty state when players prop is undefined', () => {
    render(<CrashPlayersList />);
    expect(screen.getByText(/No active players/i)).toBeInTheDocument();
  });

  it('renders a row for each player with the count in the header', () => {
    const players = [
      { id: 1, username: 'alice' },
      { id: 2, username: 'bob' },
    ];
    render(<CrashPlayersList players={players} />);
    expect(screen.getByText(/Players in Room \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    // Initials fallback (first two chars uppercased)
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByText('BO')).toBeInTheDocument();
  });

  it('renders avatar image when avatar URL is provided', () => {
    const players = [{ id: 1, username: 'alice', avatar: 'https://example.com/a.png' }];
    render(<CrashPlayersList players={players} />);
    const img = screen.getByAltText('alice');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('https://example.com/a.png');
  });
});
