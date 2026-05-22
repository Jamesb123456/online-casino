import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import SidebarNav from '@/components/SidebarNav';

function renderSidebar(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SidebarNav />
    </MemoryRouter>
  );
}

describe('SidebarNav', () => {
  it('renders without crashing and shows the sidebar landmark', () => {
    renderSidebar();
    expect(screen.getByTestId('sidebar-nav')).toBeInTheDocument();
  });

  it('renders the Casino Games section with all game links', () => {
    renderSidebar();
    expect(screen.getByText('Casino Games')).toBeInTheDocument();
    expect(screen.getByText('Crash')).toBeInTheDocument();
    expect(screen.getByText('Roulette')).toBeInTheDocument();
    expect(screen.getByText('Blackjack')).toBeInTheDocument();
    expect(screen.getByText('Plinko')).toBeInTheDocument();
    expect(screen.getByText('Wheel')).toBeInTheDocument();
    expect(screen.getByText('Landmines')).toBeInTheDocument();
  });

  it('renders the Account section with profile links', () => {
    renderSidebar();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Rewards')).toBeInTheDocument();
    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
  });

  it('links each game to its dedicated route', () => {
    renderSidebar();
    const crashLink = screen.getByText('Crash').closest('a');
    expect(crashLink).toHaveAttribute('href', '/games/crash');
    const profileLink = screen.getByText('Profile').closest('a');
    expect(profileLink).toHaveAttribute('href', '/profile');
  });
});
