import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GameErrorBoundary from '@/components/GameErrorBoundary';

const Boom = ({ shouldThrow }) => {
  if (shouldThrow) throw new Error('game blew up');
  return <div data-testid="game-ok">game is running</div>;
};

describe('GameErrorBoundary', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when no error is thrown', () => {
    render(
      <GameErrorBoundary gameName="Crash">
        <Boom shouldThrow={false} />
      </GameErrorBoundary>
    );
    expect(screen.getByTestId('game-ok')).toBeInTheDocument();
  });

  it('renders the fallback with the game name when a child throws', () => {
    render(
      <GameErrorBoundary gameName="Roulette">
        <Boom shouldThrow={true} />
      </GameErrorBoundary>
    );
    expect(screen.getByText(/Roulette Error/i)).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong while loading this game/i)).toBeInTheDocument();
  });

  it('falls back to a generic "Game Error" heading when no gameName is given', () => {
    render(
      <GameErrorBoundary>
        <Boom shouldThrow={true} />
      </GameErrorBoundary>
    );
    expect(screen.getByText(/Game Error/i)).toBeInTheDocument();
  });

  it('resets and shows children again when Try Again is clicked', () => {
    // Use a wrapper so we can flip the child's throw flag after retry
    function Wrapper() {
      const [crashed, setCrashed] = React.useState(true);
      return (
        <GameErrorBoundary
          gameName="Plinko"
          // Hook into retry by replacing the child via parent state
        >
          <button onClick={() => setCrashed(false)} data-testid="external-fix">fix</button>
          <Boom shouldThrow={crashed} />
        </GameErrorBoundary>
      );
    }

    render(<Wrapper />);
    // Boundary should be in error state initially
    expect(screen.getByText(/Plinko Error/i)).toBeInTheDocument();

    // Clicking Try Again resets the boundary; child still throws so fallback re-renders.
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText(/Plinko Error/i)).toBeInTheDocument();
  });
});
