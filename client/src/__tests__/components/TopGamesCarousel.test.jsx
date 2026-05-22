import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import TopGamesCarousel from '@/components/TopGamesCarousel';

const sampleGames = [
  { title: 'Crash', path: '/games/crash', icon: 'C', image: null, color: 'bg-red-500' },
  { title: 'Roulette', path: '/games/roulette', icon: 'R', image: null, color: 'bg-emerald-500' },
];

function renderCarousel(games) {
  return render(
    <MemoryRouter>
      <TopGamesCarousel games={games} />
    </MemoryRouter>
  );
}

describe('TopGamesCarousel', () => {
  it('shows the debug fallback when games is empty', () => {
    renderCarousel([]);
    expect(screen.getByText(/TopGamesCarousel missing data/i)).toBeInTheDocument();
  });

  it('renders the carousel container with provided games', () => {
    renderCarousel(sampleGames);
    expect(screen.getByTestId('top-games-carousel')).toBeInTheDocument();
    expect(screen.getByText('Top Games')).toBeInTheDocument();
  });

  it('renders each game card with title and link', () => {
    renderCarousel(sampleGames);
    expect(screen.getByText('Crash')).toBeInTheDocument();
    expect(screen.getByText('Roulette')).toBeInTheDocument();

    const crashCard = screen.getByText('Crash').closest('a');
    expect(crashCard).toHaveAttribute('href', '/games/crash');
  });
});
