import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import WheelPlayersList from '@/games/wheel/WheelPlayersList';

describe('WheelPlayersList', () => {
  it('renders an empty state when there are no players', () => {
    render(<WheelPlayersList players={[]} />);
    expect(screen.getByText(/No active players/i)).toBeInTheDocument();
    // Player count badge should show 0
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders an empty state when no players prop provided', () => {
    render(<WheelPlayersList />);
    expect(screen.getByText(/No active players/i)).toBeInTheDocument();
  });

  it('renders a row per player with username visible', () => {
    const players = [
      { id: 1, username: 'alice' },
      { id: 2, username: 'bob' },
    ];
    render(<WheelPlayersList players={players} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders avatar image when avatar URL is provided', () => {
    const players = [{ id: 1, username: 'alice', avatar: 'https://example.com/a.png' }];
    render(<WheelPlayersList players={players} />);
    const img = screen.getByAltText('alice');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
  });
});
