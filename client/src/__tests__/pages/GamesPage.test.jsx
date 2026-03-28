import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

vi.mock('@/components/ui/Card', () => ({
  default: ({ children, ...props }) => <div data-testid="card" {...props}>{children}</div>,
}));

import GamesPage from '@/pages/GamesPage';

describe('GamesPage', () => {
  const renderPage = () => {
    return render(
      <MemoryRouter>
        <GamesPage />
      </MemoryRouter>
    );
  };

  it('should render page heading', () => {
    renderPage();
    expect(screen.getByText(/our games/i)).toBeInTheDocument();
  });

  it('should render all 6 games', () => {
    renderPage();
    // Each game name appears twice (icon area + heading), so use getAllByText
    expect(screen.getAllByText('Crash').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Plinko').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Wheel').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Roulette').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Blackjack').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Landmines').length).toBeGreaterThanOrEqual(1);
  });

  it('should render game descriptions', () => {
    renderPage();
    expect(screen.getByText(/watch the multiplier increase/i)).toBeInTheDocument();
    expect(screen.getByText(/drop the ball/i)).toBeInTheDocument();
    expect(screen.getByText(/spin the wheel/i)).toBeInTheDocument();
    expect(screen.getByText(/classic casino roulette/i)).toBeInTheDocument();
    expect(screen.getByText(/beat the dealer/i)).toBeInTheDocument();
    expect(screen.getByText(/find diamonds/i)).toBeInTheDocument();
  });

  it('should link to correct game routes', () => {
    renderPage();
    const playButtons = screen.getAllByText(/play now/i);
    expect(playButtons).toHaveLength(6);

    const links = playButtons.map(btn => btn.closest('a'));
    const hrefs = links.map(link => link?.getAttribute('href'));
    expect(hrefs).toContain('/games/crash');
    expect(hrefs).toContain('/games/plinko');
    expect(hrefs).toContain('/games/wheel');
    expect(hrefs).toContain('/games/roulette');
    expect(hrefs).toContain('/games/blackjack');
    expect(hrefs).toContain('/games/landmines');
  });

  it('should render virtual currency notice', () => {
    renderPage();
    expect(screen.getByText(/virtual currency/i)).toBeInTheDocument();
  });

  it('should render in main layout', () => {
    renderPage();
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
  });
});
