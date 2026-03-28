import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '@/pages/HomePage';

// Mock MainLayout to avoid rendering Header/Footer/Sidebar dependencies
vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

const renderHomePage = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );

describe('HomePage', () => {
  it('renders the hero section with branding', () => {
    renderHomePage();
    expect(screen.getByText('Platinum')).toBeInTheDocument();
    expect(screen.getByText('Casino')).toBeInTheDocument();
    expect(
      screen.getByText(/experience the thrill of casino games/i)
    ).toBeInTheDocument();
  });

  it('renders CTA buttons in the hero section', () => {
    renderHomePage();
    const signUpLink = screen.getByRole('link', { name: /sign up now/i });
    expect(signUpLink).toBeInTheDocument();
    expect(signUpLink).toHaveAttribute('href', '/register');

    const browseLink = screen.getByRole('link', { name: /browse games/i });
    expect(browseLink).toBeInTheDocument();
    expect(browseLink).toHaveAttribute('href', '/games');
  });

  it('renders the Featured Games section with four featured game cards', () => {
    renderHomePage();
    expect(screen.getByText('Featured Games')).toBeInTheDocument();
    expect(
      screen.getByText(/try our most popular casino games/i)
    ).toBeInTheDocument();

    // The four featured games
    const expectedGames = ['Crash', 'Roulette', 'Blackjack', 'Plinko'];
    expectedGames.forEach((gameName) => {
      // Each featured game title appears in an h3 inside the card
      const headings = screen.getAllByRole('heading', { level: 3 });
      const found = headings.some((h) => h.textContent === gameName);
      expect(found).toBe(true);
    });
  });

  it('featured game cards link to the correct routes', () => {
    renderHomePage();
    const crashLink = screen.getAllByRole('link').find(
      (link) => link.getAttribute('href') === '/games/crash'
    );
    expect(crashLink).toBeDefined();

    const rouletteLink = screen.getAllByRole('link').find(
      (link) => link.getAttribute('href') === '/games/roulette'
    );
    expect(rouletteLink).toBeDefined();

    const blackjackLink = screen.getAllByRole('link').find(
      (link) => link.getAttribute('href') === '/games/blackjack'
    );
    expect(blackjackLink).toBeDefined();

    const plinkoLink = screen.getAllByRole('link').find(
      (link) => link.getAttribute('href') === '/games/plinko'
    );
    expect(plinkoLink).toBeDefined();
  });

  it('renders game descriptions for featured games', () => {
    renderHomePage();
    expect(
      screen.getByText(/watch the multiplier rise and cash out/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/place your bets on red, black, or your lucky number/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/beat the dealer with a hand value of 21/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/drop the ball and watch it bounce/i)
    ).toBeInTheDocument();
  });

  it('renders "Play Now" badges on each featured game card', () => {
    renderHomePage();
    const playNowElements = screen.getAllByText('Play Now');
    // 4 featured games each have a Play Now badge
    expect(playNowElements.length).toBeGreaterThanOrEqual(4);
  });

  it('renders the "Why Choose Us" section with three value propositions', () => {
    renderHomePage();
    expect(
      screen.getByText('Why Choose Platinum Casino')
    ).toBeInTheDocument();
    expect(screen.getByText('Secure & Fair')).toBeInTheDocument();
    expect(screen.getByText('Fast Payouts')).toBeInTheDocument();
    expect(screen.getByText('24/7 Support')).toBeInTheDocument();
  });

  it('renders the bottom CTA section with a "Create Account" link', () => {
    renderHomePage();
    expect(screen.getByText('Ready to Play?')).toBeInTheDocument();
    const createAccountLink = screen.getByRole('link', {
      name: /create account/i,
    });
    expect(createAccountLink).toHaveAttribute('href', '/register');
  });

  it('renders inside the MainLayout wrapper', () => {
    renderHomePage();
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
  });
});
