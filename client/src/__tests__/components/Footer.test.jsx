import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '@/components/Footer';

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  );
}

describe('Footer', () => {
  describe('Brand section', () => {
    it('renders Platinum Casino brand', () => {
      renderFooter();

      expect(screen.getByText('Platinum')).toBeInTheDocument();
      expect(screen.getByText('Casino')).toBeInTheDocument();
    });

    it('renders brand description', () => {
      renderFooter();

      expect(
        screen.getByText(/experience the thrill of casino games/i)
      ).toBeInTheDocument();
    });
  });

  describe('Game links', () => {
    it('renders Games section heading', () => {
      renderFooter();

      expect(screen.getByText('Games')).toBeInTheDocument();
    });

    it.each(['Crash', 'Plinko', 'Wheel', 'Roulette', 'Blackjack', 'Landmines'])(
      'contains link to %s game',
      (game) => {
        renderFooter();

        const link = screen.getByText(game);
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute(
          'href',
          `/games/${game.toLowerCase()}`
        );
      }
    );
  });

  describe('Support links', () => {
    it('renders Support section heading', () => {
      renderFooter();

      expect(screen.getByText('Support')).toBeInTheDocument();
    });

    it('contains Responsible Gaming link', () => {
      renderFooter();

      const link = screen.getByText('Responsible Gaming');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', '/responsible-gaming');
    });

    it('shows demo site note', () => {
      renderFooter();

      expect(
        screen.getByText(/demo site for demonstration purposes/i)
      ).toBeInTheDocument();
    });
  });

  describe('Legal section', () => {
    it('renders Legal section heading', () => {
      renderFooter();

      expect(screen.getByText('Legal')).toBeInTheDocument();
    });

    it('shows entertainment disclaimer', () => {
      renderFooter();

      expect(
        screen.getByText(/entertainment purposes only/i)
      ).toBeInTheDocument();
    });
  });

  describe('Copyright and legal info', () => {
    it('shows copyright with current year', () => {
      renderFooter();

      const currentYear = new Date().getFullYear();
      expect(
        screen.getByText(new RegExp(`${currentYear}.*Platinum Casino Platform`))
      ).toBeInTheDocument();
    });

    it('shows "All rights reserved"', () => {
      renderFooter();

      expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument();
    });

    it('shows demonstration disclaimer', () => {
      renderFooter();

      expect(
        screen.getByText(/this is a demonstration site/i)
      ).toBeInTheDocument();
    });

    it('indicates no real money is used', () => {
      renderFooter();

      expect(screen.getByText(/no real money is used/i)).toBeInTheDocument();
    });
  });

  describe('Social media buttons', () => {
    it.each(['facebook', 'twitter', 'instagram', 'discord'])(
      'renders %s social link',
      (platform) => {
        renderFooter();

        const link = screen.getByLabelText(`Follow us on ${platform}`);
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '#');
      }
    );
  });

  describe('Accessibility', () => {
    it('renders as a footer element', () => {
      const { container } = renderFooter();

      const footer = container.querySelector('footer');
      expect(footer).toBeInTheDocument();
    });

    it('social links have aria-labels', () => {
      renderFooter();

      const socialLinks = screen.getAllByLabelText(/follow us on/i);
      expect(socialLinks.length).toBe(4);
    });

    it('social icons are hidden from screen readers', () => {
      const { container } = renderFooter();

      // All SVGs inside social buttons should have aria-hidden
      const socialSvgs = container.querySelectorAll('a[href="#"] svg');
      socialSvgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });
});
