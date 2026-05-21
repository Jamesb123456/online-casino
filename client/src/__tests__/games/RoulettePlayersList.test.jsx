import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import RoulettePlayersList from '@/games/roulette/RoulettePlayersList';

describe('RoulettePlayersList', () => {
  it('renders empty state with a zero badge when no players are provided', () => {
    render(<RoulettePlayersList players={[]} />);
    expect(screen.getByText(/No active players/i)).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders empty state when players prop is undefined', () => {
    render(<RoulettePlayersList />);
    expect(screen.getByText(/No active players/i)).toBeInTheDocument();
  });

  it('renders a row per player with username and count badge', () => {
    const players = [
      { id: 1, username: 'alice' },
      { id: 2, username: 'bob' },
    ];
    render(<RoulettePlayersList players={players} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders avatar image when avatar URL is provided', () => {
    const players = [{ id: 1, username: 'alice', avatar: 'https://example.com/a.png' }];
    render(<RoulettePlayersList players={players} />);
    const img = screen.getByAltText('alice');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
  });
});
