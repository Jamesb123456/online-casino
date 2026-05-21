import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GameLayout from '@/games/_shared/GameLayout';

describe('GameLayout', () => {
  it('renders the title', () => {
    render(
      <GameLayout
        title="Dice"
        gameType="dice"
        canvas={<div>canvas-slot</div>}
        controls={<div>controls-slot</div>}
      />
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Dice' })).toBeInTheDocument();
  });

  it('renders the rules button when rules is provided', () => {
    render(
      <GameLayout
        title="Dice"
        gameType="dice"
        rules={<div>some rules</div>}
        canvas={<div>canvas-slot</div>}
        controls={<div>controls-slot</div>}
      />
    );
    expect(screen.getByTestId('rules-button')).toBeInTheDocument();
  });

  it('does NOT render the rules button when rules is not provided', () => {
    render(
      <GameLayout
        title="Dice"
        gameType="dice"
        canvas={<div>canvas-slot</div>}
        controls={<div>controls-slot</div>}
      />
    );
    expect(screen.queryByTestId('rules-button')).not.toBeInTheDocument();
  });

  it('renders canvas and controls slot content', () => {
    render(
      <GameLayout
        title="Dice"
        gameType="dice"
        canvas={<div data-testid="canvas-content">CANVAS</div>}
        controls={<div data-testid="controls-content">CONTROLS</div>}
      />
    );
    expect(screen.getByTestId('canvas-content')).toBeInTheDocument();
    expect(screen.getByTestId('controls-content')).toBeInTheDocument();
  });

  it('renders history slot only when history prop is provided', () => {
    const { rerender } = render(
      <GameLayout
        title="Dice"
        gameType="dice"
        canvas={<div>c</div>}
        controls={<div>x</div>}
      />
    );
    expect(screen.queryByLabelText('History')).not.toBeInTheDocument();

    rerender(
      <GameLayout
        title="Dice"
        gameType="dice"
        canvas={<div>c</div>}
        controls={<div>x</div>}
        history={<div data-testid="history">H</div>}
      />
    );
    expect(screen.getByTestId('history')).toBeInTheDocument();
  });

  it('renders provablyFair section only when provablyFair prop is provided', () => {
    const { rerender } = render(
      <GameLayout
        title="Dice"
        gameType="dice"
        canvas={<div>c</div>}
        controls={<div>x</div>}
      />
    );
    expect(
      screen.queryByLabelText('Provably fair verification')
    ).not.toBeInTheDocument();

    rerender(
      <GameLayout
        title="Dice"
        gameType="dice"
        canvas={<div>c</div>}
        controls={<div>x</div>}
        provablyFair={<div data-testid="pf">PF</div>}
      />
    );
    expect(screen.getByTestId('pf')).toBeInTheDocument();
  });

  it('renders the banner when provided', () => {
    render(
      <GameLayout
        title="Dice"
        gameType="dice"
        canvas={<div>c</div>}
        controls={<div>x</div>}
        banner={<div data-testid="banner">offline</div>}
      />
    );
    expect(screen.getByTestId('banner')).toBeInTheDocument();
  });
});
